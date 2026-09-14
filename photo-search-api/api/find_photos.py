"""Endpoint real de "Encuentra tus fotos" — Vercel Function (Python, FastAPI).

Sustituye al pseudocódigo de docs/plans/PHOTO_SEARCH_TECH.md §6.2 (que
asumía Modal). Primera plataforma a probar según decisión explícita del
14 sep 2026: "primero con Vercel, si no funciona probamos con Modal" — ver
§15.7 de ese documento para el detalle de la comparación y por qué.

Diseño (sin GPU, sin disco persistente — son las dos limitaciones reales
de Vercel Functions frente a Modal):

- **Sin jobs en background**: a diferencia de find-my-race/backend/api.py
  (que mantenía un registro de jobs en memoria + SSE), aquí una sola
  petición POST hace todo el trabajo síncronamente y devuelve el
  resultado final. Vercel Functions no garantiza que la misma instancia
  siga viva entre peticiones, así que un diseño de "crear job, consultar
  progreso después" no es viable sin un store externo (Convex, en este
  caso) — se deja para una iteración futura si el tiempo de respuesta lo
  exige.
- **Todo en /tmp**: es el único directorio escribible en Vercel Functions,
  y es efímero (no persiste entre invocaciones, no se comparte entre
  instancias). El caché de embeddings de referencia entre búsquedas
  distintas de find-my-race NO aplica aquí — cada petición vuelve a
  calcularlo, coste añadido pequeño (unos ms) pero real.
- **Selfies vía URL firmada**: el caller (Convex) sube las selfies a
  Convex File Storage y pasa URLs firmadas temporales — igual que asumía
  el pseudocódigo de Modal. Esta función las descarga, nunca las recibe
  como bytes en el body (el límite de payload de Vercel es 4.5 MB, muy
  ajustado para 1-3 fotos).
- **Sin copia de resultados**: a diferencia del backend de find-my-race
  (que copiaba las fotos con match a una carpeta "found" para servirlas
  luego), aquí se devuelve directamente la URL original de la foto del
  álbum (Flickr) — no hay storage propio en este primer diseño. Si se
  necesita servir la foto sin depender de que Flickr no la borre, habría
  que subirla a Convex Storage desde aquí (pendiente, no bloqueante).
"""

from __future__ import annotations

import logging
import os
import sys
import tempfile
import time
from pathlib import Path
from typing import Optional

# Añadir el directorio del servicio al path para poder importar findmyrace
# (vive junto a este archivo, no en site-packages).
SERVICE_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SERVICE_ROOT))

from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from findmyrace.color import ColorMatcher
from findmyrace.face import FaceRecognizer
from findmyrace.matcher import MatcherWeights
from findmyrace.ocr import DorsalDetector
from findmyrace.pipeline import Pipeline
from findmyrace.sources import get_source_for_url
from findmyrace.sources.flickr import FlickrSource

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("photo_search_api")

app = FastAPI(title="mi-dorsal photo-search-api", version="0.1.0")

# Shared secret simple entre Convex y esta función — mismo patrón que
# TECH.md §6.3 documentaba para Modal (no JWT/OAuth, son servicios
# internos). Configurar como env var en Vercel (vercel env add).
API_SECRET = os.environ.get("PHOTO_SEARCH_API_SECRET")

# Tope de duración interno, por debajo del máximo real de la función
# (configurado en vercel.json / maxDuration) para poder devolver un error
# controlado en vez de que Vercel corte la conexión en seco.
SOFT_TIMEOUT_SECONDS = int(os.environ.get("PHOTO_SEARCH_SOFT_TIMEOUT", "700"))

# Descargas simultáneas del álbum. 5 es un punto medio: suficiente para
# bajar bastante el tiempo total (medido: ~2m48s -> objetivo ~35-40s en
# 297 fotos) sin disparar el rate-limiting de Flickr más de lo que ya
# provoca el modo secuencial — el backoff adaptativo sigue activo y
# compartido entre los 5 workers (ver findmyrace/sources/base.py).
DOWNLOAD_WORKERS = int(os.environ.get("PHOTO_SEARCH_DOWNLOAD_WORKERS", "5"))


class FindPhotosRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    job_id: str = Field(..., alias="jobId")
    selfie_urls: list[str] = Field(..., alias="selfieUrls", min_length=1, max_length=3)
    # Varios álbumes en una misma búsqueda (p. ej. varios fotógrafos de la
    # misma carrera) — cada uno se descarga y se analiza, los resultados se
    # combinan. Límite de 3, igual que selfies, para acotar tiempo total.
    album_urls: list[str] = Field(..., alias="albumUrls", min_length=1, max_length=3)
    dorsal: Optional[str] = None
    top_k: int = Field(15, alias="topK", ge=1, le=50)
    min_score: float = Field(0.30, alias="minScore", ge=0.0, le=1.0)


class ListAlbumsRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    profile_url: str = Field(..., alias="profileUrl")


def _check_auth(request: Request) -> None:
    if not API_SECRET:
        # Sin secreto configurado, no bloqueamos (útil en dev local con
        # `vercel dev`) — pero se loggea fuerte para que no pase
        # desapercibido si esto llega a producción sin configurar.
        logger.warning("PHOTO_SEARCH_API_SECRET no configurado — auth deshabilitada")
        return
    auth_header = request.headers.get("authorization", "")
    expected = f"Bearer {API_SECRET}"
    if auth_header != expected:
        raise HTTPException(401, "Unauthorized")


@app.get("/api/find_photos")
@app.get("/")
async def health():
    return {"status": "ok", "service": "photo-search-api"}


@app.post("/api/list_albums")
async def list_albums(payload: ListAlbumsRequest, request: Request):
    """Lista los álbumes públicos de un fotógrafo dada la URL de su
    perfil de Flickr (``flickr.com/photos/<user>/albums/``) — usado por
    la UI para ofrecer un selector en vez de que el usuario tenga que
    copiar cada enlace de álbum a mano. Ver findmyrace/sources/flickr.py
    ::list_albums_for_profile.
    """
    _check_auth(request)

    source = FlickrSource()
    if not source.is_profile_albums_url(payload.profile_url):
        raise HTTPException(
            400,
            "Esa URL no parece la página de álbumes de un perfil de Flickr "
            "(debe ser del tipo flickr.com/photos/<usuario>/albums/)",
        )

    albums = source.list_albums_for_profile(payload.profile_url)
    if albums is None:
        raise HTTPException(
            502,
            "No se pudieron obtener los álbumes de ese perfil de Flickr. "
            "Puede que el perfil no exista o no tenga álbumes públicos.",
        )

    return {"albums": albums}


