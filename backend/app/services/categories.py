"""Árbol de categorías con cache en Redis (TTL 1h)."""

from __future__ import annotations

import json
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.redis import get_redis
from app.models import Category
from app.schemas.category import CategoryNode, CategoryOut

TREE_CACHE_KEY = "cache:categories:tree:v1"
TREE_TTL_SECONDS = 3600


def _active(db: Session) -> list[Category]:
    return list(
        db.scalars(
            select(Category)
            .where(Category.is_active.is_(True))
            .order_by(Category.display_order, Category.name)
        )
    )


def build_tree(categories: list[Category]) -> list[CategoryNode]:
    nodes = {c.id: CategoryNode.model_validate(c) for c in categories}
    roots: list[CategoryNode] = []
    for node in nodes.values():
        parent = nodes.get(node.parent_id) if node.parent_id else None
        (parent.children if parent else roots).append(node)
    return roots


def get_tree(db: Session) -> list[CategoryNode]:
    r = get_redis()
    cached = r.get(TREE_CACHE_KEY)
    if cached:
        return [CategoryNode.model_validate(n) for n in json.loads(cached)]
    tree = build_tree(_active(db))
    r.set(
        TREE_CACHE_KEY,
        json.dumps([n.model_dump(mode="json") for n in tree]),
        ex=TREE_TTL_SECONDS,
    )
    return tree


def invalidate_cache() -> None:
    get_redis().delete(TREE_CACHE_KEY)


def get_by_slug(db: Session, slug: str) -> Category | None:
    return db.scalars(
        select(Category).where(Category.slug == slug, Category.is_active.is_(True))
    ).first()


def children_of(db: Session, category_id: uuid.UUID) -> list[Category]:
    return list(
        db.scalars(
            select(Category)
            .where(Category.parent_id == category_id, Category.is_active.is_(True))
            .order_by(Category.display_order, Category.name)
        )
    )


def path_to(db: Session, category: Category) -> list[CategoryOut]:
    path = [CategoryOut.model_validate(category)]
    current = category
    while current.parent_id is not None:
        parent = db.get(Category, current.parent_id)
        if parent is None:
            break
        path.insert(0, CategoryOut.model_validate(parent))
        current = parent
    return path


def subtree_ids(db: Session, category: Category) -> list[uuid.UUID]:
    """La categoría y todas sus descendientes (filtrar 'Vehículos' incluye 'Autos')."""
    ids = [category.id]
    frontier = [category.id]
    while frontier:
        frontier = list(
            db.scalars(select(Category.id).where(Category.parent_id.in_(frontier)))
        )
        ids.extend(frontier)
    return ids
