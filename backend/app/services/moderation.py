"""Moderación del sitio: suspender avisos y usuarios, con historial y aviso por mail."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import ColumnElement, func, or_, select
from sqlalchemy.orm import Session

from app.config import settings
from app.core.logging import get_logger
from app.models import Listing, ModerationLog, User
from app.services import mailer
from app.services.auth import revoke_all

log = get_logger(__name__)

ROLES_MODERACION = ("admin", "moderator")


def _registrar(
    db: Session,
    actor: User,
    tipo: str,
    target_id: uuid.UUID,
    etiqueta: str,
    accion: str,
    motivo: str | None,
) -> None:
    db.add(
        ModerationLog(
            actor_id=actor.id,
            target_type=tipo,
            target_id=target_id,
            target_label=etiqueta[:255],
            action=accion,
            reason=motivo,
        )
    )


def _like(q: str) -> str:
    escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


# --- Avisos -------------------------------------------------------------------


def buscar_avisos(
    db: Session, q: str | None, estado: str | None, limite: int = 50
) -> list[Listing]:
    stmt = (
        select(Listing)
        .join(User, User.id == Listing.user_id)
        .where(Listing.deleted_at.is_(None))
        .order_by(Listing.created_at.desc())
        .limit(limite)
    )
    if estado:
        stmt = stmt.where(Listing.status == estado)
    if q and q.strip():
        term = q.strip()
        filtros: list[ColumnElement[bool]] = [
            Listing.title.ilike(_like(term), escape="\\"),
            User.username.ilike(_like(term), escape="\\"),
            User.email.ilike(_like(term), escape="\\"),
            User.full_name.ilike(_like(term), escape="\\"),
        ]
        try:
            filtros.append(Listing.id == uuid.UUID(term))
        except ValueError:
            pass
        stmt = stmt.where(or_(*filtros))
    return list(db.scalars(stmt).unique())


def _aviso(db: Session, listing_id: uuid.UUID) -> Listing:
    listing = db.get(Listing, listing_id)
    if listing is None or listing.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="El aviso no existe")
    return listing


def suspender_aviso(
    db: Session, actor: User, listing_id: uuid.UUID, motivo: str
) -> Listing:
    listing = _aviso(db, listing_id)
    listing.status = "suspended"
    listing.moderation_reason = motivo
    listing.moderated_at = datetime.now(UTC)
    _registrar(db, actor, "listing", listing.id, listing.title, "suspend", motivo)
    db.commit()
    db.refresh(listing)
    return listing


def restaurar_aviso(db: Session, actor: User, listing_id: uuid.UUID) -> Listing:
    listing = _aviso(db, listing_id)
    if listing.status != "suspended":
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="El aviso no está suspendido"
        )
    listing.status = "active"
    listing.moderation_reason = None
    listing.moderated_at = datetime.now(UTC)
    _registrar(db, actor, "listing", listing.id, listing.title, "restore", None)
    db.commit()
    db.refresh(listing)
    return listing


# --- Usuarios -----------------------------------------------------------------


def buscar_usuarios(db: Session, q: str | None, limite: int = 50) -> list[User]:
    stmt = (
        select(User)
        .where(User.deleted_at.is_(None))
        .order_by(User.created_at.desc())
        .limit(limite)
    )
    if q and q.strip():
        term = q.strip()
        stmt = stmt.where(
            or_(
                User.username.ilike(_like(term), escape="\\"),
                User.email.ilike(_like(term), escape="\\"),
                User.full_name.ilike(_like(term), escape="\\"),
            )
        )
    return list(db.scalars(stmt))


def avisos_activos_por_usuario(
    db: Session, user_ids: list[uuid.UUID]
) -> dict[uuid.UUID, int]:
    if not user_ids:
        return {}
    rows = db.execute(
        select(Listing.user_id, func.count())
        .where(
            Listing.user_id.in_(user_ids),
            Listing.deleted_at.is_(None),
            Listing.status == "active",
        )
        .group_by(Listing.user_id)
    )
    return {uid: n for uid, n in rows}


def _usuario(db: Session, user_id: uuid.UUID) -> User:
    user = db.get(User, user_id)
    if user is None or user.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="El usuario no existe")
    return user


def suspender_usuario(
    db: Session, actor: User, user_id: uuid.UUID, motivo: str
) -> User:
    user = _usuario(db, user_id)
    if user.id == actor.id:
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="No podés suspender tu propia cuenta"
        )
    if user.role in ROLES_MODERACION:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="No se puede suspender a un administrador o moderador",
        )
    user.is_active = False
    user.suspension_reason = motivo
    _registrar(db, actor, "user", user.id, user.username, "suspend", motivo)
    db.commit()
    revoke_all(db, user.id)  # cierra sus sesiones abiertas
    db.refresh(user)
    return user


def reactivar_usuario(db: Session, actor: User, user_id: uuid.UUID) -> User:
    user = _usuario(db, user_id)
    if user.is_active:
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="El usuario no está suspendido"
        )
    user.is_active = True
    user.suspension_reason = None
    _registrar(db, actor, "user", user.id, user.username, "restore", None)
    db.commit()
    db.refresh(user)
    return user


def historial(db: Session, limite: int = 100) -> list[tuple[ModerationLog, str | None]]:
    rows = db.execute(
        select(ModerationLog, User.username)
        .outerjoin(User, User.id == ModerationLog.actor_id)
        .order_by(ModerationLog.created_at.desc(), ModerationLog.id.desc())
        .limit(limite)
    )
    return [(entry, username) for entry, username in rows]


# --- Aviso al dueño -----------------------------------------------------------


def avisar_suspension(email: str | None, titulo: str, motivo: str) -> None:
    """Mail al dueño del aviso (best effort: si falla, queda en el log)."""
    if not email or not settings.email_configured:
        return
    msg = mailer.new_message(email, "Tu aviso fue suspendido · CompraVendeAqui")
    msg.set_content(
        f"Hola,\n\nTu aviso «{titulo}» fue suspendido por moderación y ya no "
        f"se muestra en el sitio.\n\nMotivo: {motivo}\n\n"
        "Si creés que es un error, respondé este mail.\n\nCompraVendeAqui"
    )
    try:
        mailer.send(msg)
    except mailer.MailError as exc:
        log.warning("moderation.mail_failed", error=str(exc))
