"""Publicar avisos y uniformes en Facebook e Instagram (API de Meta simulada)."""

from __future__ import annotations

import io
from collections.abc import Callable, Iterator
from typing import Any

import httpx
import pytest
import respx
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import select, update

from app.config import settings
from app.models import User
from app.models.tiendas import Producto
from app.services import redes
from app.tests.conftest import create_listing, jpeg_bytes

API = "/api/v1/admin/redes"
GRAPH = "https://graph.facebook.com/v21.0"
MakeUser = Callable[..., tuple[TestClient, dict[str, Any]]]


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
def aviso(make_user: MakeUser, category_id: str) -> dict[str, Any]:
    seller, _ = make_user()
    listing = create_listing(seller, category_id, title="Heladera Gafa 340 L")
    files = {"files": ("foto.jpg", jpeg_bytes((1200, 900)), "image/jpeg")}
    r = seller.post(f"/api/v1/listings/{listing['id']}/images", files=files)
    assert r.status_code in (200, 201), r.text
    return listing


@pytest.fixture
def meta(monkeypatch: pytest.MonkeyPatch) -> Iterator[respx.MockRouter]:
    monkeypatch.setattr(settings, "meta_page_id", "111")
    monkeypatch.setattr(settings, "meta_page_token", "token-de-prueba")
    monkeypatch.setattr(settings, "meta_ig_user_id", "222")
    monkeypatch.setattr(redes.time, "sleep", lambda s: None)
    with respx.mock(assert_all_called=False) as router:
        router.post(f"{GRAPH}/111/photos").mock(
            return_value=httpx.Response(200, json={"id": "9", "post_id": "111_9"})
        )
        router.post(f"{GRAPH}/222/media").mock(
            return_value=httpx.Response(200, json={"id": "c1"})
        )
        router.get(f"{GRAPH}/c1").mock(
            return_value=httpx.Response(200, json={"status_code": "FINISHED"})
        )
        router.post(f"{GRAPH}/222/media_publish").mock(
            return_value=httpx.Response(200, json={"id": "m1"})
        )
        router.get(f"{GRAPH}/m1").mock(
            return_value=httpx.Response(
                200, json={"permalink": "https://www.instagram.com/p/abc/"}
            )
        )
        yield router


def test_vista_previa_sin_conectar(
    admin: TestClient, aviso: dict[str, Any], client: TestClient
) -> None:
    r = admin.get(f"{API}/avisos/{aviso['id']}")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["conectadas"] == {"facebook": False, "instagram": False}
    assert "US$ 15.900" in data["textos"]["facebook"]
    assert "?utm_source=facebook" in data["textos"]["facebook"]
    assert "link en el perfil" in data["textos"]["instagram"]

    img = admin.get(f"{API}/avisos/{aviso['id']}/imagen.jpg")
    assert img.headers["content-type"] == "image/jpeg"
    assert Image.open(io.BytesIO(img.content)).size == (1080, 1080)

    # Sin conectar, no publica; y solo los admins usan esto.
    r = admin.post(f"{API}/avisos/{aviso['id']}", json={"redes": ["facebook"]})
    assert r.status_code == 409
    assert "Falta conectar Facebook" in r.json()["detail"]
    assert client.get(f"{API}/avisos/{aviso['id']}").status_code == 401


def test_publica_en_facebook_e_instagram(
    admin: TestClient, aviso: dict[str, Any], meta: respx.MockRouter
) -> None:
    r = admin.post(
        f"{API}/avisos/{aviso['id']}", json={"redes": ["facebook", "instagram"]}
    )
    assert r.status_code == 202, r.text
    assert {p["estado"] for p in r.json()} == {"pendiente"}

    # La tarea en segundo plano corre al terminar la respuesta (TestClient).
    publicaciones = admin.get(f"{API}/avisos/{aviso['id']}").json()["publicaciones"]
    por_red = {p["red"]: p for p in publicaciones}
    assert por_red["facebook"]["estado"] == "publicada"
    assert por_red["facebook"]["permalink"] == "https://www.facebook.com/111_9"
    assert por_red["instagram"]["permalink"] == "https://www.instagram.com/p/abc/"
    assert por_red["facebook"]["imagen_url"].endswith(".jpg")

    foto = meta.calls[0].request
    assert b"caption=Heladera" in foto.content
    (historial,) = [h for h in admin.get(API).json() if h["red"] == "facebook"]
    assert historial["aviso_titulo"] == "Heladera Gafa 340 L"


def test_error_de_meta_y_reintento(
    admin: TestClient, aviso: dict[str, Any], meta: respx.MockRouter
) -> None:
    meta.post(f"{GRAPH}/111/photos").mock(
        return_value=httpx.Response(
            400, json={"error": {"message": "El token de acceso venció"}}
        )
    )
    admin.post(f"{API}/avisos/{aviso['id']}", json={"redes": ["facebook"]})
    (fila,) = admin.get(f"{API}/avisos/{aviso['id']}").json()["publicaciones"]
    assert fila["estado"] == "error"
    assert fila["error"] == "El token de acceso venció"

    meta.post(f"{GRAPH}/111/photos").mock(
        return_value=httpx.Response(200, json={"id": "9", "post_id": "111_9"})
    )
    r = admin.post(f"{API}/{fila['id']}/reintentar")
    assert r.json()["estado"] == "publicada"


# --- Productos de tiendas (uniformes por colegio) ------------------------------


@pytest.fixture
def remera_del_colegio(admin: TestClient, db: Any) -> str:
    r = admin.post(
        "/api/v1/admin/tiendas/uniformes/grupos",
        json={
            "nombre": "Colegio San Pablo",
            "subtitulo": "Capital",
            "color1": "#a3391e",
            "color2": "#ffffff",
        },
    )
    assert r.status_code == 201, r.text
    # La remera: talles chicos a $ 23.000, grandes a $ 31.000, y 5XL consultar.
    remera = db.scalars(select(Producto).where(Producto.slug == "remera")).one()
    chicos, grandes = remera.opciones[:2], remera.opciones[2:-1]
    remera.tramos = [
        {"talles": chicos, "precio": 23000},
        {"talles": grandes, "precio": 31000},
        {"talles": remera.opciones[-1:], "precio": None},
    ]
    db.commit()
    return f"{API}/tiendas/uniformes/grupos/{r.json()['slug']}/productos/remera"


def test_publica_un_uniforme_del_colegio(
    admin: TestClient, remera_del_colegio: str, meta: respx.MockRouter
) -> None:
    url = remera_del_colegio
    data = admin.get(url).json()
    texto = data["textos"]["facebook"]
    assert "· Colegio San Pablo\n💰 Desde $ 23.000\n" in texto
    assert ": $ 31.000\n" in texto
    assert ": consultar\n" in texto
    assert "/tiendas/uniformes/colegio-san-pablo?utm_source=facebook" in texto
    assert "#ColegioSanPablo" in texto

    img = admin.get(f"{url}/imagen.jpg")
    assert Image.open(io.BytesIO(img.content)).size == (1080, 1080)

    r = admin.post(url, json={"redes": ["facebook"]})
    assert r.status_code == 202, r.text
    (fila,) = admin.get(url).json()["publicaciones"]
    assert fila["estado"] == "publicada"
    assert fila["listing_id"] is None

    (historial,) = admin.get(API).json()
    assert historial["aviso_titulo"].endswith("· Colegio San Pablo")
    assert historial["aviso_url"] == "/tiendas/uniformes/colegio-san-pablo"

    sin_producto = url.replace("/remera", "/no-existe")
    assert admin.get(sin_producto).status_code == 404
