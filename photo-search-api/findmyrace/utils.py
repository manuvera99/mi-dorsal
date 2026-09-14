"""Utilidades de carga de imágenes e IO."""

from __future__ import annotations

import hashlib
import logging
from collections.abc import Iterator
from pathlib import Path

import cv2
import numpy as np

logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS: frozenset[str] = frozenset(
    {".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tiff", ".tif"}
)


def is_image(path: Path) -> bool:
    """True si el archivo tiene una extensión de imagen soportada."""
    return path.suffix.lower() in SUPPORTED_EXTENSIONS


def iter_images(folder: Path, recursive: bool = True) -> Iterator[Path]:
    """Itera sobre las imágenes válidas dentro de una carpeta, ordenadas."""
    if not folder.exists():
        raise FileNotFoundError(f"Carpeta no encontrada: {folder}")
    if not folder.is_dir():
        raise NotADirectoryError(f"No es un directorio: {folder}")

    pattern = "**/*" if recursive else "*"
    for path in sorted(folder.glob(pattern)):
        if path.is_file() and is_image(path):
            yield path


def load_image_rgb(path: Path) -> np.ndarray:
    """Carga una imagen y la devuelve como array RGB (H, W, 3)."""
    img = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError(f"No se pudo cargar la imagen: {path}")
    return cv2.cvtColor(img, cv2.COLOR_BGR2RGB)


def crop_torso_region(image: np.ndarray) -> np.ndarray:
    """Recorta la región donde suele estar el dorsal.

    En trail running y carreras populares el dorsal suele ir en la zona
    abdominal-pierna, desde aprox. el pecho/barriga hasta la parte alta
    de la pantorrilla (30%-80% vertical). Esto cubre los dorsales que
    cuelgan del pantalón (los más comunes en trail) sin procesar las
    piernas completas (que ralentiza el OCR sin aportar info útil).
    """
    h, w = image.shape[:2]
    top = int(h * 0.30)
    bottom = int(h * 0.80)
    return image[top:bottom, :]


def file_md5(path: Path, chunk_size: int = 65536) -> str:
    """Hash MD5 rápido del contenido del archivo (para caching)."""
    md5 = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(chunk_size), b""):
            md5.update(chunk)
    return md5.hexdigest()


def ensure_dir(path: Path) -> Path:
    """Crea el directorio si no existe y lo devuelve."""
    path.mkdir(parents=True, exist_ok=True)
    return path
