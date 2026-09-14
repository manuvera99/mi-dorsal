"""Reconocimiento facial usando InsightFace.

Pipeline:
1. Carga el modelo buffalo_l (buen balance velocidad/precisión)
2. De las fotos de referencia extrae embeddings faciales
3. Para cada foto del álbum detecta caras y compara embeddings
4. Devuelve matches con score de similitud coseno

Usa ONNX Runtime por debajo (no requiere GPU para CPU-only).

Cache:
- Los embeddings de las fotos de referencia se cachean en
  ``.cache/face/<hash>.npy`` usando SHA-256 del contenido del fichero.
- Al añadir una referencia, si el cache existe se reutiliza (ahorra ~2-3s
  por foto de referencia en cada ejecucion).
"""

from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

import numpy as np

try:
    import insightface  # type: ignore[import-untyped]
    from insightface.app import FaceAnalysis  # type: ignore[import-untyped]
    HAS_INSIGHTFACE = True
except ImportError:  # pragma: no cover
    HAS_INSIGHTFACE = False

from .utils import load_image_rgb

logger = logging.getLogger(__name__)

DEFAULT_CACHE_DIR = Path("/tmp/findmyrace_cache/face")


def _file_hash(path: Path) -> str:
    """SHA-256 del contenido de un fichero (para cache de embeddings)."""
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()[:16]


@dataclass(frozen=True)
class FaceMatch:
    """Una coincidencia facial encontrada en una foto del álbum."""

    score: float  # 0.0 a 1.0, cuanto mayor más parecido
    bbox: tuple[int, int, int, int]  # x1, y1, x2, y2 de la cara
    age: int | None = None
    gender: str | None = None  # "M" o "F"


