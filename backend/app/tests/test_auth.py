"""Flujo de autenticación por OTP, password y sesiones."""

from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.models import OtpCode, User
from app.tests.conftest import RecordingSender, login

PHONE = "0264 15 412 3456"
E164 = "+5492644123456"


def test_otp_request_without_providers_returns_503(client: TestClient) -> None:
    response = client.post("/api/v1/auth/otp/request", json={"phone": PHONE})
    assert response.status_code == 503
    assert "No pudimos enviarte el código" in response.json()["detail"]


def test_otp_request_sends_code_and_stores_only_hash(
    client: TestClient, otp_sender: RecordingSender, db: Any
) -> None:
    response = client.post("/api/v1/auth/otp/request", json={"phone": PHONE})
    assert response.status_code == 200
    body = response.json()
    assert body["channel"] == "whatsapp"
    assert body["phone"] == "+54 9 264 ***-3456"
    sent_phone, code = otp_sender.sent[-1]
    assert sent_phone == E164 and len(code) == 6

    stored = db.scalars(select(OtpCode).where(OtpCode.phone == E164)).one()
    assert stored.code_hash != code and code not in stored.code_hash


def test_invalid_phone_is_rejected(
    client: TestClient, otp_sender: RecordingSender
) -> None:
    assert (
        client.post(
            "/api/v1/auth/otp/request", json={"phone": "+1 415 555 0100"}
        ).status_code
        == 422
    )


def test_resend_cooldown(client: TestClient, otp_sender: RecordingSender) -> None:
    assert (
        client.post("/api/v1/auth/otp/request", json={"phone": PHONE}).status_code
        == 200
    )
    again = client.post("/api/v1/auth/otp/request", json={"phone": PHONE})
    assert again.status_code == 429
    assert "Retry-After" in again.headers


