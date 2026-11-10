"""Búsqueda full-text (PostgreSQL, español) con filtros y cursor keyset."""

from __future__ import annotations

import base64
import json
import re
from dataclasses import dataclass, field
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any, Literal

from sqlalchemy import (
    REAL,
    ColumnElement,
    Select,
    and_,
    cast,
    func,
    literal,
    literal_column,
    or_,
    select,
)
from sqlalchemy.orm import Session

from app.models import Category, Listing, User
from app.services import categories as category_service
from app.services.fx import get_usd_ars_rate

SPANISH: ColumnElement[Any] = literal_column("'spanish'::regconfig")

Sort = Literal["relevance", "newest", "price_asc", "price_desc"]
NO_PRICE_SENTINEL = Decimal("999999999999")


class InvalidCursorError(ValueError):
    pass


@dataclass
class SearchParams:
    q: str | None = None
    category_slug: str | None = None
    department: str | None = None
    condition: str | None = None
    currency: str | None = None
    price_min: Decimal | None = None
    price_max: Decimal | None = None
    sort: Sort = "newest"
    cursor: str | None = None
    limit: int = 24
    user_id: Any = None
    exclude_ids: list[Any] = field(default_factory=list)


def ts_query(q: str) -> ColumnElement[Any]:
    """Query normalizada igual que el trigger: español + sin tildes."""
    return func.websearch_to_tsquery(SPANISH, func.unaccent(q))


def visible_listing_filter() -> ColumnElement[bool]:
    now = datetime.now(UTC)
    # Los avisos de una cuenta suspendida o dada de baja no se muestran.
    dueno_activo = (
        select(User.id)
        .where(
            User.id == Listing.user_id,
            User.is_active.is_(True),
            User.deleted_at.is_(None),
        )
        .exists()
    )
    return and_(
        Listing.deleted_at.is_(None),
        Listing.status == "active",
        or_(Listing.expires_at.is_(None), Listing.expires_at > now),
        dueno_activo,
    )


def _encode_cursor(key: Any, listing_id: Any) -> str:
    raw = json.dumps({"k": str(key), "id": str(listing_id)})
    return base64.urlsafe_b64encode(raw.encode()).decode().rstrip("=")


def _decode_cursor(cursor: str) -> tuple[str, str]:
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        data = json.loads(base64.urlsafe_b64decode(padded))
        return str(data["k"]), str(data["id"])
    except (ValueError, KeyError, TypeError) as exc:
        raise InvalidCursorError("Cursor inválido") from exc


def search_listings(
    db: Session, params: SearchParams
) -> tuple[list[Listing], str | None]:
    stmt: Select[Any] = select(Listing).where(visible_listing_filter())

    query = None
    if params.q and params.q.strip():
        query = ts_query(params.q.strip())
        stmt = stmt.where(Listing.search_vector.op("@@")(query))

    if params.category_slug:
        category = category_service.get_by_slug(db, params.category_slug)
        if category is None:
            return [], None
        stmt = stmt.where(
            Listing.category_id.in_(category_service.subtree_ids(db, category))
        )
    if params.department:
        stmt = stmt.where(Listing.department == params.department)
    if params.condition:
        stmt = stmt.where(Listing.condition == params.condition)
    if params.user_id is not None:
        stmt = stmt.where(Listing.user_id == params.user_id)
    if params.exclude_ids:
        stmt = stmt.where(Listing.id.not_in(params.exclude_ids))

    stmt = _apply_price_filter(stmt, params)

    sort: Sort = params.sort
    if sort == "relevance" and query is None:
        sort = "newest"

    key_col: ColumnElement[Any]
    descending = True
    if sort == "relevance":
        assert query is not None
        key_col = func.ts_rank_cd(Listing.search_vector, query)
    elif sort in ("price_asc", "price_desc"):
        key_col = func.coalesce(Listing.price_usd_ref, NO_PRICE_SENTINEL)
        descending = sort == "price_desc"
    else:
        key_col = Listing.created_at.expression

    if params.cursor:
        key_raw, id_raw = _decode_cursor(params.cursor)
        key_value: Any
        try:
            if sort == "relevance":
                key_value = cast(literal(float(key_raw)), REAL)
            elif sort == "newest":
                key_value = datetime.fromisoformat(key_raw)
            else:
                key_value = Decimal(key_raw)
        except (ValueError, ArithmeticError) as exc:
            raise InvalidCursorError("Cursor inválido") from exc
        if descending:
            stmt = stmt.where(
                or_(
                    key_col < key_value, and_(key_col == key_value, Listing.id < id_raw)
                )
            )
        else:
            stmt = stmt.where(
                or_(
                    key_col > key_value, and_(key_col == key_value, Listing.id > id_raw)
                )
            )

    order = (
        (key_col.desc(), Listing.id.desc())
        if descending
        else (key_col.asc(), Listing.id.asc())
    )
    limit = max(1, min(params.limit, 48))
    rows = db.execute(
        stmt.add_columns(key_col.label("sort_key")).order_by(*order).limit(limit + 1)
    ).all()

    items = [row[0] for row in rows[:limit]]
    next_cursor = None
    if len(rows) > limit:
        last = rows[limit - 1]
        key = last.sort_key
        next_cursor = _encode_cursor(
            key.isoformat() if isinstance(key, datetime) else key, last[0].id
        )
    return items, next_cursor


