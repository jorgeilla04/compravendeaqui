"""Avisos: detalle, alta, edición, baja, imágenes, vistas y contacto."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import (
    APIRouter,
    File,
    HTTPException,
    Request,
    Response,
    UploadFile,
    status,
)

from app.api.deps import CompleteUser, DbSession, OptionalUser
from app.core import ratelimit
from app.models import Listing, User
from app.schemas.listing import (
    ContactOut,
    ImageOrderIn,
    ListingCreate,
    ListingOut,
    ListingUpdate,
    OwnerListingOut,
)
from app.services import listings as listing_service

router = APIRouter(prefix="/listings", tags=["listings"])


def _editable(db: DbSession, listing_id: uuid.UUID, user: User) -> Listing:
    """Aviso propio y editable: si moderación lo suspendió, solo se puede eliminar."""
    listing = listing_service.get_owned(db, listing_id, user)
    if listing.status == "suspended" and user.role not in ("admin", "moderator"):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Este aviso está suspendido por moderación y no se puede editar",
        )
    return listing


def _visitor(request: Request, user: User | None) -> str:
    return f"u:{user.id}" if user else f"ip:{ratelimit.client_ip(request)}"


@router.post("", response_model=OwnerListingOut, status_code=status.HTTP_201_CREATED)
def create(
    body: ListingCreate, request: Request, user: CompleteUser, db: DbSession
) -> OwnerListingOut:
    ratelimit.enforce(
        f"rl:listing:create:{user.id}",
        30,
        86400,
        "Llegaste al límite de avisos por día.",
    )
    listing = listing_service.create(db, user, body)
    return listing_service.to_out(listing, owner=True)  # type: ignore[return-value]


@router.get("/{id_or_slug}", response_model=ListingOut)
def detail(id_or_slug: str, db: DbSession) -> ListingOut:
    """Detalle público. No incluye el teléfono del vendedor (ver /contact)."""
    return listing_service.to_out(listing_service.get_public(db, id_or_slug))


@router.get("/{listing_id}/manage", response_model=OwnerListingOut)
def manage(listing_id: uuid.UUID, user: CompleteUser, db: DbSession) -> OwnerListingOut:
    listing = listing_service.get_owned(db, listing_id, user)
    return listing_service.to_out(listing, owner=True)  # type: ignore[return-value]


@router.put("/{listing_id}", response_model=OwnerListingOut)
def update(
    listing_id: uuid.UUID, body: ListingUpdate, user: CompleteUser, db: DbSession
) -> OwnerListingOut:
    listing = _editable(db, listing_id, user)
    listing = listing_service.update_listing(db, listing, body)
    return listing_service.to_out(listing, owner=True)  # type: ignore[return-value]


@router.delete(
    "/{listing_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    response_model=None,
)
def delete(listing_id: uuid.UUID, user: CompleteUser, db: DbSession) -> None:
    listing_service.soft_delete(db, listing_service.get_owned(db, listing_id, user))


@router.post("/{listing_id}/images", response_model=OwnerListingOut)
async def upload_images(
    listing_id: uuid.UUID,
    user: CompleteUser,
    db: DbSession,
    files: Annotated[list[UploadFile], File(description="Fotos JPG, PNG o WEBP")],
) -> OwnerListingOut:
    listing = _editable(db, listing_id, user)
    listing = await listing_service.add_images(db, listing, files)
    return listing_service.to_out(listing, owner=True)  # type: ignore[return-value]


@router.delete("/{listing_id}/images/{image_id}", response_model=OwnerListingOut)
def delete_image(
    listing_id: uuid.UUID, image_id: uuid.UUID, user: CompleteUser, db: DbSession
) -> OwnerListingOut:
    listing = _editable(db, listing_id, user)
    listing = listing_service.delete_image(db, listing, image_id)
    return listing_service.to_out(listing, owner=True)  # type: ignore[return-value]


@router.put("/{listing_id}/images/order", response_model=OwnerListingOut)
def reorder_images(
    listing_id: uuid.UUID, body: ImageOrderIn, user: CompleteUser, db: DbSession
) -> OwnerListingOut:
    listing = _editable(db, listing_id, user)
    listing = listing_service.reorder_images(db, listing, body.image_ids)
    return listing_service.to_out(listing, owner=True)  # type: ignore[return-value]


@router.post(
    "/{listing_id}/view",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    response_model=None,
)
def view(
    listing_id: uuid.UUID, request: Request, user: OptionalUser, db: DbSession
) -> None:
    listing = listing_service.get_public(db, str(listing_id))
    listing_service.register_view(db, listing, _visitor(request, user))


@router.post("/{listing_id}/contact", response_model=ContactOut)
def contact(
    listing_id: uuid.UUID, request: Request, user: OptionalUser, db: DbSession
) -> ContactOut:
    """Registra el clic a WhatsApp y devuelve el deep link (teléfono server-side)."""
    ratelimit.enforce(
        f"rl:contact:{ratelimit.client_ip(request)}",
        60,
        3600,
        "Demasiadas consultas. Probá más tarde.",
    )
    listing = listing_service.get_public(db, str(listing_id))
    return listing_service.contact(db, listing, _visitor(request, user))
