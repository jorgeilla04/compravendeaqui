"""Esquemas de usuario. El teléfono nunca sale en respuestas públicas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.phone import InvalidPhoneError, normalize_ar_mobile
from app.schemas.fields import Email


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
    email_verified: bool
    full_name: str | None
    role: str
    whatsapp_optin: bool
    profile_pending: bool
    has_password: bool
    # Admin del sitio o encargado de alguna tienda: ve el panel de tiendas.
    gestiona_tiendas: bool = False


class UserUpdateIn(BaseModel):
    username: str | None = Field(
        default=None, min_length=3, max_length=30, pattern=r"^[a-z0-9_.]+$"
    )
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    email: Email | None = None
    # WhatsApp de contacto (queda sin verificar hasta que haya OTP por WhatsApp).
    phone: str | None = Field(default=None, min_length=6, max_length=30)
    whatsapp_optin: bool | None = None

    @field_validator("phone")
    @classmethod
    def _phone(cls, value: str | None) -> str | None:
        if value is None:
            return None
        try:
            return normalize_ar_mobile(value)
        except InvalidPhoneError as exc:
            raise ValueError(str(exc)) from exc


class PasswordSetIn(BaseModel):
    current_password: str | None = None
    new_password: str = Field(min_length=8, max_length=128)
