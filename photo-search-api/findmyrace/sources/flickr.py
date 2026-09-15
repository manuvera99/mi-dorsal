"""Scraper de álbumes públicos de Flickr.

Estrategia principal: la API REST oficial de Flickr
(``flickr.photosets.getPhotos``), autenticada con el ``site_key`` público
que el propio frontend de flickr.com usa para sus llamadas AJAX (se extrae
en caliente del HTML de la página del álbum — no está hardcodeado, así que
sigue funcionando si Flickr lo rota). Con esto se obtiene el álbum completo
en 1-2 llamadas, con el total real y sin depender de scroll JS.

Si por lo que sea no se puede extraer el site_key o la API falla, se cae a
un scraper HTML por página (``/page1``, ``/page2``, ...) como fallback.

⚠️ Limitaciones del fallback HTML (no aplican a la vía API):
- Solo álbumes públicos.
- Cada página HTML sólo trae las fotos ya renderizadas en el HTML inicial
  (las que carga JS al hacer scroll no aparecen) — en álbumes grandes se
  queda corto frente al total real del álbum.
- El feed Atom de Flickr (``services/feeds/photoset.gne``) dejó de
  respetar el parámetro ``page`` (probado en sep-2026: siempre devuelve la
  misma primera página) — no se usa como fuente.

NO requiere una API key propia para la vía principal (reutiliza la del
frontend público de Flickr). Para uso a mayor escala, lo correcto es una
API key propia (https://www.flickr.com/services/api/).
"""

from __future__ import annotations

import json
import logging
import re

import requests

from .base import DEFAULT_HEADERS, PhotoSource

logger = logging.getLogger(__name__)

# Patrón para URLs de Flickr:
# (https://)?live.staticflickr.com/{server}/{id}_{secret}_{size}.jpg
_FLICKR_URL_RE = re.compile(
    r"(?:https?://)?live\.staticflickr\.com/(\d+)/(\d+)_([a-z0-9]+)_([a-z0-9]+)\.jpg"
)

# Orden de tamaños de mayor a menor (Flickr):
_SIZE_RANK: dict[str, int] = {
    "o": 100, "k": 90, "h": 80, "b": 70, "c": 60, "z": 50,
    "m": 40, "t": 30, "s": 20, "q": 10, "n": 5,
}

# Patrones para extraer set_id y user_id de una URL de álbum de Flickr
_ALBUM_URL_RE = re.compile(
    r"flickr\.com/photos/(?P<user>[^/]+)/albums/(?P<set_id>\d+)"
)
_PAGE_RE = re.compile(r"/page(\d+)(?:/)?$")

# URL de PERFIL (lista de álbumes de un fotógrafo), sin set_id — distinta
# de _ALBUM_URL_RE, que exige un id numérico tras "/albums/".
_PROFILE_ALBUMS_URL_RE = re.compile(r"flickr\.com/photos/(?P<user>[^/]+)/albums/?$")


def _pick_best_size(sizes: list[str]) -> str:
    """Devuelve el mayor tamaño disponible de una lista."""
    return max(sizes, key=lambda s: _SIZE_RANK.get(s, 0))


def _photo_id_from_url(url: str) -> str:
    """Extrae el id de foto (segundo grupo) de una URL de staticflickr."""
    m = _FLICKR_URL_RE.search(url)
    return m.group(2) if m else url


