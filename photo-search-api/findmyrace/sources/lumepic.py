"""Fuente de fotos para álbumes de Lumepic (lumepic.com).

Investigado el 16 sep 2026 (ver docs/optional/photo-sources.md §3.2 en
mi-dorsal): Lumepic es una plataforma comercial internacional de
reconocimiento facial/dorsal para fotos de eventos (clientes: Decathlon,
Renault, Santander) usada por fotógrafos independientes — descubierto vía
un fotógrafo real (acariciandolaluz.com) que delega su búsqueda por
selfie/dorsal en Lumepic.

Endpoint real confirmado por reverse-engineering del bundle JS de la app
(sin credenciales, sin saltarse ningún control de acceso — solo
inspeccionando las peticiones que el propio navegador ya hace sin
login):

    GET https://www.lumepic.com/api/feed/albums/{albumId}/photographs
        ?pagination[skip]=N

Sin autenticación, público. Devuelve
``{"items": [{"id", "url", "thumbnailUrl", "price", "width", "height",
...}], "count": N}``, paginado de 100 en 100. Probado real contra un
álbum: 2665 fotos.

**Importante — por qué esto SÍ es aceptable a diferencia de "scrapear
una plataforma cerrada" (ver §3.2 del doc):** la ``url`` que devuelve el
endpoint ya es la foto real completa (mismas dimensiones que el archivo
pagado) pero con una marca de agua "LUMEPIC" grande superpuesta más un
aviso de derechos — es la propia vista previa pública que Lumepic ya
sirve a cualquier visitante sin login para vender la foto. Usamos esa
misma URL para el matching (cara/dorsal siguen siendo detectables bajo
la marca de agua) y, si el usuario aparece en el resultado, se le
enlaza a comprarla en Lumepic — nunca se le entrega la foto sin marca
de agua ni se elude el pago. Ver ``purchase_info_for_source_url``.

URL de compra de una foto concreta, confirmada real (HTTP 200,
integración Stripe/dLocal visible en la página):
``https://www.lumepic.com/es/album/{albumId}/{photographId}``
"""

from __future__ import annotations

import logging
import re
from urllib.parse import urlencode

from .base import DEFAULT_HEADERS, PhotoSource

logger = logging.getLogger(__name__)

# Patrón de URL de álbum de Lumepic: lumepic.com/[es/]album/{albumId}[/...]
_ALBUM_URL_RE = re.compile(
    r"lumepic\.com/(?:[a-z]{2}/)?album/([0-9a-f-]{36})"
)

_PAGE_SIZE = 100
# Tope de páginas de seguridad (100 fotos/página -> hasta 500000 fotos).
_MAX_PAGES = 5000


class LumepicPhotoSource(PhotoSource):
    """Fuente de fotos para álbumes de Lumepic — de pago, ver docstring
    del módulo para cómo se maneja eso de cara al usuario."""

    name = "lumepic"

    def __init__(self) -> None:
        # id de foto -> {price, currency} de la última llamada a
        # list_photo_urls, para poder construir purchase_info_for_source_url
        # sin volver a llamar a la API. No es cache entre búsquedas
        # distintas (cada instancia de PhotoSource vive una sola
        # búsqueda) — solo evita una segunda pasada de red dentro de la
        # misma búsqueda.
        self._photo_id_by_url: dict[str, str] = {}
        self._price_by_photo_id: dict[str, tuple[float, str]] = {}
        self._album_id_by_photo_id: dict[str, str] = {}

    def can_handle(self, url: str) -> bool:
        return _ALBUM_URL_RE.search(url) is not None

    def cache_key_for_url(self, url: str) -> str | None:
        m = _ALBUM_URL_RE.search(url)
        return m.group(1) if m else None

    def list_photo_urls(
        self, url: str, max_photos: int | None = None, dorsal: str | None = None
    ) -> list[str]:
        """Devuelve las URLs de preview (con marca de agua) del álbum —
        dorsal se pasa como filtro real de la API si se da (ver
        docstring del módulo: filters[tagValue]), pero no está confirmado
        que devuelva resultados reales todavía (puede depender de que
        Lumepic ya haya procesado OCR de dorsales en ese álbum) — si no
        hay resultados con el filtro, se cae al álbum completo, igual
        que hace ChipLevantePhotoSource con su atajo."""
        m = _ALBUM_URL_RE.search(url)
        if not m:
            logger.warning("[lumepic] URL no encaja con el patrón: %s", url)
            return []
        album_id = m.group(1)

        if dorsal:
            urls = self._fetch_all_pages(album_id, max_photos, dorsal)
            if urls:
                logger.info(
                    "[lumepic] Atajo por dorsal %s (álbum=%s): %d fotos",
                    dorsal, album_id, len(urls),
                )
                return urls
            logger.info(
                "[lumepic] Atajo por dorsal %s sin resultados, cayendo al álbum completo",
                dorsal,
            )

        urls = self._fetch_all_pages(album_id, max_photos, None)
        logger.info("[lumepic] Álbum %s: %d fotos", album_id, len(urls))
        return urls

    def _fetch_all_pages(
        self, album_id: str, max_photos: int | None, dorsal: str | None
    ) -> list[str]:
        session = self._get_session()
        all_urls: list[str] = []

        for page in range(_MAX_PAGES):
            params = {"pagination[skip]": str(page * _PAGE_SIZE)}
            if dorsal:
                params["filters[tagValue]"] = dorsal
            try:
                resp = session.get(
                    f"https://www.lumepic.com/api/feed/albums/{album_id}/photographs",
                    params=params,
                    headers={**DEFAULT_HEADERS, "Accept": "application/json"},
                    timeout=30,
                )
                resp.raise_for_status()
                body = resp.json()
            except Exception as e:  # noqa: BLE001
                logger.warning(
                    "[lumepic] Fetch falló (álbum=%s página=%d): %s", album_id, page, e
                )
                break

            items = body.get("items", [])
            if not items:
                break

            for item in items:
                photo_url = item.get("url")
                photo_id = item.get("id")
                if not photo_url or not photo_id:
                    continue
                all_urls.append(photo_url)
                self._photo_id_by_url[photo_url] = photo_id
                self._album_id_by_photo_id[photo_id] = album_id
                price = item.get("price")
                if price is not None:
                    # Sin campo de moneda explícito en la respuesta real
                    # observada — asumimos EUR (fotógrafos españoles),
                    # documentado como asunción, no confirmado por API.
                    self._price_by_photo_id[photo_id] = (float(price), "EUR")

            if max_photos and len(all_urls) >= max_photos:
                break
            if len(items) < _PAGE_SIZE:
                # Última página real (menos de una página completa).
                break

        return all_urls[:max_photos] if max_photos else all_urls

    def purchase_info_for_source_url(self, source_url: str) -> dict | None:
        """Ver docstring del módulo: la ``source_url`` de Lumepic ya lleva
        marca de agua — esto da el enlace real donde el usuario puede
        comprar la foto sin marca de agua, y el precio si se conoce."""
        photo_id = self._photo_id_by_url.get(source_url)
        if not photo_id:
            return None
        album_id = self._album_id_by_photo_id.get(photo_id)
        if not album_id:
            return None
        price, currency = self._price_by_photo_id.get(photo_id, (None, None))
        params = urlencode({"utm_source": "mi-dorsal", "utm_medium": "encuentra_tus_fotos"})
        return {
            "purchaseUrl": f"https://www.lumepic.com/es/album/{album_id}/{photo_id}?{params}",
            "price": price,
            "currency": currency,
        }
