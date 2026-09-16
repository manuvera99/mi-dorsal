"""Módulo de fuentes de fotos: Flickr, URLs directas, etc.

Permite pasar una URL al CLI y que la app descargue el álbum automáticamente.
"""

from __future__ import annotations

from .base import PhotoSource
from .chiplevante import ChipLevantePhotoSource
from .direct import DirectUrlSource
from .factory import get_source_for_url, list_supported_sources
from .flickr import FlickrSource
from .grupobrotons import GrupoBrotonsPhotoSource
from .lumepic import LumepicPhotoSource

__all__ = [
    "PhotoSource",
    "FlickrSource",
    "ChipLevantePhotoSource",
    "GrupoBrotonsPhotoSource",
    "LumepicPhotoSource",
    "DirectUrlSource",
    "get_source_for_url",
    "list_supported_sources",
]
