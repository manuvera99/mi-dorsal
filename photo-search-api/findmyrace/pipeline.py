"""Pipeline end-to-end: orquesta detección + matching sobre todo el álbum.

Uso típico:
    pipeline = Pipeline()
    results = pipeline.run(album=Path("./album"), dorsal="4827", color_ref=hist)
    for ps in results[:10]:
        print(ps.score, ps.path)
"""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Callable, Sequence

from tqdm import tqdm

from .color import ColorHistogram, ColorMatcher
from .config import get_settings
from .face import FaceRecognizer
from .matcher import Matcher, MatcherWeights, PhotoScore
from .ocr import DorsalDetector
from .utils import iter_images

logger = logging.getLogger(__name__)


class Pipeline:
    """Ejecuta el flujo completo sobre una carpeta de fotos."""

    def __init__(
        self,
        dorsal_detector: DorsalDetector | None = None,
        color_matcher: ColorMatcher | None = None,
        face_recognizer: FaceRecognizer | None = None,
        weights: MatcherWeights | None = None,
        max_workers: int | None = None,
    ) -> None:
        settings = get_settings()
        self.dorsal = dorsal_detector or DorsalDetector(
            languages=settings.ocr_languages, gpu=settings.ocr_gpu
        )
        self.color = color_matcher or ColorMatcher(bins=settings.color_bins)
        self.face = face_recognizer
        self.matcher = Matcher(
            self.dorsal, self.color, face_recognizer=face_recognizer, weights=weights
        )
        self.max_workers = max_workers or settings.max_workers
        # Fotos omitidas por max_images en la última llamada a run() — 0 si
        # no se omitió ninguna o si run() no se ha llamado todavía. Atributo
        # simple en vez de cambiar la firma de retorno de run() (que sigue
        # siendo list[PhotoScore] para no romper callers existentes, p. ej.
        # find-my-race/src/findmyrace/cli.py).
        self.last_run_omitted = 0

    def run(
        self,
        album: Path | None = None,
        target_dorsal: str = "",
        color_reference: ColorHistogram | None = None,
        min_score: float = 0.0,
        top_k: int | None = None,
        recursive: bool = True,
        progress_callback: Callable[[int, int, PhotoScore | None], None] | None = None,
        include_identity_matches: bool = True,
        max_images: int | None = None,
        image_paths: Sequence[Path] | None = None,
    ) -> list[PhotoScore]:
        """Procesa todas las fotos del álbum y devuelve resultados ordenados.

        Args:
            album: carpeta con las fotos — se recorre con ``iter_images``.
                Ignorado si se da ``image_paths``. Debe darse uno de los
                dos (``album`` o ``image_paths``).
            target_dorsal: número de dorsal a buscar.
            color_reference: histograma de la camiseta (opcional en MVP1).
            min_score: descarta fotos con score combinado (cara+dorsal+color)
                < min_score. Este umbral es sobre "cuán completo es el
                match", NO sobre "es esta persona" — ese segundo criterio es
                el gate de cara (ver matcher.FACE_GATE_THRESHOLD) y ya se
                aplicó antes de llegar aquí (score=0.0 si no pasa el gate).
            top_k: si se da, devuelve solo los K mejores.
            recursive: buscar fotos en subcarpetas.
            progress_callback: si se da, se llama con ``(current, total, photo_score)``
                tras cada foto. ``photo_score`` es None si esa foto falló.
            include_identity_matches: si True (default), una foto con
                identidad confirmada (pasó el gate de cara) se incluye
                siempre, aunque su score combinado quede por debajo de
                min_score — p. ej. el dorsal no se detectó en esa foto
                concreta pero la cara sí es un match claro. Antes de esto,
                esas fotos se perdían silenciosamente: se confirmó con un
                caso real (cara=0.32, sin dorsal detectado -> score
                combinado 0.19, por debajo de un min_score=0.3 típico) que
                era la persona correcta y no aparecía en los resultados.
                Pon False para el comportamiento antiguo (un único filtro
                sobre el score combinado, sin excepción para identidad).
            max_images: si se da, procesa como máximo esta cantidad de
                fotos (las primeras `max_images` de `iter_images`, que
                itera ordenado — ver findmyrace/utils.py). Protección real
                contra timeouts del caller (Vercel/Modal): sin esto, un
                caller que junte varios álbumes grandes (ver
                photo-search-api/api/find_photos.py, selector de álbumes
                de perfil) puede acumular miles de fotos y agotar el
                timeout de la plataforma a mitad del matching, sin devolver
                ningún resultado — confirmado en producción: 1044 fotos
                agotó un timeout de 600s al 95% sin responder nada. Con
                este límite, el job siempre termina y devuelve lo que pudo
                analizar, dejando claro en el log cuántas se omitieron.
            image_paths: si se da, se procesan exactamente estas rutas en
                vez de recorrer ``album`` con ``iter_images`` — necesario
                cuando las fotos de una búsqueda no viven todas bajo una
                única carpeta raíz (p. ej. api/find_photos.py: con la
                caché de álbumes de Modal, ver api/album_cache.py, cada
                álbum puede vivir en una carpeta persistente distinta,
                fuera del directorio temporal de la búsqueda). El orden
                de la lista importa para `max_images` (se procesan las
                primeras) — el caller es responsable de un orden
                determinista si eso le importa.

        Returns:
            Lista de PhotoScore ordenada por score descendente.
        """
        if image_paths is not None:
            all_image_paths = list(image_paths)
        else:
            if album is None:
                raise ValueError("Se debe dar `album` o `image_paths`")
            all_image_paths = list(iter_images(album, recursive=recursive))
        if not all_image_paths:
            logger.warning("Álbum vacío: %s", album)
            return []

        image_paths = all_image_paths
        self.last_run_omitted = 0
        if max_images is not None and len(all_image_paths) > max_images:
            self.last_run_omitted = len(all_image_paths) - max_images
            image_paths = all_image_paths[:max_images]
            logger.warning(
                "Álbum con %d fotos supera max_images=%d — se analizan solo las "
                "primeras %d, %d omitidas para no agotar el timeout de la plataforma",
                len(all_image_paths),
                max_images,
                max_images,
                self.last_run_omitted,
            )

        logger.info(
            "Procesando %d fotos de %s (workers=%d, dorsal='%s', color=%s)",
            len(image_paths),
            album,
            self.max_workers,
            target_dorsal,
            color_reference is not None,
        )

        results: list[PhotoScore] = []
        completed = 0
        total = len(image_paths)
        with ThreadPoolExecutor(max_workers=self.max_workers) as ex:
            futures = {
                ex.submit(
                    self.matcher.score_photo, path, target_dorsal, color_reference
                ): path
                for path in image_paths
            }
            with tqdm(total=total, desc="Analizando", unit="foto") as bar:
                for fut in as_completed(futures):
                    ps: PhotoScore | None = None
                    try:
                        ps = fut.result()
                    except Exception as e:  # noqa: BLE001 - queremos no romper el batch
                        logger.exception("Error procesando %s: %s", futures[fut], e)
                    else:
                        keep = ps.score >= min_score or (
                            include_identity_matches and ps.identity_confirmed
                        )
                        if keep:
                            results.append(ps)
                    bar.update(1)
                    completed += 1
                    if progress_callback is not None:
                        try:
                            progress_callback(completed, total, ps)
                        except Exception:  # noqa: BLE001
                            # el callback no debe romper el pipeline
                            logger.exception("progress_callback fallo; se ignora")

        results.sort()
        if top_k is not None:
            results = results[:top_k]
        logger.info("Devolviendo %d resultados (top_k=%s)", len(results), top_k)
        return results


def filter_results(
    results: Sequence[PhotoScore],
    min_score: float = 0.0,
    include_identity_matches: bool = True,
) -> list[PhotoScore]:
    """Filtra por score mínimo preservando el orden.

    Ver ``Pipeline.run`` para la semántica de ``include_identity_matches``:
    una foto con identidad confirmada (gate de cara superado) no se
    descarta aunque su score combinado esté por debajo de min_score.
    """
    return [
        r
        for r in results
        if r.score >= min_score or (include_identity_matches and r.identity_confirmed)
    ]
