from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, field_validator


class MotivoIn(BaseModel):
    motivo: str = Field(min_length=3, max_length=500)

    @field_validator("motivo")
    @classmethod
    def _motivo(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 3:
            raise ValueError("Escribí el motivo")
        return value


class DuenoOut(BaseModel):
    id: uuid.UUID
    username: str
    display_name: str
    email: str | None
    is_active: bool


class AvisoModOut(BaseModel):
    id: uuid.UUID
    title: str
    status: str
    price: Decimal | None
    price_currency: str
    url_path: str
    thumb_url: str | None
    created_at: datetime
    moderation_reason: str | None
    dueno: DuenoOut


class UsuarioModOut(BaseModel):
    id: uuid.UUID
    username: str
    display_name: str
    email: str | None
    role: str
    is_active: bool
    suspension_reason: str | None
    avisos_activos: int
    created_at: datetime


class HistorialOut(BaseModel):
    id: int
    actor: str | None
    target_type: Literal["listing", "user"]
    target_id: uuid.UUID
    target_label: str
    action: Literal["suspend", "restore"]
    reason: str | None
    created_at: datetime
