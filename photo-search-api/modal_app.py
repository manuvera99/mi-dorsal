"""Endpoint real de "Encuentra tus fotos" en Modal — alternativa a Vercel.

Decisión del 14 sep 2026: se probó primero Vercel Functions (según lo
acordado: "primero Vercel, si no funciona Modal"). Funcionó correctamente en
cuanto a lógica (ver api/find_photos.py, mismo código `findmyrace/` que este
módulo reutiliza), pero falló por un problema de infraestructura real: cada
invocación hace cold-start completo porque `/tmp` no persiste entre
invocaciones en Vercel Functions, así que cada petición re-descarga ~500MB de
pesos de modelo (InsightFace buffalo_l ~280MB + EasyOCR detector+reconocedor
~200MB). Eso solo agota el límite de 300s del plan Hobby (confirmado: 504
Function Invocation Timeout en producción) antes de procesar el álbum.

Modal resuelve esto con un `modal.Volume` persistente: los pesos se descargan
una sola vez y quedan cacheados entre invocaciones (incluso en frío), y el
límite de tiempo de ejecución es mucho más generoso (horas, no minutos).

Reutiliza el mismo paquete `findmyrace/` — es el código ya validado en
Vercel, sin cambios. Solo cambia el "pegamento" de despliegue.
"""

from __future__ import annotations

import modal

app = modal.App("photo-search-api")

# Mismo patrón que pyproject.toml (Vercel): forzamos el índice CPU de
# PyTorch para no arrastrar los paquetes nvidia-cu* (varios GB) que easyocr
# instala por defecto y que aquí no aportan nada porque corremos sin GPU.
image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("libgl1", "libglib2.0-0")  # requeridos por opencv-python-headless
    # torch/torchvision van PRIMERO y en su propia capa, con index_url del
    # build CPU-only de PyTorch. Si se instalaran después (o junto a easyocr,
    # que también los pide como dependencia), pip resuelve la petición de
    # easyocr contra el índice normal de PyPI y arrastra los paquetes
    # nvidia-cu13-* (varios GB, solo tienen sentido con GPU) antes de llegar
    # a esta capa — instalándolos ya aquí, easyocr los encuentra satisfechos
    # y no los reinstala.
    .pip_install(
        "torch",
        "torchvision",
        index_url="https://download.pytorch.org/whl/cpu",
    )
    .pip_install(
        "fastapi>=0.110",
        "pydantic>=2.6",
        "numpy>=1.26",
        "opencv-python-headless>=4.9",
        "Pillow>=10.2",
        "insightface>=0.7",
        "onnxruntime>=1.16",
        "easyocr>=1.7",
        "requests>=2.31",
        "httpx>=0.27",
        # No es un descuido: api/album_cache.py hace `import modal` en
        # tiempo de ejecución (perezoso, no a nivel de módulo) para llamar
        # a Volume.from_name()/.reload()/.commit() desde dentro de la
        # propia función Modal — explícito aquí para no depender de que
        # el cliente modal ya esté disponible en la imagen sin pedirlo.
        "modal",
    )
    .add_local_python_source("findmyrace")
    .add_local_python_source("api")
)

# Volumen persistente para los pesos de modelo (InsightFace + EasyOCR).
# Montado como HOME del contenedor: ambas librerías descargan sus pesos en
# rutas relativas a `~` (`~/.insightface`, `~/.EasyOCR`) sin que haya que
# tocar findmyrace/face.py ni findmyrace/ocr.py para redirigirlas.
model_cache = modal.Volume.from_name("photo-search-model-cache", create_if_missing=True)

# Volumen persistente para álbumes ya descargados de Flickr, reutilizado
# ENTRE búsquedas distintas — ver api/album_cache.py. Investigado el 15
# sep 2026 tras un bloqueo real por 429 masivo de Flickr: sin esto, cada
# búsqueda (incluso sobre la misma carrera que ya buscó otro corredor)
# volvía a descargar el álbum entero desde el CDN de Flickr, multiplicando
# peticiones sin necesidad. El nombre debe coincidir con
# album_cache._VOLUME_NAME.
album_cache_volume = modal.Volume.from_name(
    "photo-search-album-cache", create_if_missing=True
)

# Mismo secreto compartido que en Vercel (PHOTO_SEARCH_API_SECRET) — creado
# el 14 sep 2026 con:
#   modal secret create photo-search-api-secret PHOTO_SEARCH_API_SECRET=<valor>
# find_photos.py (_check_auth) exige "Authorization: Bearer <valor>" en
# cada petición mientras esta env var esté presente en el contenedor.
_secrets = [modal.Secret.from_name("photo-search-api-secret")]


@app.function(
    image=image,
    volumes={
        "/cache": model_cache,
        "/album_cache": album_cache_volume,
    },
    secrets=_secrets,
    # InsightFace y EasyOCR descargan sus pesos en rutas relativas a HOME
    # (~/.insightface, ~/.EasyOCR) sin que findmyrace/face.py u ocr.py les
    # pasen un directorio explícito — redirigimos HOME al volumen montado
    # para que esos pesos persistan entre invocaciones (y entre despliegues).
    # PHOTO_SEARCH_ALBUM_CACHE_DIR activa la caché de álbumes de
    # api/album_cache.py — sin esta env var (p. ej. en Vercel, o en tests
    # locales), find_photos.py cae al comportamiento anterior (descarga
    # siempre a un directorio efímero, sin reutilización entre búsquedas).
    env={"HOME": "/cache", "PHOTO_SEARCH_ALBUM_CACHE_DIR": "/album_cache"},
    # 1500s (25 min): con el selector de álbumes de perfil (hasta 3
    # álbumes reales, no solo 1) el total de fotos a analizar puede
    # superar de sobra las ~300-500 fotos de un álbum único — medido en
    # producción: 1044 fotos agotó el timeout anterior de 600s a mitad
    # del matching (95% completado, sin devolver resultado). SOFT_TIMEOUT
    # en find_photos.py debe quedar por debajo de este valor, no por
    # encima (bug corregido en la misma sesión: antes SOFT_TIMEOUT=700 >
    # este timeout=600, así que el soft-timeout nunca llegaba a activarse
    # a tiempo).
    timeout=1500,
    cpu=2,
    memory=4096,
    min_containers=0,
    scaledown_window=300,
)
@modal.asgi_app()
def fastapi_app():
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from api.find_photos import app as _app

    return _app
