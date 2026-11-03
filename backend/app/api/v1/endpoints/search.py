"""Búsqueda full-text, listado filtrado y autocomplete."""

from __future__ import annotations

import json
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import DbSession
from app.core.constants import DEPARTMENTS
from app.core.redis import get_redis
from app.schemas.listing import Condition, Currency, ListingPage
from app.services import listings as listing_service
from app.services import search as search_service

router = APIRouter(tags=["search"])


def run_search(
    db: DbSession,
    q: str | None,
    category: str | None,
    department: str | None,
    condition: Condition | None,
    currency: Currency | None,
    price_min: Decimal | None,
    price_max: Decimal | None,
    sort: search_service.Sort,
    cursor: str | None,
    limit: int,
) -> ListingPage:
    if department and department not in DEPARTMENTS:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Departamento inválido"
        )
    params = search_service.SearchParams(
        q=q,
        category_slug=category,
        department=department,
        condition=condition,
        currency=currency,
        price_min=price_min,
        price_max=price_max,
        sort=sort,
        cursor=cursor,
        limit=limit,
    )
    try:
        items, next_cursor = search_service.search_listings(db, params)
    except search_service.InvalidCursorError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return ListingPage(
        items=[listing_service.to_card(i) for i in items], next_cursor=next_cursor
    )


Q = Annotated[str | None, Query(max_length=120)]
Category = Annotated[str | None, Query(max_length=100)]
Department = Annotated[str | None, Query(max_length=100)]
Price = Annotated[Decimal | None, Query(ge=0)]
Limit = Annotated[int, Query(ge=1, le=48)]


@router.get("/search", response_model=ListingPage)
def search(
    db: DbSession,
    q: Q = None,
    category: Category = None,
    department: Department = None,
    condition: Condition | None = None,
    currency: Currency | None = None,
    price_min: Price = None,
    price_max: Price = None,
    sort: search_service.Sort = "relevance",
    cursor: str | None = None,
    limit: Limit = 24,
) -> ListingPage:
    """Full-text en español (sin tildes) + filtros; paginación por cursor."""
    return run_search(
        db,
        q,
        category,
        department,
        condition,
        currency,
        price_min,
        price_max,
        sort,
        cursor,
        limit,
    )


@router.get("/listings", response_model=ListingPage)
def list_listings(
    db: DbSession,
    category: Category = None,
    department: Department = None,
    condition: Condition | None = None,
    currency: Currency | None = None,
    price_min: Price = None,
    price_max: Price = None,
    sort: search_service.Sort = "newest",
    cursor: str | None = None,
    limit: Limit = 24,
) -> ListingPage:
    return run_search(
        db,
        None,
        category,
        department,
        condition,
        currency,
        price_min,
        price_max,
        sort,
        cursor,
        limit,
    )


@router.get("/search/suggestions")
def suggestions(
    db: DbSession, q: Annotated[str, Query(min_length=2, max_length=60)]
) -> dict[str, list[dict[str, str]]]:
    key = f"cache:suggest:{q.strip().lower()}"
    r = get_redis()
    cached = r.get(key)
    if cached:
        cached_result: dict[str, list[dict[str, str]]] = json.loads(cached)
        return cached_result
    result = search_service.suggestions(db, q)
    r.set(key, json.dumps(result), ex=300)
    return result


@router.get("/meta/departments", response_model=list[str])
def departments() -> list[str]:
    return list(DEPARTMENTS)
