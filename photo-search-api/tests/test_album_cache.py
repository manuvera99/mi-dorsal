"""Tests para api/album_cache.py — caché persistente de álbumes entre
búsquedas (ver docstring del módulo para el bug real que motivó esto).

Sin red real ni Modal real: reload()/commit() se prueban con
modal.Volume.from_name mockeado — lo que importa aquí es que este módulo
llame a los métodos correctos con el nombre de volumen correcto, y que
degrade con seguridad (nunca lance) cuando la caché no está habilitada o
cuando Modal falla."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from api import album_cache  # noqa: E402


class TestEnabled:
    def test_disabled_when_env_var_missing(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("PHOTO_SEARCH_ALBUM_CACHE_DIR", raising=False)
        assert album_cache.enabled() is False

    def test_enabled_when_env_var_set(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("PHOTO_SEARCH_ALBUM_CACHE_DIR", "/album_cache")
        assert album_cache.enabled() is True

    def test_disabled_when_env_var_empty(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Una env var vacía ("") debe tratarse como no configurada, no
        como un directorio raíz válido."""
        monkeypatch.setenv("PHOTO_SEARCH_ALBUM_CACHE_DIR", "")
        assert album_cache.enabled() is False


class TestDirFor:
    def test_creates_and_returns_nested_dir(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("PHOTO_SEARCH_ALBUM_CACHE_DIR", str(tmp_path))
        d = album_cache.dir_for("flickr", "72177720335057195")
        assert d == tmp_path / "flickr" / "72177720335057195"
        assert d.is_dir()

    def test_reuses_existing_dir_without_error(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("PHOTO_SEARCH_ALBUM_CACHE_DIR", str(tmp_path))
        d1 = album_cache.dir_for("flickr", "123")
        (d1 / "existing.jpg").write_bytes(b"fake")
        d2 = album_cache.dir_for("flickr", "123")
        assert d2 == d1
        assert (d2 / "existing.jpg").exists()

    def test_different_keys_get_different_dirs(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("PHOTO_SEARCH_ALBUM_CACHE_DIR", str(tmp_path))
        d1 = album_cache.dir_for("flickr", "123")
        d2 = album_cache.dir_for("flickr", "456")
        assert d1 != d2


class TestReloadAndCommit:
    def test_reload_noop_when_disabled(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("PHOTO_SEARCH_ALBUM_CACHE_DIR", raising=False)
        with patch("api.album_cache._get_volume") as mock_get_volume:
            album_cache.reload()
        mock_get_volume.assert_not_called()

    def test_commit_noop_when_disabled(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("PHOTO_SEARCH_ALBUM_CACHE_DIR", raising=False)
        with patch("api.album_cache._get_volume") as mock_get_volume:
            album_cache.commit()
        mock_get_volume.assert_not_called()

    def test_reload_calls_volume_reload_when_enabled(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("PHOTO_SEARCH_ALBUM_CACHE_DIR", "/album_cache")
        mock_volume = MagicMock()
        with patch("api.album_cache._get_volume", return_value=mock_volume):
            album_cache.reload()
        mock_volume.reload.assert_called_once()

    def test_commit_calls_volume_commit_when_enabled(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("PHOTO_SEARCH_ALBUM_CACHE_DIR", "/album_cache")
        mock_volume = MagicMock()
        with patch("api.album_cache._get_volume", return_value=mock_volume):
            album_cache.commit()
        mock_volume.commit.assert_called_once()

    def test_reload_failure_is_swallowed(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """Un fallo de Modal (p. ej. volumen ocupado) nunca debe romper la
        búsqueda — solo se pierde la ventaja de cache-hit para este job."""
        monkeypatch.setenv("PHOTO_SEARCH_ALBUM_CACHE_DIR", "/album_cache")
        with patch("api.album_cache._get_volume", side_effect=RuntimeError("volume busy")):
            album_cache.reload()  # no debe lanzar

    def test_commit_failure_is_swallowed(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("PHOTO_SEARCH_ALBUM_CACHE_DIR", "/album_cache")
        with patch("api.album_cache._get_volume", side_effect=RuntimeError("volume busy")):
            album_cache.commit()  # no debe lanzar


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
