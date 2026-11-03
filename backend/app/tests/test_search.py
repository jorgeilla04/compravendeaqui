"""Búsqueda full-text en español, filtros, orden y cursor."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.models import Category
from app.tests.conftest import create_listing

MakeUser = Callable[..., tuple[TestClient, dict[str, Any]]]


def _cat(db: Any, slug: str) -> str:
    return str(db.scalars(select(Category.id).where(Category.slug == slug)).one())


def _seed(make_user: MakeUser, db: Any) -> TestClient:
    seller, _ = make_user()
    autos, heladeras = _cat(db, "autos"), _cat(db, "electrodomesticos")
    create_listing(
        seller,
        autos,
        title="Camión Mercedes Benz 1114",
        description="Motor reparado, papeles al día.",
        price="9000",
        price_currency="USD",
        department="Rawson",
    )
    create_listing(
        seller,
        autos,
        title="Toyota Corolla XEI 2018",
        price="15900",
        price_currency="USD",
        department="Capital",
    )
    create_listing(
        seller,
        heladeras,
        title="Heladera Whirlpool No Frost",
        description="Funciona perfecto, poco uso.",
        price="480000",
        price_currency="ARS",
        department="Rivadavia",
        condition="usado",
    )
    create_listing(
        seller,
        heladeras,
        title="Lavarropas Drean automático",
        description="Nuevo en caja, con garantía.",
        price="650000",
        price_currency="ARS",
        department="Capital",
        condition="nuevo",
    )
    return seller


def _titles(response: Any) -> list[str]:
    assert response.status_code == 200, response.text
    return [i["title"] for i in response.json()["items"]]


def test_full_text_ignores_accents_and_stems(
    make_user: MakeUser, db: Any, client: TestClient
) -> None:
    _seed(make_user, db)
    assert _titles(client.get("/api/v1/search", params={"q": "camion"})) == [
        "Camión Mercedes Benz 1114"
    ]
    assert _titles(client.get("/api/v1/search", params={"q": "heladeras"})) == [
        "Heladera Whirlpool No Frost"
    ]
    assert _titles(client.get("/api/v1/search", params={"q": "garantia"})) == [
        "Lavarropas Drean automático"
    ]
    assert _titles(client.get("/api/v1/search", params={"q": "inexistente"})) == []


def test_filters(make_user: MakeUser, db: Any, client: TestClient) -> None:
    _seed(make_user, db)
    assert (
        len(_titles(client.get("/api/v1/listings", params={"department": "Capital"})))
        == 2
    )
    # Filtrar la categoría padre incluye las hijas.
    assert (
        len(_titles(client.get("/api/v1/listings", params={"category": "vehiculos"})))
        == 2
    )
    assert _titles(client.get("/api/v1/listings", params={"condition": "nuevo"})) == [
        "Lavarropas Drean automático"
    ]
    assert len(_titles(client.get("/api/v1/listings", params={"currency": "USD"}))) == 2
    assert (
        client.get("/api/v1/listings", params={"department": "Mendoza"}).status_code
        == 422
    )
    assert (
        _titles(client.get("/api/v1/listings", params={"category": "no-existe"})) == []
    )


def test_price_range_compares_across_currencies(
    make_user: MakeUser, db: Any, client: TestClient
) -> None:
    _seed(make_user, db)
    # Sin moneda: rango en ARS (cotización de test 1000). US$ 9000 = $ 9.000.000.
    titles = _titles(
        client.get(
            "/api/v1/listings", params={"price_min": 500000, "price_max": 10000000}
        )
    )
    assert set(titles) == {"Lavarropas Drean automático", "Camión Mercedes Benz 1114"}
    usd_only = _titles(
        client.get("/api/v1/listings", params={"currency": "USD", "price_max": 10000})
    )
    assert usd_only == ["Camión Mercedes Benz 1114"]


def test_sort_by_normalized_price(
    make_user: MakeUser, db: Any, client: TestClient
) -> None:
    _seed(make_user, db)
    titles = _titles(client.get("/api/v1/listings", params={"sort": "price_asc"}))
    assert (
        titles[0] == "Heladera Whirlpool No Frost"
        and titles[-1] == "Toyota Corolla XEI 2018"
    )
    assert (
        _titles(client.get("/api/v1/listings", params={"sort": "price_desc"}))[0]
        == "Toyota Corolla XEI 2018"
    )


def test_cursor_pagination_has_no_gaps_or_duplicates(
    make_user: MakeUser, db: Any, client: TestClient
) -> None:
    _seed(make_user, db)
    for sort in ("newest", "price_asc", "price_desc"):
        seen: list[str] = []
        cursor = None
        while True:
            params: dict[str, Any] = {"limit": 1, "sort": sort}
            if cursor:
                params["cursor"] = cursor
            page = client.get("/api/v1/listings", params=params).json()
            seen += [i["id"] for i in page["items"]]
            cursor = page["next_cursor"]
            if not cursor:
                break
        assert len(seen) == len(set(seen)) == 4, sort


def test_relevance_cursor(make_user: MakeUser, db: Any, client: TestClient) -> None:
    seller, _ = make_user()
    autos = _cat(db, "autos")
    for i in range(3):
        create_listing(seller, autos, title=f"Toyota Hilux modelo {2015 + i}")
    first = client.get("/api/v1/search", params={"q": "toyota", "limit": 2}).json()
    second = client.get(
        "/api/v1/search",
        params={"q": "toyota", "limit": 2, "cursor": first["next_cursor"]},
    ).json()
    ids = [i["id"] for i in first["items"] + second["items"]]
    assert len(ids) == len(set(ids)) == 3 and second["next_cursor"] is None


def test_invalid_cursor(client: TestClient) -> None:
    assert (
        client.get("/api/v1/listings", params={"cursor": "basura!!"}).status_code == 400
    )


def test_suggestions(make_user: MakeUser, db: Any, client: TestClient) -> None:
    _seed(make_user, db)
    data = client.get("/api/v1/search/suggestions", params={"q": "helad"}).json()
    assert data["queries"] == [{"text": "Heladera Whirlpool No Frost"}]
    cats = client.get("/api/v1/search/suggestions", params={"q": "vehic"}).json()[
        "categories"
    ]
    assert cats[0]["slug"] == "vehiculos"
    cached = client.get("/api/v1/search/suggestions", params={"q": "helad"}).json()
    assert cached == data


def test_expired_listings_are_hidden(
    make_user: MakeUser, db: Any, client: TestClient
) -> None:
    from datetime import UTC, datetime, timedelta

    from app.models import Listing
    from app.scripts.expire_listings import expire

    seller, _ = make_user()
    listing = create_listing(seller, _cat(db, "autos"))
    row = db.get(Listing, listing["id"])
    row.expires_at = datetime.now(UTC) - timedelta(days=1)
    db.commit()
    assert _titles(client.get("/api/v1/listings")) == []
    assert expire() == 1
    db.refresh(row)
    assert row.status == "expired"
    # Republicar renueva la vigencia.
    renewed = seller.put(
        f"/api/v1/listings/{listing['id']}", json={"status": "active"}
    ).json()
    assert renewed["status"] == "active"
    assert len(_titles(client.get("/api/v1/listings"))) == 1
