"""Paquetes turísticos: salidas con cupos, reservas con seña y consultas."""

from __future__ import annotations

import json
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from email.message import EmailMessage
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import update

from app.config import settings
from app.models import Reserva, User
from app.scripts.importar_paquetes import main as importar
from app.services import mailer
from app.tests.conftest import jpeg_bytes

API = "/api/v1/transporte/blanca-paloma"
ADMIN = "/api/v1/admin/transporte/blanca-paloma"
MakeUser = Callable[..., tuple[TestClient, dict[str, Any]]]

PAQUETE = {
    "titulo": "Mar del Plata – Preventa verano 2027",
    "resumen": "10 días y 7 noches frente al mar.",
    "descripcion": "Salidas en enero y febrero.",
    "dias": 10,
    "noches": 7,
    "incluye": ["Transporte", " Hotel 3 estrellas ", ""],
    "precio_desde": "700000",
}
CLIENTE = {
    "nombre": "Laura  Gómez",
    "email": "laura@gmail.com",
    "telefono": "264 555-1234",
    "dni": "30111222",
}


@pytest.fixture
def mails(monkeypatch: pytest.MonkeyPatch) -> list[EmailMessage]:
    sent: list[EmailMessage] = []
    monkeypatch.setattr(settings, "smtp_host", "smtp.test")
    monkeypatch.setattr(settings, "email_from", "CVA <no-responder@cva.test>")
    monkeypatch.setattr(mailer, "send", lambda msg, config=None: sent.append(msg))
    return sent


@pytest.fixture
def admin(make_user: MakeUser, db: Any) -> TestClient:
    client, data = make_user()
    db.execute(
        update(User)
        .where(User.username == data["user"]["username"])
        .values(role="admin")
    )
    db.commit()
    return client


@pytest.fixture
def paquete(admin: TestClient) -> dict[str, Any]:
    r = admin.post(f"{ADMIN}/paquetes", json=PAQUETE)
    assert r.status_code == 201, r.text
    slug = r.json()["slug"]
    r = admin.post(
        f"{ADMIN}/paquetes/{slug}/salidas",
        json={"nombre": "Enero 2027", "precio_persona": "700000", "cupos": 5},
    )
    assert r.status_code == 201, r.text
    data: dict[str, Any] = r.json()
    return data


def _cuerpo(msg: EmailMessage) -> str:
    return msg.get_body(("plain",)).get_content()  # type: ignore[union-attr]


def test_paquete_publico(client: TestClient, paquete: dict[str, Any]) -> None:
    assert paquete["slug"] == "mar-del-plata-preventa-verano-2027"
    assert paquete["incluye"] == ["Transporte", "Hotel 3 estrellas"]
    (resumen,) = client.get(f"{API}/paquetes").json()
    assert resumen["titulo"] == PAQUETE["titulo"]

    data = client.get(f"{API}/paquetes/{paquete['slug']}").json()
    (salida,) = data["salidas"]
    assert salida["disponibles"] == 5
    assert "cupos" not in salida
    assert data["sena_pct"] == 30
    assert data["whatsapp_url"].startswith("https://wa.me/5492644148579?text=")


def test_reserva_toma_cupos_y_avisa(
    client: TestClient,
    admin: TestClient,
    paquete: dict[str, Any],
    mails: list[EmailMessage],
) -> None:
    admin.put(
        ADMIN,
        json={
            "nombre": "Blanca Paloma",
            "whatsapp": "264 414-8579",
            "email": "ventas@bp.com.ar",
            "minimo": "120000",
            "espera_hora": "15000",
            "sena_pct": 20,
            "datos_transferencia": "Alias: BLANCA.PALOMA.VIAJES",
        },
    )
    salida_id = paquete["salidas"][0]["id"]
    url = f"{API}/paquetes/{paquete['slug']}/reservas"
    r = client.post(url, json={**CLIENTE, "salida_id": salida_id, "pasajeros": 3})
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["codigo"].startswith("R-")
    assert float(data["total"]) == 2_100_000
    assert float(data["sena"]) == 420_000
    assert data["datos_transferencia"] == "Alias: BLANCA.PALOMA.VIAJES"

    agencia, cliente = mails
    assert agencia["To"] == "ventas@bp.com.ar"
    assert agencia["Reply-To"] == "laura@gmail.com"
    assert "DNI 30111222" in _cuerpo(agencia)
    assert cliente["To"] == "laura@gmail.com"
    assert "BLANCA.PALOMA.VIAJES" in _cuerpo(cliente)
    assert "$420.000" in _cuerpo(cliente)

    # Quedan 2: no se sobrevende.
    r = client.post(url, json={**CLIENTE, "salida_id": salida_id, "pasajeros": 3})
    assert r.status_code == 409
    assert "Quedan 2 lugares" in r.json()["detail"]
    detalle = client.get(f"{API}/paquetes/{paquete['slug']}").json()
    assert detalle["salidas"][0]["disponibles"] == 2

    # Cancelar libera los lugares; no se puede bajar el cupo de lo reservado.
    (reserva,) = admin.get(f"{ADMIN}/reservas").json()
    assert reserva["estado"] == "pendiente_sena"
    r = admin.put(
        f"{ADMIN}/paquetes/{paquete['slug']}/salidas/{salida_id}",
        json={"nombre": "Enero 2027", "precio_persona": "700000", "cupos": 2},
    )
    assert r.status_code == 409
    r = admin.put(f"{ADMIN}/reservas/{reserva['id']}", json={"estado": "cancelada"})
    assert r.json()["estado"] == "cancelada"
    detalle = client.get(f"{API}/paquetes/{paquete['slug']}").json()
    assert detalle["salidas"][0]["disponibles"] == 5