class FaceRecognizer:
    """Reconocedor facial basado en InsightFace.

    Uso:
        rec = FaceRecognizer()
        rec.add_reference(Path("mi_camiseta/foto.jpg"))
        rec.add_reference(Path("mi_camiseta/otra.jpg"))
        matches = rec.find_in(Path("album/foto.jpg"))
        if matches:
            print(f"Match con score {matches[0].score}")
    """

    def __init__(
        self,
        name: str = "buffalo_l",
        det_size: tuple[int, int] = (640, 640),
        cache_dir: Path | None = None,
    ) -> None:
        if not HAS_INSIGHTFACE:
            raise ImportError(
                "InsightFace no instalado. Ejecuta: pip install insightface onnxruntime"
            )
        logger.info("Cargando modelo InsightFace %s...", name)
        self._app = FaceAnalysis(name=name, allowed_modules=["detection", "recognition"])
        self._app.prepare(ctx_id=-1, det_size=det_size)  # CPU
        logger.info("InsightFace listo.")

        # Lista de embeddings de referencia (promediamos si hay varios)
        self._reference_embeddings: list[np.ndarray] = []
        # Cache en disco (None desactiva)
        self._cache_dir: Path | None = None
        if cache_dir is not None and cache_dir != Path():
            self._cache_dir = Path(cache_dir)
            self._cache_dir.mkdir(parents=True, exist_ok=True)

    def add_reference(self, image_path: Path) -> int:
        """Añade una foto de referencia y extrae el embedding facial.

        Si la foto de referencia tiene varias caras (p. ej. una foto de
        carrera con gente de fondo), solo se usa la cara con el bbox más
        grande — asumimos que es la persona en primer plano, que es quien
        nos interesa. Promediar todas las caras detectadas (incluyendo
        desconocidos de fondo) contamina el embedding de referencia y
        rompe el matching contra el álbum.

        Si el cache esta activo y el hash del fichero ya fue procesado,
        reutiliza el embedding guardado (no recarga el modelo sobre esa
        imagen).

        Devuelve 1 si se añadió una cara, 0 si no se detectó ninguna.
        """
        # 1) Intentar cargar del cache
        if self._cache_dir is not None:
            cache_path = self._cache_dir / f"{_file_hash(image_path)}.json"
            if cache_path.exists():
                try:
                    cached = json.loads(cache_path.read_text())
                    embeddings = cached.get("embeddings", [])
                    if embeddings:
                        self._reference_embeddings.append(
                            np.asarray(embeddings[0], dtype=np.float32)
                        )
                        logger.info("Cache hit: 1 cara de %s", image_path.name)
                        return 1
                except Exception as e:
                    logger.warning("Cache corrupto para %s: %s", image_path.name, e)

        # 2) Recalcular
        image = load_image_rgb(image_path)
        faces = self._app.get(image)
        if not faces:
            logger.warning("No se detectaron caras en %s", image_path)
            return 0

        # Si hay varias caras, quedarnos solo con la de mayor bbox
        # (asumimos que es la persona en primer plano).
        if len(faces) > 1:
            logger.info(
                "%s: %d caras detectadas, usando la de mayor tamaño (bbox)",
                image_path.name,
                len(faces),
            )
        main_face = max(
            faces,
            key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]),
        )
        self._reference_embeddings.append(main_face.normed_embedding)

        # 3) Guardar en cache
        if self._cache_dir is not None:
            try:
                cache_path = self._cache_dir / f"{_file_hash(image_path)}.json"
                payload = {
                    "source": str(image_path),
                    "embeddings": [main_face.normed_embedding.tolist()],
                }
                cache_path.write_text(json.dumps(payload))
            except Exception as e:
                logger.warning("No se pudo guardar cache para %s: %s", image_path.name, e)

        logger.info("Añadida 1 cara de %s", image_path.name)
        return 1

    @property
    def num_references(self) -> int:
        return len(self._reference_embeddings)

    def assess_reference(self, image_path: Path, role: str = "auto"):
        """Analiza la calidad de una foto ANTES de añadirla como referencia.

        Reutiliza el mismo modelo ya cargado (no crea una segunda instancia
        de InsightFace). Ver ``reference_quality.assess_reference_photo``
        para el detalle de qué se comprueba y por qué — validado
        empíricamente: la calidad de la foto de referencia es la palanca
        más barata para mejorar el reconocimiento (ver ese módulo).

        Uso típico: llamar a esto antes de ``add_reference`` para decidir
        si aceptar la foto o pedir otra al usuario.
        """
        from .reference_quality import assess_reference_photo

        return assess_reference_photo(image_path, self._app, role=role)

    def _centroid(self) -> np.ndarray:
        """Embedding promedio de las referencias (más robusto que uno solo)."""
        if not self._reference_embeddings:
            raise ValueError("No hay referencias cargadas")
        return np.mean(self._reference_embeddings, axis=0)

    def find_in(
        self,
        image_path: Path,
        threshold: float = 0.35,
        gray_zone: tuple[float, float] = (0.20, 0.35),
    ) -> list[FaceMatch]:
        """Busca la cara de referencia en una foto.

        Args:
            image_path: ruta a la foto del álbum.
            threshold: similitud mínima (0-1) para considerar match.
                InsightFace usa distancia coseno donde 1.0 = idéntico.
                0.35 es un buen umbral para "mismo persona, distinta foto".
            gray_zone: rango (min, max) de score donde el mejor match de la
                primera pasada es demasiado ambiguo para confiar ciegamente
                — se hace entonces una segunda pasada de "zoom" (recortar
                la región de la cara con padding y re-detectar solo ahí) y
                se usa el mejor de los dos scores. Validado empíricamente:
                en un álbum real de 250 fotos, solo 2 (0.8%) caían en esta
                zona — el coste extra es insignificante sobre el total,
                pero la mejora en esos casos límite es real (+0.03 en el
                mejor caso visto, nunca empeora porque se queda con el
                máximo). Pasar ``gray_zone=(0, 0)`` desactiva la segunda
                pasada.

        Returns:
            Lista de FaceMatch ordenada por score descendente.
        """
        if not self._reference_embeddings:
            return []

        try:
            image = load_image_rgb(image_path)
        except Exception as e:
            logger.error("Error cargando %s: %s", image_path, e)
            return []

        faces = self._app.get(image)
        if not faces:
            return []

        ref = self._centroid()
        matches = self._score_faces(faces, ref, threshold)

        # Segunda pasada ("zoom") si el mejor score cae en zona gris.
        gray_lo, gray_hi = gray_zone
        best_score = matches[0].score if matches else 0.0
        if gray_lo < gray_hi and gray_lo <= best_score <= gray_hi:
            zoomed = self._rescore_with_zoom(image, faces, ref, threshold)
            if zoomed:
                matches = sorted(matches + zoomed, key=lambda m: -m.score)

        return matches

    def _score_faces(
        self, faces: list, ref: np.ndarray, threshold: float
    ) -> list[FaceMatch]:
        """Compara cada cara detectada contra el embedding de referencia."""
        matches: list[FaceMatch] = []
        for face in faces:
            emb = face.normed_embedding
            # Similitud coseno (producto punto de vectores normalizados)
            sim = float(np.dot(ref, emb))
            if sim >= threshold:
                x1, y1, x2, y2 = [int(v) for v in face.bbox]
                matches.append(
                    FaceMatch(
                        score=sim,
                        bbox=(x1, y1, x2, y2),
                        age=int(face.age) if hasattr(face, "age") and face.age is not None else None,
                        gender="M" if getattr(face, "gender", None) == 1 else "F" if getattr(face, "gender", None) == 0 else None,
                    )
                )
        matches.sort(key=lambda m: -m.score)
        return matches

    def _rescore_with_zoom(
        self, image: np.ndarray, faces: list, ref: np.ndarray, threshold: float
    ) -> list[FaceMatch]:
        """Recorta alrededor de la mejor cara candidata (con padding) y
        re-ejecuta detección+reconocimiento solo en ese recorte.

        Sobre una imagen pequeña, InsightFace ve proporcionalmente más
        detalle de la cara sin necesidad de subir det_size en la imagen
        completa (que cuesta ~2x en tiempo, ver benchmark en
        docs/plans/PHOTO_SEARCH_TECH.md §14). El coste de esta llamada
        extra solo se paga cuando ya se decidió activarla (zona gris).
        """
        best_face = max(faces, key=lambda f: float(np.dot(ref, f.normed_embedding)))
        x1, y1, x2, y2 = best_face.bbox
        w, h = x2 - x1, y2 - y1
        pad_x, pad_y = w * 1.5, h * 1.5
        img_h, img_w = image.shape[:2]
        cx1, cy1 = max(0, int(x1 - pad_x)), max(0, int(y1 - pad_y))
        cx2, cy2 = min(img_w, int(x2 + pad_x)), min(img_h, int(y2 + pad_y))
        if cx2 <= cx1 or cy2 <= cy1:
            return []
        crop = image[cy1:cy2, cx1:cx2]

        try:
            zoomed_faces = self._app.get(crop)
        except Exception as e:  # noqa: BLE001
            logger.debug("Zoom re-detección falló: %s", e)
            return []
        if not zoomed_faces:
            return []

        # Las bbox del crop son relativas al crop, no a la imagen original
        # — las trasladamos de vuelta para que el bbox devuelto siga
        # siendo válido en la imagen completa (usado p. ej. para overlays).
        matches = self._score_faces(zoomed_faces, ref, threshold)
        return [
            FaceMatch(
                score=m.score,
                bbox=(m.bbox[0] + cx1, m.bbox[1] + cy1, m.bbox[2] + cx1, m.bbox[3] + cy1),
                age=m.age,
                gender=m.gender,
            )
            for m in matches
        ]


def is_available() -> bool:
    """True si InsightFace está instalado y usable."""
    return HAS_INSIGHTFACE
