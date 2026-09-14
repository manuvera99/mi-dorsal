"""Clase base abstracta para fuentes de fotos."""

from __future__ import annotations

import logging
import time
from abc import ABC, abstractmethod
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

    def _get_session(self) -> requests.Session:
        if self.session is None:
            self.session = requests.Session()
            self.session.headers.update(DEFAULT_HEADERS)
        return self.session

    @abstractmethod
    def can_handle(self, url: str) -> bool:
        """Devuelve True si esta fuente sabe怎么处理 esa URL."""
        ...

    @abstractmethod
    def list_photo_urls(self, url: str, max_photos: int | None = None) -> list[str]:
        """Devuelve la lista de URLs directas a imágenes del álbum.

        Args:
            url: URL del álbum.
            max_photos: si se da, limita el total de URLs devueltas.
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

        Returns:
            Lista de paths a las imágenes descargadas.
        """
        mapping = self._download_impl(url, dest_dir, delay, timeout, max_photos, max_retries, max_delay)
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
    ) -> dict[Path, str]:
        """Como ``download``, pero además devuelve de qué URL vino cada
        foto — necesario cuando el caller no aloja copia propia de los
        resultados y necesita servir/enlazar la foto original (p. ej.
        photo-search-api, que no tiene storage propio, ver find_photos.py).
        """
        return self._download_impl(url, dest_dir, delay, timeout, max_photos, max_retries, max_delay)

    def _download_impl(
        self,
        url: str,
        dest_dir: Path,
        delay: float,
        timeout: int,
        max_photos: int | None,
        max_retries: int,
        max_delay: float,
    ) -> dict[Path, str]:
        dest_dir.mkdir(parents=True, exist_ok=True)
        photo_urls = self.list_photo_urls(url, max_photos=max_photos)

        if not photo_urls:
            logger.warning("[%s] No se encontraron fotos en %s", self.name, url)
            return {}

        logger.info("[%s] Descargando %d fotos a %s", self.name, len(photo_urls), dest_dir)

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

            # Backoff adaptativo: sube el delay si hubo rate-limit, lo
            # relaja gradualmente tras una racha de descargas sin problema.
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

        logger.info("[%s] %d/%d fotos descargadas correctamente", self.name, len(downloaded), len(photo_urls))
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
