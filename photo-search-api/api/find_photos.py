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
from findmyrace.sources.base import AdaptiveRateLimiter, PhotoSource
from findmyrace.sources.flickr import FlickrSource

from . import album_cache

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("photo_search_api")

app = FastAPI(title="mi-dorsal photo-search-api", version="0.1.0")

# Shared secret simple entre Convex y esta función — mismo patrón que
# TECH.md §6.3 documentaba para Modal (no JWT/OAuth, son servicios
# internos). Configurar como env var en Vercel (vercel env add).
API_SECRET = os.environ.get("PHOTO_SEARCH_API_SECRET")

# Tope de duración interno, por debajo del máximo real de la función
# (timeout=1500 en modal_app.py / maxDuration en vercel.json) para poder
# devolver un error controlado antes de que la plataforma corte la
# conexión en seco. Bug corregido en esta misma sesión: el valor anterior
# (700) era MAYOR que el timeout real de Modal en ese momento (600), así
# que este chequeo nunca llegaba a activarse a tiempo — el 500 lo daba
# directamente la plataforma, sin este mensaje explicativo.
SOFT_TIMEOUT_SECONDS = int(os.environ.get("PHOTO_SEARCH_SOFT_TIMEOUT", "1400"))

# Tope de fotos analizadas por búsqueda, sumando TODOS los álbumes. Con el
# selector de álbumes de perfil (hasta 3 álbumes reales, no solo 1) el
# total puede superar de sobra lo que el matching puede procesar dentro
# del timeout — confirmado en producción: 1044 fotos agotó un timeout de
# 600s al 95% del matching sin devolver resultado (dato real: ~1.9
# fotos/seg de ritmo de matching). Con 1500s de timeout, el límite teórico
# ronda 2400-2500 fotos; 1500 deja margen real frente a esa cota (CPU
# compartida, fotos más pesadas, variabilidad del backoff de descarga).
# Por encima de esto, se analizan solo las primeras N y se avisa en el
# resultado (ver Pipeline.run max_images / stats.photosOmitted).
MAX_PHOTOS_PER_JOB = int(os.environ.get("PHOTO_SEARCH_MAX_PHOTOS", "1500"))

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


# Perfil oficial de Flickr, usado solo como diana estable para el
# health-check de abajo — no depende de ningún dato nuestro, así que no se
# rompe si borramos/cambiamos álbumes propios.
_SITE_KEY_HEALTHCHECK_PROFILE = "https://www.flickr.com/photos/flickr/albums/"


