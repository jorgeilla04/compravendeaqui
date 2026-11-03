"""Usuarios: el teléfono (verificado por OTP) es el identificador real."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"

    # Nullable solo tras la baja de cuenta (anonimización, Ley 25.326).
    phone: Mapped[str | None] = mapped_column(String(20), unique=True)
    phone_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    email: Mapped[str | None] = mapped_column(String(255), unique=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    username: Mapped[str] = mapped_column(String(100), unique=True)
    password_hash: Mapped[str | None] = mapped_column(String(255))
    full_name: Mapped[str | None] = mapped_column(String(255))
    avatar_url: Mapped[str | None] = mapped_column(Text)
    role: Mapped[str] = mapped_column(String(20), default="user")
    whatsapp_optin: Mapped[bool] = mapped_column(Boolean, default=True)
    # True hasta que el usuario completa el perfil tras su primer OTP.
    profile_pending: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    @property
    def display_name(self) -> str:
        return self.full_name or self.username
