"""Usuarios: perfil público, edición, avatar, password, baja y exportación."""

from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, File, HTTPException, Response, UploadFile, status

from app.api.deps import CurrentUser, DbSession, clear_auth_cookies
from app.core.security import verify_password
from app.schemas.listing import ListingPage, OwnerListingOut
from app.schemas.user import MeOut, PasswordSetIn, PublicProfileOut, UserUpdateIn
from app.services import auth as auth_service
from app.services import listings as listing_service
from app.services import search as search_service
from app.services import users as user_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me/listings", response_model=list[OwnerListingOut])
def my_listings(user: CurrentUser, db: DbSession) -> list[OwnerListingOut]:
    """Mis avisos, en todos los estados (activos, pausados, vendidos, vencidos)."""
    return [
        listing_service.to_out(item, owner=True)  # type: ignore[misc]
        for item in listing_service.list_for_owner(db, user)
    ]


@router.put("/me", response_model=MeOut)
def update_me(body: UserUpdateIn, user: CurrentUser, db: DbSession) -> MeOut:
    return user_service.to_me(user_service.update_profile(db, user, body))


@router.post("/me/avatar", response_model=MeOut)
async def upload_avatar(
    user: CurrentUser, db: DbSession, file: Annotated[UploadFile, File()]
) -> MeOut:
    return user_service.to_me(await user_service.set_avatar(db, user, file))


@router.put(
    "/me/password",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    response_model=None,
)
def set_password(body: PasswordSetIn, user: CurrentUser, db: DbSession) -> None:
    if user.password_hash and not (
        body.current_password
        and verify_password(body.current_password, user.password_hash)
    ):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, detail="La contraseña actual no es correcta"
        )
    auth_service.set_password(user, body.new_password)
    db.commit()


@router.get("/me/export")
def export_me(user: CurrentUser, db: DbSession) -> dict[str, Any]:
    """Derecho de acceso (Ley 25.326): descarga de todos los datos personales."""
    return user_service.export_data(db, user)


@router.delete(
    "/me",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    response_model=None,
)
def delete_me(user: CurrentUser, db: DbSession, response: Response) -> Response:
    """Baja de cuenta: anonimiza los datos y da de baja todos los avisos."""
    user_service.delete_account(db, user)
    response.status_code = status.HTTP_204_NO_CONTENT
    clear_auth_cookies(response)
    return response


@router.get("/{user_id}", response_model=PublicProfileOut)
def public_profile(user_id: uuid.UUID, db: DbSession) -> PublicProfileOut:
    user = user_service.get_public(db, user_id)
    return PublicProfileOut(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        created_at=user.created_at,
        active_listings_count=listing_service.count_active_for_user(db, user.id),
    )


@router.get("/{user_id}/listings", response_model=ListingPage)
def user_listings(
    user_id: uuid.UUID, db: DbSession, cursor: str | None = None
) -> ListingPage:
    user_service.get_public(db, user_id)
    try:
        items, next_cursor = search_service.search_listings(
            db, search_service.SearchParams(user_id=user_id, cursor=cursor)
        )
    except search_service.InvalidCursorError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return ListingPage(
        items=[listing_service.to_card(i) for i in items], next_cursor=next_cursor
    )