@app.get("/api/health/flickr_site_key")
async def health_flickr_site_key(request: Request):
    """Comprueba que seguimos pudiendo extraer el ``site_key``/NSID
    público del HTML de flickr.com (ver FlickrSource, docstring del
    módulo) — la vía principal para listar álbumes/fotos hoy, sin key de
    API propia. Pensado para un cron externo (ver convex/crons/, sep
    2026): si Flickr cambia cómo expone estos valores en el HTML, esta
    vía deja de funcionar en silencio (cae al scraper HTML por página,
    más limitado) hasta que alguien lo note en una búsqueda real. Este
    endpoint permite detectarlo antes, con una alerta explícita.
    """
    _check_auth(request)
    source = FlickrSource()
    site_key, owner_nsid = source._extract_site_key_and_nsid_from_profile("flickr")
    ok = bool(site_key and owner_nsid)
    if not ok:
        logger.error(
            "[health] No se pudo extraer site_key/NSID de %s — site_key=%s, "
            "nsid=%s. La vía principal de listado de álbumes/fotos puede "
            "haber dejado de funcionar; revisar findmyrace/sources/flickr.py",
            _SITE_KEY_HEALTHCHECK_PROFILE,
            "presente" if site_key else "AUSENTE",
            "presente" if owner_nsid else "AUSENTE",
        )
    return {
        "ok": ok,
        "siteKeyFound": bool(site_key),
        "nsidFound": bool(owner_nsid),
    }


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
        #
        # source/limiter por TIPO de fuente (no por álbum): con el selector
        # de álbumes de perfil, los 3 álbumes de una búsqueda suelen ser
        # del mismo fotógrafo/dominio. Descargarlos con una FlickrSource y
        # un AdaptiveRateLimiter nuevos cada vez hacía que el 2º y 3er
        # álbum reiniciaran el backoff desde cero, ignorando que Flickr ya
        # estaba limitando por el álbum anterior — confirmado en
        # producción (15 sep 2026): 3 álbumes seguidos, el 2º tuvo 94% de
        # descargas fallidas por 429 (10/168) porque "no sabía" que el 1º
        # ya había disparado el límite. Reutilizar ambos por tipo de
        # fuente hace que el backoff persista entre álbumes del mismo
        # proveedor, tal como ya persistía entre fotos de un mismo álbum.
        path_to_source_url: dict[Path, str] = {}
        unsupported_albums: list[str] = []
        failed_albums: list[str] = []
        sources_by_type: dict[str, PhotoSource] = {}
        limiters_by_type: dict[str, AdaptiveRateLimiter] = {}

        # Ver caché entre álbumes descargados en OTRAS búsquedas (ver
        # api/album_cache.py) antes de decidir qué descargar aquí — no-op
        # si no hay caché configurada (Vercel, o tests locales). Una sola
        # vez por job, no por álbum: solo hace falta ver el estado más
        # reciente antes de empezar a leer directorios de caché.
        album_cache.reload()
        used_album_cache = False

        for i, album_url in enumerate(payload.album_urls):
            try:
                probe = get_source_for_url(album_url)
            except ValueError:
                unsupported_albums.append(album_url)
                continue

            source = sources_by_type.setdefault(probe.name, probe)
            limiter = limiters_by_type.setdefault(
                probe.name, AdaptiveRateLimiter(base_delay=0.2, max_delay=5.0)
            )

            # Álbum persistente entre búsquedas (Modal, ver modal_app.py y
            # api/album_cache.py) cuando la fuente tiene una clave estable
            # para esta URL (p. ej. el set_id de Flickr) — la MISMA carrera
            # suele buscarse por muchos corredores distintos, y el álbum
            # de fotos no cambia entre esas búsquedas. Bug real motivador
            # (15 sep 2026): sin esto, cada búsqueda repetía la descarga
            # completa del álbum, multiplicando peticiones contra el CDN
            # de Flickr sin necesidad y contribuyendo a un bloqueo por 429
            # tras varias búsquedas seguidas sobre los mismos álbumes.
            # Fallback a subcarpeta efímera bajo tmpdir si no hay clave de
            # caché (fuente sin cache_key_for_url, p. ej. DirectUrlSource)
            # o si no hay caché configurada — mismo comportamiento que
            # antes en ambos casos.
            cache_key = probe.cache_key_for_url(album_url)
            if album_cache.enabled() and cache_key is not None:
                album_dir = album_cache.dir_for(probe.name, cache_key)
                used_album_cache = True
            else:
                # Subcarpeta por álbum, todas bajo "albums/" (no
                # directamente en tmpdir — ahí también viven selfies/ y
                # face_cache/, que no son fotos del álbum): evita colisión
                # de nombres de fichero entre álbumes distintos (dos
                # fotógrafos pueden reusar el mismo esquema de nombre,
                # p. ej. "IMG_0001.jpg").
                album_dir = tmpdir / "albums" / f"album_{i}"

            # download_with_source_urls (no `download`): necesitamos saber
            # de qué URL vino cada foto para poder devolver la URL pública
            # original en la respuesta — no hay storage propio aquí que
            # copie los resultados (ver docstring del módulo). Las fotos
            # que ya existen en album_dir (de una búsqueda anterior sobre
            # el mismo álbum cacheado) se saltan solas — ver
            # PhotoSource._download_impl, "Ya existe, skip".
            #
            # max_workers=DOWNLOAD_WORKERS: descargas en paralelo con
            # backoff adaptativo COMPARTIDO entre workers (ver
            # findmyrace/sources/base.py::AdaptiveRateLimiter) — un 429
            # visto por cualquier worker (de este álbum O de uno anterior
            # del mismo tipo de fuente, ver rate_limiter=limiter) frena a
            # todos por igual. Álbum real de 297 fotos: ~2m48s secuencial
            # -> ~35-40s con 5 workers.
            #
            # dorsal=payload.dorsal: atajo real para ChipLevante (ver
            # findmyrace/sources/chiplevante.py) — ese proveedor ya asocia
            # fotos a dorsales por cronometraje+cámara, así que si el
            # usuario dio dorsal, se piden directamente SUS fotos en vez
            # del álbum completo (cientos de fotos menos que descargar).
            # Fuentes sin este atajo (Flickr) ignoran el parámetro y
            # devuelven el álbum completo igual — pasar dorsal aquí no
            # cambia su comportamiento.
            album_results = source.download_with_source_urls(
                album_url,
                album_dir,
                max_workers=DOWNLOAD_WORKERS,
                rate_limiter=limiter,
                dorsal=payload.dorsal,
            )
            if not album_results:
                failed_albums.append(album_url)
                continue
            path_to_source_url.update(album_results)

        # Publica lo descargado en esta búsqueda para que la SIGUIENTE
        # búsqueda (en este contenedor u otro) lo vea — no-op si no se usó
        # la caché en ningún álbum de este job.
        if used_album_cache:
            album_cache.commit()

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
        # pierde aunque el dorsal no se detecte en ella.
        # image_paths=list(path_to_source_url) en vez de un único `album`
        # a recorrer: con la caché de álbumes (ver album_cache.py más
        # arriba), las fotos de esta búsqueda ya NO viven todas bajo una
        # única carpeta (tmpdir/albums) — un álbum cacheado vive en el
        # Volume persistente, fuera de tmpdir. path_to_source_url ya tiene
        # exactamente las rutas descargadas de todos los álbumes, sea cual
        # sea su carpeta real.
        # max_images=MAX_PHOTOS_PER_JOB: protección real contra timeout —
        # ver docstring de Pipeline.run para el caso real que lo motivó.
        photo_scores = pipeline.run(
            image_paths=list(path_to_source_url),
            target_dorsal=payload.dorsal or "",
            min_score=payload.min_score,
            top_k=payload.top_k,
            max_images=MAX_PHOTOS_PER_JOB,
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

        omitted = pipeline.last_run_omitted
        photos_scanned = len(path_to_source_url) - omitted

        return {
            "jobId": job_id,
            "status": "done",
            "results": results,
            "rejectedSelfies": rejected,
            "stats": {
                "photosScanned": photos_scanned,
                "photosOmitted": omitted,
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
