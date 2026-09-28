"""Fixtures compartidas para los tests."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client() -> TestClient:
    """Cliente HTTP de pruebas contra la app FastAPI."""
    return TestClient(app)
