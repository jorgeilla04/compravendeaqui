"""Publicar en Facebook e Instagram avisos y productos de tiendas (por ejemplo,
la remera de un colegio). Solo administradores del sitio."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, BackgroundTasks, HTTPException, Response, status
from sqlalchemy import select

from app.api.deps import AdminUser, DbSession
from app.config import settings
from app.models import Listing, PublicacionRed
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
            aviso_titulo=f.listing.title if f.listing else (f.titulo or ""),
            aviso_url=url_path(f.listing) if f.listing else _ruta(f.url),
        )
        for f in filas
    ]


def _ruta(url: str | None) -> str:
    """La URL guardada, relativa al sitio (para enlazar desde el panel)."""
    base = settings.public_site_url.rstrip("/")
    if url and url.startswith(base):
        return url[len(base) :] or "/"
    return url or "/"


def _publicaciones(db: DbSession, *condiciones: object) -> list[PublicacionOut]:
    filas = db.scalars(
        select(PublicacionRed)
        .where(*condiciones)  # type: ignore[arg-type]
        .order_by(PublicacionRed.created_at.desc())
    )
    return [PublicacionOut.model_validate(f) for f in filas]


def _redes_de(
    pieza: service.Pieza, publicaciones: list[PublicacionOut]
) -> AvisoRedesOut:
    return AvisoRedesOut(
        textos={red: service.texto_de(pieza, red) for red in service.REDES},
        conectadas=_estado(),
        publicaciones=publicaciones,
    )


def _jpg(data: bytes) -> Response:
    return Response(
        data, media_type="image/jpeg", headers={"Cache-Control": "no-store"}
    )


@router.get("/avisos/{listing_id}", response_model=AvisoRedesOut)
def del_aviso(listing_id: uuid.UUID, _: AdminUser, db: DbSession) -> AvisoRedesOut:
    listing = service.get_listing(db, listing_id)
    return _redes_de(
        service.pieza_de_aviso(listing),
        _publicaciones(db, PublicacionRed.listing_id == listing.id),
    )


@router.get("/avisos/{listing_id}/imagen.jpg")
def vista_previa(listing_id: uuid.UUID, _: AdminUser, db: DbSession) -> Response:
    """La imagen que se va a publicar (se arma en el momento)."""
    listing = service.get_listing(db, listing_id)
    return _jpg(service.componer_imagen(listing))


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
    listing: Listing = service.get_listing(db, listing_id)
    if listing.status != "active":
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="Solo se publican avisos activos"
        )
    filas = service.crear_publicaciones(
        db,
        service.pieza_de_aviso(listing),
        sorted(set(body.redes)),
        user,
        listing_id=listing.id,
    )
    tareas.add_task(service.publicar_en_segundo_plano, [f.id for f in filas])
    return [PublicacionOut.model_validate(f) for f in filas]


# --- Productos de tiendas (ej.: uniformes de un colegio) ------------------------

PRODUCTO = "/tiendas/{tienda}/grupos/{grupo}/productos/{producto}"


@router.get(PRODUCTO, response_model=AvisoRedesOut)
def del_producto(
    tienda: str, grupo: str, producto: str, _: AdminUser, db: DbSession
) -> AvisoRedesOut:
    t, g, pp = service.get_producto_de_grupo(db, tienda, grupo, producto)
    return _redes_de(
        service.pieza_de_producto(t, g, pp),
        _publicaciones(
            db,
            PublicacionRed.producto_id == pp.producto.id,
            PublicacionRed.grupo_id == g.id,
        ),
    )


@router.get(PRODUCTO + "/imagen.jpg")
def vista_previa_producto(
    tienda: str, grupo: str, producto: str, _: AdminUser, db: DbSession
) -> Response:
    t, g, pp = service.get_producto_de_grupo(db, tienda, grupo, producto)
    return _jpg(service.componer(service.pieza_de_producto(t, g, pp)))


@router.post(
    PRODUCTO,
    response_model=list[PublicacionOut],
    status_code=status.HTTP_202_ACCEPTED,
)
def publicar_producto(
    tienda: str,
    grupo: str,
    producto: str,
    body: PublicarIn,
    user: AdminUser,
    db: DbSession,
    tareas: BackgroundTasks,
) -> list[PublicacionOut]:
    t, g, pp = service.get_producto_de_grupo(db, tienda, grupo, producto)
    filas = service.crear_publicaciones(
        db,
        service.pieza_de_producto(t, g, pp),
        sorted(set(body.redes)),
        user,
        producto_id=pp.producto.id,
        grupo_id=g.id,
    )
    tareas.add_task(service.publicar_en_segundo_plano, [f.id for f in filas])
    return [PublicacionOut.model_validate(f) for f in filas]


@router.post("/{publicacion_id}/reintentar", response_model=PublicacionOut)
def reintentar(
    publicacion_id: uuid.UUID, _: AdminUser, db: DbSession
) -> PublicacionOut:
    fila = db.get(PublicacionRed, publicacion_id)
    if fila is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No existe")
    if fila.estado != "error":
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="Solo se reintentan las que dieron error"
        )
    if not service.configurada(fila.red):
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail=f"Falta conectar {fila.red.capitalize()}"
        )
    service.publicar(db, fila)
    db.refresh(fila)
    return PublicacionOut.model_validate(fila)


@router.delete("/{publicacion_id}", response_model=PublicacionOut)
def eliminar(publicacion_id: uuid.UUID, _: AdminUser, db: DbSession) -> PublicacionOut:
    """Borra el post de la red (Facebook) y lo deja en el historial como
    eliminado."""
    fila = db.get(PublicacionRed, publicacion_id)
    if fila is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No existe")
    service.eliminar(db, fila)
    db.refresh(fila)
    return PublicacionOut.model_validate(fila)
