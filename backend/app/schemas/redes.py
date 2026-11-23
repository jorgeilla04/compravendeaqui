"""Esquemas de publicaciones en redes sociales."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Red = Literal["facebook", "instagram"]


class RedesEstadoOut(BaseModel):
    facebook: bool
    instagram: bool


class PublicacionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    listing_id: uuid.UUID | None
    producto_id: uuid.UUID | None
    grupo_id: uuid.UUID | None
    red: str
    estado: str
    texto: str
    imagen_url: str | None
    permalink: str | None
    error: str | None
    created_at: datetime
    publicada_at: datetime | None


class PublicacionListadoOut(PublicacionOut):
    aviso_titulo: str
    aviso_url: str


class AvisoRedesOut(BaseModel):
    textos: dict[str, str]
    conectadas: RedesEstadoOut
    publicaciones: list[PublicacionOut]


class PublicarIn(BaseModel):
    redes: list[Red] = Field(min_length=1, max_length=2)


class ProgramarIn(BaseModel):
    """Un aviso (listing_id) o una prenda de un colegio (tienda, grupo,
    producto), para un día."""

    fecha: date
    redes: list[Red] = Field(min_length=1, max_length=2)
    listing_id: uuid.UUID | None = None
    tienda: str | None = Field(default=None, max_length=60)
    grupo: str | None = Field(default=None, max_length=120)
    producto: str | None = Field(default=None, max_length=60)

    @model_validator(mode="after")
    def _uno_solo(self) -> ProgramarIn:
        prenda = all((self.tienda, self.grupo, self.producto))
        if (self.listing_id is not None) == prenda:
            raise ValueError("Elegí un aviso o una prenda de un colegio")
        return self


class ProgramacionOut(BaseModel):
    id: uuid.UUID
    fecha: date
    orden: int
    publicar_at: datetime
    titulo: str
    tipo: Literal["aviso", "uniforme"]
    vista_previa: str | None
    redes: list[str]
    estado: str
    error: str | None
    publicaciones: list[PublicacionOut]


class KitRedesOut(BaseModel):
    """Para que cada tienda publique en sus propias redes: el texto listo para
    cada red y el link a su página (la imagen se baja aparte)."""

    textos: dict[str, str]
    url: str
