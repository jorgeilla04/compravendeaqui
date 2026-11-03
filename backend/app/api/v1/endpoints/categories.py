"""Categorías: árbol, detalle por slug y subcategorías."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, status

from app.api.deps import DbSession
from app.schemas.category import CategoryDetail, CategoryNode, CategoryOut
from app.services import categories as category_service

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryNode])
def tree(db: DbSession) -> list[CategoryNode]:
    return category_service.get_tree(db)


@router.get("/{category_id}/children", response_model=list[CategoryOut])
def children(category_id: uuid.UUID, db: DbSession) -> list[CategoryOut]:
    return [
        CategoryOut.model_validate(c)
        for c in category_service.children_of(db, category_id)
    ]


@router.get("/{slug}", response_model=CategoryDetail)
def detail(slug: str, db: DbSession) -> CategoryDetail:
    category = category_service.get_by_slug(db, slug)
    if category is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="La categoría no existe")
    return CategoryDetail(
        **CategoryOut.model_validate(category).model_dump(),
        children=[
            CategoryOut.model_validate(c)
            for c in category_service.children_of(db, category.id)
        ],
        path=category_service.path_to(db, category),
    )
