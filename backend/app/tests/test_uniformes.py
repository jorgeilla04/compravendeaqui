"""Tienda de uniformes: catálogo, cotización, pedidos, Mercado Pago y administración."""

from __future__ import annotations

import hashlib
import hmac
import io
import json
import time
from collections.abc import Callable
from decimal import Decimal
from email.message import EmailMessage
from pathlib import Path
from typing import Any

import httpx
import pytest
import respx
from fastapi.testclient import TestClient
from sqlalchemy import select, update

from app.config import settings
from app.models import Colegio, Pedido, User
from app.scripts.import_colegios import import_colegios
from app.scripts.make_admin import set_role
from app.services import mailer
from app.services.uniformes import cotizar
from app.tests.conftest import jpeg_bytes

MP = "https://api.mercadopago.com"
MakeUser = Callable[..., tuple[TestClient, dict[str, Any]]]

CLIENTE = {
    "nombre": "María  González",
    "telefono": "264 412-3456",
    "email": "maria@gmail.com",
    "direccion": "Av. Libertador 1234 (O)",
    "departamento": "Capital",
    "notas": "Timbre 2",
}


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
def colegio(admin: TestClient) -> dict[str, Any]:
    response = admin.post(
        "/api/v1/admin/uniformes/colegios",
        json={
            "nombre": "Colegio Santa Rosa de Lima",
            "departamento": "Capital",
            "categoria": "parroquiales",
            "color1": "#1e3a8a",
            "color2": "#ffffff",
        },
    )
    assert response.status_code == 201, response.text
    data: dict[str, Any] = response.json()
    return data


@pytest.fixture
def sent_mail(monkeypatch: pytest.MonkeyPatch) -> list[EmailMessage]:
    sent: list[EmailMessage] = []
    monkeypatch.setattr(settings, "smtp_host", "smtp.test")
    monkeypatch.setattr(
        settings, "email_from", "CompraVendeAqui <no-responder@cva.test>"
    )

    def fake_send(msg: EmailMessage, config: Any = None) -> str:
        sent.append(msg)
        return "<id@test>"

    monkeypatch.setattr(mailer, "send", fake_send)
    return sent


@pytest.fixture
def mp(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "mp_access_token", "APP_USR-test")


def pedido_body(slug: str, **kw: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "items": [
            {"colegio": slug, "prenda": "remera", "talle": "10", "cantidad": 2},
            {"colegio": slug, "prenda": "corbata", "talle": "Único", "cantidad": 1},
        ],
        "envio": "estandar",
        "modalidad_pago": "sena",
        "cliente": CLIENTE,
    }
    body.update(kw)
    return body


# --- Cotización ---------------------------------------------------------------


@pytest.mark.parametrize(
    ("envio", "modalidad", "esperado"),
    [
        # subtotal, recargo, envío, total, pagado ahora, saldo
        ("estandar", "sena", (30000, 0, 5000, 35000, 8000, 27000)),
        ("estandar", "total", (30000, 0, 5000, 35000, 35000, 0)),
        ("express", "sena", (30000, 6000, 5000, 41000, 14000, 27000)),
        ("express", "total", (30000, 6000, 5000, 41000, 41000, 0)),
    ],
)
def test_cotizar_reglas_del_negocio(
    envio: str, modalidad: str, esperado: tuple[int, ...]
) -> None:
    t = cotizar(Decimal(30000), envio, modalidad)
    assert (
        t.subtotal,
        t.recargo_express,
        t.envio_monto,
        t.total,
        t.pagado_ahora,
        t.saldo,
    ) == tuple(Decimal(v) for v in esperado)


def test_cotizar_redondea_a_pesos() -> None:
    t = cotizar(Decimal(10005), "express", "sena")
    assert t.recargo_express == Decimal(2001)  # 2001.0
    assert t.pagado_ahora == Decimal(1001 + 5000 + 2001)  # seña 1000.5 → 1001


# --- Catálogo -----------------------------------------------------------------


