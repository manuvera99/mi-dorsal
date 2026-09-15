"""Fuente de fotos para ChipLevante (chiplevante.com).

Investigado con datos reales el 15 sep 2026 (ver docs/optional/photo-sources.md
§7 en mi-dorsal): ChipLevante es una empresa de cronometraje de carreras
populares de Alicante/Murcia/Albacete/Valencia con un endpoint AJAX público
que expone tanto una galería general de fotos de la carrera (paginada, sin
filtro) como un atajo por dorsal — el propio sistema de ChipLevante ya
asocia cada foto a un dorsal cruzando el tiempo de paso del corredor por un
punto de control (chip de cronometraje) con la marca de tiempo de la cámara
en ese mismo punto. Confirmado con una carrera real
(chiplevante.com/es/prueba/bajada-hondon-aspe-97-2026): pedir fotos del
dorsal 1 vía el endpoint general con ``dr=1`` devuelve exactamente las mismas
7 fotos que el endpoint dedicado ``dame_fotos.php`` (usado por el propio
frontend cuando el corredor pide su diploma) — un único endpoint sirve para
ambos casos.

Endpoint único: ``POST /modulos/inc/dame_mm.php``
    body: ev={evento}&ed={edicion}&cr={carrera}&pc=0&tp=I&dr={dorsal|""}&ti=&pag={n}
    Respuesta: {"options": "<html><ul class='tg-photos'>...<a href='...jpg'>...</ul>...<button id='btn-todo'>...</button>"}
    - dr="" (sin dorsal): álbum general completo, paginado (24 fotos/página,
      confirmado con una carrera real: 513 fotos en 22 páginas). Fin de
      paginación: la respuesta deja de incluir el botón "btn-todo" (Mostrar
      más) — no hay campo numérico de total de páginas.
    - dr=<dorsal>: solo fotos de ese dorsal — atajo, sin pipeline de
      cara/dorsal/color necesario en el lado de mi-dorsal, porque ChipLevante
      ya hizo el emparejamiento.
    - NO requiere cookie de sesión (a diferencia de dame_id_corredor.php, el
      endpoint de resultados que sí la exige — ver convex/scraper.ts).

URL de imagen real: dentro de cada ``<li><figure><a href="...">`` — el
``href`` es la foto a tamaño completo, el ``<img src="...">`` interior es un
thumbnail (ruta con ``/min/`` insertado antes del nombre de fichero). Se usa
el ``href``, nunca el ``src``.
"""

from __future__ import annotations

import logging
import re

from .base import DEFAULT_HEADERS, PhotoSource

logger = logging.getLogger(__name__)

# Patrón de URL de una prueba de ChipLevante: /es/prueba/{slug}-{evento}-{edicion}
# Mismo patrón que parseChiplevanteUrl en convex/scraper.ts — el slug puede
# tener guiones, así que el regex toma el ÚLTIMO -NUM-YEAR.
_RACE_URL_RE = re.compile(r"chiplevante\.com/es/prueba/.+?-(\d+)-(\d{4})/?$")

# href de una foto dentro del HTML devuelto por dame_mm.php — a diferencia
# del <img> (que apunta al thumbnail /min/), el <a href> apunta al tamaño
# completo. Puede tener extensión .jpg o .JPG indistintamente.
_PHOTO_HREF_RE = re.compile(r'<a href="([^"]+\.jpe?g)"', re.IGNORECASE)

# Tope de páginas a recorrer en el álbum general (24 fotos/página ->
# hasta ~12000 fotos). Salvaguarda de seguridad, no un límite real esperado
# — evita un bucle largo si "btn-todo" quedara presente por un cambio de
# formato en el HTML de ChipLevante.
_MAX_PAGES = 500


