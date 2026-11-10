"""Moderación: suspender y restaurar avisos y usuarios."""

from __future__ import annotations

from collections.abc import Callable
from email.message import EmailMessage
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update

from app.config import settings
from app.models import User
from app.services import mailer
from app.tests.conftest import create_listing

MakeUser = Callable[..., tuple[TestClient, dict[str, Any]]]
MOD = "/api/v1/admin/moderacion"


def _con_rol(make_user: MakeUser, db: Any, role: str) -> tuple[TestClient, dict]:
    client, data = make_user()
    db.execute(
        update(User).where(User.username == data["user"]["username"]).values(role=role)
    )
    db.commit()
    return client, data["user"]


@pytest.fixture
def sent_mail(monkeypatch: pytest.MonkeyPatch) -> list[EmailMessage]:
    sent: list[EmailMessage] = []
    monkeypatch.setattr(settings, "smtp_host", "smtp.test")
    monkeypatch.setattr(settings, "email_from", "tienda@test.com")
    monkeypatch.setattr(mailer, "send", lambda msg, config=None: sent.append(msg))
    return sent


def test_solo_admin_o_moderador(make_user: MakeUser, db: Any) -> None:
    comun, _ = make_user()
    assert comun.get(f"{MOD}/avisos").status_code == 403
    assert comun.get(f"{MOD}/usuarios").status_code == 403
    moderador, _ = _con_rol(make_user, db, "moderator")
    assert moderador.get(f"{MOD}/avisos").status_code == 200


def test_suspender_y_restaurar_aviso(
    make_user: MakeUser,
    db: Any,
    category_id: str,
    client: TestClient,
    sent_mail: list[EmailMessage],
) -> None:
    admin, _ = _con_rol(make_user, db, "admin")
    vendedor, data = make_user()
    db.execute(
        update(User)
        .where(User.username == data["user"]["username"])
        .values(email="vendedor@mail.com", email_verified=True)
    )
    db.commit()
    aviso = create_listing(vendedor, category_id)
    publico = f"/api/v1/listings/{aviso['id']}"

    encontrados = admin.get(f"{MOD}/avisos", params={"q": "corolla"}).json()
    assert [a["id"] for a in encontrados] == [aviso["id"]]
    assert encontrados[0]["dueno"]["email"] == "vendedor@mail.com"
    por_dueno = admin.get(f"{MOD}/avisos", params={"q": "vendedor@mail"}).json()
    assert [a["id"] for a in por_dueno] == [aviso["id"]]
    assert admin.get(f"{MOD}/avisos", params={"q": "%"}).json() == []

    sin_motivo = admin.post(
        f"{MOD}/avisos/{aviso['id']}/suspender", json={"motivo": "  "}
    )
    assert sin_motivo.status_code == 422
    suspendido = admin.post(
        f"{MOD}/avisos/{aviso['id']}/suspender",
        json={"motivo": "Precio engañoso"},
    ).json()
    assert suspendido["status"] == "suspended"
    assert client.get(publico).status_code == 404
    # El dueño lo ve con el motivo, no lo puede reactivar, y recibió un mail.
    mio = vendedor.get("/api/v1/users/me/listings").json()[0]
    assert mio["moderation_reason"] == "Precio engañoso"
    assert vendedor.put(publico, json={"status": "active"}).status_code == 409
    assert len(sent_mail) == 1 and sent_mail[0]["To"] == "vendedor@mail.com"
    assert "Precio engañoso" in sent_mail[0].get_content()

    filtrados = admin.get(f"{MOD}/avisos", params={"estado": "suspended"}).json()
    assert [a["id"] for a in filtrados] == [aviso["id"]]

    restaurado = admin.post(f"{MOD}/avisos/{aviso['id']}/restaurar").json()
    assert restaurado["status"] == "active"
    assert restaurado["moderation_reason"] is None
    assert client.get(publico).status_code == 200
    otra_vez = admin.post(f"{MOD}/avisos/{aviso['id']}/restaurar")
    assert otra_vez.status_code == 409
    nada = "00000000-0000-4000-8000-000000000000"
    assert (
        admin.post(
            f"{MOD}/avisos/{nada}/suspender", json={"motivo": "x" * 5}
        ).status_code
        == 404
    )

    historial = admin.get(f"{MOD}/historial").json()
    assert [h["action"] for h in historial] == ["restore", "suspend"]
    assert historial[1]["reason"] == "Precio engañoso"
    assert historial[1]["target_label"] == aviso["title"]


def test_suspender_y_reactivar_usuario(
    make_user: MakeUser, db: Any, category_id: str, client: TestClient
) -> None:
    admin, admin_data = _con_rol(make_user, db, "admin")
    vendedor, data = make_user()
    aviso = create_listing(vendedor, category_id)
    usuario_id = data["user"]["id"]

    lista = admin.get(f"{MOD}/usuarios", params={"q": data["user"]["username"]})
    fila = lista.json()[0]
    assert fila["avisos_activos"] == 1 and fila["is_active"] is True

    suspendido = admin.post(
        f"{MOD}/usuarios/{usuario_id}/suspender", json={"motivo": "Estafas"}
    ).json()
    assert suspendido["is_active"] is False
    assert suspendido["suspension_reason"] == "Estafas"
    # Sus avisos dejan de verse y su sesión deja de valer.
    assert client.get(f"/api/v1/listings/{aviso['id']}").status_code == 404
    assert client.get("/api/v1/search", params={"q": "corolla"}).json()["items"] == []
    assert vendedor.get("/api/v1/auth/me").status_code == 401

    reactivado = admin.post(f"{MOD}/usuarios/{usuario_id}/reactivar").json()
    assert reactivado["is_active"] is True and reactivado["suspension_reason"] is None
    assert client.get(f"/api/v1/listings/{aviso['id']}").status_code == 200
    assert admin.post(f"{MOD}/usuarios/{usuario_id}/reactivar").status_code == 409

    # No se puede suspender a uno mismo ni a otro admin o moderador.
    propio = admin.post(
        f"{MOD}/usuarios/{admin_data['id']}/suspender", json={"motivo": "prueba"}
    )
    assert propio.status_code == 409
    _, mod = _con_rol(make_user, db, "moderator")
    assert (
        admin.post(
            f"{MOD}/usuarios/{mod['id']}/suspender", json={"motivo": "prueba"}
        ).status_code
        == 409
    )
