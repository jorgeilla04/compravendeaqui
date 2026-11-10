"""Avisos: CRUD, ownership, precio USD/ARS, imágenes, vistas y WhatsApp."""

from __future__ import annotations

import io
import json
from collections.abc import Callable
from typing import Any
from urllib.parse import unquote

from fastapi.testclient import TestClient
from PIL import Image

from app.scripts.importar_avisos import main as importar_avisos
from app.tests.conftest import create_listing, jpeg_bytes

MakeUser = Callable[..., tuple[TestClient, dict[str, Any]]]


def test_create_requires_auth(client: TestClient, category_id: str) -> None:
    response = client.post("/api/v1/listings", json={"title": "x"})
    assert response.status_code == 401


def test_create_usd_listing_normalizes_price(
    make_user: MakeUser, category_id: str
) -> None:
    seller, _ = make_user()
    listing = create_listing(seller, category_id)
    assert listing["price_currency"] == "USD"
    assert listing["price_usd_ref"] == "15900.00"
    assert listing["fx_rate_at_publish"] == "1000.0000"
    assert listing["url_path"].startswith("/autos/toyota-corolla-xei-2018-")
    assert listing["status"] == "active" and listing["expires_at"]


def test_create_ars_listing_converts_to_usd(
    make_user: MakeUser, category_id: str
) -> None:
    seller, _ = make_user()
    listing = create_listing(seller, category_id, price="480000", price_currency="ARS")
    assert listing["price_usd_ref"] == "480.00"


def test_validation_errors(make_user: MakeUser, category_id: str) -> None:
    seller, _ = make_user()
    bad_department = seller.post(
        "/api/v1/listings",
        json={
            "title": "Heladera",
            "description": "Funciona perfecto",
            "category_id": category_id,
            "department": "Mendoza",
        },
    )
    assert bad_department.status_code == 422
    bad_category = seller.post(
        "/api/v1/listings",
        json={
            "title": "Heladera No Frost",
            "description": "Funciona perfecto",
            "category_id": "00000000-0000-0000-0000-000000000000",
            "department": "Rawson",
        },
    )
    assert bad_category.status_code == 422


def test_public_detail_never_exposes_phone(
    make_user: MakeUser, category_id: str, client: TestClient
) -> None:
    seller, _ = make_user("2644999888")
    listing = create_listing(seller, category_id)
    by_slug = client.get(f"/api/v1/listings/{listing['slug']}")
    by_id = client.get(f"/api/v1/listings/{listing['id']}")
    assert by_slug.status_code == by_id.status_code == 200
    for response in (by_slug, by_id):
        assert "4999888" not in response.text
        assert "views_count" not in response.json()
    assert by_slug.json()["seller"]["display_name"] == "Vendedor Test"


def test_owner_only_update_and_delete(
    make_user: MakeUser, category_id: str, client: TestClient
) -> None:
    seller, _ = make_user()
    intruder, _ = make_user()
    listing = create_listing(seller, category_id)
    path = f"/api/v1/listings/{listing['id']}"

    assert intruder.put(path, json={"title": "Hackeado total"}).status_code == 404
    assert intruder.delete(path).status_code == 404

    updated = seller.put(
        path, json={"title": "Toyota Corolla XEI 2018 full", "price": "15000"}
    )
    assert updated.status_code == 200
    assert updated.json()["price_usd_ref"] == "15000.00"
    assert seller.put(path, json={"status": "sold"}).json()["status"] == "sold"
    assert client.get(path).status_code == 404  # vendido: ya no es público

    assert seller.delete(path).status_code == 204
    assert seller.get(f"{path}/manage").status_code == 404


def test_draft_is_not_public(
    make_user: MakeUser, category_id: str, client: TestClient
) -> None:
    seller, _ = make_user()
    listing = create_listing(seller, category_id, status="draft")
    assert client.get(f"/api/v1/listings/{listing['id']}").status_code == 404
    assert seller.get(f"/api/v1/listings/{listing['id']}/manage").status_code == 200
    published = seller.put(
        f"/api/v1/listings/{listing['id']}", json={"status": "active"}
    )
    assert published.json()["status"] == "active"
    assert client.get(f"/api/v1/listings/{listing['id']}").status_code == 200


