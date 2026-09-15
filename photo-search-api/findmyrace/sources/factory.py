"""Factory: detecta qué fuente usar según la URL."""

from __future__ import annotations

import logging
from typing import Type

from .base import PhotoSource
from .chiplevante import ChipLevantePhotoSource
from .direct import DirectUrlSource
from .flickr import FlickrSource
from .grupobrotons import GrupoBrotonsPhotoSource

logger = logging.getLogger(__name__)

# Registro de fuentes disponibles. Orden = prioridad (la primera que acepte gana).
_SOURCE_REGISTRY: list[Type[PhotoSource]] = [
    FlickrSource,
    ChipLevantePhotoSource,
    GrupoBrotonsPhotoSource,
    DirectUrlSource,
]


def get_source_for_url(url: str) -> PhotoSource:
    """Devuelve la fuente adecuada para una URL.

    Lanza ValueError si ninguna fuente puede manejar la URL.
    """
    for source_cls in _SOURCE_REGISTRY:
        instance = source_cls()
        if instance.can_handle(url):
            logger.debug("URL '%s' -> fuente '%s'", url, instance.name)
            return instance

    supported = ", ".join(cls().name for cls in _SOURCE_REGISTRY)
    raise ValueError(
        f"Ninguna fuente soporta la URL: {url}\n"
        f"Fuentes disponibles: {supported}"
    )


def list_supported_sources() -> list[str]:
    """Devuelve la lista de nombres de fuentes soportadas."""
    return [cls().name for cls in _SOURCE_REGISTRY]
