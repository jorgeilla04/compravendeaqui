"""Esquemas del cotizador de transporte para empresas."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.phone import InvalidPhoneError, normalize_ar_mobile
from app.schemas.fields import Email

Monto = Decimal
EstadoTransporte = Literal["nuevo", "confirmado", "realizado", "cancelado"]


def _clean(value: str) -> str:
    return " ".join(value.split())


class LugarIn(BaseModel):
    """Un lugar elegido de las sugerencias (dentro de Argentina)."""

    nombre: str = Field(min_length=2, max_length=255)
    lat: float = Field(ge=-56, le=-21)
    lon: float = Field(ge=-74, le=-53)

    @field_validator("nombre")
    @classmethod
    def _nombre(cls, value: str) -> str:
        return _clean(value)


class LugarOut(BaseModel):
    nombre: str
    detalle: str
    lat: float
    lon: float


class ViajeIn(BaseModel):
    origen: LugarIn
    destino: LugarIn
    pasajeros: int = Field(ge=1, le=500)
    ida_vuelta: bool = False
    horas_espera: int = Field(default=0, ge=0, le=72)


class OpcionOut(BaseModel):
    unidad_id: uuid.UUID
    unidad: str
    asientos: int
    foto_url: str | None
    cantidad: int
    precio: Monto


class CotizacionOut(BaseModel):
    km: Decimal
    km_cobrados: Decimal
    iva_incluido: bool
    opciones: list[OpcionOut]


class UnidadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nombre: str
    asientos: int
    foto_url: str | None


class TransportistaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    nombre: str
    descripcion: str | None
    foto_url: str | None
    iva_incluido: bool
    whatsapp_url: str
    unidades: list[UnidadOut]


class PedidoTransporteIn(ViajeIn):
    unidad_id: uuid.UUID
    fecha: date | None = None
    nombre: str = Field(min_length=2, max_length=120)
    email: Email
    telefono: str = Field(min_length=6, max_length=30)
    empresa: str = Field(min_length=2, max_length=160)
    notas: str | None = Field(default=None, max_length=1000)

    @field_validator("nombre", "empresa")
    @classmethod
    def _texto(cls, value: str) -> str:
        return _clean(value)

    @field_validator("telefono")
    @classmethod
    def _telefono(cls, value: str) -> str:
        try:
            return normalize_ar_mobile(value)
        except InvalidPhoneError as exc:
            raise ValueError(str(exc)) from exc

    @field_validator("notas")
    @classmethod
    def _notas(cls, value: str | None) -> str | None:
        return value.strip() or None if value else None


class PedidoTransporteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    codigo: str
    estado: str
    nombre: str
    email: str
    telefono: str
    empresa: str
    origen: str
    destino: str
    km: Decimal
    ida_vuelta: bool
    fecha: date | None
    horas_espera: int
    pasajeros: int
    unidad: str
    cantidad_unidades: int
    total: Monto
    notas: str | None
    created_at: datetime


class PedidoCreadoOut(BaseModel):
    codigo: str
    total: Monto
    whatsapp_url: str


# --- Administración -----------------------------------------------------------


class UnidadAdminOut(UnidadOut):
    precio_km: Monto
    activo: bool


class TransportistaAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    nombre: str
    descripcion: str | None
    foto_url: str | None
    whatsapp: str
    email: str
    minimo: Monto
    espera_hora: Monto
    iva_incluido: bool
    tarifas_revisadas: bool
    sena_pct: int
    datos_transferencia: str | None
    activo: bool
    unidades: list[UnidadAdminOut]


class TransportistaConfigIn(BaseModel):
    nombre: str = Field(min_length=2, max_length=120)
    descripcion: str | None = Field(default=None, max_length=2000)
    whatsapp: str = Field(min_length=6, max_length=30)
    email: Email
    minimo: Monto = Field(ge=0, le=100_000_000)
    espera_hora: Monto = Field(ge=0, le=10_000_000)
    iva_incluido: bool = True
    sena_pct: int | None = Field(default=None, ge=0, le=100)
    datos_transferencia: str | None = Field(default=None, max_length=500)

    @field_validator("nombre")
    @classmethod
    def _nombre(cls, value: str) -> str:
        return _clean(value)

    @field_validator("whatsapp")
    @classmethod
    def _whatsapp(cls, value: str) -> str:
        try:
            return normalize_ar_mobile(value)
        except InvalidPhoneError as exc:
            raise ValueError(str(exc)) from exc


class UnidadIn(BaseModel):
    nombre: str = Field(min_length=2, max_length=60)
    asientos: int = Field(ge=1, le=100)
    precio_km: Monto = Field(gt=0, le=1_000_000)
    activo: bool = True

    @field_validator("nombre")
    @classmethod
    def _nombre(cls, value: str) -> str:
        return _clean(value)


class PedidoEstadoIn(BaseModel):
    estado: EstadoTransporte


class EncargadoIn(BaseModel):
    email: Email


class EncargadoOut(BaseModel):
    id: uuid.UUID
    email: str | None
    nombre: str


# --- Paquetes -----------------------------------------------------------------

EstadoReserva = Literal["pendiente_sena", "senada", "confirmada", "cancelada"]
EstadoConsulta = Literal["nueva", "respondida"]


class SalidaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nombre: str
    fecha: date | None
    precio_persona: Monto
    disponibles: int


class PaqueteResumenOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    titulo: str
    resumen: str
    foto_url: str | None
    dias: int | None
    noches: int | None
    precio_desde: Monto


class PaqueteOut(PaqueteResumenOut):
    descripcion: str | None
    incluye: list[str]
    salidas: list[SalidaOut]
    sena_pct: int
    whatsapp_url: str


class ReservaIn(BaseModel):
    salida_id: uuid.UUID
    pasajeros: int = Field(ge=1, le=20)
    nombre: str = Field(min_length=2, max_length=120)
    email: Email
    telefono: str = Field(min_length=6, max_length=30)
    dni: str | None = Field(default=None, max_length=20)
    notas: str | None = Field(default=None, max_length=1000)

    @field_validator("nombre")
    @classmethod
    def _nombre(cls, value: str) -> str:
        return _clean(value)

    @field_validator("telefono")
    @classmethod
    def _telefono(cls, value: str) -> str:
        try:
            return normalize_ar_mobile(value)
        except InvalidPhoneError as exc:
            raise ValueError(str(exc)) from exc

    @field_validator("dni", "notas")
    @classmethod
    def _opcional(cls, value: str | None) -> str | None:
        return value.strip() or None if value else None


class ReservaCreadaOut(BaseModel):
    codigo: str
    total: Monto
    sena: Monto
    sena_pct: int
    datos_transferencia: str | None
    whatsapp_url: str


class ConsultaIn(BaseModel):
    paquete: str | None = Field(default=None, max_length=120)
    nombre: str = Field(min_length=2, max_length=120)
    telefono: str = Field(min_length=6, max_length=30)
    email: Email | None = None
    mensaje: str | None = Field(default=None, max_length=1000)

    @field_validator("nombre")
    @classmethod
    def _nombre(cls, value: str) -> str:
        return _clean(value)

    @field_validator("telefono")
    @classmethod
    def _telefono(cls, value: str) -> str:
        try:
            return normalize_ar_mobile(value)
        except InvalidPhoneError as exc:
            raise ValueError(str(exc)) from exc

    @field_validator("mensaje")
    @classmethod
    def _mensaje(cls, value: str | None) -> str | None:
        return value.strip() or None if value else None


class ConsultaCreadaOut(BaseModel):
    whatsapp_url: str


class SalidaAdminOut(SalidaOut):
    cupos: int
    reservados: int
    activo: bool


class PaqueteAdminOut(PaqueteResumenOut):
    descripcion: str | None
    incluye: list[str]
    orden: int
    activo: bool
    salidas: list[SalidaAdminOut]


class PaqueteIn(BaseModel):
    titulo: str = Field(min_length=3, max_length=160)
    resumen: str = Field(min_length=3, max_length=300)
    descripcion: str | None = Field(default=None, max_length=5000)
    dias: int | None = Field(default=None, ge=1, le=60)
    noches: int | None = Field(default=None, ge=0, le=60)
    incluye: list[str] = Field(default_factory=list, max_length=20)
    precio_desde: Monto = Field(ge=0, le=100_000_000)
    orden: int = Field(default=0, ge=0, le=1000)
    activo: bool = True

    @field_validator("titulo", "resumen")
    @classmethod
    def _texto(cls, value: str) -> str:
        return _clean(value)

    @field_validator("incluye")
    @classmethod
    def _incluye(cls, value: list[str]) -> list[str]:
        return [_clean(v)[:120] for v in value if v.strip()]


class SalidaIn(BaseModel):
    nombre: str = Field(min_length=2, max_length=60)
    fecha: date | None = None
    precio_persona: Monto = Field(gt=0, le=100_000_000)
    cupos: int = Field(ge=0, le=1000)
    activo: bool = True

    @field_validator("nombre")
    @classmethod
    def _nombre(cls, value: str) -> str:
        return _clean(value)


class ReservaAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    codigo: str
    estado: str
    paquete_titulo: str
    salida_nombre: str
    pasajeros: int
    precio_persona: Monto
    total: Monto
    sena: Monto
    nombre: str
    email: str
    telefono: str
    dni: str | None
    notas: str | None
    created_at: datetime


class ReservaEstadoIn(BaseModel):
    estado: EstadoReserva


class ConsultaAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    paquete_titulo: str | None
    nombre: str
    telefono: str
    email: str | None
    mensaje: str | None
    estado: str
    created_at: datetime


class ConsultaEstadoIn(BaseModel):
    estado: EstadoConsulta