class ChipLevantePhotoSource(PhotoSource):
    """Fuente de fotos para carreras cronometradas por ChipLevante."""

    name = "chiplevante"

    def can_handle(self, url: str) -> bool:
        return _RACE_URL_RE.search(url) is not None

    def cache_key_for_url(self, url: str) -> str | None:
        """``{evento}-{edicion}`` — estable independientemente del slug con
        el que se comparta el enlace (el slug es solo cosmético en la URL,
        no identifica la carrera)."""
        m = _RACE_URL_RE.search(url)
        if not m:
            return None
        evento, edicion = m.group(1), m.group(2)
        return f"{evento}-{edicion}"

    @staticmethod
    def _parse_race_url(url: str) -> tuple[str, str] | None:
        m = _RACE_URL_RE.search(url)
        if not m:
            return None
        return m.group(1), m.group(2)

    def list_photo_urls(
        self, url: str, max_photos: int | None = None, dorsal: str | None = None
    ) -> list[str]:
        """Devuelve las URLs de fotos de la carrera — del dorsal concreto
        si se da (atajo, ver docstring del módulo), o del álbum general
        completo si no.
        """
        parsed = self._parse_race_url(url)
        if not parsed:
            logger.warning("[chiplevante] URL no encaja con el patrón: %s", url)
            return []
        evento, edicion = parsed

        # "carrera" (modalidad: 10K, 5K, marcha...) no está en la URL —
        # igual que scrapeChiplevante en convex/scraper.ts, se prueban las
        # más comunes en orden hasta que una devuelva fotos. Solo se
        # combinan aquí porque el álbum general de una carrera puede vivir
        # bajo cualquier idCarrera, no solo la 1.
        carrera_ids = ["1", "2", "3", "4", "5"]

        if dorsal:
            for carrera in carrera_ids:
                urls = self._fetch_all_pages(evento, edicion, carrera, dorsal, max_photos)
                if urls:
                    logger.info(
                        "[chiplevante] Atajo por dorsal %s (carrera=%s): %d fotos",
                        dorsal, carrera, len(urls),
                    )
                    return urls
            logger.info(
                "[chiplevante] Atajo por dorsal %s sin fotos en ninguna modalidad probada, "
                "cayendo al álbum general",
                dorsal,
            )

        all_urls: list[str] = []
        for carrera in carrera_ids:
            urls = self._fetch_all_pages(evento, edicion, carrera, None, max_photos)
            all_urls.extend(urls)
            if max_photos and len(all_urls) >= max_photos:
                break
        logger.info(
            "[chiplevante] Álbum general evento=%s edicion=%s: %d fotos",
            evento, edicion, len(all_urls),
        )
        return all_urls[:max_photos] if max_photos else all_urls

    def _fetch_all_pages(
        self,
        evento: str,
        edicion: str,
        carrera: str,
        dorsal: str | None,
        max_photos: int | None,
    ) -> list[str]:
        """Pagina el endpoint dame_mm.php hasta que deje de incluir el botón
        "Mostrar más" (fin real del álbum, confirmado con una carrera real:
        22 páginas, la última con 12 de 24 fotos y sin el botón)."""
        session = self._get_session()
        all_urls: list[str] = []
        seen: set[str] = set()

        for page in range(_MAX_PAGES):
            try:
                resp = session.post(
                    "https://www.chiplevante.com/modulos/inc/dame_mm.php",
                    data={
                        "ev": evento,
                        "ed": edicion,
                        "cr": carrera,
                        "pc": "0",  # "Cualquier punto" — sin filtrar por control
                        "tp": "I",  # Imágenes (vs "V" de vídeos)
                        "dr": dorsal or "",
                        "ti": "",
                        "pag": str(page),
                    },
                    headers={
                        **DEFAULT_HEADERS,
                        "X-Requested-With": "XMLHttpRequest",
                    },
                    timeout=30,
                )
                resp.raise_for_status()
                body = resp.json()
            except Exception as e:  # noqa: BLE001
                logger.warning(
                    "[chiplevante] dame_mm.php falló (evento=%s carrera=%s pag=%d): %s",
                    evento, carrera, page, e,
                )
                break

            html = body.get("options", "")
            for href in _PHOTO_HREF_RE.findall(html):
                if href not in seen:
                    seen.add(href)
                    all_urls.append(
                        href if href.startswith("http") else f"https://www.chiplevante.com{href}"
                    )

            if max_photos and len(all_urls) >= max_photos:
                break
            if "btn-todo" not in html:
                break

        return all_urls