@app.post("/api/find_photos")
async def find_photos(payload: FindPhotosRequest, request: Request):
    _check_auth(request)
    t0 = time.time()
    job_id = payload.job_id

    with tempfile.TemporaryDirectory(prefix=f"pS_{job_id}_") as tmpdir_str:
        tmpdir = Path(tmpdir_str)

        # 1) Descargar selfies (URLs firmadas de Convex Storage)
        selfie_paths = await _download_selfies(payload.selfie_urls, tmpdir)
        if not selfie_paths:
            raise HTTPException(400, "No se pudo descargar ninguna selfie")

        # 2) Construir FaceRecognizer y validar calidad de cada selfie
        # ANTES de aceptarla — decisión de arquitectura de TECH.md §15.3
        # resuelta aquí: vive en el mismo servicio que hace el matching,
        # no en Convex, porque de momento no hay motivo para duplicar la
        # carga del modelo InsightFace en dos sitios distintos.
        face = FaceRecognizer(cache_dir=tmpdir / "face_cache")
        rejected: list[dict] = []
        accepted = 0
        for i, selfie_path in enumerate(selfie_paths):
            role = "frontal" if i == 0 else "lateral"
            quality = face.assess_reference(selfie_path, role=role)
            if quality.rejected:
                rejected.append({"index": i, "reasons": quality.reasons})
                continue
            face.add_reference(selfie_path)
            accepted += 1

        if accepted == 0:
            return {
                "jobId": job_id,
                "status": "error",
                "error": "Ninguna selfie pasó el control de calidad",
                "rejectedSelfies": rejected,
            }

        # 3) Construir pipeline
        pipeline = Pipeline(
            dorsal_detector=DorsalDetector(languages=["en", "es"], gpu=False),
            color_matcher=ColorMatcher(bins=32),
            face_recognizer=face,
            weights=MatcherWeights(),
        )

        # 4) Descargar álbum(es). Solo Flickr tiene downloader real hoy (ver
        # TECH.md §15.1/§14.3) — get_source_for_url lanza ValueError para
        # cualquier otra URL. Con varios álbumes, uno no soportado o que
        # falle no aborta el job entero: se sigue con los demás, y solo se
        # devuelve error si NINGUNO de los álbumes dio resultado.
        path_to_source_url: dict[Path, str] = {}
        unsupported_albums: list[str] = []
        failed_albums: list[str] = []

        for i, album_url in enumerate(payload.album_urls):
            try:
                source = get_source_for_url(album_url)
            except ValueError:
                unsupported_albums.append(album_url)
                continue

            # Subcarpeta por álbum, todas bajo "albums/" (no directamente
            # en tmpdir — ahí también viven selfies/ y face_cache/, que no
            # son fotos del álbum): evita colisión de nombres de fichero
            # entre álbumes distintos (dos fotógrafos pueden reusar el
            # mismo esquema de nombre, p. ej. "IMG_0001.jpg").
            album_dir = tmpdir / "albums" / f"album_{i}"
            # download_with_source_urls (no `download`): necesitamos saber
            # de qué URL vino cada foto para poder devolver la URL pública
            # original en la respuesta — no hay storage propio aquí que
            # copie los resultados (ver docstring del módulo).
            #
            # max_workers=DOWNLOAD_WORKERS: descargas en paralelo con
            # backoff adaptativo COMPARTIDO entre workers (ver
            # findmyrace/sources/base.py::_AdaptiveRateLimiter) — un 429
            # visto por cualquier worker frena a todos por igual. Álbum
            # real de 297 fotos: ~2m48s secuencial -> ~35-40s con 5 workers.
            album_results = source.download_with_source_urls(
                album_url, album_dir, max_workers=DOWNLOAD_WORKERS
            )
            if not album_results:
                failed_albums.append(album_url)
                continue
            path_to_source_url.update(album_results)

        if not path_to_source_url:
            if unsupported_albums and len(unsupported_albums) == len(payload.album_urls):
                raise HTTPException(
                    400,
                    "Ninguno de los álbumes es de un proveedor soportado (solo Flickr por ahora)",
                )
            return {
                "jobId": job_id,
                "status": "error",
                "error": "No se pudo descargar ningún álbum",
            }

        remaining = SOFT_TIMEOUT_SECONDS - (time.time() - t0)
        if remaining < 30:
            return {
                "jobId": job_id,
                "status": "error",
                "error": "El álbum tardó demasiado en descargarse; inténtalo con un álbum más pequeño",
            }

        # 5) Matching. include_identity_matches=True (default) — ver
        # TECH.md §15.2: una foto con identidad confirmada por cara no se
        # pierde aunque el dorsal no se detecte en ella. album=tmpdir/"albums"
        # (no un único album_dir) + recursive=True: iter_images ya recorre
        # subcarpetas (findmyrace/pipeline.py), así que las N subcarpetas
        # album_0/album_1/... se analizan juntas en una sola pasada.
        photo_scores = pipeline.run(
            album=tmpdir / "albums",
            target_dorsal=payload.dorsal or "",
            min_score=payload.min_score,
            top_k=payload.top_k,
        )

        results = [
            {
                "photoUrl": path_to_source_url.get(r.path, r.path.name),
                "score": round(r.score, 3),
                "identityConfirmed": r.identity_confirmed,
                "faceScore": round(r.face.score, 3) if r.face else None,
                "dorsalMatch": r.dorsal.text if r.dorsal else None,
                "bbox": (
                    {
                        "x": r.face.bbox[0],
                        "y": r.face.bbox[1],
                        "w": r.face.bbox[2] - r.face.bbox[0],
                        "h": r.face.bbox[3] - r.face.bbox[1],
                    }
                    if r.face
                    else None
                ),
            }
            for r in photo_scores
        ]

        return {
            "jobId": job_id,
            "status": "done",
            "results": results,
            "rejectedSelfies": rejected,
            "stats": {
                "photosScanned": len(path_to_source_url),
                "durationMs": round((time.time() - t0) * 1000),
                "platform": os.environ.get("PHOTO_SEARCH_PLATFORM", "vercel"),
            },
        }
        # tmpdir se borra automáticamente al salir del `with` — selfies y
        # álbum descargado no dejan rastro en disco tras la respuesta.


async def _download_selfies(urls: list[str], tmpdir: Path) -> list[Path]:
    """Descarga las selfies (URLs firmadas) a disco temporal."""
    import httpx

    selfie_dir = tmpdir / "selfies"
    selfie_dir.mkdir(parents=True, exist_ok=True)
    paths: list[Path] = []
    async with httpx.AsyncClient(timeout=30) as client:
        for i, url in enumerate(urls):
            try:
                resp = await client.get(url)
                resp.raise_for_status()
            except httpx.HTTPError as e:
                logger.warning("Selfie %d no descargable: %s", i, e)
                continue
            path = selfie_dir / f"selfie_{i}.jpg"
            path.write_bytes(resp.content)
            paths.append(path)
    return paths
