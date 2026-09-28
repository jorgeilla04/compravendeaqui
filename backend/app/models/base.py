"""Base declarativa de SQLAlchemy y mixins comunes.

Los modelos concretos (User, Listing, etc.) se agregan en Fase 1.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Base declarativa para todos los modelos ORM."""


class TimestampMixin:
    """Agrega created_at / updated_at gestionados por la DB."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
