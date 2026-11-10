"""Tiendas virtuales: config de cada dueño, catálogo, pedidos, Mercado Pago y admin."""

from __future__ import annotations

import hashlib
import hmac
import io
import json
import time
from collections.abc import Callable
from decimal import Decimal
from email.message import EmailMessage
from typing import Any

import httpx
import pytest
import respx
from fastapi.testclient import TestClient
from sqlalchemy import select, update

from app.config import Settings, settings
from app.models import Grupo, Pedido, Tienda, User
from app.scripts.fotos_grupo import main as fotos_grupo
from app.scripts.import_grupos import import_grupos
from app.scripts.make_admin import set_role
from app.services import mailer
from app.services.mercadopago import valid_signature
from app.services.tiendas import cotizar
from app.tests.conftest import jpeg_bytes

MP = "https://api.mercadopago.com"
API = "/api/v1/tiendas"
ADMIN = "/api/v1/admin/tiendas"
MakeUser = Callable[..., tuple[TestClient, dict[str, Any]]]

CLIENTE = {
    "nombre": "María  González",
    "telefono": "264 412-3456",
    "email": "maria@gmail.com",
    "direccion": "Av. Libertador 1234 (O)",
    "departamento": "Capital",
    "notas": "Timbre 2",
}

LIBRERIA = {
    "nombre": "Librería El Estudiante",
    "descripcion": "Útiles y libros escolares",
    "grupo_label": "Lista",
    "opcion_label": "Color",
    "categorias": ["Primaria", "Secundaria"],
    "productos_en_todos": False,
    "vendedor_nombre": "Laura Pérez",
    "vendedor_email": "libreria@mail.com",
    "vendedor_whatsapp": "264 400-1122",
    "envio_habilitado": True,
    "envio_monto": "0",
    "departamentos_envio": ["Capital", "Rivadavia"],
    "retiro_habilitado": True,
    "retiro_direccion": "Mitre 100 (E), Capital",
    "sena_habilitada": False,
    "total_habilitado": True,
}


