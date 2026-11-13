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
