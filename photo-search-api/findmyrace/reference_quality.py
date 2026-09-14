"""Pre-score de calidad de las fotos de referencia (selfies) que sube el usuario.

Objetivo: antes de aceptar una selfie como referencia para la búsqueda,
avisar (o bloquear) si tiene problemas que sabemos que degradan el
matching — validado empíricamente: en una prueba real, sustituir 4 fotos
de referencia "de carrera" (pequeñas, con gente detrás) por 6 selfies
limpios subió el score de las mismas 3 fotos objetivo de 0.29-0.35 a
0.57-0.59 (casi el doble) — la calidad de la referencia es, con mucho, la
palanca más barata para mejorar el reconocimiento.

Señales usadas (todas ya disponibles vía InsightFace, sin modelos nuevos):
- det_score: confianza de detección de InsightFace.
- área relativa del bbox: ¿la cara es lo bastante grande en la foto?
- yaw_ratio: asimetría de los 5 keypoints (ojo-nariz-ojo) -> ¿de frente o
  de perfil? Confirmado con fotos reales: ~0.03 en frontales, ~0.97 en
  perfil marcado.
- nitidez (varianza del Laplaciano sobre el recorte de cara): ¿borrosa?
- número de caras detectadas: ¿hay más de una persona en la foto?
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

import cv2
import numpy as np

from .utils import load_image_rgb

logger = logging.getLogger(__name__)

# Rol declarado de la foto:
# - "frontal": se exige que sea razonablemente de frente (se rechaza un
#   perfil marcado).
# - "lateral": el ángulo NO se evalúa — un perfil marcado es justo lo que
#   se pide en este rol. Sigue validando tamaño/nitidez/detección.
# - "auto": sin rol declarado, se avisa (no se rechaza) si es un perfil muy
#   marcado — comportamiento para cuando el flujo no distingue roles.
ReferenceRole = Literal["frontal", "lateral", "auto"]

# Umbrales calibrados con selfies reales (ver docstring del módulo) y con
# margen para no ser demasiado estrictos con selfies a distancia normal
# (no solo primeros planos extremos como los de la prueba).
MIN_DET_SCORE = 0.5  # por debajo de esto, es dudoso que sea una cara real
MIN_FACE_AREA_RATIO = 0.02  # cara debe ocupar al menos ~2% de la imagen
GOOD_FACE_AREA_RATIO = 0.08  # por encima de esto, tamaño claramente bueno
MAX_YAW_FRONTAL = 0.35  # |yaw_ratio| por debajo de esto = "de frente"
MAX_YAW_ACCEPTABLE = 0.75  # por encima de esto, perfil demasiado marcado
MIN_SHARPNESS = 60.0  # varianza del Laplaciano; por debajo, sospechoso de borrosa
GOOD_SHARPNESS = 150.0


@dataclass
class ReferenceQuality:
    """Resultado del análisis de calidad de una foto de referencia."""

    # "ok": lista para usar. "warn": se puede usar, pero con reservas
    # (avisar al usuario). "reject": no debe aceptarse sin que el usuario
    # suba otra foto.
    verdict: str
    reasons: list[str] = field(default_factory=list)
    det_score: float | None = None
    face_area_ratio: float | None = None
    yaw_ratio: float | None = None
    sharpness: float | None = None
    num_faces: int = 0
    is_frontal: bool = False

    @property
    def ok(self) -> bool:
        return self.verdict == "ok"

    @property
    def rejected(self) -> bool:
        return self.verdict == "reject"


def _compute_yaw_ratio(kps: np.ndarray) -> float:
    """Estima el ángulo horizontal de la cara a partir de los 5 keypoints.

    kps = [ojo_izq, ojo_der, nariz, boca_izq, boca_der] (coords de imagen).
    Compara la distancia horizontal nariz-ojo_izq vs nariz-ojo_der: si son
    iguales, la cara está de frente (ratio ~0). Si una es mucho menor que
    la otra, la cara está girada hacia ese lado (ratio -> ±1).
    """
    eye_l, eye_r, nose = kps[0], kps[1], kps[2]
    d_left = abs(nose[0] - eye_l[0])
    d_right = abs(eye_r[0] - nose[0])
    total = d_left + d_right
    if total == 0:
        return 0.0
    return float((d_right - d_left) / total)


def _sharpness_score(image_rgb: np.ndarray, bbox: tuple[int, int, int, int]) -> float:
    """Varianza del Laplaciano sobre el recorte de cara (proxy de nitidez)."""
    x1, y1, x2, y2 = bbox
    h, w = image_rgb.shape[:2]
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(w, x2), min(h, y2)
    if x2 <= x1 or y2 <= y1:
        return 0.0
    crop = image_rgb[y1:y2, x1:x2]
    gray = cv2.cvtColor(crop, cv2.COLOR_RGB2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def assess_reference_photo(
    image_path: Path, face_app, role: ReferenceRole = "auto"
) -> ReferenceQuality:
    """Analiza una foto de referencia y devuelve un veredicto de calidad.

    Args:
        image_path: ruta a la selfie subida por el usuario.
        face_app: instancia de ``insightface.app.FaceAnalysis`` ya
            preparada (se reutiliza la misma que usa ``FaceRecognizer``,
            para no cargar el modelo dos veces).
        role: qué se espera de esta foto — ver ``ReferenceRole``. Un
            perfil marcado es un rechazo si ``role="frontal"``, pero es
            exactamente lo esperado (sin penalizar el ángulo) si
            ``role="lateral"``.

    Returns:
        ReferenceQuality con verdict "ok" | "warn" | "reject".
    """
    try:
        image = load_image_rgb(image_path)
    except Exception as e:  # noqa: BLE001
        return ReferenceQuality(
            verdict="reject",
            reasons=[f"No se pudo abrir la imagen: {e}"],
        )

    faces = face_app.get(image)
    if not faces:
        return ReferenceQuality(
            verdict="reject",
            reasons=["No se detectó ninguna cara en la foto"],
            num_faces=0,
        )

    main = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
    img_h, img_w = image.shape[:2]
    bbox_area = (main.bbox[2] - main.bbox[0]) * (main.bbox[3] - main.bbox[1])
    face_area_ratio = float(bbox_area / (img_w * img_h))
    yaw_ratio = _compute_yaw_ratio(main.kps)
    sharpness = _sharpness_score(image, tuple(int(v) for v in main.bbox))
    det_score = float(main.det_score)
    is_frontal = abs(yaw_ratio) <= MAX_YAW_FRONTAL

    reasons: list[str] = []
    verdict = "ok"

    # --- Condiciones de rechazo duro ---
    if det_score < MIN_DET_SCORE:
        verdict = "reject"
        reasons.append(
            f"Confianza de detección baja ({det_score:.2f}) — puede que no sea una cara clara"
        )
    if face_area_ratio < MIN_FACE_AREA_RATIO:
        verdict = "reject"
        reasons.append(
            "La cara es demasiado pequeña en la foto — acércate más o recorta la imagen"
        )
    if sharpness < MIN_SHARPNESS:
        verdict = "reject"
        reasons.append("La foto está borrosa o movida")

    # El ángulo solo se evalúa si el rol lo pide. Un rol "lateral" está
    # pidiendo justo un perfil marcado — no tiene sentido rechazarlo por
    # eso. Confirmado con selfies reales: perfiles genuinos dan
    # yaw_ratio ≈ ±0.97, muy por encima de MAX_YAW_ACCEPTABLE (0.75), así
    # que sin esta distinción el propio flujo de "sube frontal + lateral"
    # rechazaría la foto lateral que se está pidiendo.
    if role == "frontal" and abs(yaw_ratio) > MAX_YAW_ACCEPTABLE:
        verdict = "reject"
        reasons.append("Esta foto no parece de frente — sube una foto mirando a cámara")
    elif role == "auto" and abs(yaw_ratio) > MAX_YAW_ACCEPTABLE:
        verdict = "reject"
        reasons.append("Ángulo de perfil demasiado marcado — usa una foto más de frente")
    # role == "lateral": sin chequeo de ángulo.

    # --- Avisos (no bloquean si no hay ya un reject) ---
    if verdict != "reject":
        if len(faces) > 1:
            verdict = "warn"
            reasons.append(
                f"Se detectaron {len(faces)} caras en la foto — se usará la más grande. "
                "Mejor sube una foto donde solo aparezcas tú."
            )
        if face_area_ratio < GOOD_FACE_AREA_RATIO:
            verdict = "warn"
            reasons.append("La cara podría ser más grande para un mejor resultado")
        if sharpness < GOOD_SHARPNESS:
            verdict = "warn"
            reasons.append("La nitidez es aceptable pero no óptima")
        if role == "frontal" and not is_frontal:
            verdict = "warn"
            reasons.append("Esta foto no está muy de frente — si puedes, prueba con otra más frontal")
        elif role == "auto" and not is_frontal and abs(yaw_ratio) <= MAX_YAW_ACCEPTABLE:
            verdict = "warn"
            reasons.append("Foto de perfil — recomendamos también subir una foto de frente")

    return ReferenceQuality(
        verdict=verdict,
        reasons=reasons,
        det_score=det_score,
        face_area_ratio=face_area_ratio,
        yaw_ratio=yaw_ratio,
        sharpness=sharpness,
        num_faces=len(faces),
        is_frontal=is_frontal,
    )
