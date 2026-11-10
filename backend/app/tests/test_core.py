"""Piezas sueltas: teléfonos, slugs, FX, seguridad HTTP, imágenes, SEO."""

from __future__ import annotations

from collections.abc import Callable
from decimal import Decimal
from typing import Any

import httpx
import pytest
import respx
from fastapi.testclient import TestClient

from app.core.phone import InvalidPhoneError, mask_phone, normalize_ar_mobile
from app.core.redis import get_redis
from app.core.slug import slugify, unique_listing_slug
from app.services import fx
from app.services.images import InvalidImageError, process_image
from app.tests.conftest import create_listing

MakeUser = Callable[..., tuple[TestClient, dict[str, Any]]]


@pytest.mark.parametrize(
    "raw",
    [
        "264 412-3456",
        "0264 15 412 3456",
        "+54 9 264 4123456",
        "5492644123456",
        "0264 4123456",
    ],
)
def test_phone_normalization(raw: str) -> None:
    assert normalize_ar_mobile(raw) == "+5492644123456"


@pytest.mark.parametrize("raw", ["", "123", "+1 415 555 0100", "abc"])
def test_phone_rejects(raw: str) -> None:
    with pytest.raises(InvalidPhoneError):
        normalize_ar_mobile(raw)


def test_mask_phone() -> None:
    assert mask_phone("+5492644123456") == "+54 9 264 ***-3456"


def test_slugs() -> None:
    assert slugify("Camión Ñandú 4x4 ¡Oferta!") == "camion-nandu-4x4-oferta"
    assert slugify("!!!") == "aviso"
    a, b = unique_listing_slug("Toyota"), unique_listing_slug("Toyota")
    assert a.startswith("toyota-") and a != b


def test_fx_caches_and_falls_back(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = {"n": 0}

    def fetch() -> Decimal:
        calls["n"] += 1
        return Decimal("1250.5")

    monkeypatch.setattr(fx, "fetch_rate", fetch)
    assert fx.get_usd_ars_rate() == Decimal("1250.5")
    assert fx.get_usd_ars_rate() == Decimal("1250.5")
    assert calls["n"] == 1

    get_redis().delete(fx.CACHE_KEY)

    def broken() -> Decimal:
        raise httpx.ConnectError("caído")

    monkeypatch.setattr(fx, "fetch_rate", broken)
    assert fx.get_usd_ars_rate() == Decimal("1250.5")  # última conocida
    get_redis().delete(fx.LAST_KNOWN_KEY)
    assert fx.get_usd_ars_rate() is None


@respx.mock
def test_fx_fetch_parses_dolarapi(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.undo()
    respx.get("https://dolarapi.com/v1/dolares/blue").mock(
        return_value=httpx.Response(
            200, json={"compra": 1180, "venta": 1205.5, "casa": "blue"}
        )
    )
    assert fx.fetch_rate() == Decimal("1205.5")


def test_to_usd() -> None:
    assert fx.to_usd(Decimal("100"), "USD", None) == Decimal("100")
    assert fx.to_usd(Decimal("1000"), "ARS", Decimal("3")) == Decimal("333.33")
    assert fx.to_usd(Decimal("1000"), "ARS", None) is None
    assert fx.to_usd(None, "ARS", Decimal("3")) is None


def test_foreign_origin_is_blocked(client: TestClient) -> None:
    evil = TestClient(client.app, headers={"Origin": "https://evil.example"})
    assert evil.post("/api/v1/auth/logout").status_code == 403
    referer = TestClient(client.app, headers={"Referer": "https://evil.example/page"})
    assert referer.post("/api/v1/auth/logout").status_code == 403
    assert evil.get("/api/v1/categories").status_code == 200  # GET no modifica estado


def test_security_headers(client: TestClient) -> None:
    response = client.get("/health")
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"


def test_process_image_rejects_gif() -> None:
    import io

    from PIL import Image

    out = io.BytesIO()
    Image.new("RGB", (10, 10)).save(out, format="GIF")
    with pytest.raises(InvalidImageError):
        process_image(out.getvalue())


def test_sitemap(make_user: MakeUser, category_id: str, client: TestClient) -> None:
    seller, _ = make_user()
    listing = create_listing(seller, category_id)
    paths = [e["path"] for e in client.get("/api/v1/seo/sitemap").json()]
    assert "/autos" in paths and listing["url_path"] in paths


def test_cookie_session_without_origin_is_rejected(client: TestClient) -> None:
    bare = TestClient(client.app)
    bare.cookies.set("cva_access", "x")
    assert bare.post("/api/v1/auth/logout").status_code == 403
    # Sin cookies (cliente API con Bearer) no aplica.
    assert TestClient(client.app).post("/api/v1/auth/logout").status_code == 204


def test_spoofed_real_ip_from_untrusted_peer_is_ignored(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from starlette.requests import Request

    from app.config import settings
    from app.core.ratelimit import client_ip

    def request(peer: str) -> Request:
        scope = {
            "type": "http",
            "headers": [(b"x-real-ip", b"1.2.3.4")],
            "client": (peer, 1),
        }
        return Request(scope)

    monkeypatch.setattr(settings, "trusted_proxies", ["127.0.0.1"])
    assert client_ip(request("127.0.0.1")) == "1.2.3.4"
    assert client_ip(request("8.8.8.8")) == "8.8.8.8"


def test_production_requires_secure_cookies() -> None:
    from app.config import Settings

    with pytest.raises(ValueError, match="COOKIE_SECURE"):
        Settings(environment="production", jwt_secret_key="x" * 40, cookie_secure=False)
    with pytest.raises(ValueError, match="JWT_SECRET_KEY"):
        Settings(environment="production", cookie_secure=True)
    with pytest.raises(ValueError, match="JWT_SECRET_KEY"):
        Settings(environment="production", cookie_secure=True, jwt_secret_key="corta")


def test_trusted_proxy_accepts_cidr(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.config import settings
    from app.core.ratelimit import is_trusted_proxy

    monkeypatch.setattr(settings, "trusted_proxies", ["172.16.0.0/12", "127.0.0.1"])
    assert is_trusted_proxy("172.18.0.5")
    assert is_trusted_proxy("127.0.0.1")
    assert not is_trusted_proxy("8.8.8.8")
    assert not is_trusted_proxy("no-es-ip")
    assert not is_trusted_proxy(None)


def test_aviso_de_integraciones_segun_el_ingreso(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    from app import main

    monkeypatch.setattr(main, "configured_senders", lambda: [])
    monkeypatch.setattr(main.settings, "login_method", "email")
    main._log_integrations()
    salida = capsys.readouterr().out
    assert "SMTP_HOST y EMAIL_FROM" in salida and "TWILIO" not in salida
    monkeypatch.setattr(main.settings, "login_method", "phone")
    main._log_integrations()
    assert "WHATSAPP_* y/o TWILIO_*" in capsys.readouterr().out