def test_catalogo_publico(client: TestClient, colegio: dict[str, Any]) -> None:
    data = client.get("/api/v1/uniformes/catalogo").json()
    assert [c["slug"] for c in data["categorias"]] == [
        "parroquiales",
        "privados",
        "preuniversitarios",
    ]
    assert data["colegios"] == [
        {
            "slug": "colegio-santa-rosa-de-lima",
            "nombre": "Colegio Santa Rosa de Lima",
            "departamento": "Capital",
            "categoria": "parroquiales",
            "color1": "#1E3A8A",
            "color2": "#FFFFFF",
            "logo_url": None,
        }
    ]
    assert (
        data["config"]
        .pop("vendedora_whatsapp_url")
        .startswith("https://wa.me/5492645408193?text=")
    )
    assert data["config"] == {
        "envio_monto": 5000,
        "express_recargo_pct": 20,
        "sena_pct": 10,
        "departamentos_envio": [
            "Capital",
            "Chimbas",
            "Pocito",
            "Rawson",
            "Rivadavia",
            "Santa Lucía",
        ],
        "pagos_online": False,
        "vendedora_nombre": "Virginia Tello",
        "retiro_direccion": "Santiago del Estero Sur 1131, Capital",
    }

    detalle = client.get(f"/api/v1/uniformes/colegios/{colegio['slug']}").json()
    assert [p["slug"] for p in detalle["prendas"]] == [
        "remera",
        "pantalon",
        "pollera",
        "corbata",
        "buzo",
        "campera",
        "bermuda",
        "jogging",
    ]
    assert {p["precio"] for p in detalle["prendas"]} == {"10000.00"}
    corbata = next(p for p in detalle["prendas"] if p["slug"] == "corbata")
    assert corbata["talles"] == ["Único"]


def test_precio_por_colegio_y_prendas_que_no_usa(
    admin: TestClient, client: TestClient, colegio: dict[str, Any]
) -> None:
    slug = colegio["slug"]
    ok = admin.put(
        "/api/v1/admin/uniformes/precios",
        json={"colegio": slug, "prenda": "buzo", "precio": "18500"},
    )
    assert ok.status_code == 200, ok.text
    admin.put(
        "/api/v1/admin/uniformes/precios",
        json={"colegio": slug, "prenda": "pollera", "disponible": False},
    )
    admin.put("/api/v1/admin/uniformes/prendas/remera", json={"precio_base": "12000"})
    prendas = {
        p["slug"]: p["precio"]
        for p in client.get(f"/api/v1/uniformes/colegios/{slug}").json()["prendas"]
    }
    assert "pollera" not in prendas
    assert prendas["buzo"] == "18500.00"
    assert prendas["remera"] == "12000.00"
    # Volver al precio base.
    admin.put(
        "/api/v1/admin/uniformes/precios",
        json={"colegio": slug, "prenda": "buzo", "precio": None},
    )
    detalle = client.get(f"/api/v1/uniformes/colegios/{slug}").json()
    assert next(p for p in detalle["prendas"] if p["slug"] == "buzo")["precio"] == (
        "10000.00"
    )

    admin_view = admin.get("/api/v1/admin/uniformes/catalogo").json()
    assert {(p["prenda"], p["disponible"]) for p in admin_view["precios"]} == {
        ("buzo", True),
        ("pollera", False),
    }


def test_colegio_inactivo_no_se_vende(
    admin: TestClient, client: TestClient, colegio: dict[str, Any]
) -> None:
    slug = colegio["slug"]
    admin.put(f"/api/v1/admin/uniformes/colegios/{slug}", json={"activo": False})
    assert client.get("/api/v1/uniformes/catalogo").json()["colegios"] == []
    assert client.get(f"/api/v1/uniformes/colegios/{slug}").status_code == 404
    assert (
        client.post("/api/v1/uniformes/pedidos", json=pedido_body(slug)).status_code
        == 404
    )


# --- Pedidos sin Mercado Pago (a coordinar) -----------------------------------


