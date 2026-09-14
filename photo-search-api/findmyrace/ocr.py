"""Detección de dorsales mediante OCR (EasyOCR).

Estrategia:
1. Recortar la región del torso (donde suele estar el dorsal).
2. Pasar a EasyOCR y obtener todos los candidatos numéricos.
3. Comparar contra el dorsal objetivo: coincidencia exacta, luego fuzzy (Levenshtein).
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import easyocr  # type: ignore[import-untyped]
import numpy as np

from .utils import crop_torso_region, load_image_rgb

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class DorsalMatch:
    """Candidato a dorsal detectado en una foto."""

    text: str
    confidence: float
    bbox: tuple[int, int, int, int]  # x1, y1, x2, y2 (en coords de la imagen recortada)

    def is_exact(self, target: str) -> bool:
        return self.text == target

    def is_fuzzy(self, target: str, tolerance: int = 1) -> bool:
        """Match con tolerancia de dígitos (edición)."""
        if self.text == target:
            return True
        if abs(len(self.text) - len(target)) > tolerance:
            return False
        return _levenshtein(self.text, target) <= tolerance

    def to_dict(self) -> dict[str, Any]:
        return {
            "text": self.text,
            "confidence": self.confidence,
            "bbox": self.bbox,
        }


def _levenshtein(a: str, b: str) -> int:
    """Distancia de Levenshtein entre dos strings (iterativa, O(min(a,b)) memoria)."""
    if len(a) < len(b):
        a, b = b, a
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        curr = [i]
        for j, cb in enumerate(b, 1):
            ins = prev[j] + 1
            dele = curr[j - 1] + 1
            sub = prev[j - 1] + (ca != cb)
            curr.append(min(ins, dele, sub))
        prev = curr
    return prev[-1]


def _clean_numeric(text: str) -> str:
    """Deja solo dígitos. Útil porque OCR a veces devuelve '1O34' en vez de '1034'."""
    return re.sub(r"[^0-9]", "", text)


class DorsalDetector:
    """Detecta dorsales en fotos de carrera usando EasyOCR."""

    def __init__(self, languages: list[str] | tuple[str, ...] | None = None, gpu: bool = False) -> None:
        langs = list(languages) if languages else ["en", "es"]
        logger.info("Cargando EasyOCR (langs=%s, gpu=%s)...", langs, gpu)
        # EasyOCR descarga modelos en la primera ejecución
        self._reader: easyocr.Reader = easyocr.Reader(langs, gpu=gpu)
        logger.info("EasyOCR listo.")

    def _detect_raw(self, image: np.ndarray) -> list[DorsalMatch]:
        """Ejecuta OCR sobre la región del torso y devuelve candidatos numéricos."""
        torso = crop_torso_region(image)
        results = self._reader.readtext(torso, detail=1, paragraph=False)

        candidates: list[DorsalMatch] = []
        for bbox, text, conf in results:
            clean = _clean_numeric(text)
            if len(clean) < 2:  # descartamos ruido (1 dígito suelto)
                continue
            (x1, _y1), (x2, _y2) = bbox[0], bbox[2]
            candidates.append(
                DorsalMatch(
                    text=clean,
                    confidence=float(conf),
                    bbox=(int(x1), int(_y1), int(x2), int(_y2)),
                )
            )
        return candidates

    def detect(self, image_path: Path, target_dorsal: str) -> DorsalMatch | None:
        """Devuelve el mejor match si el dorsal objetivo aparece en la foto.

        Prioridad: exacto > fuzzy (±1 dígito) > None.
        """
        image = load_image_rgb(image_path)
        candidates = self._detect_raw(image)

        for cand in candidates:
            if cand.is_exact(target_dorsal):
                logger.debug("%s → match exacto '%s'", image_path.name, cand.text)
                return cand
        for cand in candidates:
            if cand.is_fuzzy(target_dorsal):
                logger.debug("%s → match fuzzy '%s' (target %s)", image_path.name, cand.text, target_dorsal)
                return cand
        return None

    def detect_all(self, image_path: Path) -> list[DorsalMatch]:
        """Devuelve todos los dorsales candidatos detectados (sin filtrar por target)."""
        image = load_image_rgb(image_path)
        return self._detect_raw(image)
