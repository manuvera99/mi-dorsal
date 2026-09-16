"""Clase base abstracta para fuentes de fotos."""

from __future__ import annotations

import logging
import threading
import time
from abc import ABC, abstractmethod
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

logger = logging.getLogger(__name__)

# User-Agent para identificar nuestra app (algunos sitios lo requieren)
DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# Cabeceras por defecto para evitar bloqueos simples
DEFAULT_HEADERS: dict[str, str] = {
    "User-Agent": DEFAULT_USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "DNT": "1",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}


class AdaptiveRateLimiter:
    """Backoff adaptativo thread-safe: la misma lógica que antes vivía como
    variables locales del bucle secuencial (``current_delay``,
    ``consecutive_ok``), ahora compartida entre varios workers.

    Por qué un lock y no un token bucket más sofisticado: el ritmo que le
    importa a Flickr es la tasa media de peticiones por segundo, no si
    van en serie o en paralelo. Con N workers que cada uno espera antes
    de su siguiente descarga, la tasa total es aproximadamente
    ``N / delay_medio`` — subir ``current_delay`` cuando cualquiera de
    ellos ve un 429 frena a todos por igual, igual que en el modo
    secuencial frenaba las siguientes descargas.

    Público (sin guión bajo) desde esta sesión: un caller que descarga
    VARIOS álbumes del mismo proveedor en la misma búsqueda (ver
    photo-search-api/api/find_photos.py, selector de álbumes de perfil)
    debe crear UNA instancia y pasarla a cada llamada de
    ``download_with_source_urls`` — si no, cada álbum reinicia el backoff
    desde cero e ignora que Flickr ya estaba limitando por el álbum
    anterior. Confirmado en producción (15 sep 2026): 3 álbumes seguidos
    del mismo perfil, cada uno con su propio limitador nuevo, provocó que
    el segundo álbum tuviera un 94% de descargas fallidas por 429 (10/168)
    — el primero ya había "quemado" el margen de Flickr y el segundo
    empezaba como si nada hubiera pasado.
    """

    def __init__(self, base_delay: float, max_delay: float) -> None:
        self._base_delay = base_delay
        self._max_delay = max_delay
        self._current_delay = base_delay
        self._consecutive_ok = 0
        self._lock = threading.Lock()

    def report(self, was_rate_limited: bool) -> None:
        with self._lock:
            if was_rate_limited:
                self._current_delay = min(
                    self._max_delay, max(self._current_delay * 2, self._base_delay * 2)
                )
                self._consecutive_ok = 0
            else:
                self._consecutive_ok += 1
                if self._consecutive_ok >= 10 and self._current_delay > self._base_delay:
                    self._current_delay = max(self._base_delay, self._current_delay / 2)
                    self._consecutive_ok = 0

    def current_delay(self) -> float:
        with self._lock:
            return self._current_delay


