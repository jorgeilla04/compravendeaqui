"""Transporte para empresas: cotizador por km y unidad (ej.: Blanca Paloma).

Cada transportista carga sus unidades con la tarifa por km, el mínimo por
viaje y la hora de espera; el cliente cotiza al instante y deja el pedido.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

MONEY = Numeric(12, 2)


class Transportista(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "transportistas"

    slug: Mapped[str] = mapped_column(String(60), unique=True)
    nombre: Mapped[str] = mapped_column(String(120))
    descripcion: Mapped[str | None] = mapped_column(Text)
    foto_url: Mapped[str | None] = mapped_column(Text)
    # A dónde llegan los pedidos.
    whatsapp: Mapped[str] = mapped_column(String(20))
    email: Mapped[str] = mapped_column(String(255))
    # Tarifas: el viaje nunca baja del mínimo; la espera se cobra por hora.
    minimo: Mapped[Decimal] = mapped_column(MONEY)
    espera_hora: Mapped[Decimal] = mapped_column(MONEY)
    iva_incluido: Mapped[bool] = mapped_column(Boolean, default=True)
    # False mientras las tarifas sean las de ejemplo: el panel lo avisa.
    tarifas_revisadas: Mapped[bool] = mapped_column(Boolean, default=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    unidades: Mapped[list[TransporteUnidad]] = relationship(
        back_populates="transportista",
        order_by="TransporteUnidad.asientos",
        cascade="all, delete-orphan",
    )


class TransporteUnidad(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "transporte_unidades"

    transportista_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("transportistas.id", ondelete="CASCADE"), index=True
    )
    nombre: Mapped[str] = mapped_column(String(60))  # "Minibús"
    asientos: Mapped[int] = mapped_column(Integer)
    precio_km: Mapped[Decimal] = mapped_column(MONEY)
    foto_url: Mapped[str | None] = mapped_column(Text)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    transportista: Mapped[Transportista] = relationship(back_populates="unidades")


class TransporteAdmin(Base):
    """Usuarios que administran un transportista (además de los admins)."""

    __tablename__ = "transporte_admins"
    __table_args__ = (UniqueConstraint("transportista_id", "user_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    transportista_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("transportistas.id", ondelete="CASCADE")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )


class TransportePedido(UUIDPrimaryKeyMixin, Base):
    """Pedido de traslado con el presupuesto que vio el cliente."""

    __tablename__ = "transporte_pedidos"

    codigo: Mapped[str] = mapped_column(String(12), unique=True)
    transportista_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("transportistas.id", ondelete="CASCADE"), index=True
    )
    estado: Mapped[str] = mapped_column(String(20), default="nuevo")
    # Contacto (los mismos datos que pedía el formulario).
    nombre: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255))
    telefono: Mapped[str] = mapped_column(String(30))
    empresa: Mapped[str] = mapped_column(String(160))
    # Viaje
    origen: Mapped[str] = mapped_column(String(255))
    destino: Mapped[str] = mapped_column(String(255))
    km: Mapped[Decimal] = mapped_column(Numeric(8, 1))
    ida_vuelta: Mapped[bool] = mapped_column(Boolean)
    fecha: Mapped[date | None] = mapped_column(Date)
    horas_espera: Mapped[int] = mapped_column(Integer, default=0)
    pasajeros: Mapped[int] = mapped_column(Integer)
    unidad: Mapped[str] = mapped_column(String(60))
    cantidad_unidades: Mapped[int] = mapped_column(Integer)
    total: Mapped[Decimal] = mapped_column(MONEY)
    notas: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    transportista: Mapped[Transportista] = relationship()