def _admin_of(
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


@pytest.fixture
def admin(make_user: MakeUser, db: Any) -> TestClient:
    return _admin_of(make_user, db)[0]


@pytest.fixture
def colegio(admin: TestClient) -> dict[str, Any]:
    response = admin.post(
        f"{ADMIN}/uniformes/grupos",
        json={
            "nombre": "Colegio Santa Rosa de Lima",
            "subtitulo": "Capital",
            "categoria": "Parroquiales y confesionales",
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


def pedido_body(grupo: str, **kw: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "items": [
            {"grupo": grupo, "producto": "remera", "opcion": "10", "cantidad": 2},
            {"grupo": grupo, "producto": "corbata", "cantidad": 1},
        ],
        "entrega": "estandar",
        "modalidad_pago": "sena",
        "cliente": CLIENTE,
    }
    body.update(kw)
    return body


def _tienda(**kw: Any) -> Tienda:
    base: dict[str, Any] = dict(
        envio_monto=Decimal(5000),
        envio_gratis_desde=None,
        express_recargo_pct=20,
        express_monto=Decimal(0),
        sena_pct=10,
    )
    base.update(kw)
    return Tienda(**base)


# --- Cotización ---------------------------------------------------------------


@pytest.mark.parametrize(
    ("entrega", "modalidad", "esperado"),
    [
        # subtotal, envío, express, total, pagado ahora, saldo
        ("estandar", "sena", (30000, 5000, 0, 35000, 8000, 27000)),
        ("estandar", "total", (30000, 5000, 0, 35000, 35000, 0)),
        # Express: el envío fijo de $5.000 + 20% de los productos.
        ("express", "sena", (30000, 5000, 6000, 41000, 14000, 27000)),
        ("express", "total", (30000, 5000, 6000, 41000, 41000, 0)),
        ("retiro", "sena", (30000, 0, 0, 30000, 3000, 27000)),
    ],
)
def test_cotizar_uniformes(
    entrega: str, modalidad: str, esperado: tuple[int, ...]
) -> None:
    t = cotizar(_tienda(), Decimal(30000), entrega, modalidad)
    assert (
        t.subtotal,
        t.envio_monto,
        t.recargo_express,
        t.total,
        t.pagado_ahora,
        t.saldo,
    ) == tuple(Decimal(v) for v in esperado)


def test_cotizar_con_otras_configuraciones() -> None:
    gratis = _tienda(envio_monto=Decimal(0))
    assert cotizar(gratis, Decimal(30000), "estandar", "total").total == Decimal(30000)
    desde = _tienda(envio_gratis_desde=Decimal(25000))
    assert cotizar(desde, Decimal(30000), "estandar", "total").envio_monto == 0
    assert cotizar(desde, Decimal(20000), "estandar", "total").envio_monto == 5000
    # Express con monto fijo extra además del %.
    fijo = _tienda(express_recargo_pct=0, express_monto=Decimal(3000))
    assert cotizar(fijo, Decimal(30000), "express", "total").total == Decimal(38000)
    # Redondeo a pesos.
    t = cotizar(_tienda(), Decimal(10005), "express", "sena")
    assert t.recargo_express == Decimal(2001)
    assert t.pagado_ahora == Decimal(1001 + 5000 + 2001)


# --- Catálogo público ---------------------------------------------------------


def test_tienda_publica(client: TestClient, colegio: dict[str, Any]) -> None:
    assert client.get(API).json() == [
        {
            "slug": "uniformes",
            "nombre": "Uniformes escolares",
            "descripcion": (
                "El uniforme de tu colegio con envío a tu casa. Pagás una seña y "
                "el resto cuando lo recibís."
            ),
        }
    ]
    data = client.get(f"{API}/uniformes").json()
    assert data["grupo_label"] == "Colegio" and data["opcion_label"] == "Talle"
    assert data["entregas"] == ["estandar", "express"]
    assert data["modalidades"] == ["sena", "total"]
    assert data["envio_monto"] == "5000.00" and data["express_recargo_pct"] == 20
    assert data["retiro_direccion"] is None  # el retiro está deshabilitado
    assert data["vendedor_nombre"] == "Virginia Tello"
    assert "vendedor_email" not in data
    assert data["whatsapp_url"].startswith("https://wa.me/5492645408193?text=")
    assert data["grupos"] == [
        {
            "slug": "colegio-santa-rosa-de-lima",
            "nombre": "Colegio Santa Rosa de Lima",
            "subtitulo": "Capital",
            "categoria": "Parroquiales y confesionales",
            "color1": "#1E3A8A",
            "color2": "#FFFFFF",
            "logo_url": None,
        }
    ]
    detalle = client.get(f"{API}/uniformes/grupos/{colegio['slug']}").json()
    assert [p["slug"] for p in detalle["productos"]] == [
        "remera",
        "pantalon",
        "pollera",
        "corbata",
        "buzo",
        "campera",
        "bermuda",
        "jogging",
    ]
    assert {p["precio"] for p in detalle["productos"]} == {"10000.00"}
    corbata = next(p for p in detalle["productos"] if p["slug"] == "corbata")
    assert corbata["opciones"] == []
    assert client.get(f"{API}/no-existe").status_code == 404
    assert client.get(f"{API}/uniformes/grupos/no-existe").status_code == 404


def test_precio_por_grupo_y_productos_que_no_vende(
    admin: TestClient, client: TestClient, colegio: dict[str, Any]
) -> None:
    slug = colegio["slug"]
    ok = admin.put(
        f"{ADMIN}/uniformes/precios",
        json={"grupo": slug, "producto": "buzo", "precio": "18500"},
    )
    assert ok.status_code == 200, ok.text
    admin.put(
        f"{ADMIN}/uniformes/precios",
        json={"grupo": slug, "producto": "pollera", "disponible": False},
    )
    admin.put(f"{ADMIN}/uniformes/productos/remera", json={"precio_base": "12000"})
    precios = {
        p["slug"]: p["precio"]
        for p in client.get(f"{API}/uniformes/grupos/{slug}").json()["productos"]
    }
    assert "pollera" not in precios
    assert (precios["buzo"], precios["remera"]) == ("18500.00", "12000.00")
    admin.put(
        f"{ADMIN}/uniformes/precios",
        json={"grupo": slug, "producto": "buzo", "precio": None},
    )
    detalle = client.get(f"{API}/uniformes/grupos/{slug}").json()
    buzo = next(p for p in detalle["productos"] if p["slug"] == "buzo")
    assert buzo["precio"] == "10000.00"


# --- Pedidos sin Mercado Pago (a coordinar) -----------------------------------


def test_pedido_a_coordinar_avisa_al_dueno(
    client: TestClient, colegio: dict[str, Any], sent_mail: list[EmailMessage], db: Any
) -> None:
    response = client.post(
        f"{API}/uniformes/pedidos", json=pedido_body(colegio["slug"])
    )
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["init_point"] is None
    pedido = data["pedido"]
    assert pedido["estado"] == "a_coordinar"
    assert pedido["codigo"].startswith("P-") and len(pedido["codigo"]) == 8
    assert pedido["tienda"]["slug"] == "uniformes"
    assert pedido["entrega_label"] == "Envío a domicilio (48 hs)"
    assert (pedido["subtotal"], pedido["envio_monto"], pedido["total"]) == (
        "30000.00",
        "5000.00",
        "35000.00",
    )
    assert (pedido["pagado_ahora"], pedido["saldo"]) == ("8000.00", "27000.00")
    assert pedido["items"][1]["opcion"] is None
    assert pedido["whatsapp_url"].startswith("https://wa.me/5492645408193?text=")
    # El link del pedido es compartible: no expone dirección ni teléfono.
    assert "direccion" not in pedido and "cliente_tel" not in pedido

    stored = db.scalars(select(Pedido)).one()
    assert stored.cliente_nombre == "María González"
    assert stored.cliente_tel == "+5492644123456"
    assert stored.notificado_at is not None

    msg = sent_mail[0]
    assert msg["To"] == "virginialauratello@gmail.com"
    assert msg["Subject"] == (
        f"Nuevo pedido a coordinar {pedido['codigo']} — Uniformes escolares"
    )
    assert msg["Reply-To"] == "maria@gmail.com"
    text = msg.get_body(("plain",)).get_content()  # type: ignore[union-attr]
    assert "2 × Remera / chomba talle 10 — Colegio Santa Rosa de Lima" in text
    assert "1 × Corbata — Colegio Santa Rosa de Lima" in text
    assert "Total: $35.000" in text
    assert "Saldo contra entrega: $27.000" in text
    assert "Entrega: Av. Libertador 1234 (O), Capital" in text
    assert "https://wa.me/5492644123456" in text


def test_express_cobra_envio_mas_recargo(
    client: TestClient, colegio: dict[str, Any]
) -> None:
    body = pedido_body(colegio["slug"], entrega="express", modalidad_pago="total")
    pedido = client.post(f"{API}/uniformes/pedidos", json=body).json()["pedido"]
    assert (pedido["envio_monto"], pedido["recargo_express"], pedido["total"]) == (
        "5000.00",
        "6000.00",
        "41000.00",
    )
    assert pedido["entrega_label"] == "Envío express (24 hs)"


@pytest.mark.parametrize(
    ("cambio", "mensaje"),
    [
        ({"opcion": "99"}, "Elegí talle de remera"),
        ({"opcion": None}, "Elegí talle de remera"),
        ({"producto": "smoking"}, "no tiene ese producto"),
    ],
)
def test_pedido_valida_producto_y_opcion(
    client: TestClient, colegio: dict[str, Any], cambio: dict[str, Any], mensaje: str
) -> None:
    body = pedido_body(colegio["slug"])
    body["items"][0].update(cambio)
    response = client.post(f"{API}/uniformes/pedidos", json=body)
    assert response.status_code == 422
    assert mensaje in response.json()["detail"]


def test_pedido_valida_entrega_pago_y_cliente(
    client: TestClient, colegio: dict[str, Any]
) -> None:
    slug = colegio["slug"]

    def post(**kw: Any) -> Any:
        return client.post(f"{API}/uniformes/pedidos", json=pedido_body(slug, **kw))

    corbata_talle = pedido_body(slug)
    corbata_talle["items"][1]["opcion"] = "M"
    resp = client.post(f"{API}/uniformes/pedidos", json=corbata_talle)
    assert "no tiene talle" in resp.json()["detail"]
    assert "no está disponible" in post(entrega="retiro").json()["detail"]
    lejos = post(cliente={**CLIENTE, "departamento": "Jáchal"})
    assert lejos.status_code == 422 and "Gran" not in lejos.json()["detail"]
    assert "Capital" in lejos.json()["detail"]
    sin_dir = post(cliente={**CLIENTE, "direccion": "  "})
    assert sin_dir.json()["detail"] == "Escribí la dirección de entrega"
    assert post(cliente={**CLIENTE, "telefono": "123"}).status_code == 422
    assert post(cliente={**CLIENTE, "nombre": "   "}).status_code == 422
    assert post(items=[]).status_code == 422


def test_el_precio_lo_pone_el_servidor(
    client: TestClient, colegio: dict[str, Any]
) -> None:
    body = pedido_body(colegio["slug"])
    body["items"][0]["precio"] = "1"  # se ignora
    body["total"] = "1"
    data = client.post(f"{API}/uniformes/pedidos", json=body).json()
    assert data["pedido"]["total"] == "35000.00"


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
        f"{API}/uniformes/pedidos", json=pedido_body(colegio["slug"])
    )
    assert response.status_code == 201
    assert db.scalars(select(Pedido)).one().notificado_at is None


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
    body = pedido_body(colegio["slug"], entrega="express", modalidad_pago="total")
    response = client.post(f"{API}/uniformes/pedidos", json=body)
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["init_point"] == "https://mp.test/checkout/pref-123"
    assert data["pedido"]["estado"] == "pendiente_pago"
    assert data["pedido"]["pago_url"] == "https://mp.test/checkout/pref-123"

    request = route.calls.last.request
    assert request.headers["Authorization"] == "Bearer APP_USR-test"
    assert request.headers["X-Idempotency-Key"] == data["pedido"]["id"]
    sent = json.loads(request.content)
    assert sent["items"][0]["unit_price"] == 41000.0
    assert sent["items"][0]["title"].startswith("Uniformes escolares — Pago total")
    assert sent["external_reference"] == data["pedido"]["id"]
    assert sent["payer"] == {"name": "María González", "email": "maria@gmail.com"}
    back = f"https://compravendeaqui.test/tiendas/pedido/{data['pedido']['id']}"
    assert sent["back_urls"] == {"success": back, "failure": back, "pending": back}
    assert sent["notification_url"].startswith(
        "https://compravendeaqui.test/api/v1/tiendas/webhooks/mercadopago"
    )
    assert db.scalars(select(Pedido)).one().mp_preference_id == "pref-123"


@respx.mock
def test_si_mp_falla_no_queda_el_pedido(
    client: TestClient, colegio: dict[str, Any], mp: None, db: Any
) -> None:
    respx.post(f"{MP}/checkout/preferences").mock(
        return_value=httpx.Response(401, json={"message": "invalid token"})
    )
    response = client.post(
        f"{API}/uniformes/pedidos", json=pedido_body(colegio["slug"])
    )
    assert response.status_code == 503
    assert db.scalars(select(Pedido)).all() == []


def _crear_pendiente(client: TestClient, slug: str) -> dict[str, Any]:
    with respx.mock:
        respx.post(f"{MP}/checkout/preferences").mock(
            return_value=httpx.Response(
                201, json={"id": "p", "init_point": "https://x"}
            )
        )
        data: dict[str, Any] = client.post(
            f"{API}/uniformes/pedidos", json=pedido_body(slug)
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
            f"{API}/webhooks/mercadopago?data.id=987654321&type=payment",
            json={"type": "payment", "data": {"id": "987654321"}},
        )
    assert response.status_code == 200
    estado = client.get(f"{API}/pedidos/{pedido['id']}").json()
    assert estado["estado"] == "pagado" and estado["pagado_at"]
    assert estado["pago_url"] is None
    assert sent_mail[-1]["Subject"].startswith(
        f"Nuevo pedido pagado {pedido['codigo']}"
    )
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
            f"{API}/webhooks/mercadopago",
            json={"type": "payment", "data": {"id": "987654321"}},
        )
    assert client.get(f"{API}/pedidos/{pedido['id']}").json()["estado"] == (
        "pendiente_pago"
    )


def test_vuelta_de_mp_rechazado_y_luego_aprobado(
    client: TestClient, colegio: dict[str, Any], mp: None
) -> None:
    pedido = _crear_pendiente(client, colegio["slug"])
    url = f"{API}/pedidos/{pedido['id']}?payment_id=987654321"
    with respx.mock:
        route = respx.get(f"{MP}/v1/payments/987654321")
        route.mock(
            return_value=httpx.Response(200, json=_pago(pedido["id"], "rejected"))
        )
        rechazado = client.get(url).json()
        assert rechazado["estado"] == "rechazado"
        assert rechazado["pago_url"] == "https://x"  # puede volver a intentar
        route.mock(return_value=httpx.Response(200, json=_pago(pedido["id"])))
        pagado = client.get(url).json()
        assert pagado["estado"] == "pagado" and pagado["pago_url"] is None
        calls = route.call_count
        client.get(url)  # ya pagado: no vuelve a consultar
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
        estado = client.get(f"{API}/pedidos/{pedido['id']}?payment_id=987654321").json()
        assert estado["estado"] == "pendiente_pago"
        assert client.get(f"{API}/pedidos/{otro['id']}").json()["estado"] == (
            "pendiente_pago"
        )
        client.get(f"{API}/pedidos/{pedido['id']}?payment_id=1;drop")


def _firma(data_id: str, request_id: str, ts: int, secret: str = "secreto") -> str:
    manifest = f"id:{data_id};request-id:{request_id};ts:{ts};"
    v1 = hmac.new(secret.encode(), manifest.encode(), hashlib.sha256).hexdigest()
    return f"ts={ts},v1={v1}"


def test_webhook_firma(
    client: TestClient,
    colegio: dict[str, Any],
    mp: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "mp_webhook_secret", "secreto")
    pedido = _crear_pendiente(client, colegio["slug"])
    hook = TestClient(client.app)
    path = f"{API}/webhooks/mercadopago?data.id=987654321&type=payment"
    body = {"type": "payment", "data": {"id": "987654321"}}
    now = int(time.time())
    for headers in [
        {"x-signature": "ts=1,v1=deadbeef", "x-request-id": "r"},
        {},
        {"x-signature": _firma("987654321", "r", now)},  # sin request-id
        {"x-signature": _firma("987654321", "r", now - 600), "x-request-id": "r"},
        {"x-signature": _firma("111", "r", now), "x-request-id": "r"},
    ]:
        assert hook.post(path, json=body, headers=headers).status_code == 401
    with respx.mock:
        respx.get(f"{MP}/v1/payments/987654321").mock(
            return_value=httpx.Response(200, json=_pago(pedido["id"]))
        )
        ok = hook.post(
            path,
            json=body,
            headers={
                "x-signature": _firma("987654321", "r", now * 1000),
                "x-request-id": "r",
            },
        )
    assert ok.status_code == 200
    assert client.get(f"{API}/pedidos/{pedido['id']}").json()["estado"] == "pagado"


def test_webhook_ids_y_otros_avisos(client: TestClient, mp: None) -> None:
    hook = TestClient(client.app)
    distinto = hook.post(
        f"{API}/webhooks/mercadopago?data.id=111&type=payment",
        json={"type": "payment", "data": {"id": "222"}},
    )
    assert distinto.status_code == 400
    otro = hook.post(
        f"{API}/webhooks/mercadopago?topic=merchant_order&id=1", content=b""
    )
    assert otro.status_code == 200
    assert (
        client.get(f"{API}/pedidos/00000000-0000-4000-8000-000000000000").status_code
        == 404
    )


def test_en_produccion_mp_exige_secreto_del_webhook() -> None:
    base: dict[str, Any] = dict(
        environment="production",
        jwt_secret_key="x" * 40,
        cookie_secure=True,
        mp_access_token="APP_USR-1",
    )
    with pytest.raises(ValueError, match="MP_WEBHOOK_SECRET"):
        Settings(**base)
    prod = Settings(**base, mp_webhook_secret="s")
    sin = prod.model_copy(update={"mp_webhook_secret": ""})
    assert (
        valid_signature(x_signature=None, x_request_id=None, data_id="1", config=sin)
        is False
    )


# --- Administración: tiendas, encargados y configuración ----------------------


def test_crear_tienda_y_asignar_encargado(
    admin: TestClient, make_user: MakeUser, db: Any, client: TestClient
) -> None:
    creada = admin.post(ADMIN, json=LIBRERIA)
    assert creada.status_code == 201, creada.text
    lib = creada.json()
    assert lib["slug"] == "libreria-el-estudiante"
    assert lib["vendedor_whatsapp"] == "+5492644001122"
    assert lib["departamentos_envio"] == ["Capital", "Rivadavia"]

    encargado, email = _admin_of(make_user, db, role="user")
    assert encargado.get("/api/v1/auth/me").json()["gestiona_tiendas"] is False
    assert admin.get("/api/v1/auth/me").json()["gestiona_tiendas"] is True
    assert encargado.get(f"{ADMIN}/libreria-el-estudiante/catalogo").status_code == 404
    sin_cuenta = admin.post(
        f"{ADMIN}/libreria-el-estudiante/encargados", json={"email": "nadie@mail.com"}
    )
    assert sin_cuenta.status_code == 404
    asignado = admin.post(
        f"{ADMIN}/libreria-el-estudiante/encargados", json={"email": email}
    )
    assert asignado.status_code == 201
    assert [
        e["email"]
        for e in admin.get(f"{ADMIN}/libreria-el-estudiante/encargados").json()
    ] == [email]

    # El encargado ve y maneja solo su tienda (y el menú le muestra el panel).
    assert encargado.get("/api/v1/auth/me").json()["gestiona_tiendas"] is True
    assert [t["slug"] for t in encargado.get(ADMIN).json()] == [
        "libreria-el-estudiante"
    ]
    assert encargado.get(f"{ADMIN}/uniformes/catalogo").status_code == 404
    assert encargado.post(ADMIN, json=LIBRERIA).status_code == 403
    assert (
        encargado.post(
            f"{ADMIN}/uniformes/encargados", json={"email": email}
        ).status_code
        == 403
    )
    assert {t["slug"] for t in admin.get(ADMIN).json()} == {
        "libreria-el-estudiante",
        "uniformes",
    }
    # Público: la tienda nueva aparece.
    publica = client.get(f"{API}/libreria-el-estudiante").json()
    assert publica["entregas"] == ["estandar", "retiro"]
    assert publica["modalidades"] == ["total"]
    assert publica["retiro_direccion"] == "Mitre 100 (E), Capital"

    user_id = admin.get(f"{ADMIN}/libreria-el-estudiante/encargados").json()[0]["id"]
    quitado = admin.delete(f"{ADMIN}/libreria-el-estudiante/encargados/{user_id}")
    assert quitado.status_code == 204
    assert encargado.get(ADMIN).json() == []
    assert encargado.get("/api/v1/auth/me").json()["gestiona_tiendas"] is False
    otra_vez = admin.delete(f"{ADMIN}/libreria-el-estudiante/encargados/{user_id}")
    assert otra_vez.status_code == 404


def test_encargado_solo_con_email_verificado(
    admin: TestClient, make_user: MakeUser, db: Any
) -> None:
    """Un email cargado sin verificar en un perfil no da permisos de encargado."""
    _, email = _admin_of(make_user, db, role="user")
    db.execute(update(User).where(User.email == email).values(email_verified=False))
    db.commit()
    response = admin.post(f"{ADMIN}/uniformes/encargados", json={"email": email})
    assert response.status_code == 404


def test_el_dueno_configura_envio_express_retiro_y_pagos(
    admin: TestClient,
    client: TestClient,
    colegio: dict[str, Any],
    make_user: MakeUser,
    db: Any,
) -> None:
    virginia, email = _admin_of(make_user, db, role="user")
    admin.post(f"{ADMIN}/uniformes/encargados", json={"email": email})
    actual = virginia.get(f"{ADMIN}/uniformes/catalogo").json()["tienda"]
    nueva = {
        **actual,
        "envio_monto": "3500",
        "envio_gratis_desde": "60000",
        "express_recargo_pct": 15,
        "express_monto": "1000",
        "express_demora": "el mismo día",
        "retiro_habilitado": True,
        "retiro_direccion": "Santiago del Estero Sur 1131, Capital",
        "sena_pct": 30,
    }
    nueva.pop("slug")
    ok = virginia.put(f"{ADMIN}/uniformes", json=nueva)
    assert ok.status_code == 200, ok.text
    publica = client.get(f"{API}/uniformes").json()
    assert publica["entregas"] == ["estandar", "express", "retiro"]
    assert publica["express_demora"] == "el mismo día"

    body = pedido_body(colegio["slug"], entrega="express", modalidad_pago="sena")
    pedido = client.post(f"{API}/uniformes/pedidos", json=body).json()["pedido"]
    # 30.000 + envío 3.500 + express (15% = 4.500 + 1.000); seña 30% = 9.000.
    assert (pedido["envio_monto"], pedido["recargo_express"], pedido["total"]) == (
        "3500.00",
        "5500.00",
        "39000.00",
    )
    assert pedido["pagado_ahora"] == "18000.00"
    retiro = client.post(
        f"{API}/uniformes/pedidos",
        json=pedido_body(
            colegio["slug"],
            entrega="retiro",
            modalidad_pago="total",
            cliente={**CLIENTE, "direccion": None, "departamento": None},
        ),
    ).json()["pedido"]
    assert (retiro["envio_monto"], retiro["total"]) == ("0.00", "30000.00")
    assert retiro["entrega_label"] == "Retiro en el local"


@pytest.mark.parametrize(
    ("cambio", "mensaje"),
    [
        ({"envio_habilitado": False, "retiro_habilitado": False}, "Habilitá el envío"),
        ({"sena_habilitada": False, "total_habilitado": False}, "Habilitá la seña"),
        ({"retiro_habilitado": True, "retiro_direccion": " "}, "dirección de retiro"),
        ({"departamentos_envio": []}, "al menos un departamento"),
    ],
)
def test_config_invalida(
    admin: TestClient, cambio: dict[str, Any], mensaje: str
) -> None:
    actual = admin.get(f"{ADMIN}/uniformes/catalogo").json()["tienda"]
    actual.pop("slug")
    response = admin.put(f"{ADMIN}/uniformes", json={**actual, **cambio})
    assert response.status_code == 422
    assert mensaje in response.json()["detail"]
    malo = admin.put(
        f"{ADMIN}/uniformes", json={**actual, "departamentos_envio": ["Mendoza"]}
    )
    assert malo.status_code == 422


def test_libreria_productos_solo_donde_se_habilitan(
    admin: TestClient, client: TestClient
) -> None:
    admin.post(ADMIN, json=LIBRERIA)
    base = f"{ADMIN}/libreria-el-estudiante"
    lista = admin.post(
        f"{base}/grupos", json={"nombre": "1er grado", "categoria": "Primaria"}
    ).json()
    cuaderno = admin.post(
        f"{base}/productos",
        json={
            "nombre": "Cuaderno Rivadavia 48 hojas",
            "precio_base": "2500",
            "opciones": ["Rayado", "Cuadriculado", " Rayado "],
        },
    ).json()
    assert cuaderno["opciones"] == ["Rayado", "Cuadriculado"]
    assert cuaderno["tipo"] == "generico"
    admin.post(f"{base}/productos", json={"nombre": "Mochila", "precio_base": "30000"})
    vacio = client.get(f"{API}/libreria-el-estudiante/grupos/{lista['slug']}").json()
    assert vacio["productos"] == []
    admin.put(
        f"{base}/precios",
        json={"grupo": lista["slug"], "producto": cuaderno["slug"], "disponible": True},
    )
    productos = client.get(
        f"{API}/libreria-el-estudiante/grupos/{lista['slug']}"
    ).json()["productos"]
    assert [p["nombre"] for p in productos] == ["Cuaderno Rivadavia 48 hojas"]
    pedido = client.post(
        f"{API}/libreria-el-estudiante/pedidos",
        json={
            "items": [
                {
                    "grupo": lista["slug"],
                    "producto": cuaderno["slug"],
                    "opcion": "Rayado",
                    "cantidad": 4,
                }
            ],
            "entrega": "estandar",
            "modalidad_pago": "total",
            "cliente": CLIENTE,
        },
    ).json()["pedido"]
    # Envío gratis (monto 0) y solo pago total.
    assert (pedido["envio_monto"], pedido["total"]) == ("0.00", "10000.00")
    assert pedido["opcion_label"] == "Color"
    sena = client.post(
        f"{API}/libreria-el-estudiante/pedidos",
        json={
            "items": [
                {
                    "grupo": lista["slug"],
                    "producto": cuaderno["slug"],
                    "opcion": "Rayado",
                    "cantidad": 1,
                }
            ],
            "entrega": "estandar",
            "modalidad_pago": "sena",
            "cliente": CLIENTE,
        },
    )
    assert "pago no está disponible" in sena.json()["detail"]


def test_admin_pedidos_y_estados(
    admin: TestClient, client: TestClient, colegio: dict[str, Any]
) -> None:
    pedido = client.post(
        f"{API}/uniformes/pedidos", json=pedido_body(colegio["slug"])
    ).json()["pedido"]
    lista = admin.get(f"{ADMIN}/uniformes/pedidos").json()
    assert lista[0]["codigo"] == pedido["codigo"]
    assert lista[0]["cliente_tel"] == "+5492644123456"
    assert lista[0]["direccion"] == "Av. Libertador 1234 (O)"
    assert lista[0]["cliente_whatsapp_url"].startswith("https://wa.me/5492644123456")
    cambio = admin.put(
        f"{ADMIN}/uniformes/pedidos/{pedido['id']}", json={"estado": "entregado"}
    )
    assert cambio.json()["estado"] == "entregado"
    assert admin.get(f"{ADMIN}/uniformes/pedidos?estado=a_coordinar").json() == []
    invalido = admin.put(
        f"{ADMIN}/uniformes/pedidos/{pedido['id']}", json={"estado": "perdido"}
    )
    assert invalido.status_code == 422
    # Un pedido de otra tienda no se toca desde esta.
    admin.post(ADMIN, json=LIBRERIA)
    ajeno = admin.put(
        f"{ADMIN}/libreria-el-estudiante/pedidos/{pedido['id']}",
        json={"estado": "cancelado"},
    )
    assert ajeno.status_code == 404


def test_admin_requiere_permiso(client: TestClient, make_user: MakeUser) -> None:
    assert client.get(ADMIN).status_code == 401
    comun, _ = make_user()
    assert comun.get(ADMIN).json() == []
    assert comun.get(f"{ADMIN}/uniformes/pedidos").status_code == 404
    assert (
        comun.put(f"{ADMIN}/uniformes/productos/remera", json={"precio_base": "1"})
    ).status_code == 404


def test_admin_grupos(admin: TestClient, colegio: dict[str, Any]) -> None:
    def crear(nombre: str) -> Any:
        return admin.post(
            f"{ADMIN}/uniformes/grupos",
            json={"nombre": nombre, "color1": "#000000", "color2": "#FFFFFF"},
        )

    assert crear("Colegio Santa Rosa de Lima").json()["slug"] == (
        "colegio-santa-rosa-de-lima-2"
    )
    assert crear("Carrito").json()["slug"] == "colegio-carrito"
    malo = admin.post(
        f"{ADMIN}/uniformes/grupos", json={"nombre": "Otro", "color1": "azul"}
    )
    assert malo.status_code == 422
    editado = admin.put(
        f"{ADMIN}/uniformes/grupos/{colegio['slug']}",
        json={"color1": "#7f1d1d", "nombre": "Colegio Santa Rosa", "activo": False},
    ).json()
    assert (editado["color1"], editado["nombre"], editado["activo"]) == (
        "#7F1D1D",
        "Colegio Santa Rosa",
        False,
    )
    assert editado["slug"] == colegio["slug"]  # no rompe links compartidos


def test_admin_logo_y_foto(
    admin: TestClient, colegio: dict[str, Any], fake_storage: dict[str, bytes]
) -> None:
    logo = admin.post(
        f"{ADMIN}/uniformes/grupos/{colegio['slug']}/logo",
        files={"file": ("e.jpg", io.BytesIO(jpeg_bytes((400, 400))), "image/jpeg")},
    )
    assert logo.status_code == 200, logo.text
    assert logo.json()["logo_url"].startswith(
        "https://cdn.test/media/tiendas/uniformes/logos/colegio-santa-rosa-de-lima/"
    )
    foto = admin.post(
        f"{ADMIN}/uniformes/productos/buzo/foto",
        files={"file": ("b.jpg", io.BytesIO(jpeg_bytes((800, 800))), "image/jpeg")},
    )
    assert foto.json()["foto_url"].startswith(
        "https://cdn.test/media/tiendas/uniformes/productos/buzo/"
    )
    assert len(fake_storage) == 2
    no_imagen = admin.post(
        f"{ADMIN}/uniformes/productos/buzo/foto",
        files={"file": ("x.jpg", io.BytesIO(b"no soy una imagen"), "image/jpeg")},
    )
    assert no_imagen.status_code == 422
    assert admin.put(f"{ADMIN}/uniformes/productos/nada", json={}).status_code == 404


def _jpg(name: str = "f.jpg") -> dict[str, Any]:
    return {"file": (name, io.BytesIO(jpeg_bytes((600, 600))), "image/jpeg")}


def test_foto_de_producto_por_grupo(
    admin: TestClient,
    client: TestClient,
    colegio: dict[str, Any],
    fake_storage: dict[str, bytes],
) -> None:
    otro = admin.post(
        f"{ADMIN}/uniformes/grupos",
        json={"nombre": "Colegio San Pablo", "color1": "#111111", "color2": "#eeeeee"},
    ).json()
    general = admin.post(f"{ADMIN}/uniformes/productos/remera/foto", files=_jpg())
    general_url = general.json()["foto_url"]
    url_slug = f"{ADMIN}/uniformes/grupos/{otro['slug']}/productos/remera/foto"
    propia = admin.post(url_slug, files=_jpg())
    assert propia.status_code == 200, propia.text
    propia_url = propia.json()["foto_url"]
    assert propia_url.startswith(
        "https://cdn.test/media/tiendas/uniformes/grupos/colegio-san-pablo/remera/"
    )

    def foto(grupo: str) -> str | None:
        productos = client.get(f"{API}/uniformes/grupos/{grupo}").json()["productos"]
        url: str | None = next(p for p in productos if p["slug"] == "remera")[
            "foto_url"
        ]
        return url

    assert foto(otro["slug"]) == propia_url
    assert foto(colegio["slug"]) == general_url  # el otro colegio no cambia
    # Cambiar el precio no borra la foto, y la fila nueva no oculta la prenda.
    precio = admin.put(
        f"{ADMIN}/uniformes/precios",
        json={"grupo": otro["slug"], "producto": "remera", "precio": "12000"},
    ).json()
    assert precio["foto_url"] == propia_url
    assert foto(otro["slug"]) == propia_url
    catalogo = admin.get(f"{ADMIN}/uniformes/catalogo").json()
    assert {p["producto"]: p["foto_url"] for p in catalogo["precios"]} == {
        "remera": propia_url
    }
    # Reemplazar o quitar la foto borra la anterior del bucket.
    objetos = len(fake_storage)
    reemplazo = admin.post(url_slug, files=_jpg()).json()["foto_url"]
    assert reemplazo != propia_url and len(fake_storage) == objetos
    assert admin.delete(url_slug).json()["foto_url"] is None
    assert len(fake_storage) == objetos - 1
    assert foto(otro["slug"]) == general_url
    otra_general = admin.post(f"{ADMIN}/uniformes/productos/remera/foto", files=_jpg())
    assert otra_general.json()["foto_url"] != general_url
    assert len(fake_storage) == objetos - 1  # la general vieja también se borra
    nada = f"{ADMIN}/uniformes/grupos/{otro['slug']}/productos/nada/foto"
    assert admin.post(nada, files=_jpg()).status_code == 404


def test_galeria_del_grupo(
    admin: TestClient,
    client: TestClient,
    colegio: dict[str, Any],
    fake_storage: dict[str, bytes],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    base = f"{ADMIN}/uniformes/grupos/{colegio['slug']}/fotos"
    primera = admin.post(base, files=_jpg()).json()["fotos"]
    fotos = admin.post(base, files=_jpg()).json()["fotos"]
    assert len(fotos) == 2 and fotos[0] == primera[0]
    publico = client.get(f"{API}/uniformes/grupos/{colegio['slug']}").json()
    assert publico["fotos"] == fotos
    assert len(fake_storage) == 2
    assert admin.delete(f"{base}/0").json()["fotos"] == fotos[1:]
    assert len(fake_storage) == 1
    assert admin.delete(f"{base}/5").status_code == 404
    monkeypatch.setattr("app.services.tiendas.MAX_FOTOS_GRUPO", 1)
    lleno = admin.post(base, files=_jpg())
    assert lleno.status_code == 409
    assert "Hasta 1 fotos" in lleno.json()["detail"]


def test_galeria_tope_con_subidas_simultaneas(
    admin: TestClient,
    colegio: dict[str, Any],
    fake_storage: dict[str, bytes],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Otra subida completa la galería mientras esta sube: no pasa el tope
    y la imagen que sobra se borra."""
    from app.database import SessionLocal
    from app.services import tiendas as service

    monkeypatch.setattr(service, "MAX_FOTOS_GRUPO", 1)
    original = service.subir_imagen

    async def subir_y_competir(upload: Any, carpeta: str) -> str:
        url = await original(upload, carpeta)
        with SessionLocal() as otra:
            grupo = otra.scalars(
                select(Grupo).where(Grupo.slug == colegio["slug"])
            ).one()
            grupo.fotos = ["https://cdn.test/media/tiendas/otra.webp"]
            otra.commit()
        return url

    monkeypatch.setattr(service, "subir_imagen", subir_y_competir)
    respuesta = admin.post(
        f"{ADMIN}/uniformes/grupos/{colegio['slug']}/fotos", files=_jpg()
    )
    assert respuesta.status_code == 409
    assert fake_storage == {}


def test_borrar_solo_imagenes_propias(
    fake_storage: dict[str, bytes], monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.services import storage
    from app.services.tiendas import borrar_imagenes

    borradas: list[list[str]] = []
    monkeypatch.setattr(storage, "delete_objects", borradas.append)
    propia = storage.public_url("tiendas/uniformes/a.webp")
    borrar_imagenes(
        [
            propia,
            None,
            "https://otro.sitio/tiendas/x.webp",
            storage.public_url("avatars/u.webp"),
            storage.public_url("tiendas/../avatars/u.webp"),
        ]
    )
    assert borradas == [["tiendas/uniformes/a.webp"]]


def test_galeria_sin_permiso(
    make_user: MakeUser, colegio: dict[str, Any], fake_storage: dict[str, bytes]
) -> None:
    ajeno, _ = make_user()
    base = f"{ADMIN}/uniformes/grupos/{colegio['slug']}"
    assert ajeno.post(f"{base}/fotos", files=_jpg()).status_code == 404
    assert ajeno.delete(f"{base}/productos/remera/foto").status_code == 404


def test_admin_producto_inactivo_y_opciones(
    admin: TestClient, client: TestClient, colegio: dict[str, Any]
) -> None:
    nuevo = admin.post(
        f"{ADMIN}/uniformes/productos",
        json={
            "nombre": "Medias",
            "tipo": "generico",
            "precio_base": "3000",
            "opciones": ["1", "2"],
        },
    ).json()
    admin.put(f"{ADMIN}/uniformes/productos/corbata", json={"activo": False})
    admin.put(
        f"{ADMIN}/uniformes/productos/{nuevo['slug']}", json={"opciones": ["Única"]}
    )
    productos = client.get(f"{API}/uniformes/grupos/{colegio['slug']}").json()[
        "productos"
    ]
    assert "corbata" not in [p["slug"] for p in productos]
    assert next(p for p in productos if p["slug"] == "medias")["opciones"] == ["Única"]


def test_guia_de_talles(
    admin: TestClient, client: TestClient, colegio: dict[str, Any]
) -> None:
    url = f"{API}/uniformes/grupos/{colegio['slug']}"
    remera = next(
        p for p in client.get(url).json()["productos"] if p["slug"] == "remera"
    )
    # Medidas de referencia cargadas por la migración, en el orden de los talles.
    assert remera["medidas"]["columnas"][0] == "Largo total"
    assert remera["medidas"]["aproximadas"] is True
    assert [f["talle"] for f in remera["medidas"]["filas"]][:2] == ["4", "6"]

    propias = {
        "columnas": ["Largo", "Ancho"],
        "filas": [
            {"talle": "4", "valores": [45, 34]},
            {"talle": "6", "valores": [48, None]},
        ],
        "aproximadas": False,
    }
    r = admin.put(f"{ADMIN}/uniformes/productos/remera", json={"medidas": propias})
    assert r.status_code == 200, r.text
    assert r.json()["medidas"]["filas"][1]["valores"] == [48, None]
    remera = next(
        p for p in client.get(url).json()["productos"] if p["slug"] == "remera"
    )
    assert remera["medidas"]["aproximadas"] is False

    # Una fila con menos medidas que columnas no se guarda.
    malas = {**propias, "filas": [{"talle": "4", "valores": [45]}]}
    assert (
        admin.put(
            f"{ADMIN}/uniformes/productos/remera", json={"medidas": malas}
        ).status_code
        == 422
    )
    # null borra la guía.
    admin.put(f"{ADMIN}/uniformes/productos/remera", json={"medidas": None})
    remera = next(
        p for p in client.get(url).json()["productos"] if p["slug"] == "remera"
    )
    assert remera["medidas"] is None


# --- Scripts ------------------------------------------------------------------


def test_import_grupos(db: Any) -> None:
    rows = [
        {
            "nombre": "Escuela Industrial Domingo F. Sarmiento",
            "subtitulo": "Capital",
            "categoria": "Preuniversitarios (UNSJ)",
            "color1": "#0f172a",
            "color2": "#facc15",
        },
        {
            "nombre": "Colegio del Bicentenario",
            "subtitulo": "Rivadavia",
            "categoria": "Privados laicos y bilingües",
            "color1": "#14532d",
            "color2": "#ffffff",
        },
    ]
    assert import_grupos("uniformes", rows) == (2, 0)
    rows[1]["color1"] = "#000000"
    assert import_grupos("uniformes", rows) == (0, 2)
    colores = {g.slug: g.color1 for g in db.scalars(select(Grupo))}
    assert colores == {
        "escuela-industrial-domingo-f-sarmiento": "#0F172A",
        "colegio-del-bicentenario": "#000000",
    }
    with pytest.raises(ValueError, match="Categorías"):
        import_grupos("uniformes", [{**rows[0], "categoria": "Públicos"}])
    with pytest.raises(ValueError, match="No existe"):
        import_grupos("nada", rows)


def test_script_fotos_grupo(
    db: Any, fake_storage: dict[str, bytes], tmp_path: Any
) -> None:
    import_grupos(
        "uniformes",
        [{"nombre": "Colegio San Pablo", "color1": "#111111", "color2": "#eeeeee"}],
    )
    imagen = tmp_path / "a.jpg"
    imagen.write_bytes(jpeg_bytes((500, 500)))
    salida = fotos_grupo(
        [
            "uniformes",
            "colegio-san-pablo",
            "--galeria",
            str(imagen),
            str(imagen),
            "--producto",
            "pollera",
            str(imagen),
        ]
    )
    assert salida == "Colegio San Pablo: 2 fotos en la galería, 1 prendas con foto"
    assert len(fake_storage) == 3
    with pytest.raises(SystemExit, match="No existe"):
        fotos_grupo(["nada", "colegio-san-pablo"])


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
    assert {t["slug"] for t in client.get(ADMIN).json()} == {"uniformes"}
    assert set_role("jefe@mail.com", admin=False) is True
    assert client.get(ADMIN).json() == []
