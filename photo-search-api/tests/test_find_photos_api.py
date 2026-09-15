"""Tests de sanidad para api/find_photos.py — sin red real.

No repite la cobertura de find-my-race/tests/ (matcher, face, sources ya
están probados ahí y son el mismo código fuente). Esto valida
específicamente lo que es propio de este fork: el contrato HTTP, la
validación de payload, y el manejo de errores esperables (álbum de
proveedor no soportado, selfies no descargables).
"""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from api.find_photos import app  # noqa: E402

client = TestClient(app)


class TestHealth:
    def test_root_health(self) -> None:
        resp = client.get("/")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

    def test_find_photos_get_health(self) -> None:
        resp = client.get("/api/find_photos")
        assert resp.status_code == 200


class TestFlickrSiteKeyHealth:
    """GET /api/health/flickr_site_key — ver docstring del endpoint: sin
    esto, un cambio del HTML de flickr.com que rompa la extracción del
    site_key/NSID (vía principal de listado de álbumes/fotos hoy, sin key
    de API propia) pasaría desapercibido hasta fallar en una búsqueda
    real."""

    def test_ok_when_site_key_and_nsid_found(self) -> None:
        with patch(
            "api.find_photos.FlickrSource._extract_site_key_and_nsid_from_profile",
            return_value=("abc123", "12345@N01"),
        ):
            resp = client.get("/api/health/flickr_site_key")
        assert resp.status_code == 200
        body = resp.json()
        assert body == {"ok": True, "siteKeyFound": True, "nsidFound": True}

    def test_not_ok_when_site_key_missing(self) -> None:
        """Si Flickr deja de exponer site_key en el HTML (el escenario
        real que motivó este endpoint), ok debe ser False para que el
        cron externo lo detecte — nunca un 200 genérico sin distinguir."""
        with patch(
            "api.find_photos.FlickrSource._extract_site_key_and_nsid_from_profile",
            return_value=(None, "12345@N01"),
        ):
            resp = client.get("/api/health/flickr_site_key")
        assert resp.status_code == 200
        body = resp.json()
        assert body == {"ok": False, "siteKeyFound": False, "nsidFound": True}

    def test_not_ok_when_both_missing(self) -> None:
        with patch(
            "api.find_photos.FlickrSource._extract_site_key_and_nsid_from_profile",
            return_value=(None, None),
        ):
            resp = client.get("/api/health/flickr_site_key")
        assert resp.json() == {"ok": False, "siteKeyFound": False, "nsidFound": False}

    def test_requires_auth(self) -> None:
        with patch("api.find_photos.API_SECRET", "supersecret"):
            resp = client.get("/api/health/flickr_site_key")
        assert resp.status_code == 401


class TestPayloadValidation:
    def test_missing_required_fields_rejected(self) -> None:
        resp = client.post("/api/find_photos", json={})
        assert resp.status_code == 422

    def test_too_many_selfies_rejected(self) -> None:
        resp = client.post(
            "/api/find_photos",
            json={
                "jobId": "x",
                "selfieUrls": ["a", "b", "c", "d"],  # 4 > max_length=3
                "albumUrls": ["https://example.com"],
            },
        )
        assert resp.status_code == 422

    def test_no_selfies_rejected(self) -> None:
        resp = client.post(
            "/api/find_photos",
            json={"jobId": "x", "selfieUrls": [], "albumUrls": ["https://example.com"]},
        )
        assert resp.status_code == 422

    def test_too_many_albums_rejected(self) -> None:
        resp = client.post(
            "/api/find_photos",
            json={
                "jobId": "x",
                "selfieUrls": ["a"],
                "albumUrls": ["https://a.com", "https://b.com", "https://c.com", "https://d.com"],
            },
        )
        assert resp.status_code == 422

    def test_no_albums_rejected(self) -> None:
        resp = client.post(
            "/api/find_photos",
            json={"jobId": "x", "selfieUrls": ["a"], "albumUrls": []},
        )
        assert resp.status_code == 422