def test_verify_creates_user_and_sets_cookies(
    client: TestClient, otp_sender: RecordingSender
) -> None:
    client.post("/api/v1/auth/otp/request", json={"phone": PHONE})
    response = client.post(
        "/api/v1/auth/otp/verify", json={"phone": PHONE, "code": otp_sender.last_code()}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["is_new_user"] is True
    assert data["user"]["profile_pending"] is True
    assert "cva_access" in response.cookies and "cva_refresh" in response.cookies

    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["phone_masked"] == "+54 9 264 ***-3456"


def test_code_is_single_use(client: TestClient, otp_sender: RecordingSender) -> None:
    client.post("/api/v1/auth/otp/request", json={"phone": PHONE})
    code = otp_sender.last_code()
    assert (
        client.post(
            "/api/v1/auth/otp/verify", json={"phone": PHONE, "code": code}
        ).status_code
        == 200
    )
    assert (
        client.post(
            "/api/v1/auth/otp/verify", json={"phone": PHONE, "code": code}
        ).status_code
        == 400
    )


def test_wrong_code_counts_down_then_locks(
    client: TestClient, otp_sender: RecordingSender
) -> None:
    client.post("/api/v1/auth/otp/request", json={"phone": PHONE})
    good = otp_sender.last_code()
    wrong = "000000" if good != "000000" else "111111"
    first = client.post("/api/v1/auth/otp/verify", json={"phone": PHONE, "code": wrong})
    assert first.status_code == 400 and "4 intentos" in first.json()["detail"]
    for _ in range(3):
        client.post("/api/v1/auth/otp/verify", json={"phone": PHONE, "code": wrong})
    locked = client.post(
        "/api/v1/auth/otp/verify", json={"phone": PHONE, "code": wrong}
    )
    assert locked.status_code == 429
    # Bloqueado: ni el código correcto entra, ni se puede pedir otro.
    assert (
        client.post(
            "/api/v1/auth/otp/verify", json={"phone": PHONE, "code": good}
        ).status_code
        == 429
    )
    assert (
        client.post("/api/v1/auth/otp/request", json={"phone": PHONE}).status_code
        == 429
    )


def test_register_completes_profile(
    client: TestClient, otp_sender: RecordingSender
) -> None:
    client.post("/api/v1/auth/otp/request", json={"phone": PHONE})
    client.post(
        "/api/v1/auth/otp/verify", json={"phone": PHONE, "code": otp_sender.last_code()}
    )
    rejected = client.post(
        "/api/v1/auth/register",
        json={"username": "juan.sj", "full_name": "Juan Pérez", "accept_terms": False},
    )
    assert rejected.status_code == 422
    response = client.post(
        "/api/v1/auth/register",
        json={
            "username": "juan.sj",
            "full_name": "Juan Pérez",
            "email": "juan@example.com",
            "password": "una-clave-segura",
            "accept_terms": True,
        },
    )
    assert response.status_code == 200
    me = response.json()
    assert me["profile_pending"] is False and me["has_password"] is True
    assert me["display_name"] == "Juan Pérez"


def test_returning_user_is_not_new(
    client: TestClient, otp_sender: RecordingSender
) -> None:
    login(client, otp_sender, PHONE)
    other = TestClient(client.app, headers={"Origin": "http://localhost:3000"})
    other.post("/api/v1/auth/otp/request", json={"phone": PHONE})
    # El cooldown es por teléfono: se limpia para simular el reingreso más tarde.
    from app.core.redis import get_redis

    get_redis().delete(f"otp:cooldown:{E164}")
    other.post("/api/v1/auth/otp/request", json={"phone": PHONE})
    data = other.post(
        "/api/v1/auth/otp/verify", json={"phone": PHONE, "code": otp_sender.last_code()}
    ).json()
    assert data["is_new_user"] is False


def test_password_login_and_lockout(
    client: TestClient, otp_sender: RecordingSender
) -> None:
    login(client, otp_sender, PHONE)
    client.put("/api/v1/users/me/password", json={"new_password": "una-clave-segura"})
    anon = TestClient(client.app, headers={"Origin": "http://localhost:3000"})
    ok = anon.post(
        "/api/v1/auth/login", json={"phone": PHONE, "password": "una-clave-segura"}
    )
    assert ok.status_code == 200
    for _ in range(4):
        assert (
            anon.post(
                "/api/v1/auth/login", json={"phone": PHONE, "password": "mal"}
            ).status_code
            == 401
        )
    assert (
        anon.post(
            "/api/v1/auth/login", json={"phone": PHONE, "password": "mal"}
        ).status_code
        == 429
    )
    assert (
        anon.post(
            "/api/v1/auth/login", json={"phone": PHONE, "password": "una-clave-segura"}
        ).status_code
        == 429
    )


def test_password_login_unknown_user_is_generic(client: TestClient) -> None:
    response = client.post("/api/v1/auth/login", json={"phone": PHONE, "password": "x"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Teléfono o contraseña incorrectos"


def test_refresh_rotates_and_detects_reuse(
    client: TestClient, otp_sender: RecordingSender
) -> None:
    login(client, otp_sender, PHONE)
    old_refresh = client.cookies.get("cva_refresh")
    rotated = client.post("/api/v1/auth/refresh")
    assert rotated.status_code == 200
    new_refresh = client.cookies.get("cva_refresh")
    assert new_refresh and new_refresh != old_refresh

    # Reusar el token viejo (robado) revoca todas las sesiones.
    reuse = client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
    assert reuse.status_code == 401
    assert (
        client.post(
            "/api/v1/auth/refresh", json={"refresh_token": new_refresh}
        ).status_code
        == 401
    )


def test_logout_revokes_refresh(
    client: TestClient, otp_sender: RecordingSender
) -> None:
    login(client, otp_sender, PHONE)
    refresh = client.cookies.get("cva_refresh")
    assert client.post("/api/v1/auth/logout").status_code == 204
    assert (
        client.post("/api/v1/auth/refresh", json={"refresh_token": refresh}).status_code
        == 401
    )


def test_me_requires_auth(client: TestClient) -> None:
    assert client.get("/api/v1/auth/me").status_code == 401
    assert (
        client.get(
            "/api/v1/auth/me", headers={"Authorization": "Bearer basura"}
        ).status_code
        == 401
    )


def test_bearer_token_works(client: TestClient, otp_sender: RecordingSender) -> None:
    data = login(client, otp_sender, PHONE)
    anon = TestClient(client.app)
    me = anon.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {data['access_token']}"}
    )
    assert me.status_code == 200


def test_suspended_user_cannot_login(
    client: TestClient, otp_sender: RecordingSender, db: Any
) -> None:
    login(client, otp_sender, PHONE)
    user = db.scalars(select(User).where(User.phone == E164)).one()
    user.is_active = False
    db.commit()
    from app.core.redis import get_redis

    get_redis().delete(f"otp:cooldown:{E164}")
    client.post("/api/v1/auth/otp/request", json={"phone": PHONE})
    response = client.post(
        "/api/v1/auth/otp/verify", json={"phone": PHONE, "code": otp_sender.last_code()}
    )
    assert response.status_code == 403


def test_register_only_once(client: TestClient, otp_sender: RecordingSender) -> None:
    login(client, otp_sender, PHONE)
    again = client.post(
        "/api/v1/auth/register",
        json={
            "username": "otro.nombre",
            "full_name": "Otro",
            "password": "pisar-la-clave",
            "accept_terms": True,
        },
    )
    assert again.status_code == 409


def test_password_change_closes_other_sessions(
    client: TestClient, otp_sender: RecordingSender
) -> None:
    from app.core.redis import get_redis

    login(client, otp_sender, PHONE)
    other_device = TestClient(client.app, headers={"Origin": "http://localhost:3000"})
    get_redis().delete(f"otp:cooldown:{E164}")
    other_device.post("/api/v1/auth/otp/request", json={"phone": PHONE})
    other_device.post(
        "/api/v1/auth/otp/verify", json={"phone": PHONE, "code": otp_sender.last_code()}
    )
    other_refresh = other_device.cookies.get("cva_refresh")

    assert (
        client.put(
            "/api/v1/users/me/password", json={"new_password": "nueva-clave-123"}
        ).status_code
        == 204
    )
    # La sesión actual sigue (cookies nuevas); la del otro dispositivo, no.
    assert client.get("/api/v1/auth/me").status_code == 200
    assert client.post("/api/v1/auth/refresh").status_code == 200
    assert (
        other_device.post(
            "/api/v1/auth/refresh", json={"refresh_token": other_refresh}
        ).status_code
        == 401
    )
