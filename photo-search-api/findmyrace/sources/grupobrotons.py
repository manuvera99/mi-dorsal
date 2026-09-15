"""Fuente de fotos para Grupo Brotons (grupobrotons.com).

Investigado con datos reales el 15 sep 2026 (ver docs/optional/photo-sources.md
§7.1 en mi-dorsal): Grupo Brotons organiza carreras populares de
Alicante/Benidorm/El Campello y publica galerías de fotos propias en un
plugin NextGEN Gallery de WordPress — a diferencia de ChipLevante, aquí no
hace falta ninguna sesión ni endpoint AJAX: el HTML estático de la propia
página del álbum ya trae los enlaces a las fotos de tamaño completo, sin JS.

Confirmado con un álbum real
(grupobrotons.com/fotografias/nggallery/album/1er-cross-despedida-verano-2026):
740 fotos reales en 4 páginas (200+200+200+140), paginación vía
``/page/{n}``, fin de paginación cuando una página no devuelve ninguna foto
(no hay contador de páginas ni mensaje de error explícito que parsear — el
criterio simple "0 fotos en esta página" ya es suficiente y fiable).

La ficha de un evento (``grupobrotons.com/event/{slug}/``) NO enlaza al
álbum específico de esa carrera — solo al índice general
(``grupobrotons.com/fotografias/``). El usuario tiene que pegar la URL
del álbum concreto (``.../fotografias/nggallery/album/{slug-album}``),
igual que ya hace hoy con un álbum de Flickr o de ChipLevante. Un mismo
evento puede tener varios álbumes (p. ej. "avance", el álbum principal, y
uno de "más fotos" de otro fotógrafo) — no hay problema con esto: el límite
de 3 álbumes por búsqueda que ya existe en photoSearch.create cubre el
caso sin necesitar lógica especial aquí.
"""

from __future__ import annotations

import logging
import re

from .base import DEFAULT_HEADERS, PhotoSource

logger = logging.getLogger(__name__)

# Patrón de URL de un álbum de Grupo Brotons:
# grupobrotons.com/fotografias/nggallery/album/{slug}[/page/N]
_ALBUM_URL_RE = re.compile(
    r"grupobrotons\.com/fotografias/nggallery/album/([^/]+)"
)
_PAGE_SUFFIX_RE = re.compile(r"/page/(\d+)/?$")

# href de una foto en el HTML estático del álbum — el <a href> es el tamaño
# completo (el <img src> interior es el thumbnail, con /thumbs/ insertado,
# no se usa). Mismo patrón que ChipLevante (ver chiplevante.py).
_PHOTO_HREF_RE = re.compile(r'<a href="([^"]+\.jpe?g)[^"]*"', re.IGNORECASE)

# Tope de páginas de seguridad (200 fotos/página -> hasta 100000 fotos).
# El criterio real de parada es una página sin fotos (ver docstring del
# módulo); esto solo evita un bucle largo si ese criterio fallara alguna
# vez por un cambio de formato en el sitio.
_MAX_PAGES = 500


class GrupoBrotonsPhotoSource(PhotoSource):
    """Fuente de fotos para carreras organizadas por Grupo Brotons."""

    name = "grupobrotons"

    def can_handle(self, url: str) -> bool:
        return _ALBUM_URL_RE.search(url) is not None

    def cache_key_for_url(self, url: str) -> str | None:
        """El slug del álbum — estable independientemente de si la URL
        pegada incluye ``/page/N`` al final (dos corredores podrían pegar
        páginas distintas del mismo álbum sin saberlo)."""
        m = _ALBUM_URL_RE.search(url)
        return m.group(1) if m else None

    def list_photo_urls(
        self, url: str, max_photos: int | None = None, dorsal: str | None = None
    ) -> list[str]:
        """Devuelve las URLs de fotos del álbum — dorsal se ignora, Grupo
        Brotons no asocia fotos a dorsales (a diferencia de ChipLevante)."""
        m = _ALBUM_URL_RE.search(url)
        if not m:
            logger.warning("[grupobrotons] URL no encaja con el patrón: %s", url)
            return []
        slug = m.group(1)
        base_url = f"https://grupobrotons.com/fotografias/nggallery/album/{slug}"

        session = self._get_session()
        all_urls: list[str] = []
        seen: set[str] = set()

        for page in range(1, _MAX_PAGES + 1):
            page_url = base_url if page == 1 else f"{base_url}/page/{page}"
            try:
                resp = session.get(page_url, headers=DEFAULT_HEADERS, timeout=30)
                resp.raise_for_status()
                html = resp.text
            except Exception as e:  # noqa: BLE001
                logger.warning(
                    "[grupobrotons] Fetch falló (álbum=%s página=%d): %s", slug, page, e
                )
                break

            hrefs = _PHOTO_HREF_RE.findall(html)
            if not hrefs:
                # Página sin fotos = fin del álbum (ver docstring: no hay
                # contador de páginas explícito que parsear).
                break

            new_this_page = 0
            for href in hrefs:
                if href not in seen:
                    seen.add(href)
                    all_urls.append(href)
                    new_this_page += 1

            if new_this_page == 0:
                # Mismo contenido que la página anterior (p. ej. el sitio
                # redirige /page/N fuera de rango a la última página real)
                # — evita un bucle infinito repitiendo la misma página.
                break

            if max_photos and len(all_urls) >= max_photos:
                break

        logger.info("[grupobrotons] Álbum %s: %d fotos", slug, len(all_urls))
        return all_urls[:max_photos] if max_photos else all_urls
