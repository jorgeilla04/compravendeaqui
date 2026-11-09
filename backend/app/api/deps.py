"""Dependencias compartidas de la API: sesión de DB, usuario actual, cookies."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.config import settings
from app.core.security import decode_access_token
from app.database import get_db
from app.models import User
from app.services.auth import AuthTokens

ACCESS_COOKIE = "cva_access"
REFRESH_COOKIE = "cva_refresh"
REFRESH_COOKIE_PATH = f"{settings.api_v1_prefix}/auth"

DbSession = Annotated[Session, Depends(get_db)]


def _token_from_request(request: Request) -> str | None:
    header = request.headers.get("authorization", "")
    if header.lower().startswith("bearer "):
        return header[7:].strip() or None
    return request.cookies.get(ACCESS_COOKIE)


def get_optional_user(request: Request, db: DbSession) -> User | None:
    token = _token_from_request(request)
    if not token:
        return None
    payload = decode_access_token(token)
    if payload is None:
        return None
    try:
        user_id = uuid.UUID(str(payload.get("sub")))
    except ValueError:
        return None
    user = db.get(User, user_id)
    if user is None or not user.is_active or user.deleted_at is not None:
        return None
    return user


def get_current_user(user: Annotated[User | None, Depends(get_optional_user)]) -> User:
    if user is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail="Tenés que ingresar para continuar",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def get_complete_user(user: CurrentUser) -> User:
    """Usuario con el perfil completo (aceptó términos y privacidad en el alta)."""
    if user.profile_pending:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            detail="Completá tu perfil y aceptá los términos para continuar",
        )
    return user


CompleteUser = Annotated[User, Depends(get_complete_user)]


def get_admin_user(user: CompleteUser) -> User:
    """Administración (por ahora, la tienda de uniformes)."""
    if user.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Solo administradores")
    return user


AdminUser = Annotated[User, Depends(get_admin_user)]
OptionalUser = Annotated[User | None, Depends(get_optional_user)]


def set_auth_cookies(response: Response, tokens: AuthTokens) -> None:
    common = {
        "httponly": True,
        "secure": settings.cookie_secure,
        "samesite": "lax",
        "domain": settings.cookie_domain,
    }
    response.set_cookie(
        ACCESS_COOKIE,
        tokens.access_token,
        max_age=settings.access_token_ttl_minutes * 60,
        path="/",
        **common,  # type: ignore[arg-type]
    )
    response.set_cookie(
        REFRESH_COOKIE,
        tokens.refresh_token,
        max_age=settings.refresh_token_ttl_days * 86400,
        path=REFRESH_COOKIE_PATH,
        **common,  # type: ignore[arg-type]
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(ACCESS_COOKIE, path="/", domain=settings.cookie_domain)
    response.delete_cookie(
        REFRESH_COOKIE, path=REFRESH_COOKIE_PATH, domain=settings.cookie_domain
    )
