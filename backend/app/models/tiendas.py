"""Tiendas virtuales (uniformes, librería, ...): cada una con su dueño y su config.

Cada tienda tiene grupos (en uniformes: colegios; en una librería: rubros o
listas por colegio), productos con opciones (talles, colores...) y precio por
grupo. El dueño configura envío, express, retiro y formas de pago.
Los importes los calcula siempre el servidor.
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


class Tienda(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "tiendas"

    slug: Mapped[str] = mapped_column(String(60), unique=True)
    nombre: Mapped[str] = mapped_column(String(120))
    descripcion: Mapped[str | None] = mapped_column(Text)
    # Cómo se llaman los grupos y las opciones en esta tienda.
    grupo_label: Mapped[str] = mapped_column(String(40))  # "Colegio"
    opcion_label: Mapped[str] = mapped_column(String(40))  # "Talle"
    # Categorías de grupos, en el orden en que se muestran.
    categorias: Mapped[list[str]] = mapped_column(JSON)
    # True: cada producto se vende en todos los grupos salvo que se lo
    # desactive (uniformes). False: solo donde se lo habilita (librería).
    productos_en_todos: Mapped[bool] = mapped_column(Boolean, default=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    # Dueño/encargado: a quién le llegan los pedidos.
    vendedor_nombre: Mapped[str] = mapped_column(String(120))
    vendedor_email: Mapped[str] = mapped_column(String(255))
    vendedor_whatsapp: Mapped[str] = mapped_column(String(20))

    # Entrega a domicilio
    envio_habilitado: Mapped[bool] = mapped_column(Boolean, default=True)
    envio_monto: Mapped[Decimal] = mapped_column(MONEY)  # 0 = gratis
    envio_gratis_desde: Mapped[Decimal | None] = mapped_column(MONEY)
    envio_demora: Mapped[str] = mapped_column(String(40))  # "48 hs"
    departamentos_envio: Mapped[list[str]] = mapped_column(JSON)
    # Express: el envío más un recargo (% de los productos y/o monto fijo).
    express_habilitado: Mapped[bool] = mapped_column(Boolean, default=False)
    express_recargo_pct: Mapped[int] = mapped_column(Integer, default=0)
    express_monto: Mapped[Decimal] = mapped_column(MONEY)
    express_demora: Mapped[str] = mapped_column(String(40))  # "24 hs"
    # Retiro en el local (sin costo)
    retiro_habilitado: Mapped[bool] = mapped_column(Boolean, default=False)
    retiro_direccion: Mapped[str | None] = mapped_column(String(255))

    # Pago por adelantado: seña (% de los productos + envío) y/o total.
    sena_habilitada: Mapped[bool] = mapped_column(Boolean, default=True)
    sena_pct: Mapped[int] = mapped_column(Integer, default=10)
    total_habilitado: Mapped[bool] = mapped_column(Boolean, default=True)


class TiendaAdmin(Base):
    """Usuarios que administran una tienda (además de los admins del sitio)."""

    __tablename__ = "tienda_admins"
    __table_args__ = (UniqueConstraint("tienda_id", "user_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tienda_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tiendas.id", ondelete="CASCADE")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )


class Grupo(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Colegio (uniformes), rubro o lista (librería)..."""

    __tablename__ = "tienda_grupos"
    __table_args__ = (UniqueConstraint("tienda_id", "slug"),)

    tienda_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tiendas.id", ondelete="CASCADE"), index=True
    )
    slug: Mapped[str] = mapped_column(String(120))
    nombre: Mapped[str] = mapped_column(String(160))
    subtitulo: Mapped[str | None] = mapped_column(String(80))  # departamento
    categoria: Mapped[str | None] = mapped_column(String(80))
    color1: Mapped[str] = mapped_column(String(7))
    color2: Mapped[str] = mapped_column(String(7))
    logo_url: Mapped[str | None] = mapped_column(Text)
    # Fotos del uniforme completo (galería del grupo).
    fotos: Mapped[list[str]] = mapped_column(JSON, default=list, server_default="[]")
    activo: Mapped[bool] = mapped_column(Boolean, default=True)


