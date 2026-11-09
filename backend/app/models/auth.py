"""Tablas de autenticación: códigos OTP y refresh tokens."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDPrimaryKeyMixin


class OtpCode(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "otp_codes"
    __table_args__ = (
        Index("idx_otp_destination", "destination", "purpose"),
        Index(
            "uq_otp_codes_link_hash",
            "link_hash",
            unique=True,
            postgresql_where=text("link_hash IS NOT NULL"),
        ),
    )

    # Teléfono (+549...) o email (en minúsculas) al que se mandó el código.
    destination: Mapped[str] = mapped_column(String(255))
    # HMAC del código: nunca se guarda en claro.
    code_hash: Mapped[str] = mapped_column(String(255))
    # HMAC del token del link "Entrar" que va en el mail (solo canal email).
    link_hash: Mapped[str | None] = mapped_column(String(255))
    purpose: Mapped[str] = mapped_column(String(20))  # 'login' | 'contact'
    channel: Mapped[str | None] = mapped_column(String(20))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    consumed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class RefreshToken(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "refresh_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(255), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
