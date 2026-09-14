"""Motor de scoring combinado.

Une las señales (dorsal, color, cara) en una puntuación final por foto.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path

from .color import ColorHistogram, ColorMatcher
from .face import FaceMatch, FaceRecognizer, is_available as face_available
from .ocr import DorsalDetector, DorsalMatch

logger = logging.getLogger(__name__)

# Umbral del gate de cara: por debajo de esto, la foto se descarta aunque
# tenga dorsal/color coincidentes. Se pasa explícitamente a
# FaceRecognizer.find_in() (cuyo propio default es 0.35) para que ambos
# coincidan siempre — antes de este fix, find_in() filtraba internamente a
# 0.35 antes de que este gate pudiera evaluar nada por debajo de eso, así
# que el umbral real efectivo era 0.35, no 0.30 (bug confirmado con un
# positivo conocido real: score 0.317, se perdía por el filtro interno de
# find_in aunque debería haber pasado el gate de 0.30 documentado aquí).
FACE_GATE_THRESHOLD = 0.30


@dataclass
class PhotoScore:
    """Puntuación de una foto contra los criterios de búsqueda.

    ``identity_confirmed`` separa dos preguntas distintas que antes vivían
    fundidas en un único ``score``: "¿es esta persona?" (gate de cara, ver
    FACE_GATE_THRESHOLD) vs. "¿cuán completo es el match?" (score combinado
    cara+dorsal+color). Una foto puede tener identidad confirmada con score
    bajo (p. ej. el dorsal no se detectó en esa foto) — antes esas fotos se
    perdían silenciosamente si ``min_score`` (pensado para filtrar ruido)
    quedaba por encima del score combinado, aunque la persona SÍ apareciera
    en la foto. Confirmado con un caso real: cara=0.32 (pasa el gate 0.30),
    sin dorsal detectado -> score combinado 0.19, por debajo de un
    min_score=0.3 típico.
    """

    path: Path
    dorsal: DorsalMatch | None = None
    color_similarity: float = 0.0
    face: FaceMatch | None = None
    score: float = 0.0
    identity_confirmed: bool = False
    reasons: list[str] = field(default_factory=list)

    def __lt__(self, other: "PhotoScore") -> bool:
        # Mayor score = mejor; ordenamos descendente
        return self.score > other.score

    def color_reference_used(self) -> bool:
        """True si se proporciono referencia de color (independiente del valor)."""
        return self.color_similarity > 0 or any("color_sim" in r for r in self.reasons)


@dataclass(frozen=True)
class MatcherWeights:
    """Pesos de cada señal. La cara es la senal principal (gate + dominante).

    Cara es siempre obligatoria: si no hay match de cara, la foto queda excluida.
    Dorsal y color son senales adicionales que anaden bonus al score cuando estan
    disponibles y matchean.
    """

    face: float = 0.6  # principal (gate + base)
    dorsal: float = 0.25  # bonus cuando hay match
    color: float = 0.15  # bonus cuando hay match

    def __post_init__(self) -> None:
        total = self.face + self.dorsal + self.color
        if abs(total - 1.0) > 0.01:
            logger.warning("MatcherWeights no suman 1.0 (total=%.2f)", total)

    def without_face(self) -> "MatcherWeights":
        """Pesos para cuando NO hay cara configurada (re-normaliza)."""
        total = self.dorsal + self.color
        if total == 0:
            return MatcherWeights(face=0.0, dorsal=1.0, color=0.0)
        return MatcherWeights(
            face=0.0,
            dorsal=self.dorsal / total,
            color=self.color / total,
        )


class Matcher:
    """Calcula la puntuación de cada foto combinando todas las señales disponibles."""

    def __init__(
        self,
        dorsal_detector: DorsalDetector,
        color_matcher: ColorMatcher,
        face_recognizer: FaceRecognizer | None = None,
        weights: MatcherWeights | None = None,
    ) -> None:
        self.dorsal = dorsal_detector
        self.color = color_matcher
        self.face = face_recognizer
        self.weights = weights or MatcherWeights()
        # Si no hay cara, re-normalizamos los pesos
        if self.face is None or self.face.num_references == 0:
            self.weights = self.weights.without_face()

    def score_photo(
        self,
        image_path: Path,
        target_dorsal: str,
        color_reference: ColorHistogram | None,
    ) -> PhotoScore:
        """Evalúa una foto y devuelve su PhotoScore.

        Estrategia: cara como GATE, dorsal y color como BONUS.
        - Si no hay match de cara (o no hay cara configurada), la foto queda excluida.
        - Si hay match de cara, se calcula el score como suma ponderada:
          face * 0.6 + dorsal * 0.25 + color * 0.15
        - Dorsal y color solo suman si matchean (no restan si no matchean).
        """
        # 1) Cara (siempre, si esta configurada)
        face_match: FaceMatch | None = None
        face_score = 0.0
        if self.face is not None and self.face.num_references > 0:
            matches = self.face.find_in(image_path, threshold=FACE_GATE_THRESHOLD)
            if matches:
                face_match = matches[0]
                face_score = matches[0].score

        # Gate: si no hay match de cara, no es la persona
        if self.face is not None and self.face.num_references > 0 and face_score < FACE_GATE_THRESHOLD:
            return PhotoScore(
                path=image_path,
                face=None,
                score=0.0,
                reasons=["sin match de cara (gate)"],
            )

        # 2) Base: cara (peso dominante)
        score = self.weights.face * face_score

        # 3) Bonus: dorsal (si hay match)
        dorsal_match: DorsalMatch | None = None
        if target_dorsal:
            dorsal_match = self.dorsal.detect(image_path, target_dorsal)
            if dorsal_match is not None:
                dorsal_score = (
                    1.0 if dorsal_match.is_exact(target_dorsal) else 0.6
                )
                score += self.weights.dorsal * dorsal_score

        # 4) Bonus: color (si hay referencia)
        color_sim = 0.0
        if color_reference is not None:
            color_sim = self.color.match(image_path, color_reference)
            # Solo suma si supera un umbral (sino podria meter ruido)
            if color_sim > 0.4:
                score += self.weights.color * color_sim

        # Razones legibles
        reasons: list[str] = []
        if face_match is not None:
            reasons.append(f"cara={face_match.score:.2f}")
        if dorsal_match is not None:
            reasons.append(f"dorsal='{dorsal_match.text}' ({dorsal_match.confidence:.2f})")
        if color_reference is not None:
            reasons.append(f"color_sim={color_sim:.2f}")

        return PhotoScore(
            path=image_path,
            dorsal=dorsal_match,
            color_similarity=color_sim,
            face=face_match,
            score=score,
            # Identidad confirmada si pasó el gate de cara (face_match no es
            # None). Independiente del score combinado — una foto puede
            # tener identidad confirmada con score bajo si el dorsal/color
            # no matchean en esa foto concreta.
            identity_confirmed=face_match is not None,
            reasons=reasons,
        )
