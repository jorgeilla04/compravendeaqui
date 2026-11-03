"""Esquemas de avisos."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.constants import DEPARTMENTS
from app.schemas.category import CategoryOut
from app.schemas.user import PublicUserOut

Currency = Literal["ARS", "USD"]
Condition = Literal["nuevo", "usado", "reacondicionado"]
EditableStatus = Literal["active", "draft", "sold"]


def _check_department(value: str | None) -> str | None:
    if value is not None and value not in DEPARTMENTS:
        raise ValueError("Departamento de San Juan inválido")
    return value


class ListingBase(BaseModel):
    title: str = Field(min_length=5, max_length=120)
    description: str = Field(min_length=10, max_length=5000)
    category_id: uuid.UUID
    price: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    price_currency: Currency = "ARS"
    condition: Condition | None = None
    department: str
    location: str | None = Field(default=None, max_length=255)

    @field_validator("department")
    @classmethod
    def _department(cls, value: str) -> str:
        _check_department(value)
        return value

    @field_validator("title", "description", "location")
    @classmethod
    def _strip(cls, value: str | None) -> str | None:
        return value.strip() if isinstance(value, str) else value


class ListingCreate(ListingBase):
    status: Literal["active", "draft"] = "active"


class ListingUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=5, max_length=120)
    description: str | None = Field(default=None, min_length=10, max_length=5000)
    category_id: uuid.UUID | None = None
    price: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    price_currency: Currency | None = None
    condition: Condition | None = None
    department: str | None = None
    location: str | None = Field(default=None, max_length=255)
    status: EditableStatus | None = None

    @field_validator("department")
    @classmethod
    def _department(cls, value: str | None) -> str | None:
        return _check_department(value)


class ListingImageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    url: str
    thumb_url: str | None
    width: int | None
    height: int | None
    is_primary: bool
    display_order: int


class ListingCard(BaseModel):
    """Versión liviana para grillas y resultados de búsqueda."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    slug: str
    title: str
    price: Decimal | None
    price_currency: str
    price_usd_ref: Decimal | None
    condition: str | None
    department: str | None
    status: str
    category_slug: str
    url_path: str
    thumb_url: str | None
    created_at: datetime


class ListingOut(ListingCard):
    description: str
    location: str | None
    category: CategoryOut
    images: list[ListingImageOut]
    seller: PublicUserOut
    fx_rate_at_publish: Decimal | None
    updated_at: datetime
    expires_at: datetime | None


class OwnerListingOut(ListingOut):
    """Lo que ve el dueño: suma métricas."""

    views_count: int
    contacts_count: int


class ListingPage(BaseModel):
    items: list[ListingCard]
    next_cursor: str | None


class ImageOrderIn(BaseModel):
    image_ids: list[uuid.UUID]


class ContactOut(BaseModel):
    whatsapp_url: str
    phone_display: str