def test_pedido_sin_mp_queda_a_coordinar_y_avisa_a_la_vendedora(
    client: TestClient, colegio: dict[str, Any], sent_mail: list[EmailMessage], db: Any
) -> None:
    response = client.post(
        "/api/v1/uniformes/pedidos", json=pedido_body(colegio["slug"])
    )
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["init_point"] is None
    pedido = data["pedido"]
    assert pedido["estado"] == "a_coordinar"
    assert pedido["codigo"].startswith("U-") and len(pedido["codigo"]) == 8
    assert (pedido["subtotal"], pedido["envio_monto"], pedido["total"]) == (
        "30000.00",
        "5000.00",
        "35000.00",
    )
    assert (pedido["pagado_ahora"], pedido["saldo"]) == ("8000.00", "27000.00")
    assert pedido["whatsapp_url"].startswith("https://wa.me/5492645408193?text=")
    assert pedido["codigo"] in pedido["whatsapp_url"]
    # El link del pedido es compartible: no expone dirección ni teléfono.
    assert "direccion" not in pedido and "cliente_tel" not in pedido

    stored = db.scalars(select(Pedido)).one()
    assert stored.cliente_nombre == "María González"
    assert stored.cliente_tel == "+5492644123456"
    assert stored.notificado_at is not None
    assert len(stored.items) == 2

    msg = sent_mail[0]
    assert msg["To"] == "virginialauratello@gmail.com"
    assert msg["Subject"] == f"Nuevo pedido a coordinar {pedido['codigo']}"
    assert msg["Reply-To"] == "maria@gmail.com"
    text = msg.get_body(("plain",)).get_content()  # type: ignore[union-attr]
    assert "2 × Remera / chomba talle 10 — Colegio Santa Rosa de Lima" in text
    assert "Total: $35.000" in text
    assert "Saldo contra entrega: $27.000" in text
    assert "Av. Libertador 1234 (O), Capital" in text
    assert "https://wa.me/5492644123456" in text


def test_pedido_sin_smtp_igual_se_registra(
    client: TestClient, colegio: dict[str, Any], db: Any
) -> None:
    response = client.post(
        "/api/v1/uniformes/pedidos", json=pedido_body(colegio["slug"])
    )
    assert response.status_code == 201
    assert db.scalars(select(Pedido)).one().notificado_at is None


@pytest.mark.parametrize(
    ("cambio", "mensaje"),
    [
        ({"talle": "99"}, "No hay talle 99"),
        ({"prenda": "smoking"}, "no tiene esa prenda"),
    ],
)
def test_pedido_valida_prenda_y_talle(
    client: TestClient, colegio: dict[str, Any], cambio: dict[str, str], mensaje: str
) -> None:
    body = pedido_body(colegio["slug"])
    body["items"][0].update(cambio)
    response = client.post("/api/v1/uniformes/pedidos", json=body)
    assert response.status_code == 422
    assert mensaje in response.json()["detail"]


def test_pedido_valida_datos_del_cliente(
    client: TestClient, colegio: dict[str, Any]
) -> None:
    lejos = pedido_body(colegio["slug"], cliente={**CLIENTE, "departamento": "Jáchal"})
    response = client.post("/api/v1/uniformes/pedidos", json=lejos)
    assert response.status_code == 422
    assert "Gran San Juan" in response.json()["detail"][0]["msg"]
    tel = pedido_body(colegio["slug"], cliente={**CLIENTE, "telefono": "123"})
    assert client.post("/api/v1/uniformes/pedidos", json=tel).status_code == 422
    muchos = pedido_body(colegio["slug"])
    muchos["items"][0]["cantidad"] = 21
    assert client.post("/api/v1/uniformes/pedidos", json=muchos).status_code == 422
    espacios = pedido_body(colegio["slug"], cliente={**CLIENTE, "nombre": "   "})
    assert client.post("/api/v1/uniformes/pedidos", json=espacios).status_code == 422
    vacio = pedido_body(colegio["slug"], items=[])
    assert client.post("/api/v1/uniformes/pedidos", json=vacio).status_code == 422


def test_el_precio_lo_pone_el_servidor(
    client: TestClient, colegio: dict[str, Any]
) -> None:
    body = pedido_body(colegio["slug"])
    body["items"][0]["precio"] = "1"  # se ignora
    body["total"] = "1"
    data = client.post("/api/v1/uniformes/pedidos", json=body).json()
    assert data["pedido"]["total"] == "35000.00"


# --- Mercado Pago -------------------------------------------------------------


