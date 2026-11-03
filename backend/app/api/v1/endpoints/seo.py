"""Datos para SEO: entradas del sitemap (los genera el frontend)."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import select

from app.api.deps import DbSession
from app.models import Category, Listing
from app.services.search import visible_listing_filter

router = APIRouter(prefix="/seo", tags=["seo"])


class SitemapEntry(BaseModel):
    path: str
    updated_at: datetime | None


@router.get("/sitemap", response_model=list[SitemapEntry])
def sitemap(db: DbSession) -> list[SitemapEntry]:
    categories = db.scalars(select(Category).where(Category.is_active.is_(True)))
    entries = [SitemapEntry(path=f"/{c.slug}", updated_at=None) for c in categories]
    rows = db.execute(
        select(Category.slug, Listing.slug, Listing.updated_at)
        .join(Category, Category.id == Listing.category_id)
        .where(visible_listing_filter())
        .order_by(Listing.updated_at.desc())
        .limit(45000)
    )
    entries.extend(
        SitemapEntry(path=f"/{cat}/{slug}", updated_at=updated)
        for cat, slug, updated in rows
    )
    return entries
