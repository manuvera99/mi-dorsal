"""Caché persistente de álbumes de fotos entre búsquedas distintas.

Bug real investigado el 15 sep 2026: cada búsqueda de "Encuentra tus
fotos" descargaba el álbum de Flickr entero desde cero, aunque fuera la
MISMA carrera que ya buscó otro corredor minutos antes — con varios
corredores buscando en la misma carrera (el caso normal en producción),
esto multiplica innecesariamente las peticiones contra el CDN de Flickr
(``live.staticflickr.com``) y fue la causa real de un bloqueo por 429
masivo tras varias búsquedas seguidas sobre los mismos álbumes de prueba.

Con este módulo, solo la PRIMERA búsqueda sobre un álbum concreto paga el
coste de red contra Flickr — las siguientes reutilizan los ficheros ya
descargados (identificados por ``PhotoSource.cache_key_for_url``, p. ej.
el ``set_id`` de Flickr) sin volver a tocar el CDN en absoluto. No hay
manifest ni TTL: los nombres de fichero ya son estables por foto (derivados
de la URL, que para Flickr incluye el ID real de la foto), así que un
álbum con fotos nuevas simplemente descarga las que faltan — el mismo
mecanismo de "skip si ya existe" que ``PhotoSource._download_impl`` ya
usaba para no repetir descargas dentro de una misma búsqueda.

Solo aplica cuando hay un directorio de caché persistente configurado
(Modal, ver modal_app.py — un ``modal.Volume`` montado). En Vercel, o en
tests locales sin ``PHOTO_SEARCH_ALBUM_CACHE_DIR`` definida, el caché
queda deshabilitado y find_photos.py cae al comportamiento anterior
(descarga siempre a un directorio efímero, sin reutilización entre
búsquedas) — nunca rompe la búsqueda, solo pierde la ventaja de cache-hit.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

_CACHE_DIR_ENV = "PHOTO_SEARCH_ALBUM_CACHE_DIR"

# Mismo nombre que el modal.Volume creado/montado en modal_app.py — este
# módulo no importa `modal` a nivel de módulo (no es dependencia de
# findmyrace/, compartido con la app de escritorio find-my-race, que no
# usa Modal), solo dentro de _get_volume() cuando hace falta de verdad.
_VOLUME_NAME = "photo-search-album-cache"


def enabled() -> bool:
    """True si hay un directorio de caché persistente configurado — usado
    por find_photos.py para decidir si intenta cachear cada álbum o
    descarga siempre a un directorio efímero (comportamiento anterior)."""
    return bool(os.environ.get(_CACHE_DIR_ENV))


def _root() -> Path:
    return Path(os.environ[_CACHE_DIR_ENV])


def _get_volume():
    """Handle del modal.Volume que respalda el directorio de caché.
    Import perezoso de ``modal``: este módulo vive en api/ (específico de
    este despliegue), no en findmyrace/ (compartido con find-my-race, que
    no depende de Modal)."""
    import modal

    return modal.Volume.from_name(_VOLUME_NAME, create_if_missing=True)


def reload() -> None:
    """Refresca la vista local del volumen antes de decidir qué descargar
    — para ver álbumes cacheados por OTRAS búsquedas (en este contenedor
    u otro) desde la última vez que este contenedor sincronizó. Best-effort:
    un fallo aquí nunca debe romper la búsqueda, solo hace que esta
    invocación no aproveche cachés recién creadas por otro contenedor."""
    if not enabled():
        return
    try:
        _get_volume().reload()
    except Exception as e:  # noqa: BLE001
        logger.warning("[album_cache] reload falló, se ignora: %s", e)


def commit() -> None:
    """Publica los ficheros descargados en esta búsqueda para que otras
    búsquedas (en este contenedor u otro) los vean. Best-effort, igual
    que reload()."""
    if not enabled():
        return
    try:
        _get_volume().commit()
    except Exception as e:  # noqa: BLE001
        logger.warning("[album_cache] commit falló, se ignora: %s", e)


def dir_for(source_name: str, cache_key: str) -> Path:
    """Carpeta persistente para el álbum ``cache_key`` de la fuente
    ``source_name`` (p. ej. "flickr" + set_id "72177720335057195") — se
    crea si no existe. Solo debe llamarse cuando ``enabled()`` es True.
    El llamador es responsable de llamar a ``reload()`` antes (para ver
    descargas de otras búsquedas) y ``commit()`` después de escribir."""
    d = _root() / source_name / cache_key
    d.mkdir(parents=True, exist_ok=True)
    return d
