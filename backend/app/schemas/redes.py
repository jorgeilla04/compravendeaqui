"""Esquemas de publicaciones en redes sociales."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

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
