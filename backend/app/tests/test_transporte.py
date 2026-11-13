"""Cotizador de transporte para empresas: lugares, precio, pedidos y panel."""

from __future__ import annotations

from collections.abc import Callable, Iterator
from decimal import Decimal
from email.message import EmailMessage
from typing import Any

import httpx
import pytest
import respx
from fastapi.testclient import TestClient
from sqlalchemy import update

from app.config import settings
from app.models import User
from app.services import mailer
from app.services import transporte as service

API = "/api/v1/transporte"
ADMIN = "/api/v1/admin/transporte"
MakeUser = Callable[..., tuple[TestClient, dict[str, Any]]]

SAN_JUAN = {"nombre": "Plaza 25 de Mayo, San Juan", "lat": -31.5375, "lon": -68.5364}
RODEO = {"nombre": "Rodeo, Iglesia", "lat": -30.2139, "lon": -69.1406}
VIAJE = {"origen": SAN_JUAN, "destino": RODEO, "pasajeros": 20}
CLIENTE = {
    "nombre": "Ana  Pérez",
    "email": "ana@minera.com",
    "telefono": "264 412-3456",
    "empresa": "Minera Andina SA",
}


@pytest.fixture(autouse=True)
def mapa() -> Iterator[respx.MockRouter]:
    """OSRM devuelve 200 km para cualquier ruta; Photon, dos lugares."""
    service._ruta_km.cache_clear()
    with respx.mock(assert_all_called=False) as router:
        router.get(url__startswith=f"{settings.osrm_url}/route/").mock(
            return_value=httpx.Response(
                200, json={"code": "Ok", "routes": [{"distance": 200_000}]}
            )
        )
        router.get(url__startswith=settings.photon_url).mock(
            return_value=httpx.Response(
                200,
                json={
                    "features": [
                        {
                            "geometry": {"coordinates": [-69.14, -30.21]},
                            "properties": {
                                "name": "Rodeo",
                                "county": "Iglesia",
                                "state": "San Juan",
                                "countrycode": "AR",
                            },
                        },
                        {
                            "geometry": {"coordinates": [-70.6, -33.4]},
                            "properties": {"name": "Rodeo", "countrycode": "CL"},
                        },
                    ]
                },
            )
        )
        yield router


def _usuario(
    make_user: MakeUser, db: Any, role: str = "admin"
) -> tuple[TestClient, str]:
    client, data = make_user()
    email = f"{data['user']['username']}@mail.com"
    db.execute(
        update(User)
        .where(User.username == data["user"]["username"])
        .values(role=role, email=email, email_verified=True)
    )
    db.commit()
    return client, email


def test_pagina_y_lugares(client: TestClient) -> None:
    r = client.get(f"{API}/blanca-paloma")
    assert r.status_code == 200, r.text
    data = r.json()
    assert [u["asientos"] for u in data["unidades"]] == [15, 24, 45, 60]
    assert "precio_km" not in data["unidades"][0]  # las tarifas no se publican

    lugares = client.get(f"{API}/lugares", params={"q": "rodeo"}).json()
    # Solo Argentina.
    assert lugares == [
        {
            "nombre": "Rodeo",
            "detalle": "Iglesia, San Juan",
            "lat": -30.21,
            "lon": -69.14,
        }
    ]
    assert client.get(f"{API}/lugares", params={"q": "ro"}).status_code == 422


def test_cotiza_por_km_y_unidad(client: TestClient) -> None:
    r = client.post(f"{API}/blanca-paloma/cotizar", json=VIAJE)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["km"] == "200.0"
    precios = {o["unidad"]: (o["cantidad"], o["precio"]) for o in data["opciones"]}
    # 20 pasajeros: 2 combis o 1 minibús, colectivo...; 200 km × $/km.
    assert precios["Combi"] == (2, "520000")
    assert precios["Minibús"] == (1, "340000")
    assert precios["Colectivo"] == (1, "460000")
    assert data["opciones"][0]["unidad"] == "Minibús"  # la más barata primero

    # Ida y vuelta duplica los km; la espera se suma por hora.
    r = client.post(
        f"{API}/blanca-paloma/cotizar",
        json={**VIAJE, "ida_vuelta": True, "horas_espera": 2},
    )
    minibus = next(o for o in r.json()["opciones"] if o["unidad"] == "Minibús")
    assert r.json()["km_cobrados"] == "400.0"
    assert minibus["precio"] == str(400 * 1700 + 2 * 15000)


def test_minimo_y_limites(client: TestClient, mapa: respx.MockRouter) -> None:
    mapa.routes[0].mock(
        return_value=httpx.Response(
            200, json={"code": "Ok", "routes": [{"distance": 10_000}]}
        )
    )
    r = client.post(f"{API}/blanca-paloma/cotizar", json={**VIAJE, "pasajeros": 5})
    assert {o["precio"] for o in r.json()["opciones"]} == {"120000"}  # el mínimo

    # Más de 10 unidades no se cotiza.
    r = client.post(f"{API}/blanca-paloma/cotizar", json={**VIAJE, "pasajeros": 500})
    assert [o["unidad"] for o in r.json()["opciones"]] == ["Colectivo doble piso"]

    fuera = {**VIAJE, "destino": {"nombre": "Madrid", "lat": 40.4, "lon": -3.7}}
    assert client.post(f"{API}/blanca-paloma/cotizar", json=fuera).status_code == 422


