"""Tablas de autenticación: códigos OTP y refresh tokens."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDPrimaryKeyMixin


class OtpCode(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "otp_codes"
    __table_args__ = (Index("idx_otp_phone", "phone", "purpose"),)

    phone: Mapped[str] = mapped_column(String(20))
    # HMAC del código: nunca se guarda en claro.
    code_hash: Mapped[str] = mapped_column(String(255))
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
