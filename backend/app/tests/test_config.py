"""Regresión: CORS_ORIGINS como cadena separada por comas debe parsear
sin crashear.

Antes del fix, pydantic-settings intentaba json.loads() sobre el valor del
env/.env y levantaba SettingsError al instanciar. El `NoDecode` en
app.config.Settings.cors_origins delega el parseo al validador
_split_cors_origins. Este test blinda ese comportamiento.
"""

from __future__ import annotations

import pytest

from app.config import Settings


def test_cors_origins_parses_comma_separated(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(
        "CORS_ORIGINS",
        "http://localhost:3000,https://compravendeaqui.com",
    )

    settings = Settings()

    assert settings.cors_origins == [
        "http://localhost:3000",
        "https://compravendeaqui.com",
    ]


def test_cors_origins_trims_whitespace(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CORS_ORIGINS", " http://a.com ,  http://b.com ")

    settings = Settings()

    assert settings.cors_origins == ["http://a.com", "http://b.com"]


def test_cors_origins_single_value(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:3000")

    settings = Settings()

    assert settings.cors_origins == ["http://localhost:3000"]
