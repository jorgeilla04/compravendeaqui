"""Esquemas de las tiendas virtuales."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.constants import DEPARTMENTS
from app.core.phone import InvalidPhoneError, normalize_ar_mobile
from app.schemas.fields import Email

Entrega = Literal["estandar", "express", "retiro"]
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
TipoIlustracion = Literal[
    "remera",
    "pantalon",
    "pollera",
    "corbata",
    "buzo",
    "campera",
    "bermuda",
    "jogging",
    "generico",
]
Monto = Decimal


def _hex(value: str) -> str:
    if not (len(value) == 7 and value.startswith("#")):
        raise ValueError("Usá un color en formato #RRGGBB")
    try:
        int(value[1:], 16)
    except ValueError as exc:
        raise ValueError("Usá un color en formato #RRGGBB") from exc
    return value.upper()


def _phone(value: str) -> str:
    try:
        return normalize_ar_mobile(value)
    except InvalidPhoneError as exc:
        raise ValueError(
            "Revisá el celular: con característica, por ejemplo 264 412-3456"
        ) from exc


def _clean_opciones(value: list[str]) -> list[str]:
    seen: list[str] = []
    for item in (v.strip() for v in value):
        if item and item not in seen:
            if len(item) > 40:
                raise ValueError("Cada opción puede tener hasta 40 letras")
            seen.append(item)
    return seen


def _clean(value: str) -> str:
    cleaned = " ".join(value.split())
    if len(cleaned) < 2:
        raise ValueError("Completá este dato")
    return cleaned


# --- Tienda (pública) ---------------------------------------------------------


class TiendaResumenOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    nombre: str
    descripcion: str | None


class GrupoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    nombre: str
    subtitulo: str | None
    categoria: str | None
    color1: str
    color2: str
    logo_url: str | None


class TiendaOut(TiendaResumenOut):
    """Lo que necesita el catálogo y el carrito (sin el email del dueño)."""

    grupo_label: str
    opcion_label: str
    categorias: list[str]
    vendedor_nombre: str
    whatsapp_url: str
    entregas: list[Entrega]
    modalidades: list[ModalidadPago]
    envio_monto: Monto
    envio_gratis_desde: Monto | None
    envio_demora: str
    departamentos_envio: list[str]
    express_recargo_pct: int
    express_monto: Monto
    express_demora: str
    retiro_direccion: str | None
    sena_pct: int
    pagos_online: bool
    grupos: list[GrupoOut]


class ProductoOut(BaseModel):
    slug: str
    nombre: str
    descripcion: str | None
    tipo: str
    precio: Monto
    opciones: list[str]
    foto_url: str | None


class GrupoDetalleOut(GrupoOut):
    fotos: list[str]
    productos: list[ProductoOut]


# --- Pedido -------------------------------------------------------------------


class ItemIn(BaseModel):
    grupo: str = Field(min_length=1, max_length=120)
    producto: str = Field(min_length=1, max_length=60)
    opcion: str | None = Field(default=None, max_length=40)
    cantidad: int = Field(ge=1, le=50)


class ClienteIn(BaseModel):
    nombre: str = Field(min_length=2, max_length=120)
    telefono: str = Field(min_length=6, max_length=30)
    email: Email | None = None
    direccion: str | None = Field(default=None, max_length=255)
    departamento: str | None = Field(default=None, max_length=60)
    notas: str | None = Field(default=None, max_length=500)

    @field_validator("nombre")
    @classmethod
    def _nombre(cls, value: str) -> str:
        return _clean(value)

    @field_validator("direccion")
    @classmethod
    def _direccion(cls, value: str | None) -> str | None:
        return _clean(value) if value and value.strip() else None

    @field_validator("telefono")
    @classmethod
    def _tel(cls, value: str) -> str:
        return _phone(value)


class PedidoIn(BaseModel):
    items: list[ItemIn] = Field(min_length=1, max_length=50)
    entrega: Entrega
    modalidad_pago: ModalidadPago
    cliente: ClienteIn


class PedidoItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    grupo_nombre: str
    producto_nombre: str
    opcion: str | None
    cantidad: int
    precio_unit: Monto


class PedidoOut(BaseModel):
    """Lo que ve el comprador (sin dirección ni teléfono: el link es compartible)."""

    id: uuid.UUID
    codigo: str
    tienda: TiendaResumenOut
    opcion_label: str
    estado: str
    entrega: str
    entrega_label: str
    modalidad_pago: str
    subtotal: Monto
    envio_monto: Monto
    recargo_express: Monto
    total: Monto
    pagado_ahora: Monto
    saldo: Monto
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
    direccion: str | None
    departamento: str | None
    notas: str | None
    mp_payment_id: str | None
    notificado_at: datetime | None
    cliente_whatsapp_url: str


class PedidoEstadoIn(BaseModel):
    estado: EstadoPedido


class TiendaConfigBase(BaseModel):
    nombre: str = Field(min_length=3, max_length=120)
    descripcion: str | None = Field(default=None, max_length=500)
    grupo_label: str = Field(min_length=2, max_length=40)
    opcion_label: str = Field(min_length=2, max_length=40)
    categorias: list[str] = Field(default_factory=list, max_length=20)
    productos_en_todos: bool = True
    activo: bool = True
    vendedor_nombre: str = Field(min_length=2, max_length=120)
    vendedor_email: Email
    vendedor_whatsapp: str = Field(min_length=6, max_length=30)
    envio_habilitado: bool = True
    envio_monto: Monto = Field(default=Decimal(0), ge=0, le=1_000_000)
    envio_gratis_desde: Monto | None = Field(default=None, ge=0, le=100_000_000)
    envio_demora: str = Field(default="48 hs", min_length=1, max_length=40)
    departamentos_envio: list[str] = Field(default_factory=list)
    express_habilitado: bool = False
    express_recargo_pct: int = Field(default=0, ge=0, le=200)
    express_monto: Monto = Field(default=Decimal(0), ge=0, le=1_000_000)
    express_demora: str = Field(default="24 hs", min_length=1, max_length=40)
    retiro_habilitado: bool = False
    retiro_direccion: str | None = Field(default=None, max_length=255)
    sena_habilitada: bool = True
    sena_pct: int = Field(default=10, ge=1, le=99)
    total_habilitado: bool = True

    @field_validator("vendedor_whatsapp")
    @classmethod
    def _wa(cls, value: str) -> str:
        return _phone(value)

    @field_validator("departamentos_envio")
    @classmethod
    def _deptos(cls, value: list[str]) -> list[str]:
        invalid = [d for d in value if d not in DEPARTMENTS]
        if invalid:
            raise ValueError(f"Departamentos que no existen: {', '.join(invalid)}")
        return [d for d in DEPARTMENTS if d in value]

    @field_validator("categorias")
    @classmethod
    def _categorias(cls, value: list[str]) -> list[str]:
        seen: list[str] = []
        for item in (" ".join(v.split()) for v in value):
            if item and item not in seen:
                if len(item) > 80:
                    raise ValueError("Cada categoría puede tener hasta 80 letras")
                seen.append(item)
        return seen


class TiendaIn(TiendaConfigBase):
    """Alta de una tienda (solo administradores del sitio)."""


class TiendaConfigIn(TiendaConfigBase):
    """Lo que edita el dueño desde su panel."""


class TiendaAdminOut(TiendaConfigBase):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    vendedor_email: str


class EncargadoIn(BaseModel):
    email: Email


class EncargadoOut(BaseModel):
    id: uuid.UUID
    email: str | None
    nombre: str


class GrupoIn(BaseModel):
    nombre: str = Field(min_length=2, max_length=160)
    subtitulo: str | None = Field(default=None, max_length=80)
    categoria: str | None = Field(default=None, max_length=80)
    color1: str = "#1E3A8A"
    color2: str = "#FFFFFF"
    activo: bool = True

    @field_validator("color1", "color2")
    @classmethod
    def _color(cls, value: str) -> str:
        return _hex(value)


class GrupoUpdateIn(BaseModel):
    nombre: str | None = Field(default=None, min_length=2, max_length=160)
    subtitulo: str | None = Field(default=None, max_length=80)
    categoria: str | None = Field(default=None, max_length=80)
    color1: str | None = None
    color2: str | None = None
    activo: bool | None = None

    @field_validator("color1", "color2")
    @classmethod
    def _color(cls, value: str | None) -> str | None:
        return _hex(value) if value else value


class GrupoAdminOut(GrupoOut):
    activo: bool
    fotos: list[str]


class ProductoIn(BaseModel):
    nombre: str = Field(min_length=2, max_length=120)
    descripcion: str | None = Field(default=None, max_length=1000)
    tipo: TipoIlustracion = "generico"
    precio_base: Monto = Field(ge=0, le=100_000_000)
    opciones: list[str] = Field(default_factory=list, max_length=40)
    activo: bool = True

    @field_validator("opciones")
    @classmethod
    def _opciones(cls, value: list[str]) -> list[str]:
        return _clean_opciones(value)


class ProductoUpdateIn(BaseModel):
    nombre: str | None = Field(default=None, min_length=2, max_length=120)
    descripcion: str | None = Field(default=None, max_length=1000)
    tipo: TipoIlustracion | None = None
    precio_base: Monto | None = Field(default=None, ge=0, le=100_000_000)
    opciones: list[str] | None = Field(default=None, max_length=40)
    orden: int | None = Field(default=None, ge=0, le=1000)
    activo: bool | None = None

    @field_validator("opciones")
    @classmethod
    def _opciones(cls, value: list[str] | None) -> list[str] | None:
        return _clean_opciones(value) if value is not None else None


class ProductoAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    nombre: str
    descripcion: str | None
    tipo: str
    precio_base: Monto
    opciones: list[str]
    foto_url: str | None
    orden: int
    activo: bool


class PrecioIn(BaseModel):
    """Precio de un producto en un grupo. precio=None vuelve al precio base."""

    grupo: str
    producto: str
    precio: Monto | None = Field(default=None, ge=0, le=100_000_000)
    disponible: bool = True


class PrecioOut(BaseModel):
    grupo: str
    producto: str
    precio: Monto | None
    disponible: bool
    foto_url: str | None = None


class CatalogoAdminOut(BaseModel):
    tienda: TiendaAdminOut
    grupos: list[GrupoAdminOut]
    productos: list[ProductoAdminOut]
    precios: list[PrecioOut]