class TestUnsupportedAlbumSource:
    def test_non_flickr_url_returns_400(self) -> None:
        """get_source_for_url lanza ValueError para proveedores sin
        downloader (fotoscarreras.com, barrel.cloud, etc. — ver TECH.md
        §15.1/§14.3). Si NINGÚN álbum es soportado, debe traducirse en un
        400 explícito, no un 500."""
        with patch(
            "api.find_photos._download_selfies",
            new=AsyncMock(return_value=[Path("/tmp/fake_selfie.jpg")]),
        ), patch("api.find_photos.FaceRecognizer") as mock_face_cls:
            mock_face = MagicMock()
            mock_face.assess_reference.return_value = MagicMock(rejected=False)
            mock_face_cls.return_value = mock_face

            resp = client.post(
                "/api/find_photos",
                json={
                    "jobId": "x",
                    "selfieUrls": ["https://example.com/selfie.jpg"],
                    "albumUrls": ["https://fotoscarreras.com/algun-album"],
                },
            )
        assert resp.status_code == 400


class TestAlbumCache:
    """Integración: cuando la caché de álbumes está habilitada (ver
    api/album_cache.py), find_photos.py debe descargar el álbum en la
    carpeta persistente en vez del directorio temporal efímero — y
    reload()/commit() deben llamarse alrededor de la descarga."""

    def _mock_face(self):
        mock_face = MagicMock()
        mock_face.assess_reference.return_value = MagicMock(rejected=False)
        return mock_face

    def test_flickr_album_downloaded_into_cache_dir_when_enabled(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("PHOTO_SEARCH_ALBUM_CACHE_DIR", str(tmp_path))

        fake_photo = tmp_path / "flickr" / "123" / "photo1.jpg"

        def _fake_download(url, dest_dir, **kwargs):
            # El caller (find_photos.py) debe pasar la carpeta de caché,
            # no una subcarpeta de tmpdir.
            assert dest_dir == tmp_path / "flickr" / "123"
            dest_dir.mkdir(parents=True, exist_ok=True)
            fake_photo.write_bytes(b"fake")
            return {fake_photo: "https://live.staticflickr.com/x/123_abc_k.jpg"}

        with patch(
            "api.find_photos._download_selfies",
            new=AsyncMock(return_value=[Path("/tmp/fake_selfie.jpg")]),
        ), patch("api.find_photos.FaceRecognizer") as mock_face_cls, patch(
            "api.find_photos.FlickrSource.cache_key_for_url", return_value="123"
        ), patch(
            "api.find_photos.FlickrSource.download_with_source_urls",
            side_effect=_fake_download,
        ) as mock_download, patch(
            "api.find_photos.Pipeline.run", return_value=[]
        ) as mock_run, patch(
            "api.album_cache.reload"
        ) as mock_reload, patch(
            "api.album_cache.commit"
        ) as mock_commit:
            mock_face_cls.return_value = self._mock_face()

            resp = client.post(
                "/api/find_photos",
                json={
                    "jobId": "x",
                    "selfieUrls": ["https://example.com/selfie.jpg"],
                    "albumUrls": [
                        "https://www.flickr.com/photos/u/albums/123/"
                    ],
                },
            )

        assert resp.status_code == 200
        mock_download.assert_called_once()
        mock_reload.assert_called_once()
        mock_commit.assert_called_once()
        # image_paths pasado a Pipeline.run debe incluir la foto "cacheada"
        assert mock_run.call_args.kwargs["image_paths"] == [fake_photo]

    def test_ephemeral_dir_used_when_cache_disabled(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.delenv("PHOTO_SEARCH_ALBUM_CACHE_DIR", raising=False)

        captured_dirs: list[Path] = []

        def _fake_download(url, dest_dir, **kwargs):
            captured_dirs.append(dest_dir)
            return {}

        with patch(
            "api.find_photos._download_selfies",
            new=AsyncMock(return_value=[Path("/tmp/fake_selfie.jpg")]),
        ), patch("api.find_photos.FaceRecognizer") as mock_face_cls, patch(
            "api.find_photos.FlickrSource.cache_key_for_url", return_value="123"
        ), patch(
            "api.find_photos.FlickrSource.download_with_source_urls",
            side_effect=_fake_download,
        ), patch("api.album_cache.reload") as mock_reload, patch(
            "api.album_cache.commit"
        ) as mock_commit:
            mock_face_cls.return_value = self._mock_face()

            client.post(
                "/api/find_photos",
                json={
                    "jobId": "x",
                    "selfieUrls": ["https://example.com/selfie.jpg"],
                    "albumUrls": [
                        "https://www.flickr.com/photos/u/albums/123/"
                    ],
                },
            )

        assert len(captured_dirs) == 1
        # Carpeta efímera bajo el tmpdir de la búsqueda, no la de caché
        assert "albums" in captured_dirs[0].parts
        assert str(tmp_path) not in str(captured_dirs[0])
        # reload() sigue siendo no-op seguro; commit() no se llama porque
        # ningún álbum usó la caché (used_album_cache queda False)
        mock_reload.assert_called_once()
        mock_commit.assert_not_called()


class TestListAlbums:
    """POST /api/list_albums — lista los álbumes públicos de un perfil de
    Flickr (feature de selector, ver PHOTO_SEARCH_TECH.md, sesión 14 sep
    2026). No repite la cobertura de findmyrace/sources/flickr.py — eso
    ya está probado en find-my-race/tests/test_sources.py; aquí solo se
    valida el contrato HTTP de este endpoint."""

    def test_non_profile_url_returns_400(self) -> None:
        """Una URL de álbum concreto (no de perfil) debe rechazarse
        explícitamente, sin llegar a llamar a la red."""
        resp = client.post(
            "/api/list_albums",
            json={"profileUrl": "https://www.flickr.com/photos/u/albums/123456/"},
        )
        assert resp.status_code == 400

    def test_missing_profile_url_rejected(self) -> None:
        resp = client.post("/api/list_albums", json={})
        assert resp.status_code == 422

    def test_profile_url_returns_albums(self) -> None:
        fake_albums = [
            {
                "id": "111",
                "title": "Carrera A",
                "photoCount": 297,
                "url": "https://www.flickr.com/photos/u/albums/111/",
            }
        ]
        with patch(
            "api.find_photos.FlickrSource.list_albums_for_profile",
            return_value=fake_albums,
        ):
            resp = client.post(
                "/api/list_albums",
                json={"profileUrl": "https://www.flickr.com/photos/u/albums/"},
            )
        assert resp.status_code == 200
        assert resp.json() == {"albums": fake_albums}

    def test_profile_fetch_failure_returns_502(self) -> None:
        with patch(
            "api.find_photos.FlickrSource.list_albums_for_profile",
            return_value=None,
        ):
            resp = client.post(
                "/api/list_albums",
                json={"profileUrl": "https://www.flickr.com/photos/u/albums/"},
            )
        assert resp.status_code == 502

    def test_wrong_secret_rejected(self) -> None:
        with patch("api.find_photos.API_SECRET", "supersecret"):
            resp = client.post(
                "/api/list_albums",
                json={"profileUrl": "https://www.flickr.com/photos/u/albums/"},
                headers={"Authorization": "Bearer wrong"},
            )
        assert resp.status_code == 401


class TestAuth:
    def test_no_secret_configured_allows_request(self) -> None:
        """Sin PHOTO_SEARCH_API_SECRET configurado, no bloquea (comportamiento
        de dev local) — pero solo se verifica que no da 401, el resto del
        flujo puede fallar por otros motivos (probado en otros tests)."""
        resp = client.post(
            "/api/find_photos",
            json={"jobId": "x", "selfieUrls": [], "albumUrls": ["https://example.com"]},
        )
        assert resp.status_code != 401

    def test_wrong_secret_rejected(self) -> None:
        with patch("api.find_photos.API_SECRET", "supersecret"):
            resp = client.post(
                "/api/find_photos",
                json={"jobId": "x", "selfieUrls": ["a"], "albumUrls": ["https://example.com"]},
                headers={"Authorization": "Bearer wrong"},
            )
        assert resp.status_code == 401

    def test_correct_secret_passes_auth(self) -> None:
        with patch("api.find_photos.API_SECRET", "supersecret"), patch(
            "api.find_photos._download_selfies", new=AsyncMock(return_value=[])
        ):
            resp = client.post(
                "/api/find_photos",
                json={"jobId": "x", "selfieUrls": ["a"], "albumUrls": ["https://example.com"]},
                headers={"Authorization": "Bearer supersecret"},
            )
        # Pasa la auth (no 401) — el 400 vendría de "no se pudo descargar
        # ninguna selfie", que es un error esperado más adelante en el flujo.
        assert resp.status_code != 401


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
