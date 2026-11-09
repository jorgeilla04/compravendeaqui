"""Perfil de usuario, baja de cuenta y exportación de datos (Ley 25.326)."""

from __future__ import annotations

import secrets
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core import ratelimit
from app.core.logging import get_logger
from app.core.phone import mask_phone
from app.models import Listing, User
from app.schemas.user import MeOut, UserUpdateIn
from app.services import images as image_service
from app.services import storage
from app.services.auth import revoke_all

log = get_logger(__name__)


def to_me(user: User) -> MeOut:
    return MeOut(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        created_at=user.created_at,
        phone_masked=mask_phone(user.phone) if user.phone else None,
        phone_verified=user.phone_verified,
        email=user.email,
        email_verified=user.email_verified,
        full_name=user.full_name,
        role=user.role,
        whatsapp_optin=user.whatsapp_optin,
        profile_pending=user.profile_pending,
        has_password=bool(user.password_hash),
    )


def get_public(db: Session, user_id: uuid.UUID) -> User:
    user = db.get(User, user_id)
    if user is None or user.deleted_at is not None or not user.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="El usuario no existe")
    return user


def _ensure_unique(db: Session, user: User, field: str, value: str) -> None:
    column = getattr(User, field)
    taken = db.scalar(select(User.id).where(column == value, User.id != user.id))
    if taken:
        label = "nombre de usuario" if field == "username" else "email"
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail=f"Ese {label} ya está en uso"
        )


def update_profile(db: Session, user: User, data: UserUpdateIn) -> User:
    # Límite de cambios: evita usar el perfil para sondear qué datos existen.
    ratelimit.enforce(
        f"rl:profile:{user.id}",
        20,
        900,
        "Hiciste muchos cambios seguidos. Probá en unos minutos.",
    )
    changes = data.model_dump(exclude_unset=True)
    if changes.get("username"):
        _ensure_unique(db, user, "username", changes["username"])
    if changes.get("email"):
        changes["email"] = changes["email"].lower()
        if changes["email"] == user.email:
            del changes["email"]
        elif user.email_verified:
            # Es con lo que ingresa: cambiarlo sin verificar el nuevo lo dejaría
            # afuera de su cuenta.
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail=(
                    "Tu email es con el que ingresás: por ahora no se puede cambiar"
                ),
            )
        else:
            _ensure_unique(db, user, "email", changes["email"])
            user.email_verified = False
    if changes.get("phone") and changes["phone"] != user.phone:
        if user.phone_verified:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail=(
                    "Tu celular es con el que ingresás: por ahora no se puede cambiar"
                ),
            )
        # Un celular verificado por otra cuenta es de su dueño: no se usa de
        # contacto ajeno.
        taken = db.scalar(
            select(User.id).where(
                User.phone == changes["phone"],
                User.phone_verified.is_(True),
                User.deleted_at.is_(None),
                User.id != user.id,
            )
        )
        if taken:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail=(
                    "No podemos usar ese celular. Si es tuyo, escribinos al "
                    "contacto que figura en Términos y lo revisamos."
                ),
            )
        # Ingreso por email: es el WhatsApp de contacto, sin verificar.
        user.phone_verified = False
    for key, value in changes.items():
        if value is None and key in (
            "username",
            "full_name",
            "whatsapp_optin",
            "phone",
        ):
            continue
        if key == "email" and value is None and user.email_verified:
            continue
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user


async def set_avatar(db: Session, user: User, upload: UploadFile) -> User:
    raw = await upload.read(5 * 1024 * 1024 + 1)
    if len(raw) > 5 * 1024 * 1024:
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="La foto puede pesar hasta 5 MB",
        )
    try:
        processed = image_service.process_image(raw)
    except image_service.InvalidImageError as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    key = f"avatars/{user.id}/{uuid.uuid4().hex}.webp"
    try:
        user.avatar_url = storage.put_object(key, processed.thumb, "image/webp")
    except storage.StorageError as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc
    db.commit()
    db.refresh(user)
    return user


def delete_account(db: Session, user: User) -> None:
    """Supresión real: anonimiza datos personales y da de baja los avisos.

    El registro queda (anonimizado) para preservar la integridad referencial.
    """
    now = datetime.now(UTC)
    db.execute(
        update(Listing)
        .where(Listing.user_id == user.id, Listing.deleted_at.is_(None))
        .values(deleted_at=now)
    )
    revoke_all(db, user.id)
    user.phone = None
    user.email = None
    user.full_name = None
    user.password_hash = None
    user.avatar_url = None
    user.username = f"eliminado-{secrets.token_hex(6)}"
    user.whatsapp_optin = False
    user.is_active = False
    user.deleted_at = now
    db.commit()
    log.info("user.deleted", user_id=str(user.id))


def export_data(db: Session, user: User) -> dict[str, Any]:
    """Derecho de acceso (Ley 25.326 art. 14): todos los datos del titular."""
    listings = db.scalars(
        select(Listing).where(Listing.user_id == user.id).order_by(Listing.created_at)
    ).unique()
    return {
        "generated_at": datetime.now(UTC).isoformat(),
        "user": {
            "id": str(user.id),
            "phone": user.phone,
            "phone_verified": user.phone_verified,
            "email": user.email,
            "username": user.username,
            "full_name": user.full_name,
            "avatar_url": user.avatar_url,
            "whatsapp_optin": user.whatsapp_optin,
            "created_at": user.created_at.isoformat(),
            "last_login": user.last_login.isoformat() if user.last_login else None,
        },
        "listings": [
            {
                "id": str(item.id),
                "title": item.title,
                "description": item.description,
                "price": str(item.price) if item.price is not None else None,
                "price_currency": item.price_currency,
                "department": item.department,
                "status": item.status,
                "views_count": item.views_count,
                "contacts_count": item.contacts_count,
                "created_at": item.created_at.isoformat(),
                "deleted_at": item.deleted_at.isoformat() if item.deleted_at else None,
                "images": [img.url for img in item.images],
            }
            for item in listings
        ],
    }
