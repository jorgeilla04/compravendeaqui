"""Publicaciones en redes sociales (Facebook e Instagram): de un aviso o de un
producto de una tienda en un grupo (ej.: la remera de un colegio)."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import JSON, Date, DateTime, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin
from app.models.listing import Listing


class PublicacionRed(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "publicaciones_redes"

    listing_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("listings.id", ondelete="CASCADE"), index=True
    )
    producto_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("tienda_productos.id", ondelete="CASCADE")
    )
    grupo_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("tienda_grupos.id", ondelete="CASCADE"), index=True
    )
    # Lo publicado, para el historial (el aviso o el producto pueden cambiar).
    titulo: Mapped[str | None] = mapped_column(String(200))
    url: Mapped[str | None] = mapped_column(Text)
    red: Mapped[str] = mapped_column(String(20))  # facebook | instagram
    # pendiente | publicada | error | eliminada
    estado: Mapped[str] = mapped_column(String(20), default="pendiente")
    texto: Mapped[str] = mapped_column(Text)
    imagen_url: Mapped[str | None] = mapped_column(Text)
    post_id: Mapped[str | None] = mapped_column(String(120))
    permalink: Mapped[str | None] = mapped_column(Text)
    error: Mapped[str | None] = mapped_column(Text)
    creada_por: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL")
    )
    # Si salió del calendario: la programación que la generó.
    programacion_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("programaciones_redes.id", ondelete="SET NULL"), index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    publicada_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    listing: Mapped[Listing | None] = relationship(lazy="joined")


class ProgramacionRed(UUIDPrimaryKeyMixin, Base):
    """Una publicación agendada en el calendario: un producto (aviso o prenda de
    un colegio) para un día. Hasta 3 por día; la hora sale de cuántos hay."""

    __tablename__ = "programaciones_redes"

    fecha: Mapped[date] = mapped_column(Date, index=True)
    orden: Mapped[int] = mapped_column(Integer)  # 1..3, en el día
    publicar_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    listing_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("listings.id", ondelete="CASCADE")
    )
    producto_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("tienda_productos.id", ondelete="CASCADE")
    )
    grupo_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("tienda_grupos.id", ondelete="CASCADE")
    )
    titulo: Mapped[str] = mapped_column(String(200))
    redes: Mapped[list[str]] = mapped_column(JSON)
    # programada | publicando | publicada | error | cancelada
    estado: Mapped[str] = mapped_column(String(20), default="programada", index=True)
    error: Mapped[str | None] = mapped_column(Text)
    creada_por: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