class FlickrSource(PhotoSource):
    """Fuente para álbumes públicos de Flickr."""

    name = "flickr"
    # Tope de páginas HTML a recorrer por álbum en el fallback
    # (~24 fotos/página = hasta ~2400 fotos). Evita bucles largos si la
    # detección de fin de álbum fallara por algún cambio en el HTML de
    # Flickr. La vía principal (API) no tiene este límite: usa el total
    # real que devuelve la propia API.
    MAX_PAGES = 100

    def __init__(self, session: requests.Session | None = None) -> None:
        self.session = session or requests.Session()
        self.session.headers.update(DEFAULT_HEADERS)

    def can_handle(self, url: str) -> bool:
        return "flickr.com" in url.lower()

    def cache_key_for_url(self, url: str) -> str | None:
        """El ``set_id`` numérico del álbum — estable independientemente
        de con qué alias de usuario o formato de URL se haya compartido el
        enlace (dos corredores pueden pegar URLs distintas del mismo
        álbum). None si ``url`` no es una URL de álbum concreto (p. ej.
        apunta a una página /pageN o no matchea en absoluto) — en ese
        caso no cacheamos, para no arriesgar mezclar contenido de dos
        álbumes distintos bajo la misma clave."""
        if self._is_specific_page(url):
            return None
        _, set_id = self._parse_album_url(url)
        return set_id

    @staticmethod
    def _parse_album_url(url: str) -> tuple[str | None, str | None]:
        """Extrae (user, set_id) de una URL de álbum de Flickr."""
        m = _ALBUM_URL_RE.search(url)
        if m:
            return m.group("user"), m.group("set_id")
        return None, None

    @staticmethod
    def _is_specific_page(url: str) -> bool:
        """True si la URL apunta a una página concreta (/pageN)."""
        return _PAGE_RE.search(url) is not None

    def _extract_site_key_and_nsid(
        self, user: str, set_id: str
    ) -> tuple[str | None, str | None]:
        """Extrae el ``site_key`` público y el NSID real del propietario.

        El ``site_key`` es el api_key que el propio frontend de flickr.com
        usa para sus llamadas AJAX a la API REST
        (``root.YUI_config.flickr.api.site_key`` en un <script> inline).
        Público y sin autenticación adicional — no es un secreto nuestro,
        es el que ya usa cualquier visitante.

        El NSID (p. ej. ``202749691@N08``) es necesario porque
        ``flickr.photosets.getPhotos`` exige el ``user_id`` numérico — si la
        URL usa un alias/pathAlias (p. ej. ``mikemanitasdpm``, el formato
        habitual al compartir un álbum), la API falla con "User not found"
        y sin este fix se caía silenciosamente al fallback HTML incompleto
        (confirmado: un álbum de 297 fotos reales se listaba con solo 73).
        Se extrae de ``"ownerNsid":"..."`` en el mismo HTML del álbum.
        """
        try:
            base_url = f"https://www.flickr.com/photos/{user}/albums/{set_id}"
            resp = self.session.get(base_url, timeout=30)
            resp.raise_for_status()
            html = resp.text
            key_match = re.search(r'site_key\s*=\s*"([0-9a-f]{32})"', html)
            nsid_match = re.search(r'"ownerNsid":"(\d+@N\d+)"', html)
            site_key = key_match.group(1) if key_match else None
            # Si el `user` de la URL ya es un NSID (contiene "@N"), no hace
            # falta resolverlo — usamos el de la URL como fallback.
            owner_nsid = nsid_match.group(1) if nsid_match else (user if "@N" in user else None)
            return site_key, owner_nsid
        except Exception as e:  # noqa: BLE001
            logger.warning("[flickr] No se pudo extraer site_key/NSID: %s", e)
            return None, None

    def _extract_site_key_and_nsid_from_profile(
        self, user: str
    ) -> tuple[str | None, str | None]:
        """Como ``_extract_site_key_and_nsid``, pero para la página de
        PERFIL de un fotógrafo (``/photos/<user>/albums/``, sin set_id) en
        vez de la de un álbum concreto.

        Confirmado con una petición real (14 sep 2026, mikemanitasdpm): esa
        página también expone `site_key` (mismo patrón). El NSID del
        propietario, sin embargo, no aparece como ``"ownerNsid":"..."``
        (eso solo está en la página de un álbum) — en la de perfil aparece
        como ``"nsid":"..."`` dentro de los `params` de la vista
        `albums-list-page-view` que Flickr inicializa inline. Puede
        aparecer más de una vez en el HTML (otros NSIDs de terceros,
        contactos, etc.) — nos quedamos con el primer match, que es el de
        `initialView.params`, la propia vista de álbumes que se está
        cargando.
        """
        try:
            base_url = f"https://www.flickr.com/photos/{user}/albums/"
            resp = self.session.get(base_url, timeout=30)
            resp.raise_for_status()
            html = resp.text
            key_match = re.search(r'site_key\s*=\s*"([0-9a-f]{32})"', html)
            nsid_match = re.search(r'"nsid":"(\d+@N\d+)"', html)
            site_key = key_match.group(1) if key_match else None
            owner_nsid = nsid_match.group(1) if nsid_match else (user if "@N" in user else None)
            return site_key, owner_nsid
        except Exception as e:  # noqa: BLE001
            logger.warning("[flickr] No se pudo extraer site_key/NSID de perfil: %s", e)
            return None, None

    @staticmethod
    def is_profile_albums_url(url: str) -> bool:
        """True si `url` es la página de perfil de un fotógrafo (lista de
        álbumes), no un álbum concreto — usado por el endpoint de listado
        de álbumes para distinguir ambos casos."""
        return _PROFILE_ALBUMS_URL_RE.search(url) is not None

    def list_albums_for_profile(self, profile_url: str) -> list[dict] | None:
        """Lista los álbumes públicos de un fotógrafo dada la URL de su
        perfil (``flickr.com/photos/<user>/albums/``).

        Usa ``flickr.photosets.getList`` (método hermano de
        ``flickr.photosets.getPhotos``, que ya usa ``_list_via_api``) — la
        misma API REST pública, autenticada igual (site_key extraído del
        HTML). Devuelve None si la URL no es de perfil o si falla la
        extracción/llamada — el caller decide cómo comunicar el error.

        Confirmado con una llamada real (14 sep 2026) contra el perfil de
        mikemanitasdpm: 363 álbumes reales devueltos correctamente.
        """
        m = _PROFILE_ALBUMS_URL_RE.search(profile_url)
        if not m:
            return None
        user = m.group("user")

        site_key, owner_nsid = self._extract_site_key_and_nsid_from_profile(user)
        if not site_key or not owner_nsid:
            return None

        albums: list[dict] = []
        page = 1
        per_page = 500  # máximo permitido por flickr.photosets.getList
        while True:
            params = {
                "method": "flickr.photosets.getList",
                "api_key": site_key,
                "user_id": owner_nsid,
                "per_page": per_page,
                "page": page,
                "format": "json",
                "nojsoncallback": 1,
            }
            try:
                resp = self.session.get(
                    "https://api.flickr.com/services/rest", params=params, timeout=30
                )
                resp.raise_for_status()
                data = json.loads(resp.text)
            except Exception as e:  # noqa: BLE001
                logger.warning("[flickr] getList falló: %s", e)
                return None

            if data.get("stat") != "ok":
                logger.warning("[flickr] getList respondió error: %s", data.get("message"))
                return None

            photosets = data.get("photosets", {})
            for ps in photosets.get("photoset", []):
                set_id = ps.get("id")
                title = (ps.get("title") or {}).get("_content", "")
                albums.append(
                    {
                        "id": set_id,
                        "title": title,
                        "photoCount": int(ps.get("count_photos", 0)),
                        "url": f"https://www.flickr.com/photos/{user}/albums/{set_id}/",
                    }
                )

            total_pages = int(photosets.get("pages", 1))
            if page >= total_pages:
                break
            page += 1

        logger.info("[flickr] getList: %d álbumes para %s", len(albums), user)
        return albums

    def _list_via_api(
        self, user: str, set_id: str, max_photos: int | None
    ) -> list[str] | None:
        """Lista el álbum vía la API REST oficial de Flickr.

        Devuelve None si falla (site_key/NSID no extraíbles, API error,
        etc.), para que el caller caiga al fallback HTML.
        """
        site_key, owner_nsid = self._extract_site_key_and_nsid(user, set_id)
        if not site_key or not owner_nsid:
            return None

        all_urls: list[str] = []
        page = 1
        per_page = 500  # máximo permitido por flickr.photosets.getPhotos
        while True:
            params = {
                "method": "flickr.photosets.getPhotos",
                "api_key": site_key,
                "photoset_id": set_id,
                "user_id": owner_nsid,
                "extras": "url_k,url_h,url_b,url_o,url_z",
                "per_page": per_page,
                "page": page,
                "format": "json",
                "nojsoncallback": 1,
            }
            try:
                resp = self.session.get(
                    "https://api.flickr.com/services/rest", params=params, timeout=30
                )
                resp.raise_for_status()
                data = json.loads(resp.text)
            except Exception as e:  # noqa: BLE001
                logger.warning("[flickr] API request falló: %s", e)
                return None

            if data.get("stat") != "ok":
                logger.warning("[flickr] API respondió error: %s", data.get("message"))
                return None

            photoset = data.get("photoset", {})
            photos = photoset.get("photo", [])
            for p in photos:
                # Preferimos _k (2048px) sobre _o (original): de sobra
                # para OCR/cara, pesa menos y reduce el riesgo de rate
                # limiting de Flickr al descargar álbumes grandes.
                for size_key in ("url_k", "url_h", "url_b", "url_o", "url_z"):
                    if size_key in p:
                        all_urls.append(p[size_key])
                        break
            if max_photos and len(all_urls) >= max_photos:
                return all_urls[:max_photos]

            total_pages = int(photoset.get("pages", 1))
            if page >= total_pages:
                break
            page += 1

        logger.info(
            "[flickr] API: %d fotos (álbum '%s', total declarado=%s)",
            len(all_urls),
            photoset.get("title", set_id),
            photoset.get("total"),
        )
        return all_urls

    def _list_photo_urls_from_html(self, url: str) -> list[str]:
        """Fallback: scraper HTML para una página específica."""
        logger.info("[flickr] Fetching HTML: %s", url)
        resp = self.session.get(url, timeout=30)
        resp.raise_for_status()
        html = resp.text

        matches = _FLICKR_URL_RE.findall(html)
        photos: dict[tuple[str, str, str], list[str]] = {}
        for server, pid, secret, size in matches:
            photos.setdefault((server, pid, secret), []).append(size)

        return [
            f"https://live.staticflickr.com/{server}/{pid}_{secret}_{_pick_best_size(sizes)}.jpg"
            for (server, pid, secret), sizes in photos.items()
        ]

    def list_photo_urls(
        self, url: str, max_photos: int | None = None, dorsal: str | None = None
    ) -> list[str]:
        """Devuelve la lista de URLs de las fotos del álbum.

        - Si la URL tiene /pageN: usa el scraper HTML (solo esa página) —
          se respeta explícitamente porque el caller pidió esa página.
        - Si no (álbum completo): intenta primero la API REST oficial
          (rápida, completa, con el total real). Si falla, cae al scraper
          HTML por página como fallback.

        Args:
            url: URL del álbum.
            max_photos: si se da, limita el total de URLs devueltas.
            dorsal: ignorado — Flickr no asocia fotos a dorsales, no hay
                atajo posible (a diferencia de ChipLevantePhotoSource).
                Aceptado solo para cumplir la interfaz de PhotoSource.
        """
        user, set_id = self._parse_album_url(url)
        if not user or not set_id:
            # No es una URL de álbum, fallback al HTML
            return self._list_photo_urls_from_html(url)

        if self._is_specific_page(url):
            # Página específica: scraping HTML (más rápido)
            urls = self._list_photo_urls_from_html(url)
            logger.info("[flickr] HTML page: %d fotos", len(urls))
            return urls[:max_photos] if max_photos else urls

        api_urls = self._list_via_api(user, set_id, max_photos)
        if api_urls is not None:
            return api_urls

        logger.info("[flickr] API no disponible, usando fallback HTML por página")
        return self._list_photo_urls_from_html_paged(user, set_id, max_photos)

    def _list_photo_urls_from_html_paged(
        self, user: str, set_id: str, max_photos: int | None
    ) -> list[str]:
        """Fallback: itera páginas HTML 1, 2, 3... hasta que:

        - una página no aporte fotos nuevas (Flickr, cuando se pide una
          página fuera de rango, no da 404: hace fallback silencioso y
          devuelve el mismo contenido que /page1 — confirmado empíricamente
          en septiembre 2026), o
        - se supere MAX_PAGES (tope de seguridad).

        No hay un total de páginas fiable en el HTML/metadata del álbum
        (los contadores embebidos, como countPhotosPublic, son del perfil
        completo del usuario, no del álbum), así que paginamos hasta
        detectar que no hay fotos nuevas en vez de precalcular un total.
        Solo se usa cuando la vía API (``_list_via_api``) falla.
        """
        base_url = f"https://www.flickr.com/photos/{user}/albums/{set_id}"
        all_urls: list[str] = []
        seen: set[str] = set()
        page1_ids: frozenset[str] | None = None

        for p in range(1, self.MAX_PAGES + 1):
            page_urls = self._list_photo_urls_from_html(base_url + f"/page{p}")
            page_ids = frozenset(_photo_id_from_url(u) for u in page_urls)
            logger.info("[flickr] HTML page %d: %d fotos", p, len(page_urls))

            if p == 1:
                if not page_urls:
                    return []
                page1_ids = page_ids
            elif not page_urls or page_ids <= (page1_ids or frozenset()):
                # Página vacía, o repite (subconjunto de) la página 1:
                # hemos superado el final real del álbum.
                logger.info(
                    "[flickr] page%d repite/vacía (fin de álbum detectado en page%d)",
                    p,
                    p - 1,
                )
                break

            new_in_page = 0
            for u in page_urls:
                if u not in seen:
                    seen.add(u)
                    all_urls.append(u)
                    new_in_page += 1
            if new_in_page == 0 and p > 1:
                # Ninguna foto nueva aunque la página no sea idéntica a la 1
                # (p. ej. orden distinto): también es señal de fin de álbum.
                break

            if max_photos and len(all_urls) >= max_photos:
                break

        if max_photos:
            all_urls = all_urls[:max_photos]

        logger.info("[flickr] Total: %d fotos únicas", len(all_urls))
        return all_urls