def test_consulta(
    client: TestClient,
    admin: TestClient,
    paquete: dict[str, Any],
    mails: list[EmailMessage],
) -> None:
    r = client.post(
        f"{API}/consultas",
        json={
            "paquete": paquete["slug"],
            "nombre": "Pedro",
            "telefono": "2645551234",
            "mensaje": "¿Hay lugar para 4 en febrero?",
        },
    )
    assert r.status_code == 201, r.text
    assert r.json()["whatsapp_url"].startswith("https://wa.me/5492644148579")
    (msg,) = mails
    assert "Mar del Plata" in msg["Subject"]
    assert "febrero" in _cuerpo(msg)

    (consulta,) = admin.get(f"{ADMIN}/consultas").json()
    assert consulta["paquete_titulo"] == PAQUETE["titulo"]
    r = admin.put(f"{ADMIN}/consultas/{consulta['id']}", json={"estado": "respondida"})
    assert r.json()["estado"] == "respondida"
    assert client.post(f"{API}/consultas", json={"nombre": "X"}).status_code == 422


def test_importar_paquetes(tmp_path: Path, client: TestClient) -> None:
    (tmp_path / "mdq.jpg").write_bytes(jpeg_bytes((800, 600)))
    archivo = tmp_path / "paquetes.json"
    archivo.write_text(
        json.dumps(
            {
                "transportista": "blanca-paloma",
                "paquetes": [
                    {
                        **PAQUETE,
                        "foto": "mdq.jpg",
                        "salidas": [
                            {
                                "nombre": "Enero 2027",
                                "precio_persona": 700000,
                                "cupos": 40,
                            }
                        ],
                    }
                ],
            }
        )
    )
    assert importar([str(archivo)]) == "1 paquetes nuevos y 0 actualizados de 1"
    assert importar([str(archivo)]) == "0 paquetes nuevos y 1 actualizados de 1"
    data = client.get(f"{API}/paquetes/mar-del-plata-preventa-verano-2027").json()
    assert data["foto_url"].endswith(".webp")
    assert len(data["salidas"]) == 1  # no se duplican al reimportar


def test_reserva_sin_sena_vence(
    client: TestClient,
    admin: TestClient,
    paquete: dict[str, Any],
    db: Any,
    mails: list[EmailMessage],
) -> None:
    salida_id = paquete["salidas"][0]["id"]
    url = f"{API}/paquetes/{paquete['slug']}"
    r = client.post(
        f"{url}/reservas", json={**CLIENTE, "salida_id": salida_id, "pasajeros": 4}
    )
    assert r.status_code == 201, r.text
    # El mail al cliente no lleva lo que escribió quien reservó.
    cliente = mails[1]
    assert "30111222" not in _cuerpo(cliente)
    assert client.get(url).json()["salidas"][0]["disponibles"] == 1

    db.execute(
        update(Reserva).values(created_at=datetime.now(UTC) - timedelta(hours=73))
    )
    db.commit()
    assert client.get(url).json()["salidas"][0]["disponibles"] == 5
    (reserva,) = admin.get(f"{ADMIN}/reservas").json()
    assert reserva["estado"] == "cancelada"
    assert "Vencida sin seña" in reserva["notas"]
