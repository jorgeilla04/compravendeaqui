"""Esquemas de usuario. El teléfono nunca sale en respuestas públicas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class PublicUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    display_name: str
    avatar_url: str | None
    created_at: datetime


class PublicProfileOut(PublicUserOut):
    active_listings_count: int


class MeOut(PublicUserOut):
    """Perfil propio: incluye datos de contacto (enmascarados)."""

    phone_masked: str | None
    phone_verified: bool
    email: str | None
    full_name: str | None
    role: str
    whatsapp_optin: bool
    profile_pending: bool
    has_password: bool


class UserUpdateIn(BaseModel):
    username: str | None = Field(
        default=None, min_length=3, max_length=30, pattern=r"^[a-z0-9_.]+$"
    )
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    email: EmailStr | None = None
    whatsapp_optin: bool | None = None


class PasswordSetIn(BaseModel):
    current_password: str | None = None
    new_password: str = Field(min_length=8, max_length=128)
