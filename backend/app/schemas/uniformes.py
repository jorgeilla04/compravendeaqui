"""Esquemas de la tienda de uniformes."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.phone import InvalidPhoneError, normalize_ar_mobile
from app.schemas.fields import Email
from app.services.uniformes import DEPARTAMENTOS_ENVIO

Categoria = Literal["parroquiales", "privados", "preuniversitarios"]
Envio = Literal["estandar", "express"]
ModalidadPago = Literal["sena", "total"]
EstadoPedido = Literal[
    "pendiente_pago",
    "pagado",
    "rechazado",
    "a_coordinar",
    "en_preparacion",
    "entregado",
    "cancelado",
]
HexColor = str


def _hex(value: str) -> str:
    if not (len(value) == 7 and value.startswith("#")):
        raise ValueError("Usá un color en formato #RRGGBB")
    int(value[1:], 16)
    return value.upper()


# --- Catálogo público ---------------------------------------------------------


class CategoriaOut(BaseModel):
    slug: str
    nombre: str


class ColegioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    nombre: str
    departamento: str
    categoria: str
    color1: str
    color2: str
    logo_url: str | None


class PrendaOut(BaseModel):
    slug: str
    nombre: str
    tipo: str
    precio: Decimal
    talles: list[str]
    foto_url: str | None


class ColegioDetalleOut(ColegioOut):
    prendas: list[PrendaOut]


class TiendaConfigOut(BaseModel):
    envio_monto: int
    express_recargo_pct: int
    sena_pct: int
    departamentos_envio: list[str]
    pagos_online: bool
    vendedora_nombre: str
    vendedora_whatsapp_url: str
    retiro_direccion: str


class CatalogoOut(BaseModel):
    categorias: list[CategoriaOut]
    colegios: list[ColegioOut]
    config: TiendaConfigOut


# --- Pedido -------------------------------------------------------------------


class ItemIn(BaseModel):
    colegio: str = Field(min_length=1, max_length=120)
    prenda: str = Field(min_length=1, max_length=40)
    talle: str = Field(min_length=1, max_length=10)
    cantidad: int = Field(ge=1, le=20)


class ClienteIn(BaseModel):
    nombre: str = Field(min_length=2, max_length=120)
    telefono: str = Field(min_length=6, max_length=30)
    email: Email | None = None
    direccion: str = Field(min_length=5, max_length=255)
    departamento: str
    notas: str | None = Field(default=None, max_length=500)

    @field_validator("nombre", "direccion")
    @classmethod
    def _strip(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if len(cleaned) < 2:
            raise ValueError("Completá este dato")
        return cleaned

    @field_validator("telefono")
    @classmethod
    def _phone(cls, value: str) -> str:
        try:
            return normalize_ar_mobile(value)
        except InvalidPhoneError as exc:
            raise ValueError(
                "Revisá el celular: con característica, por ejemplo 264 412-3456"
            ) from exc

    @field_validator("departamento")
    @classmethod
    def _departamento(cls, value: str) -> str:
        if value not in DEPARTAMENTOS_ENVIO:
            raise ValueError(
                "Por ahora enviamos al Gran San Juan: " + ", ".join(DEPARTAMENTOS_ENVIO)
            )
        return value


class PedidoIn(BaseModel):
    items: list[ItemIn] = Field(min_length=1, max_length=30)
    envio: Envio
    modalidad_pago: ModalidadPago
    cliente: ClienteIn


class PedidoItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    colegio_nombre: str
    prenda_nombre: str
    talle: str
    cantidad: int
    precio_unit: Decimal


class PedidoOut(BaseModel):
    """Lo que ve el comprador (sin dirección ni teléfono: el link es compartible)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    codigo: str
    estado: str
    envio: str
    modalidad_pago: str
    subtotal: Decimal
    recargo_express: Decimal
    envio_monto: Decimal
    total: Decimal
    pagado_ahora: Decimal
    saldo: Decimal
    items: list[PedidoItemOut]
    cliente_nombre: str
    created_at: datetime
    pagado_at: datetime | None
    whatsapp_url: str
    # Para reintentar el pago (solo mientras no esté pagado).
    pago_url: str | None


class PedidoCreadoOut(BaseModel):
    pedido: PedidoOut
    # Adónde redirigir para pagar (Mercado Pago). None: se coordina por WhatsApp.
    init_point: str | None


# --- Administración -----------------------------------------------------------


class PedidoAdminOut(PedidoOut):
    cliente_tel: str
    cliente_email: str | None
    direccion: str
    departamento: str
    notas: str | None
    mp_payment_id: str | None
    notificado_at: datetime | None
    cliente_whatsapp_url: str


class PedidoEstadoIn(BaseModel):
    estado: EstadoPedido


class ColegioIn(BaseModel):
    nombre: str = Field(min_length=3, max_length=160)
    departamento: str = Field(min_length=2, max_length=60)
    categoria: Categoria
    color1: HexColor
    color2: HexColor
    activo: bool = True

    @field_validator("color1", "color2")
    @classmethod
    def _color(cls, value: str) -> str:
        return _hex(value)


class ColegioUpdateIn(BaseModel):
    nombre: str | None = Field(default=None, min_length=3, max_length=160)
    departamento: str | None = Field(default=None, min_length=2, max_length=60)
    categoria: Categoria | None = None
    color1: HexColor | None = None
    color2: HexColor | None = None
    activo: bool | None = None

    @field_validator("color1", "color2")
    @classmethod
    def _color(cls, value: str | None) -> str | None:
        return _hex(value) if value else value


class ColegioAdminOut(ColegioOut):
    activo: bool


class PrendaAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    nombre: str
    tipo: str
    precio_base: Decimal
    talles: list[str]
    foto_url: str | None
    activo: bool


class PrendaUpdateIn(BaseModel):
    precio_base: Decimal | None = Field(default=None, ge=0, le=10_000_000)
    talles: list[str] | None = Field(default=None, min_length=1, max_length=30)
    activo: bool | None = None


class PrecioIn(BaseModel):
    """Precio de una prenda en un colegio. precio=None vuelve al precio base."""

    colegio: str
    prenda: str
    precio: Decimal | None = Field(default=None, ge=0, le=10_000_000)
    disponible: bool = True


class PrecioOut(BaseModel):
    colegio: str
    prenda: str
    precio: Decimal | None
    disponible: bool


class CatalogoAdminOut(BaseModel):
    colegios: list[ColegioAdminOut]
    prendas: list[PrendaAdminOut]
    precios: list[PrecioOut]
