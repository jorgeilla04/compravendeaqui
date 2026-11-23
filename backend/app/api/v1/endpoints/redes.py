"""Publicar avisos en Facebook e Instagram (solo administradores del sitio)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, BackgroundTasks, HTTPException, Response, status
from sqlalchemy import select

from app.api.deps import AdminUser, DbSession
from app.config import settings
from app.models import PublicacionRed
from app.schemas.redes import (
    AvisoRedesOut,
    PublicacionListadoOut,
    PublicacionOut,
    PublicarIn,
    RedesEstadoOut,
)
from app.services import redes as service
from app.services.listings import url_path

router = APIRouter(prefix="/admin/redes", tags=["redes"])


def _estado() -> RedesEstadoOut:
    return RedesEstadoOut(
        facebook=settings.facebook_configured,
        instagram=settings.instagram_configured,
    )


@router.get("/estado", response_model=RedesEstadoOut)
def estado(_: AdminUser) -> RedesEstadoOut:
    return _estado()


@router.get("", response_model=list[PublicacionListadoOut])
def historial(_: AdminUser, db: DbSession) -> list[PublicacionListadoOut]:
    filas = db.scalars(
        select(PublicacionRed).order_by(PublicacionRed.created_at.desc()).limit(150)
    )
    return [
        PublicacionListadoOut(
            **PublicacionOut.model_validate(f).model_dump(),
            aviso_titulo=f.listing.title,
            aviso_url=url_path(f.listing),
        )
        for f in filas
    ]


@router.get("/avisos/{listing_id}", response_model=AvisoRedesOut)
def del_aviso(listing_id: uuid.UUID, _: AdminUser, db: DbSession) -> AvisoRedesOut:
    listing = service.get_listing(db, listing_id)
    filas = db.scalars(
        select(PublicacionRed)
        .where(PublicacionRed.listing_id == listing.id)
        .order_by(PublicacionRed.created_at.desc())
    )
    return AvisoRedesOut(
        textos={red: service.texto_para(listing, red) for red in service.REDES},
        conectadas=_estado(),
        publicaciones=[PublicacionOut.model_validate(f) for f in filas],
    )


@router.get("/avisos/{listing_id}/imagen.jpg")
def vista_previa(listing_id: uuid.UUID, _: AdminUser, db: DbSession) -> Response:
    """La imagen que se va a publicar (se arma en el momento)."""
    listing = service.get_listing(db, listing_id)
    return Response(
        service.componer_imagen(listing),
        media_type="image/jpeg",
        headers={"Cache-Control": "no-store"},
    )


@router.post(
    "/avisos/{listing_id}",
    response_model=list[PublicacionOut],
    status_code=status.HTTP_202_ACCEPTED,
)
def publicar(
    listing_id: uuid.UUID,
    body: PublicarIn,
    user: AdminUser,
    db: DbSession,
    tareas: BackgroundTasks,
) -> list[PublicacionOut]:
    listing = service.get_listing(db, listing_id)
    filas = service.crear_publicaciones(db, listing, sorted(set(body.redes)), user)
    tareas.add_task(service.publicar_en_segundo_plano, [f.id for f in filas])
    return [PublicacionOut.model_validate(f) for f in filas]


@router.post("/{publicacion_id}/reintentar", response_model=PublicacionOut)
def reintentar(
    publicacion_id: uuid.UUID, _: AdminUser, db: DbSession
) -> PublicacionOut:
    fila = db.get(PublicacionRed, publicacion_id)
    if fila is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No existe")
    if fila.estado == "publicada":
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Ya está publicada")
    if not service.configurada(fila.red):
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail=f"Falta conectar {fila.red.capitalize()}"
        )
    service.publicar(db, fila)
    db.refresh(fila)
    return PublicacionOut.model_validate(fila)
