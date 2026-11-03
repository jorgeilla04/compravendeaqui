"""Perfil, baja de cuenta y exportación de datos."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.models import Listing, User
from app.tests.conftest import create_listing, jpeg_bytes

MakeUser = Callable[..., tuple[TestClient, dict[str, Any]]]


def test_public_profile_and_listings(
    make_user: MakeUser, category_id: str, client: TestClient
) -> None:
    seller, data = make_user()
    create_listing(seller, category_id)
    profile = client.get(f"/api/v1/users/{data['user']['id']}").json()
    assert profile["active_listings_count"] == 1
    assert "phone" not in str(profile)
    page = client.get(f"/api/v1/users/{data['user']['id']}/listings").json()
    assert len(page["items"]) == 1


def test_update_profile_and_username_conflict(make_user: MakeUser) -> None:
    first, first_data = make_user()
    second, _ = make_user()
    updated = first.put(
        "/api/v1/users/me", json={"full_name": "Ana Gómez", "email": "Ana@Example.com"}
    )
    assert updated.status_code == 200
    assert updated.json()["email"] == "ana@example.com"
    taken = second.put(
        "/api/v1/users/me", json={"username": first_data["user"]["username"]}
    )
    assert taken.status_code == 409


def test_avatar(make_user: MakeUser) -> None:
    user, _ = make_user()
    response = user.post(
        "/api/v1/users/me/avatar",
        files={"file": ("a.jpg", jpeg_bytes((600, 600)), "image/jpeg")},
    )
    assert response.status_code == 200
    assert response.json()["avatar_url"].startswith("https://cdn.test/media/avatars/")


def test_change_password_requires_current(make_user: MakeUser) -> None:
    user, _ = make_user()
    assert (
        user.put(
            "/api/v1/users/me/password", json={"new_password": "primera-clave"}
        ).status_code
        == 204
    )
    assert (
        user.put(
            "/api/v1/users/me/password", json={"new_password": "segunda-clave"}
        ).status_code
        == 400
    )
    ok = user.put(
        "/api/v1/users/me/password",
        json={"current_password": "primera-clave", "new_password": "segunda-clave"},
    )
    assert ok.status_code == 204


def test_export_contains_personal_data(make_user: MakeUser, category_id: str) -> None:
    user, _ = make_user("2644555666")
    create_listing(user, category_id)
    export = user.get("/api/v1/users/me/export").json()
    assert export["user"]["phone"] == "+5492644555666"
    assert len(export["listings"]) == 1


def test_delete_account_anonymizes(
    make_user: MakeUser, category_id: str, db: Any, client: TestClient
) -> None:
    user, data = make_user("2644777888")
    listing = create_listing(user, category_id)
    assert user.delete("/api/v1/users/me").status_code == 204

    row = db.get(User, data["user"]["id"])
    assert row.phone is None and row.full_name is None and row.is_active is False
    assert (
        db.scalars(select(Listing.deleted_at).where(Listing.id == listing["id"])).one()
        is not None
    )
    assert client.get(f"/api/v1/listings/{listing['id']}").status_code == 404
    assert client.get(f"/api/v1/users/{data['user']['id']}").status_code == 404
    # La sesión ya no sirve.
    assert user.get("/api/v1/auth/me").status_code == 401