@respx.mock
def test_pedido_con_mp_crea_preferencia(
    client: TestClient, colegio: dict[str, Any], mp: None, db: Any
) -> None:
    route = respx.post(f"{MP}/checkout/preferences").mock(
        return_value=httpx.Response(
            201,
            json={"id": "pref-123", "init_point": "https://mp.test/checkout/pref-123"},
        )
    )
    body = pedido_body(colegio["slug"], envio="express", modalidad_pago="total")
    response = client.post("/api/v1/uniformes/pedidos", json=body)
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["init_point"] == "https://mp.test/checkout/pref-123"
    assert data["pedido"]["estado"] == "pendiente_pago"

    request = route.calls.last.request
    assert request.headers["Authorization"] == "Bearer APP_USR-test"
    assert request.headers["X-Idempotency-Key"] == data["pedido"]["id"]
    sent = json.loads(request.content)
    assert sent["items"][0]["unit_price"] == 41000.0
    assert sent["items"][0]["currency_id"] == "ARS"
    assert "Pago total" in sent["items"][0]["title"]
    assert sent["external_reference"] == data["pedido"]["id"]
    assert sent["payer"] == {"name": "María González", "email": "maria@gmail.com"}
    back = f"https://compravendeaqui.test/uniformes/pedido/{data['pedido']['id']}"
    assert sent["back_urls"] == {"success": back, "failure": back, "pending": back}
    assert sent["auto_return"] == "approved"
    assert sent["notification_url"].startswith(
        "https://compravendeaqui.test/api/v1/uniformes/webhooks/mercadopago"
    )
    assert db.scalars(select(Pedido)).one().mp_preference_id == "pref-123"
    assert data["pedido"]["pago_url"] == "https://mp.test/checkout/pref-123"


@respx.mock
def test_si_mp_falla_no_queda_el_pedido(
    client: TestClient, colegio: dict[str, Any], mp: None, db: Any
) -> None:
    respx.post(f"{MP}/checkout/preferences").mock(
        return_value=httpx.Response(401, json={"message": "invalid token"})
    )
    response = client.post(
        "/api/v1/uniformes/pedidos", json=pedido_body(colegio["slug"])
    )
    assert response.status_code == 503
    assert "Mercado Pago" in response.json()["detail"]
    assert db.scalars(select(Pedido)).all() == []


def _crear_pendiente(client: TestClient, slug: str) -> dict[str, Any]:
    with respx.mock:
        respx.post(f"{MP}/checkout/preferences").mock(
            return_value=httpx.Response(
                201, json={"id": "p", "init_point": "https://x"}
            )
        )
        data: dict[str, Any] = client.post(
            "/api/v1/uniformes/pedidos", json=pedido_body(slug)
        ).json()["pedido"]
    return data


def _pago(
    pedido_id: str, status: str = "approved", amount: float = 8000
) -> dict[str, Any]:
    return {
        "id": 987654321,
        "status": status,
        "currency_id": "ARS",
        "transaction_amount": amount,
        "external_reference": pedido_id,
    }


def test_webhook_aprobado_marca_pagado_y_avisa(
    client: TestClient,
    colegio: dict[str, Any],
    mp: None,
    sent_mail: list[EmailMessage],
) -> None:
    pedido = _crear_pendiente(client, colegio["slug"])
    with respx.mock:
        respx.get(f"{MP}/v1/payments/987654321").mock(
            return_value=httpx.Response(200, json=_pago(pedido["id"]))
        )
        hook = TestClient(client.app)  # Mercado Pago: sin cookies ni Origin
        response = hook.post(
            "/api/v1/uniformes/webhooks/mercadopago?data.id=987654321&type=payment",
            json={"type": "payment", "data": {"id": "987654321"}},
        )
    assert response.status_code == 200
    estado = client.get(f"/api/v1/uniformes/pedidos/{pedido['id']}").json()
    assert estado["estado"] == "pagado" and estado["pagado_at"]
    assert sent_mail[-1]["Subject"] == f"Nuevo pedido pagado {pedido['codigo']}"
    text = sent_mail[-1].get_body(("plain",)).get_content()  # type: ignore[union-attr]
    assert "Seña pagado: $8.000" in text
    assert "Pago Mercado Pago N° 987654321" in text


def test_webhook_con_monto_distinto_no_marca_pagado(
    client: TestClient, colegio: dict[str, Any], mp: None
) -> None:
    pedido = _crear_pendiente(client, colegio["slug"])
    with respx.mock:
        respx.get(f"{MP}/v1/payments/987654321").mock(
            return_value=httpx.Response(200, json=_pago(pedido["id"], amount=100))
        )
        TestClient(client.app).post(
            "/api/v1/uniformes/webhooks/mercadopago",
            json={"type": "payment", "data": {"id": "987654321"}},
        )
    estado = client.get(f"/api/v1/uniformes/pedidos/{pedido['id']}").json()
    assert estado["estado"] == "pendiente_pago"


