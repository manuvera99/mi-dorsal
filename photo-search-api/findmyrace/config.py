"""Configuración centralizada de FindMyRace (fork para Vercel Functions).

Lee variables de entorno. En Vercel las env vars se configuran en el
dashboard/CLI (vercel env), no via .env — dotenv solo se usa en local dev
(vercel dev sí carga .env.local) y se hace opcional para no fallar si el
paquete no está instalado en el bundle de producción.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:  # pragma: no cover - no instalado en el bundle de prod
    pass


def _get_env(key: str, default: str) -> str:
    return os.getenv(key, default)


def _get_env_float(key: str, default: float) -> float:
    raw = os.getenv(key)
    return float(raw) if raw else default


def _get_env_int(key: str, default: int) -> int:
    raw = os.getenv(key)
    return int(raw) if raw else default


def _get_env_bool(key: str, default: bool) -> bool:
    raw = os.getenv(key, "").strip().lower()
    if raw in ("1", "true", "yes", "y", "on"):
        return True
    if raw in ("0", "false", "no", "n", "off"):
        return False
    return default


@dataclass(frozen=True)
class Settings:
    """Configuración inmutable de la app."""

    # General
    app_env: str = field(default_factory=lambda: _get_env("APP_ENV", "development"))
    log_level: str = field(default_factory=lambda: _get_env("LOG_LEVEL", "INFO"))

    # Cache. Default a /tmp: es el ÚNICO directorio escribible en Vercel
    # Functions (filesystem de solo lectura salvo /tmp, que además es
    # efímero — no persiste entre invocaciones ni se comparte entre
    # instancias). El cache de embeddings de face.py pierde su ventaja
    # entre invocaciones distintas por este motivo (ver nota en face.py
    # sobre por qué esto es aceptable).
    cache_dir: Path = field(default_factory=lambda: Path(_get_env("CACHE_DIR", "/tmp/findmyrace_cache")))

    # Procesamiento
    max_workers: int = field(default_factory=lambda: _get_env_int("MAX_WORKERS", 4))

    # OCR
    ocr_gpu: bool = field(default_factory=lambda: _get_env_bool("OCR_GPU", False))
    ocr_languages: tuple[str, ...] = field(
        default_factory=lambda: tuple(_get_env("OCR_LANGS", "en,es").split(","))
    )

    # Matcher (cara es gate + senal principal; dorsal y color son bonus)
    weight_face: float = field(default_factory=lambda: _get_env_float("WEIGHT_FACE", 0.6))
    weight_dorsal: float = field(default_factory=lambda: _get_env_float("WEIGHT_DORSAL", 0.25))
    weight_color: float = field(default_factory=lambda: _get_env_float("WEIGHT_COLOR", 0.15))

    # Color
    color_bins: int = field(default_factory=lambda: _get_env_int("COLOR_BINS", 32))
    color_threshold: float = field(default_factory=lambda: _get_env_float("COLOR_THRESHOLD", 0.5))

    def __post_init__(self) -> None:
        # Crear cache_dir si no existe (frozen dataclass necesita object.__setattr__)
        object.__setattr__(self, "cache_dir", Path(self.cache_dir))
        self.cache_dir.mkdir(parents=True, exist_ok=True)


def get_settings() -> Settings:
    """Devuelve una instancia cached de Settings."""
    return Settings()