class PhotoSource(ABC):
    """Clase base para todas las fuentes de fotos.

    Cada fuente sabe:
    1. Si puede manejar una URL (can_handle)
    2. Cómo extraer las URLs directas de las imágenes (list_photo_urls)
    3. Cómo descargarlas (download) — implementación por defecto
    """

    name: str = "base"
    # Sesión HTTP reutilizada entre descargas (keep-alive real). Subclases
    # que ya mantienen su propia `self.session` (p. ej. FlickrSource) la
    # comparten aquí para no abrir una conexión TCP/TLS nueva por cada
    # foto — medido: ~37% más rápido en fotos consecutivas del mismo host,
    # y genera menos "ruido" de conexiones nuevas por segundo (una señal
    # que los sistemas anti-bot vigilan).
    session: requests.Session | None = None
    # Atributo de CLASE (no de instancia): protege solo la creación de
    # self.session cuando varios workers llegan a la vez a la primera
    # descarga (requests.Session, una vez creada, sí es segura para
    # peticiones concurrentes). No se define en __init__ porque
    # FlickrSource tiene su propio __init__ sin llamar a super() — un
    # atributo de clase existe siempre, sin depender de esa cadena de
    # constructores ni de una inicialización perezosa con su propia
    # carrera. Compartir el lock entre instancias no es un problema aquí:
    # cada búsqueda crea su propia instancia de fuente.
    _session_lock = threading.Lock()

    def _get_session(self) -> requests.Session:
        if self.session is None:
            with self._session_lock:
                if self.session is None:
                    self.session = requests.Session()
                    self.session.headers.update(DEFAULT_HEADERS)
        return self.session

    def cache_key_for_url(self, url: str) -> str | None:
        """Clave estable para cachear el álbum de ``url`` entre búsquedas
        distintas (ver photo-search-api/api/album_cache.py), o None si
        esta fuente no puede identificar un "álbum" de forma estable a
        partir de la URL (p. ej. DirectUrlSource: cada URL es una foto
        suelta, no hay álbum que cachear). Por defecto None — subclases
        que sí tienen un identificador de álbum estable (p. ej.
        FlickrSource con el set_id numérico) lo sobreescriben."""
        return None

    def purchase_info_for_source_url(self, source_url: str) -> dict | None:
        """Info de compra para una foto de pago (ver LumepicPhotoSource,
        investigado 16 sep 2026): ``{"purchaseUrl": str, "price": float,
        "currency": str}``, o None si esta fuente no vende fotos (Flickr,
        ChipLevante, Grupo Brotons — todo gratuito). find_photos.py usa
        esto para marcar el resultado como "de pago" en vez de mostrar la
        foto como si fuera gratuita — la propia ``source_url`` de una
        foto de pago YA lleva marca de agua real (confirmado
        descargándola), así que sirve como preview sin coste añadido, sin
        necesitar copiar ni comprar nada por nuestra parte."""
        return None

    @abstractmethod
    def can_handle(self, url: str) -> bool:
        """Devuelve True si esta fuente sabe怎么处理 esa URL."""
        ...

    @abstractmethod
    def list_photo_urls(
        self, url: str, max_photos: int | None = None, dorsal: str | None = None
    ) -> list[str]:
        """Devuelve la lista de URLs directas a imágenes del álbum.

        Args:
            url: URL del álbum.
            max_photos: si se da, limita el total de URLs devueltas.
            dorsal: si se da Y la fuente sabe filtrar por dorsal en origen
                (ver ``ChipLevantePhotoSource``: el propio proveedor ya
                asocia fotos a dorsales por cronometraje+cámara, sin que
                haga falta descargar el álbum completo ni correr
                cara/OCR), se devuelven solo las fotos de ese dorsal —
                mucho más rápido y barato que el álbum completo. Fuentes
                sin este atajo (p. ej. Flickr, que no conoce dorsales)
                ignoran el parámetro y devuelven el álbum completo igual;
                el caller (find_photos.py) sigue corriendo el pipeline
                normal sobre lo que reciba, así que ignorarlo es seguro.
        """
        ...

    def download(
        self,
        url: str,
        dest_dir: Path,
        delay: float = 0.2,
        timeout: int = 30,
        max_photos: int | None = None,
        max_retries: int = 3,
        max_delay: float = 5.0,
        max_workers: int = 1,
        rate_limiter: AdaptiveRateLimiter | None = None,
        dorsal: str | None = None,
    ) -> list[Path]:
        """Descarga todas las fotos a dest_dir y devuelve sus paths locales.

        Args:
            url: URL del álbum.
            dest_dir: carpeta destino (se crea si no existe).
            delay: segundos base a esperar entre descargas (rate
                limiting). Se ajusta de forma adaptativa durante la
                descarga (ver ``max_delay``) — no es un valor fijo.
            timeout: timeout por request.
            max_photos: si se da, limita el total de fotos a descargar.
            max_retries: reintentos con backoff ante 429 (rate limit) o
                errores 5xx del servidor de imágenes. Álbumes grandes
                (200+ fotos) disparan 429 de Flickr con cierta frecuencia
                si se pide todo seguido; sin retry se pierden fotos que
                sí existen y sí son descargables un segundo después.
            max_delay: tope del delay adaptativo entre descargas. Cada vez
                que una foto necesita reintento por 429/5xx, el delay
                entre las SIGUIENTES descargas sube (más despacio a partir
                de ahí); tras varias descargas seguidas sin problema, baja
                de vuelta hacia ``delay``. Sin esto, el ritmo de peticiones
                seguía siendo el mismo aunque Flickr ya estuviera avisando
                de que íbamos demasiado rápido — más agresivo con el
                servidor de lo necesario y más lento en conjunto por los
                reintentos repetidos.
            max_workers: descargas simultáneas. 1 (por defecto) mantiene
                el comportamiento secuencial original. >1 usa un pool de
                hilos con el mismo backoff adaptativo, pero compartido
                entre workers (ver ``AdaptiveRateLimiter``) — la tasa
                total de peticiones/segundo sigue respondiendo a los
                429/5xx de la misma forma, solo se reparte entre varias
                conexiones a la vez en lugar de una.
            rate_limiter: si se da (solo aplica con max_workers>1), se
                reutiliza este limitador en vez de crear uno nuevo — usar
                cuando el caller descarga VARIOS álbumes en la misma
                búsqueda (ver docstring de ``AdaptiveRateLimiter``), para
                que el backoff de un álbum persista al pasar al siguiente
                en vez de reiniciarse desde cero.
            dorsal: ver ``list_photo_urls`` — atajo por dorsal cuando la
                fuente lo soporta (p. ej. ChipLevantePhotoSource),
                ignorado por fuentes que no lo soportan.

        Returns:
            Lista de paths a las imágenes descargadas.
        """
        mapping = self._download_impl(
            url, dest_dir, delay, timeout, max_photos, max_retries, max_delay, max_workers,
            rate_limiter, dorsal,
        )
        return list(mapping.keys())

    def download_with_source_urls(
        self,
        url: str,
        dest_dir: Path,
        delay: float = 0.2,
        timeout: int = 30,
        max_photos: int | None = None,
        max_retries: int = 3,
        max_delay: float = 5.0,
        max_workers: int = 1,
        rate_limiter: AdaptiveRateLimiter | None = None,
        dorsal: str | None = None,
    ) -> dict[Path, str]:
        """Como ``download``, pero además devuelve de qué URL vino cada
        foto — necesario cuando el caller no aloja copia propia de los
        resultados y necesita servir/enlazar la foto original (p. ej.
        photo-search-api, que no tiene storage propio, ver find_photos.py).
        """
        return self._download_impl(
            url, dest_dir, delay, timeout, max_photos, max_retries, max_delay, max_workers,
            rate_limiter, dorsal,
        )

    def _download_impl(
        self,
        url: str,
        dest_dir: Path,
        delay: float,
        timeout: int,
        max_photos: int | None,
        max_retries: int,
        max_delay: float,
        max_workers: int = 1,
        rate_limiter: AdaptiveRateLimiter | None = None,
        dorsal: str | None = None,
    ) -> dict[Path, str]:
        dest_dir.mkdir(parents=True, exist_ok=True)
        photo_urls = self.list_photo_urls(url, max_photos=max_photos, dorsal=dorsal)

        if not photo_urls:
            logger.warning("[%s] No se encontraron fotos en %s", self.name, url)
            return {}

        logger.info(
            "[%s] Descargando %d fotos a %s (max_workers=%d)",
            self.name, len(photo_urls), dest_dir, max_workers,
        )

        if max_workers <= 1:
            downloaded = self._download_sequential(
                photo_urls, dest_dir, delay, timeout, max_retries, max_delay
            )
        else:
            downloaded = self._download_parallel(
                photo_urls, dest_dir, delay, timeout, max_retries, max_delay, max_workers,
                rate_limiter,
            )

        logger.info(
            "[%s] %d/%d fotos descargadas correctamente", self.name, len(downloaded), len(photo_urls)
        )
        return downloaded

    def _download_sequential(
        self,
        photo_urls: list[str],
        dest_dir: Path,
        delay: float,
        timeout: int,
        max_retries: int,
        max_delay: float,
    ) -> dict[Path, str]:
        """Camino original, sin cambios de comportamiento (ver tests de
        TestAdaptiveBackoff, que fijan exactamente esta secuencia de
        sleeps) — se mantiene tal cual por si algún caller depende de un
        ritmo estrictamente uno-a-uno."""
        downloaded: dict[Path, str] = {}
        current_delay = delay
        consecutive_ok = 0
        for i, photo_url in enumerate(photo_urls, 1):
            filename = self._filename_from_url(photo_url, i)
            target = dest_dir / filename

            if target.exists():
                logger.debug("Ya existe, skip: %s", target)
                downloaded[target] = photo_url
                continue

            success, was_rate_limited = self._download_one(
                photo_url, target, timeout, max_retries
            )
            if success:
                downloaded[target] = photo_url

            if was_rate_limited:
                current_delay = min(max_delay, max(current_delay * 2, delay * 2))
                consecutive_ok = 0
            else:
                consecutive_ok += 1
                if consecutive_ok >= 10 and current_delay > delay:
                    current_delay = max(delay, current_delay / 2)
                    consecutive_ok = 0

            if current_delay > 0 and i < len(photo_urls):
                time.sleep(current_delay)

        return downloaded

    def _download_parallel(
        self,
        photo_urls: list[str],
        dest_dir: Path,
        delay: float,
        timeout: int,
        max_retries: int,
        max_delay: float,
        max_workers: int,
        rate_limiter: AdaptiveRateLimiter | None = None,
    ) -> dict[Path, str]:
        """Pool de hilos con backoff adaptativo compartido.

        Cada worker, antes de pedir SU siguiente foto, espera el delay
        actual del limitador compartido — igual que en el modo secuencial
        se esperaba entre una foto y la siguiente, pero ahora repartido
        entre N conexiones. Un 429 visto por cualquier worker sube el
        delay para todos; una racha sin problemas (contada de forma
        global, no por worker) lo relaja igual que antes.

        rate_limiter: si se pasa, se reutiliza en vez de crear uno nuevo —
        ver docstring de ``download``/``AdaptiveRateLimiter`` para el caso
        real que lo motivó (varios álbumes en la misma búsqueda).
        """
        limiter = rate_limiter or AdaptiveRateLimiter(base_delay=delay, max_delay=max_delay)
        downloaded: dict[Path, str] = {}
        downloaded_lock = threading.Lock()

        def _worker(index_and_url: tuple[int, str]) -> None:
            i, photo_url = index_and_url
            filename = self._filename_from_url(photo_url, i)
            target = dest_dir / filename

            if target.exists():
                logger.debug("Ya existe, skip: %s", target)
                with downloaded_lock:
                    downloaded[target] = photo_url
                return

            wait = limiter.current_delay()
            if wait > 0:
                time.sleep(wait)

            success, was_rate_limited = self._download_one(
                photo_url, target, timeout, max_retries
            )
            limiter.report(was_rate_limited)
            if success:
                with downloaded_lock:
                    downloaded[target] = photo_url

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = [
                executor.submit(_worker, (i, photo_url))
                for i, photo_url in enumerate(photo_urls, 1)
            ]
            for future in as_completed(futures):
                future.result()  # re-lanza cualquier excepción inesperada

        return downloaded

    def _download_one(
        self, photo_url: str, target: Path, timeout: int, max_retries: int
    ) -> tuple[bool, bool]:
        """Descarga una foto con reintento y backoff exponencial ante 429/5xx.

        Returns:
            (success, was_rate_limited) — was_rate_limited es True si en
            algún intento se recibió 429/5xx, independientemente de si la
            descarga acabó teniendo éxito tras reintentar. El caller usa
            esta señal para el backoff adaptativo entre fotos.
        """
        session = self._get_session()
        was_rate_limited = False
        for attempt in range(max_retries + 1):
            try:
                resp = session.get(photo_url, timeout=timeout, stream=True)
                if resp.status_code == 429 or resp.status_code >= 500:
                    was_rate_limited = True
                    if attempt < max_retries:
                        wait = float(resp.headers.get("Retry-After", 2 ** (attempt + 1)))
                        logger.debug(
                            "Rate limited/%s en %s, reintento %d/%d en %.1fs",
                            resp.status_code,
                            photo_url,
                            attempt + 1,
                            max_retries,
                            wait,
                        )
                        time.sleep(wait)
                        continue
                resp.raise_for_status()
                target.write_bytes(resp.content)
                return True, was_rate_limited
            except requests.RequestException as e:
                if attempt < max_retries:
                    time.sleep(2 ** (attempt + 1))
                    continue
                logger.error("Error descargando %s: %s", photo_url, e)
                return False, was_rate_limited
        return False, was_rate_limited

    @staticmethod
    def _filename_from_url(url: str, index: int) -> str:
        """Genera un nombre de archivo único para una URL."""
        # Última parte de la URL sin query string
        from urllib.parse import urlparse, unquote

        parsed = urlparse(url)
        path = unquote(parsed.path)
        name = path.rsplit("/", 1)[-1] or f"photo_{index}.jpg"
        # Sanitizar
        name = "".join(c for c in name if c.isalnum() or c in "._-")
        if not name:
            name = f"photo_{index}.jpg"
        # Si no tiene extensión, añadimos .jpg
        if "." not in name:
            name += ".jpg"
        return name