def test_vuelta_de_mp_rechazado_y_luego_aprobado(
    client: TestClient, colegio: dict[str, Any], mp: None
) -> None:
    pedido = _crear_pendiente(client, colegio["slug"])
    url = f"/api/v1/uniformes/pedidos/{pedido['id']}?payment_id=987654321"
    with respx.mock:
        route = respx.get(f"{MP}/v1/payments/987654321")
        route.mock(
            return_value=httpx.Response(200, json=_pago(pedido["id"], "rejected"))
        )
        rechazado = client.get(url).json()
        assert rechazado["estado"] == "rechazado"
        assert rechazado["pago_url"] == "https://x"  # puede volver a intentar
        # Reintenta y paga: el mismo pedido pasa a pagado.
        route.mock(return_value=httpx.Response(200, json=_pago(pedido["id"])))
        pagado = client.get(url).json()
        assert pagado["estado"] == "pagado" and pagado["pago_url"] is None
        # Ya pagado: no vuelve a consultar.
        calls = route.call_count
        client.get(url)
        assert route.call_count == calls


def test_pago_de_otro_pedido_no_cuenta(
    client: TestClient, colegio: dict[str, Any], mp: None
) -> None:
    pedido = _crear_pendiente(client, colegio["slug"])
    otro = _crear_pendiente(client, colegio["slug"])
    with respx.mock:
        respx.get(f"{MP}/v1/payments/987654321").mock(
            return_value=httpx.Response(200, json=_pago(otro["id"]))
        )
        # Vuelve con el payment_id de otro pedido: no se aplica a ninguno.
        estado = client.get(
            f"/api/v1/uniformes/pedidos/{pedido['id']}?payment_id=987654321"
        ).json()
        assert estado["estado"] == "pendiente_pago"
        otro_estado = client.get(f"/api/v1/uniformes/pedidos/{otro['id']}").json()
        assert otro_estado["estado"] == "pendiente_pago"
        # Un payment_id que no es número ni se consulta.
        client.get(f"/api/v1/uniformes/pedidos/{pedido['id']}?payment_id=1;drop")


def _firma(
    data_id: str, request_id: str, ts: int, secret: str = "secreto-webhook"
) -> str:
    manifest = f"id:{data_id};request-id:{request_id};ts:{ts};"
    v1 = hmac.new(secret.encode(), manifest.encode(), hashlib.sha256).hexdigest()
    return f"ts={ts},v1={v1}"


def test_webhook_firma(
    client: TestClient,
    colegio: dict[str, Any],
    mp: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "mp_webhook_secret", "secreto-webhook")
    pedido = _crear_pendiente(client, colegio["slug"])
    hook = TestClient(client.app)
    path = "/api/v1/uniformes/webhooks/mercadopago?data.id=987654321&type=payment"
    body = {"type": "payment", "data": {"id": "987654321"}}
    now = int(time.time())
    casos = [
        {"x-signature": "ts=1,v1=deadbeef", "x-request-id": "req-1"},
        {},  # sin firma
        {"x-signature": _firma("987654321", "req-1", now)},  # sin request-id
        # Firma válida pero vieja (reenvío): se rechaza.
        {
            "x-signature": _firma("987654321", "req-1", now - 600),
            "x-request-id": "req-1",
        },
        # Firmada para otro pago.
        {"x-signature": _firma("111", "req-1", now), "x-request-id": "req-1"},
    ]
    for headers in casos:
        assert hook.post(path, json=body, headers=headers).status_code == 401

    with respx.mock:
        respx.get(f"{MP}/v1/payments/987654321").mock(
            return_value=httpx.Response(200, json=_pago(pedido["id"]))
        )
        # ts en milisegundos también vale.
        ok = hook.post(
            path,
            json=body,
            headers={
                "x-signature": _firma("987654321", "req-1", now * 1000),
                "x-request-id": "req-1",
            },
        )
    assert ok.status_code == 200
    assert client.get(f"/api/v1/uniformes/pedidos/{pedido['id']}").json()["estado"] == (
        "pagado"
    )


def test_webhook_id_de_la_url_y_del_cuerpo_tienen_que_coincidir(
    client: TestClient, mp: None
) -> None:
    hook = TestClient(client.app)
    response = hook.post(
        "/api/v1/uniformes/webhooks/mercadopago?data.id=111&type=payment",
        json={"type": "payment", "data": {"id": "222"}},
    )
    assert response.status_code == 400