class Producto(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "tienda_productos"
    __table_args__ = (UniqueConstraint("tienda_id", "slug"),)

    tienda_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tiendas.id", ondelete="CASCADE"), index=True
    )
    slug: Mapped[str] = mapped_column(String(60))
    nombre: Mapped[str] = mapped_column(String(120))
    descripcion: Mapped[str | None] = mapped_column(Text)
    # Dibujo con los colores del grupo mientras no haya foto: remera,
    # pantalon, pollera, corbata, buzo, campera, bermuda, jogging o generico.
    tipo: Mapped[str] = mapped_column(String(20))
    precio_base: Mapped[Decimal] = mapped_column(MONEY)
    # Talles, colores... ([] = sin opciones).
    opciones: Mapped[list[str]] = mapped_column(JSON)
    foto_url: Mapped[str | None] = mapped_column(Text)
    orden: Mapped[int] = mapped_column(Integer, default=0)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)


class PrecioGrupo(Base):
    """Precio y disponibilidad de un producto en un grupo."""

    __tablename__ = "tienda_precios"
    __table_args__ = (UniqueConstraint("grupo_id", "producto_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    grupo_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tienda_grupos.id", ondelete="CASCADE")
    )
    producto_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tienda_productos.id", ondelete="CASCADE")
    )
    precio: Mapped[Decimal | None] = mapped_column(MONEY)  # None = precio base
    disponible: Mapped[bool] = mapped_column(Boolean, default=True)
    # Foto del producto en este grupo (None = la foto general del producto).
    foto_url: Mapped[str | None] = mapped_column(Text)


class Pedido(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "tienda_pedidos"

    tienda_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tiendas.id"), index=True
    )
    # Código corto para hablar del pedido por WhatsApp (ej: P-7F3K2Q).
    codigo: Mapped[str] = mapped_column(String(12), unique=True)
    cliente_nombre: Mapped[str] = mapped_column(String(120))
    cliente_tel: Mapped[str] = mapped_column(String(20))
    cliente_email: Mapped[str | None] = mapped_column(String(255))
    direccion: Mapped[str | None] = mapped_column(String(255))
    departamento: Mapped[str | None] = mapped_column(String(60))
    notas: Mapped[str | None] = mapped_column(Text)
    entrega: Mapped[str] = mapped_column(String(10))  # estandar | express | retiro
    modalidad_pago: Mapped[str] = mapped_column(String(10))  # sena | total
    subtotal: Mapped[Decimal] = mapped_column(MONEY)
    envio_monto: Mapped[Decimal] = mapped_column(MONEY)
    recargo_express: Mapped[Decimal] = mapped_column(MONEY)
    total: Mapped[Decimal] = mapped_column(MONEY)
    pagado_ahora: Mapped[Decimal] = mapped_column(MONEY)
    saldo: Mapped[Decimal] = mapped_column(MONEY)
    # pendiente_pago | pagado | rechazado | a_coordinar | en_preparacion |
    # entregado | cancelado
    estado: Mapped[str] = mapped_column(String(20), index=True)
    mp_preference_id: Mapped[str | None] = mapped_column(String(80))
    mp_init_point: Mapped[str | None] = mapped_column(Text)
    mp_payment_id: Mapped[str | None] = mapped_column(String(40))
    pagado_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notificado_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    tienda: Mapped[Tienda] = relationship(lazy="joined", innerjoin=True)
    items: Mapped[list[PedidoItem]] = relationship(
        back_populates="pedido",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="PedidoItem.id",
    )


class PedidoItem(Base):
    __tablename__ = "tienda_pedido_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    pedido_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tienda_pedidos.id", ondelete="CASCADE"), index=True
    )
    grupo_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("tienda_grupos.id"))
    producto_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("tienda_productos.id")
    )
    # Copias al momento de la compra (el pedido no cambia si se edita el catálogo).
    grupo_nombre: Mapped[str] = mapped_column(String(160))
    producto_nombre: Mapped[str] = mapped_column(String(120))
    opcion: Mapped[str | None] = mapped_column(String(40))
    cantidad: Mapped[int] = mapped_column(Integer)
    precio_unit: Mapped[Decimal] = mapped_column(MONEY)

    pedido: Mapped[Pedido] = relationship(back_populates="items")
