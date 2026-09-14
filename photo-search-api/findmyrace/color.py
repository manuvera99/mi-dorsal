"""Extracción y matching de color de camiseta mediante histograma HSV.

Estrategia:
1. Recortar la región central del torso.
2. Calcular histograma HSV (Hue, Saturation, Value).
3. Comparar histogramas con cosine similarity.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

from .utils import crop_torso_region, load_image_rgb

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ColorHistogram:
    """Histograma HSV normalizado (L1)."""

    h: np.ndarray  # shape (bins,)
    s: np.ndarray
    v: np.ndarray
    bins: int

    def flatten(self) -> np.ndarray:
        """Concatena los 3 canales en un único vector 1D."""
        return np.concatenate([self.h, self.s, self.v])

    @staticmethod
    def cosine_similarity(a: "ColorHistogram", b: "ColorHistogram") -> float:
        """Similitud coseno entre dos histogramas (0.0 = nada similar, 1.0 = idéntico)."""
        va, vb = a.flatten(), b.flatten()
        denom = float(np.linalg.norm(va) * np.linalg.norm(vb))
        if denom == 0.0:
            return 0.0
        return float(np.dot(va, vb) / denom)


def compute_histogram(image: np.ndarray, bins: int = 32) -> ColorHistogram:
    """Calcula el histograma HSV normalizado para la región del torso.

    Calcula 3 histogramas 1D (uno por canal HSV) en vez de un histograma 3D.
    Es más simple, más rápido, y evita ambigüedades de slicing.
    """
    torso = crop_torso_region(image)
    hsv = cv2.cvtColor(torso, cv2.COLOR_RGB2HSV)

    # Rangos OpenCV: H=[0,180], S=[0,256], V=[0,256]
    ranges = [(0, 180), (0, 256), (0, 256)]

    h_hist = cv2.calcHist([hsv], channels=[0], mask=None, histSize=[bins], ranges=ranges[0]).flatten()
    s_hist = cv2.calcHist([hsv], channels=[1], mask=None, histSize=[bins], ranges=ranges[1]).flatten()
    v_hist = cv2.calcHist([hsv], channels=[2], mask=None, histSize=[bins], ranges=ranges[2]).flatten()

    # L1-normalize cada uno
    h_hist = h_hist / (h_hist.sum() + 1e-10)
    s_hist = s_hist / (s_hist.sum() + 1e-10)
    v_hist = v_hist / (v_hist.sum() + 1e-10)

    return ColorHistogram(h=h_hist, s=s_hist, v=v_hist, bins=bins)


def describe_color_name(hsv_pixel: tuple[int, int, int]) -> str:
    """Mapeo muy simple H → nombre de color en español. Útil para debug/UI."""
    h, s, v = hsv_pixel
    if v < 50:
        return "negro"
    if s < 40:
        return "blanco" if v > 200 else "gris"
    # Hue está en [0, 180] en OpenCV
    if h < 10 or h >= 170:
        return "rojo"
    if h < 25:
        return "naranja"
    if h < 35:
        return "amarillo"
    if h < 85:
        return "verde"
    if h < 100:
        return "cian"
    if h < 130:
        return "azul"
    if h < 150:
        return "violeta"
    return "rosa"


class ColorMatcher:
    """Compara el color de la camiseta objetivo contra el de cada foto."""

    def __init__(self, bins: int = 32) -> None:
        self.bins = bins
        logger.info("ColorMatcher inicializado (bins=%d)", bins)

    def extract_reference(self, image_path: Path) -> ColorHistogram:
        """Extrae histograma de la foto de referencia del usuario."""
        image = load_image_rgb(image_path)
        return compute_histogram(image, bins=self.bins)

    def match(self, image_path: Path, reference: ColorHistogram) -> float:
        """Devuelve similitud coseno [0, 1] entre la camiseta de la foto y la referencia."""
        image = load_image_rgb(image_path)
        hist = compute_histogram(image, bins=self.bins)
        return ColorHistogram.cosine_similarity(hist, reference)
