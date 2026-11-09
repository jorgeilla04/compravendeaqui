"""Ingreso por email: código + link de un solo uso que lleva directo a publicar."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, update

from app.config import settings
from app.core.redis import get_redis
from app.models import OtpCode, User
from app.tests.conftest import RecordingSender, create_listing, login

EMAIL = "Juan.Perez@Gmail.com"
NORMALIZED = "juan.perez@gmail.com"


@pytest.fixture(autouse=True)
def email_login(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "login_method", "email")


def _token(link: str | None) -> tuple[str, str]:
    assert link is not None
    parsed = urlparse(link)
    assert link.startswith("https://compravendeaqui.test/ingresar/enlace?")
    query = parse_qs(parsed.query)
    return query["t"][0], query["next"][0]


def _skip_cooldown() -> None:
    """Saltea la espera entre reenvíos."""
    get_redis().flushdb()


def _register(client: TestClient, **extra: object) -> Any:
    return client.post(
        "/api/v1/auth/register",
        json={
            "username": "juanp",
            "full_name": "Juan Pérez",
            "accept_terms": True,
            **extra,
        },
    )


def test_methods_reports_the_login_method(client: TestClient) -> None:
    assert client.get("/api/v1/auth/methods").json() == {"otp": "email"}


def test_without_smtp_returns_503(client: TestClient) -> None:
    response = client.post("/api/v1/auth/otp/request", json={"email": EMAIL})
    assert response.status_code == 503


def test_request_sends_code_and_link_to_publish(
    client: TestClient, otp_sender: RecordingSender, db: Any
) -> None:
    response = client.post("/api/v1/auth/otp/request", json={"email": EMAIL})
    assert response.status_code == 200, response.text
    assert response.json()["destination"] == "ju***@gmail.com"
    assert response.json()["expires_in"] == 15 * 60
    destination, code = otp_sender.sent[-1]
    assert destination == NORMALIZED
    token, next_path = _token(otp_sender.last_link())
    assert next_path == "/publicar"
    stored = db.scalars(select(OtpCode)).one()
    assert stored.destination == NORMALIZED
    # Ni el código ni el token se guardan en claro.
    assert code not in stored.code_hash
    assert stored.link_hash and token not in stored.link_hash


def test_link_keeps_internal_next_and_ignores_external(
    client: TestClient, otp_sender: RecordingSender
) -> None:
    client.post(
        "/api/v1/auth/otp/request", json={"email": EMAIL, "next": "/mis-avisos"}
    )
    assert _token(otp_sender.last_link())[1] == "/mis-avisos"
    _skip_cooldown()
    client.post(
        "/api/v1/auth/otp/request", json={"email": EMAIL, "next": "//evil.com/x"}
    )
    assert _token(otp_sender.last_link())[1] == "/publicar"


def test_only_the_enabled_method_is_accepted(
    client: TestClient, otp_sender: RecordingSender, monkeypatch: pytest.MonkeyPatch
) -> None:
    by_phone = client.post("/api/v1/auth/otp/request", json={"phone": "2644123456"})
    assert by_phone.status_code == 422
    assert by_phone.json()["detail"] == "Ingresá tu email"
    both = client.post(
        "/api/v1/auth/otp/request", json={"email": EMAIL, "phone": "2644123456"}
    )
    assert both.status_code == 422

    monkeypatch.setattr(settings, "login_method", "phone")
    by_email = client.post("/api/v1/auth/otp/request", json={"email": EMAIL})
    assert by_email.status_code == 422
    assert client.get("/api/v1/auth/methods").json() == {"otp": "phone"}


def test_code_creates_account_and_profile_requires_phone(
    client: TestClient, otp_sender: RecordingSender, db: Any
) -> None:
    client.post("/api/v1/auth/otp/request", json={"email": EMAIL})
    response = client.post(
        "/api/v1/auth/otp/verify", json={"email": EMAIL, "code": otp_sender.last_code()}
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["is_new_user"] is True
    assert data["user"]["email"] == NORMALIZED
    assert data["user"]["email_verified"] is True
    assert data["user"]["phone_masked"] is None

    missing = _register(client)
    assert missing.status_code == 422
    assert "celular" in missing.json()["detail"]

    done = _register(client, phone="264 412-3456", email="otro@mail.com")
    assert done.status_code == 200, done.text
    me = done.json()
    assert me["profile_pending"] is False
    assert me["phone_masked"] == "+54 9 264 ***-3456"
    assert me["phone_verified"] is False
    # El email verificado del ingreso no se reemplaza desde el registro.
    assert me["email"] == NORMALIZED


def test_link_signs_in_once(
    client: TestClient, otp_sender: RecordingSender, db: Any
) -> None:
    client.post("/api/v1/auth/otp/request", json={"email": EMAIL})
    token, _ = _token(otp_sender.last_link())

    # Se abre en otro dispositivo (el celular): no hay cookie previa.
    phone_browser = TestClient(client.app, headers=dict(client.headers))
    response = phone_browser.post("/api/v1/auth/otp/link", json={"token": token})
    assert response.status_code == 200, response.text
    assert response.json()["user"]["email"] == NORMALIZED
    assert phone_browser.get("/api/v1/auth/me").status_code == 200

    again = client.post("/api/v1/auth/otp/link", json={"token": token})
    assert again.status_code == 400
    # Usar el link también quema el código del mismo mail.
    code = client.post(
        "/api/v1/auth/otp/verify", json={"email": EMAIL, "code": otp_sender.last_code()}
    )
    assert code.status_code == 400


def test_expired_or_unknown_link_is_rejected(
    client: TestClient, otp_sender: RecordingSender, db: Any
) -> None:
    client.post("/api/v1/auth/otp/request", json={"email": EMAIL})
    token, _ = _token(otp_sender.last_link())
    db.execute(
        update(OtpCode).values(expires_at=datetime.now(UTC) - timedelta(minutes=1))
    )
    db.commit()
    expired = client.post("/api/v1/auth/otp/link", json={"token": token})
    assert expired.status_code == 400
    assert "venció" in expired.json()["detail"]
    unknown = client.post("/api/v1/auth/otp/link", json={"token": "x" * 43})
    assert unknown.status_code == 400


def test_new_link_invalidates_the_previous_one(
    client: TestClient, otp_sender: RecordingSender
) -> None:
    client.post("/api/v1/auth/otp/request", json={"email": EMAIL})
    first, _ = _token(otp_sender.last_link())
    _skip_cooldown()
    client.post("/api/v1/auth/otp/request", json={"email": EMAIL})
    assert (
        client.post("/api/v1/auth/otp/link", json={"token": first}).status_code == 400
    )


def test_unverified_email_on_other_profile_does_not_grant_access(
    client: TestClient,
    otp_sender: RecordingSender,
    db: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Alguien con ingreso por celular carga en su perfil el email de otra persona.
    monkeypatch.setattr(settings, "login_method", "phone")
    squatter = TestClient(client.app, headers=dict(client.headers))
    login(squatter, otp_sender, "2644999888")
    assert squatter.put("/api/v1/users/me", json={"email": EMAIL}).status_code == 200

    # El dueño real ingresa con el código de su mail: cuenta propia y nueva.
    monkeypatch.setattr(settings, "login_method", "email")
    client.post("/api/v1/auth/otp/request", json={"email": EMAIL})
    response = client.post(
        "/api/v1/auth/otp/verify", json={"email": EMAIL, "code": otp_sender.last_code()}
    )
    assert response.status_code == 200
    assert response.json()["is_new_user"] is True
    users = {u.phone: u for u in db.scalars(select(User)).all()}
    assert users["+5492644999888"].email is None
    assert users[None].email == NORMALIZED


def test_password_login_with_email(
    client: TestClient, otp_sender: RecordingSender
) -> None:
    client.post("/api/v1/auth/otp/request", json={"email": EMAIL})
    client.post(
        "/api/v1/auth/otp/verify", json={"email": EMAIL, "code": otp_sender.last_code()}
    )
    _register(client, phone="2644123456", password="clave-segura-1")
    fresh = TestClient(client.app, headers=dict(client.headers))
    ok = fresh.post(
        "/api/v1/auth/login", json={"email": EMAIL, "password": "clave-segura-1"}
    )
    assert ok.status_code == 200, ok.text
    bad = fresh.post("/api/v1/auth/login", json={"email": EMAIL, "password": "nop"})
    assert bad.status_code == 401
    assert bad.json()["detail"] == "Email o contraseña incorrectos"


def test_profile_keeps_login_email_and_phone_is_editable(
    client: TestClient, otp_sender: RecordingSender
) -> None:
    client.post("/api/v1/auth/otp/request", json={"email": EMAIL})
    client.post(
        "/api/v1/auth/otp/verify", json={"email": EMAIL, "code": otp_sender.last_code()}
    )
    _register(client, phone="2644123456")
    change_email = client.put("/api/v1/users/me", json={"email": "nuevo@mail.com"})
    assert change_email.status_code == 409
    same_email = client.put("/api/v1/users/me", json={"email": EMAIL})
    assert same_email.status_code == 200
    phone = client.put("/api/v1/users/me", json={"phone": "264 555-1234"})
    assert phone.status_code == 200
    assert phone.json()["phone_masked"] == "+54 9 264 ***-1234"
    bad = client.put("/api/v1/users/me", json={"phone": "123"})
    assert bad.status_code == 422


def test_seller_without_verified_phone_still_gets_whatsapp_contact(
    client: TestClient, otp_sender: RecordingSender, category_id: str
) -> None:
    client.post("/api/v1/auth/otp/request", json={"email": EMAIL})
    client.post(
        "/api/v1/auth/otp/verify", json={"email": EMAIL, "code": otp_sender.last_code()}
    )
    _register(client, phone="2644123456")
    listing = create_listing(client, category_id)
    contact = client.post(f"/api/v1/listings/{listing['id']}/contact")
    assert contact.status_code == 200, contact.text
    assert contact.json()["whatsapp_url"].startswith("https://wa.me/5492644123456")


def test_invalid_email_message_is_in_spanish(client: TestClient) -> None:
    response = client.post("/api/v1/auth/otp/request", json={"email": "juan@gmail"})
    assert response.status_code == 422
    assert "Revisá el email" in response.json()["detail"][0]["msg"]


def test_phone_verified_by_another_account_cannot_be_used(
    client: TestClient,
    otp_sender: RecordingSender,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "login_method", "phone")
    owner = TestClient(client.app, headers=dict(client.headers))
    login(owner, otp_sender, "2644777666")

    monkeypatch.setattr(settings, "login_method", "email")
    client.post("/api/v1/auth/otp/request", json={"email": EMAIL})
    client.post(
        "/api/v1/auth/otp/verify", json={"email": EMAIL, "code": otp_sender.last_code()}
    )
    taken = _register(client, phone="264 477-7666")
    assert taken.status_code == 409
    assert taken.json()["detail"].startswith("No podemos usar ese celular")
    assert _register(client, phone="264 477-7667").status_code == 200
    again = client.put("/api/v1/users/me", json={"phone": "2644777666"})
    assert again.status_code == 409


def test_verifying_a_phone_releases_it_from_unverified_profiles(
    client: TestClient,
    otp_sender: RecordingSender,
    db: Any,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Alguien con ingreso por email carga como contacto un celular ajeno.
    client.post("/api/v1/auth/otp/request", json={"email": EMAIL})
    client.post(
        "/api/v1/auth/otp/verify", json={"email": EMAIL, "code": otp_sender.last_code()}
    )
    assert _register(client, phone="2644333222").status_code == 200

    # El dueño real ingresa con ese celular: el número deja de ser del otro.
    monkeypatch.setattr(settings, "login_method", "phone")
    owner = TestClient(client.app, headers=dict(client.headers))
    login(owner, otp_sender, "2644333222")
    squatter = db.scalars(select(User).where(User.email == NORMALIZED)).one()
    assert squatter.phone is None
    owner_row = db.scalars(select(User).where(User.phone == "+5492644333222")).one()
    assert owner_row.phone_verified is True


def test_profile_changes_are_rate_limited(
    client: TestClient, otp_sender: RecordingSender
) -> None:
    client.post("/api/v1/auth/otp/request", json={"email": EMAIL})
    client.post(
        "/api/v1/auth/otp/verify", json={"email": EMAIL, "code": otp_sender.last_code()}
    )
    _register(client, phone="2644123456")
    statuses = [
        client.put("/api/v1/users/me", json={"full_name": f"Juan {i}"}).status_code
        for i in range(21)
    ]
    assert statuses[:19] == [200] * 19
    assert statuses[-1] == 429