def _apply_price_filter(stmt: Select[Any], params: SearchParams) -> Select[Any]:
    if params.currency:
        stmt = stmt.where(Listing.price_currency == params.currency)
        if params.price_min is not None:
            stmt = stmt.where(Listing.price >= params.price_min)
        if params.price_max is not None:
            stmt = stmt.where(Listing.price <= params.price_max)
        return stmt
    if params.price_min is None and params.price_max is None:
        return stmt
    # Sin moneda elegida: el rango está en ARS y se compara contra el precio
    # normalizado a USD, así un aviso en dólares también entra en el filtro.
    rate = get_usd_ars_rate()
    if rate is None:
        stmt = stmt.where(Listing.price_currency == "ARS")
        if params.price_min is not None:
            stmt = stmt.where(Listing.price >= params.price_min)
        if params.price_max is not None:
            stmt = stmt.where(Listing.price <= params.price_max)
        return stmt
    if params.price_min is not None:
        stmt = stmt.where(Listing.price_usd_ref >= params.price_min / rate)
    if params.price_max is not None:
        stmt = stmt.where(Listing.price_usd_ref <= params.price_max / rate)
    return stmt


_TOKEN_RE = re.compile(r"[\wáéíóúüñ]+", re.IGNORECASE)


def suggestions(db: Session, q: str, limit: int = 8) -> dict[str, list[dict[str, str]]]:
    """Autocomplete: títulos por prefijo (tsquery :*) y categorías por nombre."""
    tokens = _TOKEN_RE.findall(q.lower())[:5]
    if not tokens:
        return {"queries": [], "categories": []}
    prefix_query = " & ".join(f"{t}:*" for t in tokens)
    tsq = func.to_tsquery(SPANISH, func.unaccent(prefix_query))

    title_rows = db.execute(
        select(Listing.title)
        .where(visible_listing_filter(), Listing.search_vector.op("@@")(tsq))
        .order_by(
            func.ts_rank_cd(Listing.search_vector, tsq).desc(),
            Listing.created_at.desc(),
        )
        .limit(limit * 3)
    ).scalars()
    seen: set[str] = set()
    queries: list[dict[str, str]] = []
    for title in title_rows:
        normalized = title.strip().lower()
        if normalized not in seen:
            seen.add(normalized)
            queries.append({"text": title.strip()})
        if len(queries) >= limit:
            break

    cat_rows = db.scalars(
        select(Category)
        .where(
            Category.is_active.is_(True),
            func.unaccent(Category.name).ilike(
                func.unaccent(f"%{_escape_like(q.strip())}%"), escape="\\"
            ),
        )
        .order_by(Category.display_order)
        .limit(3)
    )
    cats = [{"name": c.name, "slug": c.slug} for c in cat_rows]
    return {"queries": queries, "categories": cats}


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
