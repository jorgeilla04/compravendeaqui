"""Tienda de uniformes escolares: catálogo (colegios, prendas, precios) y pedidos.

Tablas con prefijo `uniformes_`: es un módulo aparte de los clasificados.
Los importes se guardan en pesos con 2 decimales y siempre los calcula el
servidor (nunca se confía en montos que manda el navegador).
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
    Boolean,
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


class Colegio(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "uniformes_colegios"

    slug: Mapped[str] = mapped_column(String(120), unique=True)
    nombre: Mapped[str] = mapped_column(String(160))
    departamento: Mapped[str] = mapped_column(String(60))
    # parroquiales | privados | preuniversitarios
    categoria: Mapped[str] = mapped_column(String(30), index=True)
    # Colores característicos (#RRGGBB) para fichas e ilustraciones.
    color1: Mapped[str] = mapped_column(String(7))
    color2: Mapped[str] = mapped_column(String(7))
    # Escudo oficial, cargado con autorización del colegio.
    logo_url: Mapped[str | None] = mapped_column(Text)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)


class Prenda(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "uniformes_prendas"

    slug: Mapped[str] = mapped_column(String(40), unique=True)
    nombre: Mapped[str] = mapped_column(String(80))
    # Forma de la ilustración: remera | pantalon | pollera | corbata | buzo |
    # campera | bermuda | jogging
    tipo: Mapped[str] = mapped_column(String(20))
    precio_base: Mapped[Decimal] = mapped_column(MONEY)
    talles: Mapped[list[str]] = mapped_column(JSON)
    foto_url: Mapped[str | None] = mapped_column(Text)
    orden: Mapped[int] = mapped_column(Integer, default=0)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)


class PrecioUniforme(Base):
    """Precio (o baja) de una prenda en un colegio; sin fila rige el precio base."""

    __tablename__ = "uniformes_precios"
    __table_args__ = (UniqueConstraint("colegio_id", "prenda_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    colegio_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("uniformes_colegios.id", ondelete="CASCADE")
    )
    prenda_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("uniformes_prendas.id", ondelete="CASCADE")
    )
    precio: Mapped[Decimal | None] = mapped_column(MONEY)
    # False: ese colegio no usa esa prenda.
    disponible: Mapped[bool] = mapped_column(Boolean, default=True)


class Pedido(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "uniformes_pedidos"

    # Código corto para hablar del pedido por WhatsApp (ej: U-7F3K2Q).
    codigo: Mapped[str] = mapped_column(String(12), unique=True)
    cliente_nombre: Mapped[str] = mapped_column(String(120))
    cliente_tel: Mapped[str] = mapped_column(String(20))
    cliente_email: Mapped[str | None] = mapped_column(String(255))
    direccion: Mapped[str] = mapped_column(String(255))
    departamento: Mapped[str] = mapped_column(String(60))
    notas: Mapped[str | None] = mapped_column(Text)
    envio: Mapped[str] = mapped_column(String(10))  # estandar | express
    modalidad_pago: Mapped[str] = mapped_column(String(10))  # sena | total
    subtotal: Mapped[Decimal] = mapped_column(MONEY)
    recargo_express: Mapped[Decimal] = mapped_column(MONEY)
    envio_monto: Mapped[Decimal] = mapped_column(MONEY)
    total: Mapped[Decimal] = mapped_column(MONEY)
    pagado_ahora: Mapped[Decimal] = mapped_column(MONEY)
    saldo: Mapped[Decimal] = mapped_column(MONEY)
    # pendiente_pago | pagado | rechazado | a_coordinar | en_preparacion |
    # entregado | cancelado
    estado: Mapped[str] = mapped_column(String(20), index=True)
    mp_preference_id: Mapped[str | None] = mapped_column(String(80))
    # Link de pago de la preferencia: permite reintentar si el pago no salió.
    mp_init_point: Mapped[str | None] = mapped_column(Text)
    mp_payment_id: Mapped[str | None] = mapped_column(String(40))
    pagado_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notificado_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    items: Mapped[list[PedidoItem]] = relationship(
        back_populates="pedido",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="PedidoItem.id",
    )


class PedidoItem(Base):
    __tablename__ = "uniformes_pedido_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    pedido_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("uniformes_pedidos.id", ondelete="CASCADE"), index=True
    )
    colegio_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("uniformes_colegios.id")
    )
    prenda_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("uniformes_prendas.id")
    )
    # Copias al momento de la compra: el pedido no cambia si después se edita
    # el catálogo.
    colegio_nombre: Mapped[str] = mapped_column(String(160))
    prenda_nombre: Mapped[str] = mapped_column(String(80))
    talle: Mapped[str] = mapped_column(String(10))
    cantidad: Mapped[int] = mapped_column(Integer)
    precio_unit: Mapped[Decimal] = mapped_column(MONEY)

    pedido: Mapped[Pedido] = relationship(back_populates="items")