def test_images_are_webp_resized_and_without_gps(
    make_user: MakeUser, category_id: str, fake_storage: dict[str, bytes]
) -> None:
    seller, _ = make_user()
    listing = create_listing(seller, category_id)
    files = [
        ("files", ("foto1.jpg", jpeg_bytes(with_gps=True), "image/jpeg")),
        ("files", ("foto2.jpg", jpeg_bytes((800, 600)), "image/jpeg")),
    ]
    response = seller.post(f"/api/v1/listings/{listing['id']}/images", files=files)
    assert response.status_code == 200, response.text
    images = response.json()["images"]
    assert len(images) == 2 and images[0]["is_primary"] is True
    assert images[0]["url"].startswith("https://cdn.test/media/listings/")
    assert images[0]["width"] == 1600

    full_key = images[0]["url"].removeprefix("https://cdn.test/media/")
    stored = Image.open(io.BytesIO(fake_storage[full_key]))
    assert stored.format == "WEBP"
    assert not stored.getexif()  # sin EXIF: no se filtra la ubicación del vendedor
    assert len(fake_storage[full_key]) < 100 * 1024


def test_image_rules(make_user: MakeUser, category_id: str) -> None:
    seller, _ = make_user()
    listing = create_listing(seller, category_id)
    url = f"/api/v1/listings/{listing['id']}/images"
    not_image = seller.post(
        url, files=[("files", ("x.jpg", b"no soy una imagen", "image/jpeg"))]
    )
    assert not_image.status_code == 422
    too_many = [
        ("files", (f"{i}.jpg", jpeg_bytes((50, 50)), "image/jpeg")) for i in range(11)
    ]
    assert seller.post(url, files=too_many).status_code == 422


def test_reorder_and_delete_images(
    make_user: MakeUser, category_id: str, fake_storage: dict[str, bytes]
) -> None:
    seller, _ = make_user()
    listing = create_listing(seller, category_id)
    base = f"/api/v1/listings/{listing['id']}/images"
    files = [
        ("files", (f"{i}.jpg", jpeg_bytes((100, 100)), "image/jpeg")) for i in range(3)
    ]
    images = seller.post(base, files=files).json()["images"]
    ids = [i["id"] for i in images]

    reordered = seller.put(
        f"{base}/order", json={"image_ids": list(reversed(ids))}
    ).json()["images"]
    assert reordered[0]["id"] == ids[2] and reordered[0]["is_primary"] is True
    assert seller.put(f"{base}/order", json={"image_ids": ids[:1]}).status_code == 422

    remaining = seller.delete(f"{base}/{ids[2]}").json()["images"]
    assert [i["id"] for i in remaining] == [ids[1], ids[0]]
    assert remaining[0]["is_primary"] is True
    assert len(fake_storage) == 4


def test_contact_returns_whatsapp_link_and_counts(
    make_user: MakeUser, category_id: str, client: TestClient
) -> None:
    seller, _ = make_user("2644123456")
    listing = create_listing(seller, category_id)
    contact = client.post(f"/api/v1/listings/{listing['id']}/contact")
    assert contact.status_code == 200
    data = contact.json()
    assert data["whatsapp_url"].startswith("https://wa.me/5492644123456?text=")
    message = unquote(data["whatsapp_url"].split("text=")[1])
    assert "Toyota Corolla XEI 2018" in message
    assert f"https://compravendeaqui.test{listing['url_path']}" in message

    client.post(f"/api/v1/listings/{listing['id']}/contact")  # mismo visitante
    other = TestClient(
        client.app, headers={"Origin": "http://localhost:3000", "X-Real-IP": "10.0.0.9"}
    )
    other.post(f"/api/v1/listings/{listing['id']}/contact")
    owner_view = seller.get(f"/api/v1/listings/{listing['id']}/manage").json()
    assert owner_view["contacts_count"] == 2


def test_contact_respects_whatsapp_optout(
    make_user: MakeUser, category_id: str, client: TestClient
) -> None:
    seller, _ = make_user()
    listing = create_listing(seller, category_id)
    seller.put("/api/v1/users/me", json={"whatsapp_optin": False})
    assert client.post(f"/api/v1/listings/{listing['id']}/contact").status_code == 409


def test_views_are_deduplicated(
    make_user: MakeUser, category_id: str, client: TestClient
) -> None:
    seller, _ = make_user()
    listing = create_listing(seller, category_id)
    for _ in range(3):
        assert client.post(f"/api/v1/listings/{listing['id']}/view").status_code == 204
    assert (
        seller.get(f"/api/v1/listings/{listing['id']}/manage").json()["views_count"]
        == 1
    )


