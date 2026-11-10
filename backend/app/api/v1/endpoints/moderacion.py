"""Moderación del sitio (admin o moderador): avisos, usuarios e historial."""

from __future__ import annotations

import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status

from app.api.deps import CompleteUser, DbSession
from app.models import Listing, User
from app.schemas.moderation import (
    AvisoModOut,
    DuenoOut,
    HistorialOut,
    MotivoIn,
    UsuarioModOut,
)
from app.services import listings as listing_service
from app.services import moderation as service


def get_moderator(user: CompleteUser) -> User:
    if user.role not in service.ROLES_MODERACION:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, detail="Solo administradores o moderadores"
        )
    return user


Moderator = Annotated[User, Depends(get_moderator)]
router = APIRouter(prefix="/admin/moderacion", tags=["moderacion"])

EstadoAviso = Literal["active", "draft", "sold", "expired", "suspended"]


def _aviso_out(listing: Listing) -> AvisoModOut:
    card = listing_service.to_card(listing)
    dueno: User = listing.user
    return AvisoModOut(
        id=listing.id,
        title=listing.title,
        status=listing.status,
        price=listing.price,
        price_currency=listing.price_currency,
        url_path=card.url_path,
        thumb_url=card.thumb_url,
        created_at=listing.created_at,
        moderation_reason=listing.moderation_reason,
        dueno=DuenoOut(
            id=dueno.id,
            username=dueno.username,
            display_name=dueno.display_name,
            email=dueno.email,
            is_active=dueno.is_active,
        ),
    )


def _usuario_out(user: User, activos: int) -> UsuarioModOut:
    return UsuarioModOut(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        suspension_reason=user.suspension_reason,
        avisos_activos=activos,
        created_at=user.created_at,
    )


@router.get("/avisos", response_model=list[AvisoModOut])
def avisos(
    _: Moderator,
    db: DbSession,
    q: Annotated[str | None, Query(max_length=120)] = None,
    estado: EstadoAviso | None = None,
) -> list[AvisoModOut]:
    return [_aviso_out(a) for a in service.buscar_avisos(db, q, estado)]


@router.post("/avisos/{listing_id}/suspender", response_model=AvisoModOut)
def suspender_aviso(
    listing_id: uuid.UUID,
    body: MotivoIn,
    actor: Moderator,
    db: DbSession,
    tasks: BackgroundTasks,
) -> AvisoModOut:
    listing = service.suspender_aviso(db, actor, listing_id, body.motivo)
    dueno: User = listing.user
    email = dueno.email if dueno.email_verified else None
    tasks.add_task(service.avisar_suspension, email, listing.title, body.motivo)
    return _aviso_out(listing)


@router.post("/avisos/{listing_id}/restaurar", response_model=AvisoModOut)
def restaurar_aviso(
    listing_id: uuid.UUID, actor: Moderator, db: DbSession
) -> AvisoModOut:
    return _aviso_out(service.restaurar_aviso(db, actor, listing_id))


@router.get("/usuarios", response_model=list[UsuarioModOut])
def usuarios(
    _: Moderator,
    db: DbSession,
    q: Annotated[str | None, Query(max_length=120)] = None,
) -> list[UsuarioModOut]:
    found = service.buscar_usuarios(db, q)
    activos = service.avisos_activos_por_usuario(db, [u.id for u in found])
    return [_usuario_out(u, activos.get(u.id, 0)) for u in found]


@router.post("/usuarios/{user_id}/suspender", response_model=UsuarioModOut)
def suspender_usuario(
    user_id: uuid.UUID, body: MotivoIn, actor: Moderator, db: DbSession
) -> UsuarioModOut:
    user = service.suspender_usuario(db, actor, user_id, body.motivo)
    activos = service.avisos_activos_por_usuario(db, [user.id])
    return _usuario_out(user, activos.get(user.id, 0))


@router.post("/usuarios/{user_id}/reactivar", response_model=UsuarioModOut)
def reactivar_usuario(
    user_id: uuid.UUID, actor: Moderator, db: DbSession
) -> UsuarioModOut:
    user = service.reactivar_usuario(db, actor, user_id)
    activos = service.avisos_activos_por_usuario(db, [user.id])
    return _usuario_out(user, activos.get(user.id, 0))


@router.get("/historial", response_model=list[HistorialOut])
def historial(_: Moderator, db: DbSession) -> list[HistorialOut]:
    return [
        HistorialOut(
            id=e.id,
            actor=actor,
            target_type=e.target_type,
            target_id=e.target_id,
            target_label=e.target_label,
            action=e.action,
            reason=e.reason,
            created_at=e.created_at,
        )
        for e, actor in service.historial(db)
    ]
