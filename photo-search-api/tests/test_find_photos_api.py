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
                "albumUrl": "https://example.com",
            },
        )
        assert resp.status_code == 422

    def test_no_selfies_rejected(self) -> None:
        resp = client.post(
            "/api/find_photos",
            json={"jobId": "x", "selfieUrls": [], "albumUrl": "https://example.com"},
        )
        assert resp.status_code == 422


class TestUnsupportedAlbumSource:
    def test_non_flickr_url_returns_400(self) -> None:
        """get_source_for_url lanza ValueError para proveedores sin
        downloader (fotoscarreras.com, barrel.cloud, etc. — ver TECH.md
        §15.1/§14.3). Debe traducirse en un 400 explícito, no un 500."""
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
                    "albumUrl": "https://fotoscarreras.com/algun-album",
                },
            )
        assert resp.status_code == 400


class TestAuth:
    def test_no_secret_configured_allows_request(self) -> None:
        """Sin PHOTO_SEARCH_API_SECRET configurado, no bloquea (comportamiento
        de dev local) — pero solo se verifica que no da 401, el resto del
        flujo puede fallar por otros motivos (probado en otros tests)."""
        resp = client.post(
            "/api/find_photos",
            json={"jobId": "x", "selfieUrls": [], "albumUrl": "https://example.com"},
        )
        assert resp.status_code != 401

    def test_wrong_secret_rejected(self) -> None:
        with patch("api.find_photos.API_SECRET", "supersecret"):
            resp = client.post(
                "/api/find_photos",
                json={"jobId": "x", "selfieUrls": ["a"], "albumUrl": "https://example.com"},
                headers={"Authorization": "Bearer wrong"},
            )
        assert resp.status_code == 401

    def test_correct_secret_passes_auth(self) -> None:
        with patch("api.find_photos.API_SECRET", "supersecret"), patch(
            "api.find_photos._download_selfies", new=AsyncMock(return_value=[])
        ):
            resp = client.post(
                "/api/find_photos",
                json={"jobId": "x", "selfieUrls": ["a"], "albumUrl": "https://example.com"},
                headers={"Authorization": "Bearer supersecret"},
            )
        # Pasa la auth (no 401) — el 400 vendría de "no se pudo descargar
        # ninguna selfie", que es un error esperado más adelante en el flujo.
        assert resp.status_code != 401


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