def test_sin_ruta(client: TestClient, mapa: respx.MockRouter) -> None:
    mapa.routes[0].mock(return_value=httpx.Response(200, json={"code": "NoRoute"}))
    r = client.post(f"{API}/blanca-paloma/cotizar", json=VIAJE)
    assert r.status_code == 503
    assert "distancia" in r.json()["detail"]


def test_pedido_recalcula_y_avisa(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    sent: list[EmailMessage] = []
    monkeypatch.setattr(settings, "smtp_host", "smtp.test")
    monkeypatch.setattr(settings, "email_from", "CVA <no-responder@cva.test>")
    monkeypatch.setattr(mailer, "send", lambda msg, config=None: sent.append(msg))

    opciones = client.post(f"{API}/blanca-paloma/cotizar", json=VIAJE).json()
    minibus = next(o for o in opciones["opciones"] if o["unidad"] == "Minibús")
    r = client.post(
        f"{API}/blanca-paloma/pedidos",
        json={
            **VIAJE,
            **CLIENTE,
            "unidad_id": minibus["unidad_id"],
            "fecha": "2026-12-01",
            "notas": "Salida 6 am",
        },
    )
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["codigo"].startswith("T-")
    assert Decimal(data["total"]) == 340000
    assert data["whatsapp_url"].startswith("https://wa.me/5492644148579?text=")

    (msg,) = sent
    assert msg["To"] == "administracion@blancapalomasrl.com.ar"
    assert msg["Reply-To"] == "ana@minera.com"
    cuerpo = msg.get_body(("plain",)).get_content()  # type: ignore[union-attr]
    assert "Minera Andina SA" in cuerpo
    assert "$340.000" in cuerpo
    assert "01/12/2026" in cuerpo

    # Un teléfono que no es de Argentina no pasa.
    malo = {**VIAJE, **CLIENTE, "telefono": "123", "unidad_id": minibus["unidad_id"]}
    assert client.post(f"{API}/blanca-paloma/pedidos", json=malo).status_code == 422


def test_panel_de_la_empresa(client: TestClient, make_user: MakeUser, db: Any) -> None:
    admin, _ = _usuario(make_user, db)
    encargada, email = _usuario(make_user, db, role="user")

    # Sin ser encargada no lo ve; el admin del sitio la asigna.
    assert encargada.get(f"{ADMIN}/blanca-paloma").status_code == 404
    r = admin.post(f"{ADMIN}/blanca-paloma/encargados", json={"email": email})
    assert r.status_code == 201, r.text
    assert [t["slug"] for t in encargada.get(ADMIN).json()] == ["blanca-paloma"]

    panel = encargada.get(f"{ADMIN}/blanca-paloma").json()
    assert panel["tarifas_revisadas"] is False
    combi = next(u for u in panel["unidades"] if u["nombre"] == "Combi")

    r = encargada.put(
        f"{ADMIN}/blanca-paloma",
        json={
            "nombre": "Blanca Paloma",
            "descripcion": "Traslados",
            "whatsapp": "264 414-8579",
            "email": "ventas@bp.com.ar",
            "minimo": "150000",
            "espera_hora": "20000",
            "iva_incluido": False,
        },
    )
    assert r.status_code == 200, r.text
    assert r.json()["tarifas_revisadas"] is True

    r = encargada.put(
        f"{ADMIN}/blanca-paloma/unidades/{combi['id']}",
        json={"nombre": "Combi", "asientos": 19, "precio_km": "1500", "activo": False},
    )
    assert r.status_code == 200, r.text
    r = encargada.post(
        f"{ADMIN}/blanca-paloma/unidades",
        json={"nombre": "Auto ejecutivo", "asientos": 4, "precio_km": "900"},
    )
    assert r.status_code == 201, r.text

    publica = client.get(f"{API}/blanca-paloma").json()
    assert "Combi" not in [u["nombre"] for u in publica["unidades"]]
    assert publica["iva_incluido"] is False
    opciones = client.post(
        f"{API}/blanca-paloma/cotizar", json={**VIAJE, "pasajeros": 3}
    ).json()["opciones"]
    assert opciones[0] == {
        **opciones[0],
        "unidad": "Auto ejecutivo",
        "precio": str(200 * 900),
    }

    r = encargada.post(
        f"{ADMIN}/blanca-paloma/foto",
        files={"file": ("bus.jpg", _jpeg(), "image/jpeg")},
    )
    assert r.status_code == 200, r.text
    assert r.json()["foto_url"].endswith(".webp")

    # Pedidos y estado.
    unidad = opciones[0]["unidad_id"]
    client.post(
        f"{API}/blanca-paloma/pedidos",
        json={**VIAJE, **CLIENTE, "pasajeros": 3, "unidad_id": unidad},
    )
    (pedido,) = encargada.get(f"{ADMIN}/blanca-paloma/pedidos").json()
    assert pedido["estado"] == "nuevo"
    r = encargada.put(
        f"{ADMIN}/blanca-paloma/pedidos/{pedido['id']}", json={"estado": "confirmado"}
    )
    assert r.json()["estado"] == "confirmado"

    # Solo el admin del sitio maneja encargados.
    assert encargada.get(f"{ADMIN}/blanca-paloma/encargados").status_code == 403


def _jpeg() -> bytes:
    from app.tests.conftest import jpeg_bytes

    return jpeg_bytes((800, 600))