def test_en_produccion_mp_exige_secreto_del_webhook() -> None:
    from app.config import Settings

    base = dict(
        environment="production",
        jwt_secret_key="x" * 40,
        cookie_secure=True,
        mp_access_token="APP_USR-1",
    )
    with pytest.raises(ValueError, match="MP_WEBHOOK_SECRET"):
        Settings(**base)  # type: ignore[arg-type]
    prod = Settings(**base, mp_webhook_secret="s")  # type: ignore[arg-type]
    prod_sin = prod.model_copy(update={"mp_webhook_secret": ""})
    from app.services.mercadopago import valid_signature

    # Si igual faltara el secreto en producción, la firma falla (no deja pasar).
    assert (
        valid_signature(
            x_signature=None, x_request_id=None, data_id="1", config=prod_sin
        )
        is False
    )


def test_webhook_ignora_otros_avisos(client: TestClient) -> None:
    hook = TestClient(client.app)
    response = hook.post(
        "/api/v1/uniformes/webhooks/mercadopago?topic=merchant_order&id=1", content=b""
    )
    assert response.status_code == 200


def test_pedido_inexistente(client: TestClient) -> None:
    response = client.get(
        "/api/v1/uniformes/pedidos/00000000-0000-4000-8000-000000000000"
    )
    assert response.status_code == 404


# --- Administración -----------------------------------------------------------


def test_admin_requiere_rol(
    client: TestClient, make_user: MakeUser, colegio: dict[str, Any]
) -> None:
    assert client.get("/api/v1/admin/uniformes/pedidos").status_code == 401
    comun, _ = make_user()
    assert comun.get("/api/v1/admin/uniformes/pedidos").status_code == 403
    assert (
        comun.put("/api/v1/admin/uniformes/prendas/remera", json={"precio_base": "1"})
    ).status_code == 403


def test_admin_pedidos_y_estados(
    admin: TestClient, client: TestClient, colegio: dict[str, Any]
) -> None:
    pedido = client.post(
        "/api/v1/uniformes/pedidos", json=pedido_body(colegio["slug"])
    ).json()["pedido"]
    lista = admin.get("/api/v1/admin/uniformes/pedidos").json()
    assert lista[0]["codigo"] == pedido["codigo"]
    assert lista[0]["cliente_tel"] == "+5492644123456"
    assert lista[0]["direccion"] == "Av. Libertador 1234 (O)"
    assert lista[0]["cliente_whatsapp_url"].startswith("https://wa.me/5492644123456")
    cambio = admin.put(
        f"/api/v1/admin/uniformes/pedidos/{pedido['id']}", json={"estado": "entregado"}
    )
    assert cambio.json()["estado"] == "entregado"
    assert admin.get("/api/v1/admin/uniformes/pedidos?estado=a_coordinar").json() == []
    invalido = admin.put(
        f"/api/v1/admin/uniformes/pedidos/{pedido['id']}", json={"estado": "perdido"}
    )
    assert invalido.status_code == 422


def test_admin_colegios(admin: TestClient, colegio: dict[str, Any]) -> None:
    repetido = admin.post(
        "/api/v1/admin/uniformes/colegios",
        json={
            "nombre": "Colegio Santa Rosa de Lima",
            "departamento": "Rivadavia",
            "categoria": "privados",
            "color1": "#000000",
            "color2": "#FFFFFF",
        },
    )
    assert repetido.json()["slug"] == "colegio-santa-rosa-de-lima-2"
    reservado = admin.post(
        "/api/v1/admin/uniformes/colegios",
        json={
            "nombre": "Carrito",
            "departamento": "Capital",
            "categoria": "privados",
            "color1": "#000000",
            "color2": "#FFFFFF",
        },
    )
    assert reservado.json()["slug"] == "colegio-carrito"
    malo = admin.post(
        "/api/v1/admin/uniformes/colegios",
        json={
            "nombre": "Otro",
            "departamento": "Capital",
            "categoria": "privados",
            "color1": "azul",
            "color2": "#FFFFFF",
        },
    )
    assert malo.status_code == 422
    editado = admin.put(
        f"/api/v1/admin/uniformes/colegios/{colegio['slug']}",
        json={"color1": "#7f1d1d", "nombre": "Colegio Santa Rosa"},
    ).json()
    assert (editado["color1"], editado["nombre"]) == ("#7F1D1D", "Colegio Santa Rosa")
    # El slug no cambia: no rompe links ya compartidos.
    assert editado["slug"] == colegio["slug"]


