"""Fuente para URLs directas o fichero de texto con una URL por línea.

Útil cuando:
- Tienes un link directo a una imagen (https://example.com/foto.jpg)
- Tienes un .txt con una URL por línea (links.txt)
- Quieres pegar a mano una lista de URLs
"""

from __future__ import annotations

import logging
from pathlib import Path

from .base import PhotoSource

logger = logging.getLogger(__name__)

_IMAGE_EXTENSIONS: frozenset[str] = frozenset(
    {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".tif", ".gif"}
)


class DirectUrlSource(PhotoSource):
    """Maneja URLs directas o ficheros de texto con listas de URLs."""

    name = "direct"

    def can_handle(self, url: str) -> bool:
        if url.lower().startswith(("http://", "https://")):
            # URL directa a una imagen
            if any(url.lower().split("?", 1)[0].endswith(ext) for ext in _IMAGE_EXTENSIONS):
                return True
            return False
        # O un fichero de texto local
        path = Path(url)
        if path.is_file() and path.suffix.lower() in {".txt", ".lst", ".urls", ".list"}:
            return True
        return False

    def list_photo_urls(self, url: str, max_photos: int | None = None) -> list[str]:
        if url.lower().startswith(("http://", "https://")):
            logger.info("[direct] Single URL: %s", url)
            urls = [url]
        else:
            # Fichero local
            path = Path(url)
            if not path.is_file():
                raise FileNotFoundError(f"Fichero no encontrado: {path}")
            urls = []
            for line in path.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                urls.append(line)
            logger.info("[direct] %d URLs leídas de %s", len(urls), path)

        if max_photos is not None:
            urls = urls[:max_photos]
        return urls