def test_my_listings_include_all_states(make_user: MakeUser, category_id: str) -> None:
    seller, _ = make_user()
    create_listing(seller, category_id)
    create_listing(seller, category_id, title="Ford Ka 2015 nafta", status="draft")
    mine = seller.get("/api/v1/users/me/listings").json()
    assert {item["status"] for item in mine} == {"active", "draft"}
    assert all("contacts_count" in item for item in mine)


def test_owner_cannot_reactivate_suspended_listing(
    make_user: MakeUser, category_id: str, db: Any
) -> None:
    from app.models import Listing

    seller, _ = make_user()
    listing = create_listing(seller, category_id)
    row = db.get(Listing, listing["id"])
    row.status = "suspended"
    db.commit()
    path = f"/api/v1/listings/{listing['id']}"
    assert seller.put(path, json={"status": "active"}).status_code == 409
    assert seller.put(path, json={"title": "Otro título largo"}).status_code == 409
    assert seller.delete(path).status_code == 204


def test_pending_profile_cannot_publish(
    client: TestClient, otp_sender: Any, category_id: str
) -> None:
    client.post("/api/v1/auth/otp/request", json={"phone": "2644321987"})
    client.post(
        "/api/v1/auth/otp/verify",
        json={"phone": "2644321987", "code": otp_sender.last_code()},
    )
    response = client.post(
        "/api/v1/listings",
        json={
            "title": "Moto 110cc",
            "description": "Anda perfecto, papeles al día.",
            "category_id": category_id,
            "department": "Capital",
        },
    )
    assert response.status_code == 403
    assert (
        client.put("/api/v1/users/me", json={"full_name": "Sin términos"}).status_code
        == 403
    )
    # Los derechos sobre los datos siguen disponibles.
    assert client.get("/api/v1/users/me/export").status_code == 200


def test_suspended_listing_photos_are_locked(
    make_user: MakeUser, category_id: str, db: Any
) -> None:
    from app.models import Listing

    seller, _ = make_user()
    listing = create_listing(seller, category_id)
    base = f"/api/v1/listings/{listing['id']}/images"
    image_id = seller.post(
        base, files=[("files", ("a.jpg", jpeg_bytes((80, 80)), "image/jpeg"))]
    ).json()["images"][0]["id"]
    row = db.get(Listing, listing["id"])
    row.status = "suspended"
    db.commit()
    assert (
        seller.post(
            base, files=[("files", ("b.jpg", jpeg_bytes((80, 80)), "image/jpeg"))]
        ).status_code
        == 409
    )
    assert (
        seller.put(f"{base}/order", json={"image_ids": [image_id]}).status_code == 409
    )
    assert seller.delete(f"{base}/{image_id}").status_code == 409


def test_script_importar_avisos(
    make_user: MakeUser, fake_storage: dict[str, bytes], tmp_path: Any
) -> None:
    client, me = make_user()
    usuario = me["user"]["username"]
    (tmp_path / "fotos").mkdir()
    (tmp_path / "fotos" / "a.jpg").write_bytes(jpeg_bytes((600, 400)))
    aviso = {
        "titulo": "Heladera con freezer Kanji Serie 140",
        "descripcion": "Capacidad neta 138 L. Modelo KJH-HD140.",
        "categoria": "electrodomesticos",
        "precio": 549999,
        "departamento": "Capital",
        "fotos": ["fotos/a.jpg"],
    }
    archivo = tmp_path / "lista.json"
    archivo.write_text(json.dumps({"usuario": usuario, "avisos": [aviso]}))

    assert importar_avisos([str(archivo), "--dry-run"]) == (
        "1 avisos válidos (sin publicar)"
    )
    assert client.get("/api/v1/users/me/listings").json() == []
    assert importar_avisos([str(archivo)]) == "1 avisos nuevos y 0 actualizados de 1"

    archivo.write_text(
        json.dumps({"usuario": usuario, "avisos": [{**aviso, "precio": 599999}]})
    )
    assert importar_avisos([str(archivo)]) == "0 avisos nuevos y 1 actualizados de 1"
    mios = client.get("/api/v1/users/me/listings").json()
    assert len(mios) == 1
    detalle = client.get(f"/api/v1/listings/{mios[0]['id']}").json()
    assert float(detalle["price"]) == 599999
    assert detalle["condition"] == "nuevo"
    assert detalle["category"]["slug"] == "electrodomesticos"
    assert len(detalle["images"]) == 1
    assert len(fake_storage) == 2