def test_admin_escudo_y_foto(
    admin: TestClient, colegio: dict[str, Any], fake_storage: dict[str, bytes]
) -> None:
    logo = admin.post(
        f"/api/v1/admin/uniformes/colegios/{colegio['slug']}/logo",
        files={
            "file": ("escudo.jpg", io.BytesIO(jpeg_bytes((400, 400))), "image/jpeg")
        },
    )
    assert logo.status_code == 200, logo.text
    assert logo.json()["logo_url"].startswith(
        "https://cdn.test/media/uniformes/escudos/colegio-santa-rosa-de-lima/"
    )
    foto = admin.post(
        "/api/v1/admin/uniformes/prendas/buzo/foto",
        files={"file": ("buzo.jpg", io.BytesIO(jpeg_bytes((800, 800))), "image/jpeg")},
    )
    assert foto.json()["foto_url"].startswith(
        "https://cdn.test/media/uniformes/prendas/buzo/"
    )
    assert len(fake_storage) == 2
    no_imagen = admin.post(
        "/api/v1/admin/uniformes/prendas/buzo/foto",
        files={"file": ("x.jpg", io.BytesIO(b"no soy una imagen"), "image/jpeg")},
    )
    assert no_imagen.status_code == 422


def test_admin_prenda_talles(
    admin: TestClient, client: TestClient, colegio: dict[str, Any]
) -> None:
    admin.put("/api/v1/admin/uniformes/prendas/corbata", json={"activo": False})
    admin.put("/api/v1/admin/uniformes/prendas/pollera", json={"talles": ["8", "10"]})
    prendas = client.get(f"/api/v1/uniformes/colegios/{colegio['slug']}").json()[
        "prendas"
    ]
    assert "corbata" not in [p["slug"] for p in prendas]
    assert next(p for p in prendas if p["slug"] == "pollera")["talles"] == ["8", "10"]
    assert admin.put("/api/v1/admin/uniformes/prendas/nada", json={}).status_code == 404


# --- Scripts ------------------------------------------------------------------


def test_import_colegios(db: Any, tmp_path: Path) -> None:
    rows = [
        {
            "nombre": "Escuela Industrial Domingo F. Sarmiento",
            "departamento": "Capital",
            "categoria": "preuniversitarios",
            "color1": "#0f172a",
            "color2": "#facc15",
        },
        {
            "nombre": "Colegio del Bicentenario",
            "departamento": "Rivadavia",
            "categoria": "privados",
            "color1": "#14532d",
            "color2": "#ffffff",
        },
    ]
    assert import_colegios(rows) == (2, 0)
    rows[1]["color1"] = "#000000"
    assert import_colegios(rows) == (0, 2)
    nombres = {c.slug: c.color1 for c in db.scalars(select(Colegio))}
    assert nombres == {
        "escuela-industrial-domingo-f-sarmiento": "#0F172A",
        "colegio-del-bicentenario": "#000000",
    }
    with pytest.raises(ValueError):
        import_colegios([{**rows[0], "categoria": "publicos"}])


def test_make_admin(make_user: MakeUser, db: Any) -> None:
    assert set_role("nadie@mail.com") is False
    client, data = make_user()
    db.execute(
        update(User)
        .where(User.username == data["user"]["username"])
        .values(email="jefe@mail.com")
    )
    db.commit()
    assert set_role("Jefe@Mail.com") is True
    assert client.get("/api/v1/admin/uniformes/pedidos").status_code == 200
    assert set_role("jefe@mail.com", admin=False) is True
    assert client.get("/api/v1/admin/uniformes/pedidos").status_code == 403


def test_si_el_aviso_falla_el_pedido_igual_queda(
    client: TestClient,
    colegio: dict[str, Any],
    monkeypatch: pytest.MonkeyPatch,
    db: Any,
) -> None:
    monkeypatch.setattr(settings, "smtp_host", "smtp.test")
    monkeypatch.setattr(settings, "email_from", "x@cva.test")

    def boom(msg: EmailMessage, config: Any = None) -> str:
        raise RuntimeError("se cayó todo")

    monkeypatch.setattr(mailer, "send", boom)
    response = client.post(
        "/api/v1/uniformes/pedidos", json=pedido_body(colegio["slug"])
    )
    assert response.status_code == 201
    assert db.scalars(select(Pedido)).one().notificado_at is None
