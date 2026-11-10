"""Avisos: CRUD, imágenes, métricas y contacto por WhatsApp."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from urllib.parse import quote

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.config import settings
from app.core.logging import get_logger
from app.core.phone import wa_digits
from app.core.redis import get_redis
from app.core.slug import unique_listing_slug
from app.models import Category, Listing, ListingImage, User
from app.schemas.category import CategoryOut
from app.schemas.listing import (
    ContactOut,
    ListingCard,
    ListingCreate,
    ListingImageOut,
    ListingOut,
    ListingUpdate,
    OwnerListingOut,
)
from app.schemas.user import PublicUserOut
from app.services import images as image_service
from app.services import storage
from app.services.fx import get_usd_ars_rate, to_usd
from app.services.search import visible_listing_filter

log = get_logger(__name__)

NOT_FOUND = "El aviso no existe o ya no está disponible"


# --- Serialización -----------------------------------------------------------


def url_path(listing: Listing) -> str:
    return f"/{listing.category.slug}/{listing.slug}"


def public_url(listing: Listing) -> str:
    return settings.public_site_url.rstrip("/") + url_path(listing)


def _primary_image(listing: Listing) -> ListingImage | None:
    if not listing.images:
        return None
    return next((i for i in listing.images if i.is_primary), listing.images[0])


def to_card(listing: Listing) -> ListingCard:
    primary = _primary_image(listing)
    return ListingCard(
        id=listing.id,
        slug=listing.slug,
        title=listing.title,
        price=listing.price,
        price_currency=listing.price_currency,
        price_usd_ref=listing.price_usd_ref,
        condition=listing.condition,
        department=listing.department,
        status=listing.status,
        category_slug=listing.category.slug,
        url_path=url_path(listing),
        thumb_url=(primary.thumb_url or primary.url) if primary else None,
        created_at=listing.created_at,
    )


def to_out(listing: Listing, owner: bool = False) -> ListingOut | OwnerListingOut:
    card = to_card(listing).model_dump()
    data = {
        **card,
        "description": listing.description,
        "location": listing.location,
        "category": CategoryOut.model_validate(listing.category),
        "images": [ListingImageOut.model_validate(i) for i in listing.images],
        "seller": PublicUserOut.model_validate(listing.user),
        "fx_rate_at_publish": listing.fx_rate_at_publish,
        "updated_at": listing.updated_at,
        "expires_at": listing.expires_at,
    }
    if owner:
        return OwnerListingOut(
            **data,
            views_count=listing.views_count,
            contacts_count=listing.contacts_count,
            moderation_reason=listing.moderation_reason,
        )
    return ListingOut(**data)


# --- Lectura -----------------------------------------------------------------


def get_public(db: Session, id_or_slug: str) -> Listing:
    stmt = select(Listing).where(visible_listing_filter())
    try:
        stmt = stmt.where(Listing.id == uuid.UUID(id_or_slug))
    except ValueError:
        stmt = stmt.where(Listing.slug == id_or_slug)
    listing = db.scalars(stmt).unique().first()
    if listing is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=NOT_FOUND)
    return listing


def get_owned(db: Session, listing_id: uuid.UUID, user: User) -> Listing:
    listing = db.get(Listing, listing_id)
    if listing is None or listing.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=NOT_FOUND)
    if listing.user_id != user.id and user.role not in ("admin", "moderator"):
        # 404 y no 403: no confirmamos la existencia de avisos ajenos.
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=NOT_FOUND)
    return listing


def list_for_owner(db: Session, user: User) -> list[Listing]:
    return list(
        db.scalars(
            select(Listing)
            .where(Listing.user_id == user.id, Listing.deleted_at.is_(None))
            .order_by(Listing.created_at.desc())
        ).unique()
    )


# --- Escritura ---------------------------------------------------------------


def _check_category(db: Session, category_id: uuid.UUID) -> Category:
    category = db.get(Category, category_id)
    if category is None or not category.is_active:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Categoría inválida"
        )
    return category


def _apply_price(listing: Listing) -> None:
    rate = get_usd_ars_rate()
    listing.fx_rate_at_publish = rate
    listing.price_usd_ref = to_usd(listing.price, listing.price_currency, rate)


def create(db: Session, user: User, data: ListingCreate) -> Listing:
    _check_category(db, data.category_id)
    listing = Listing(
        user_id=user.id,
        category_id=data.category_id,
        title=data.title,
        slug=unique_listing_slug(data.title),
        description=data.description,
        price=data.price,
        price_currency=data.price_currency,
        condition=data.condition,
        department=data.department,
        location=data.location,
        status=data.status,
        views_count=0,
        contacts_count=0,
        is_featured=False,
        expires_at=datetime.now(UTC) + timedelta(days=settings.listing_ttl_days),
    )
    _apply_price(listing)
    db.add(listing)
    db.commit()
    db.refresh(listing)
    log.info("listing.created", listing_id=str(listing.id), user_id=str(user.id))
    return listing


def update_listing(db: Session, listing: Listing, data: ListingUpdate) -> Listing:
    changes = data.model_dump(exclude_unset=True)
    if "category_id" in changes and changes["category_id"] is not None:
        _check_category(db, changes["category_id"])
    for key, value in changes.items():
        if value is None and key in (
            "title",
            "description",
            "category_id",
            "department",
            "price_currency",
            "status",
        ):
            continue
        setattr(listing, key, value)
    if {"price", "price_currency"} & changes.keys():
        _apply_price(listing)
    if (
        changes.get("status") == "active"
        and listing.expires_at
        and listing.expires_at <= datetime.now(UTC)
    ):
        # Republicar un aviso vencido renueva la vigencia.
        listing.expires_at = datetime.now(UTC) + timedelta(
            days=settings.listing_ttl_days
        )
    db.commit()
    db.refresh(listing)
    return listing


def soft_delete(db: Session, listing: Listing) -> None:
    listing.deleted_at = datetime.now(UTC)
    db.commit()


# --- Imágenes ----------------------------------------------------------------


def store_image(listing: Listing, raw: bytes, order: int) -> ListingImage:
    """Procesa una foto, la sube al storage y devuelve la fila (sin guardar)."""
    try:
        processed = image_service.process_image(raw)
    except image_service.InvalidImageError as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc

    base = f"listings/{listing.id}/{uuid.uuid4().hex}"
    try:
        full_url = storage.put_object(f"{base}.webp", processed.full, "image/webp")
        thumb_url = storage.put_object(
            f"{base}_thumb.webp", processed.thumb, "image/webp"
        )
    except storage.StorageError as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc
    return ListingImage(
        url=full_url,
        thumb_url=thumb_url,
        storage_key=base,
        width=processed.width,
        height=processed.height,
        size_bytes=len(processed.full),
        display_order=order,
        is_primary=order == 0,
    )


async def add_images(db: Session, listing: Listing, files: list[UploadFile]) -> Listing:
    current = len(listing.images)
    if current + len(files) > settings.image_max_per_listing:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Máximo {settings.image_max_per_listing} fotos por aviso",
        )
    max_bytes = settings.image_max_upload_mb * 1024 * 1024
    for index, upload in enumerate(files):
        raw = await upload.read(max_bytes + 1)
        if len(raw) > max_bytes:
            raise HTTPException(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Cada foto puede pesar hasta {settings.image_max_upload_mb} MB",
            )
        listing.images.append(store_image(listing, raw, current + index))
    db.commit()
    db.refresh(listing)
    return listing


def delete_image(db: Session, listing: Listing, image_id: uuid.UUID) -> Listing:
    image = next((i for i in listing.images if i.id == image_id), None)
    if image is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="La foto no existe")
    listing.images.remove(image)
    if image.storage_key:
        storage.delete_objects(
            [f"{image.storage_key}.webp", f"{image.storage_key}_thumb.webp"]
        )
    _renumber(listing.images)
    db.commit()
    db.refresh(listing)
    return listing


def reorder_images(
    db: Session, listing: Listing, image_ids: list[uuid.UUID]
) -> Listing:
    by_id = {i.id: i for i in listing.images}
    if set(image_ids) != set(by_id):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El orden debe incluir todas las fotos del aviso",
        )
    _renumber([by_id[i] for i in image_ids])
    db.commit()
    db.refresh(listing)
    return listing


def _renumber(images: list[ListingImage]) -> None:
    for order, image in enumerate(images):
        image.display_order = order
        image.is_primary = order == 0


# --- Métricas y contacto -----------------------------------------------------


def _first_time(key: str, seconds: int) -> bool:
    return bool(get_redis().set(key, "1", ex=seconds, nx=True))


def register_view(db: Session, listing: Listing, visitor: str) -> None:
    # Una vista por visitante y aviso cada hora (no infla con recargas).
    if _first_time(f"view:{listing.id}:{visitor}", 3600):
        db.execute(
            update(Listing)
            .where(Listing.id == listing.id)
            .values(views_count=Listing.views_count + 1)
        )
        db.commit()


def whatsapp_message(listing: Listing) -> str:
    return (
        f'¡Hola! Vi tu aviso "{listing.title}" en CompraVendeAqui: '
        f"{public_url(listing)} ¿Sigue disponible?"
    )


def contact(db: Session, listing: Listing, visitor: str) -> ContactOut:
    seller = listing.user
    if not seller.phone or not seller.is_active or seller.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=NOT_FOUND)
    if not seller.whatsapp_optin:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Este vendedor no recibe consultas por WhatsApp",
        )
    # Cada clic devuelve el link; la métrica cuenta un contacto por visitante
    # cada 30 min para que refleje personas interesadas, no clics repetidos.
    if _first_time(f"contact:{listing.id}:{visitor}", 1800):
        db.execute(
            update(Listing)
            .where(Listing.id == listing.id)
            .values(contacts_count=Listing.contacts_count + 1)
        )
        db.commit()
        log.info("listing.contact", listing_id=str(listing.id))
    digits = wa_digits(seller.phone)
    return ContactOut(
        whatsapp_url=f"https://wa.me/{digits}?text={quote(whatsapp_message(listing))}",
        phone_display=f"+54 9 {digits[3:6]} {digits[6:9]}-{digits[9:]}",
    )


def count_active_for_user(db: Session, user_id: uuid.UUID) -> int:
    return int(
        db.scalar(
            select(func.count(Listing.id)).where(
                Listing.user_id == user_id, visible_listing_filter()
            )
        )
        or 0
    )
