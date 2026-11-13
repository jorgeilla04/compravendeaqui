"""Transporte para empresas: cotizador por km y unidad (ej.: Blanca Paloma).

Cada transportista carga sus unidades con la tarifa por km, el mínimo por
viaje y la hora de espera; el cliente cotiza al instante y deja el pedido.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
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
    # Paquetes: % de seña para reservar y cómo transferirla (alias, CBU...).
    sena_pct: Mapped[int] = mapped_column(Integer, default=30)
    datos_transferencia: Mapped[str | None] = mapped_column(Text)
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


# --- Agencia de viajes: paquetes, salidas, reservas y consultas ---------------


class Paquete(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "paquetes"
    __table_args__ = (UniqueConstraint("transportista_id", "slug"),)

    transportista_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("transportistas.id", ondelete="CASCADE"), index=True
    )
    slug: Mapped[str] = mapped_column(String(120))
    titulo: Mapped[str] = mapped_column(String(160))
    resumen: Mapped[str] = mapped_column(String(300))
    descripcion: Mapped[str | None] = mapped_column(Text)
    dias: Mapped[int | None] = mapped_column(Integer)
    noches: Mapped[int | None] = mapped_column(Integer)
    # Lo que incluye, una línea por ítem ("Transporte", "Hotel 3 estrellas").
    incluye: Mapped[list[str]] = mapped_column(JSON, default=list)
    precio_desde: Mapped[Decimal] = mapped_column(MONEY)
    foto_url: Mapped[str | None] = mapped_column(Text)
    orden: Mapped[int] = mapped_column(Integer, default=0)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    salidas: Mapped[list[Salida]] = relationship(
        back_populates="paquete",
        order_by="(Salida.fecha, Salida.nombre)",
        cascade="all, delete-orphan",
    )
    transportista: Mapped[Transportista] = relationship()


class Salida(UUIDPrimaryKeyMixin, Base):
    """Una fecha (o mes) de salida con su precio por persona y sus cupos."""

    __tablename__ = "paquete_salidas"

    paquete_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("paquetes.id", ondelete="CASCADE"), index=True
    )
    nombre: Mapped[str] = mapped_column(String(60))  # "Enero 2027", "10/01"
    fecha: Mapped[date | None] = mapped_column(Date)
    precio_persona: Mapped[Decimal] = mapped_column(MONEY)
    cupos: Mapped[int] = mapped_column(Integer)
    # Lugares tomados por reservas no canceladas.
    reservados: Mapped[int] = mapped_column(Integer, default=0)
    activo: Mapped[bool] = mapped_column(Boolean, default=True)

    paquete: Mapped[Paquete] = relationship(back_populates="salidas")

    @property
    def disponibles(self) -> int:
        return max(0, self.cupos - self.reservados)


class Reserva(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "paquete_reservas"

    codigo: Mapped[str] = mapped_column(String(12), unique=True)
    transportista_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("transportistas.id", ondelete="CASCADE"), index=True
    )
    salida_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("paquete_salidas.id", ondelete="CASCADE"), index=True
    )
    # pendiente_sena, senada, confirmada, cancelada
    estado: Mapped[str] = mapped_column(String(20), default="pendiente_sena")
    paquete_titulo: Mapped[str] = mapped_column(String(160))
    salida_nombre: Mapped[str] = mapped_column(String(60))
    pasajeros: Mapped[int] = mapped_column(Integer)
    precio_persona: Mapped[Decimal] = mapped_column(MONEY)
    total: Mapped[Decimal] = mapped_column(MONEY)
    sena: Mapped[Decimal] = mapped_column(MONEY)
    nombre: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255))
    telefono: Mapped[str] = mapped_column(String(30))
    dni: Mapped[str | None] = mapped_column(String(20))
    notas: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    salida: Mapped[Salida] = relationship()
    transportista: Mapped[Transportista] = relationship()


class Consulta(UUIDPrimaryKeyMixin, Base):
    """Contacto que deja alguien interesado en un paquete (o en la agencia)."""

    __tablename__ = "paquete_consultas"

    transportista_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("transportistas.id", ondelete="CASCADE"), index=True
    )
    paquete_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("paquetes.id", ondelete="SET NULL")
    )
    paquete_titulo: Mapped[str | None] = mapped_column(String(160))
    nombre: Mapped[str] = mapped_column(String(120))
    telefono: Mapped[str] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(255))
    mensaje: Mapped[str | None] = mapped_column(Text)
    estado: Mapped[str] = mapped_column(String(20), default="nueva")  # respondida
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
