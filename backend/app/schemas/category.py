"""Esquemas de categorías."""

from __future__ import annotations

import uuid

from pydantic import BaseModel, ConfigDict


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    parent_id: uuid.UUID | None
    name: str
    slug: str
    icon: str | None
    display_order: int


class CategoryNode(CategoryOut):
    children: list[CategoryNode] = []


class CategoryDetail(CategoryOut):
    children: list[CategoryOut]
    # Ruta desde la raíz (para breadcrumbs), incluye la categoría actual.
    path: list[CategoryOut]
