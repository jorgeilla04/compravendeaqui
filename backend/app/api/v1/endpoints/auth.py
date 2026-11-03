"""Endpoints de autenticación: OTP por WhatsApp/SMS, password y sesiones."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from app.api.deps import (
    REFRESH_COOKIE,
    CurrentUser,
    DbSession,
    clear_auth_cookies,
    set_auth_cookies,
)
from app.config import settings
from app.core import ratelimit
from app.core.phone import mask_phone
from app.models import User
from app.schemas.auth import (
    AuthOut,
    OtpRequestIn,
    OtpRequestOut,
    OtpVerifyIn,
    PasswordLoginIn,
    RefreshIn,
    RegisterIn,
)
from app.schemas.user import MeOut, UserUpdateIn
from app.services import auth as auth_service
from app.services import users as user_service
from app.services.otp_delivery import OtpDispatcher, get_otp_dispatcher

router = APIRouter(prefix="/auth", tags=["auth"])


def _auth_response(
    response: Response, db: DbSession, user: User, is_new: bool = False
) -> AuthOut:
    tokens = auth_service.issue_session(db, user)
    set_auth_cookies(response, tokens)
    return AuthOut(
        user=user_service.to_me(user),
        is_new_user=is_new,
        access_token=tokens.access_token,
        expires_in=settings.access_token_ttl_minutes * 60,
    )


@router.post("/otp/request", response_model=OtpRequestOut)
def otp_request(
    body: OtpRequestIn,
    request: Request,
    db: DbSession,
    dispatcher: Annotated[OtpDispatcher, Depends(get_otp_dispatcher)],
) -> OtpRequestOut:
    """Envía un código de un solo uso al teléfono (WhatsApp, con SMS de respaldo)."""
    result = auth_service.request_otp(
        db, dispatcher, body.phone, ratelimit.client_ip(request)
    )
    return OtpRequestOut(
        phone=mask_phone(body.phone),
        channel=result.channel,
        expires_in=result.expires_in,
        resend_in=result.resend_in,
    )


@router.post("/otp/verify", response_model=AuthOut)
def otp_verify(body: OtpVerifyIn, response: Response, db: DbSession) -> AuthOut:
    """Valida el código: ingresa al usuario o lo da de alta si es nuevo."""
    user, is_new = auth_service.verify_otp(db, body.phone, body.code)
    return _auth_response(response, db, user, is_new or user.profile_pending)


@router.post("/register", response_model=MeOut)
def register(body: RegisterIn, user: CurrentUser, db: DbSession) -> MeOut:
    """Completa el perfil del usuario recién verificado (email/password opcionales)."""
    user_service.update_profile(
        db,
        user,
        UserUpdateIn(
            username=body.username,
            full_name=body.full_name,
            email=body.email,
            whatsapp_optin=body.whatsapp_optin,
        ),
    )
    if body.password:
        auth_service.set_password(user, body.password)
    user.profile_pending = False
    db.commit()
    db.refresh(user)
    return user_service.to_me(user)


@router.post("/login", response_model=AuthOut)
def login(
    body: PasswordLoginIn, request: Request, response: Response, db: DbSession
) -> AuthOut:
    """Ingreso con contraseña (método secundario; el principal es OTP)."""
    ratelimit.enforce(
        f"rl:login:ip:{ratelimit.client_ip(request)}",
        30,
        900,
        "Demasiados intentos. Probá más tarde.",
    )
    user = auth_service.login_with_password(db, body.phone, body.password)
    return _auth_response(response, db, user)


@router.post("/refresh", response_model=AuthOut)
def refresh(
    request: Request, response: Response, db: DbSession, body: RefreshIn | None = None
) -> AuthOut:
    raw = (body.refresh_token if body else None) or request.cookies.get(REFRESH_COOKIE)
    if not raw:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED, detail="Sesión vencida. Ingresá de nuevo."
        )
    try:
        user, tokens = auth_service.rotate_refresh(db, raw)
    except HTTPException:
        clear_auth_cookies(response)
        raise
    set_auth_cookies(response, tokens)
    return AuthOut(
        user=user_service.to_me(user),
        access_token=tokens.access_token,
        expires_in=settings.access_token_ttl_minutes * 60,
    )


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    response_model=None,
)
def logout(
    request: Request, response: Response, db: DbSession, body: RefreshIn | None = None
) -> Response:
    raw = (body.refresh_token if body else None) or request.cookies.get(REFRESH_COOKIE)
    if raw:
        auth_service.revoke_refresh(db, raw)
    response.status_code = status.HTTP_204_NO_CONTENT
    clear_auth_cookies(response)
    return response


@router.get("/me", response_model=MeOut)
def me(user: CurrentUser) -> MeOut:
    return user_service.to_me(user)
