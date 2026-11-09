"""Endpoints de autenticación: OTP por email (o WhatsApp/SMS), password y sesiones."""

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
from app.core.phone import mask_destination
from app.models import User
from app.schemas.auth import (
    AuthOut,
    IdentityIn,
    LoginMethodsOut,
    OtpLinkIn,
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


def _otp_identity(body: IdentityIn) -> str:
    """El código solo se manda por el método habilitado (LOGIN_METHOD)."""
    if settings.login_method == "email" and not body.email:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Ingresá tu email"
        )
    if settings.login_method == "phone" and not body.phone:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Ingresá tu celular"
        )
    return body.identity


@router.get("/methods", response_model=LoginMethodsOut)
def methods() -> LoginMethodsOut:
    """Con qué se ingresa hoy (el frontend arma el formulario según esto)."""
    return LoginMethodsOut(otp=settings.login_method)


@router.post("/otp/request", response_model=OtpRequestOut)
def otp_request(
    body: OtpRequestIn,
    request: Request,
    db: DbSession,
    dispatcher: Annotated[OtpDispatcher, Depends(get_otp_dispatcher)],
) -> OtpRequestOut:
    """Envía un código de un solo uso por email (con link para entrar directo)
    o al celular (WhatsApp, con SMS de respaldo), según LOGIN_METHOD."""
    destination = _otp_identity(body)
    result = auth_service.request_otp(
        db, dispatcher, destination, ratelimit.client_ip(request), body.next
    )
    return OtpRequestOut(
        destination=mask_destination(destination),
        channel=result.channel,
        expires_in=result.expires_in,
        resend_in=result.resend_in,
    )


@router.post("/otp/verify", response_model=AuthOut)
def otp_verify(body: OtpVerifyIn, response: Response, db: DbSession) -> AuthOut:
    """Valida el código: ingresa al usuario o lo da de alta si es nuevo."""
    user, is_new = auth_service.verify_otp(db, _otp_identity(body), body.code)
    return _auth_response(response, db, user, is_new or user.profile_pending)


@router.post("/otp/link", response_model=AuthOut)
def otp_link(
    body: OtpLinkIn, request: Request, response: Response, db: DbSession
) -> AuthOut:
    """Entra con el link del mail (un solo uso, vence junto con el código)."""
    ratelimit.enforce(
        f"rl:otplink:ip:{ratelimit.client_ip(request)}",
        30,
        900,
        "Demasiados intentos. Probá más tarde.",
    )
    user, is_new = auth_service.verify_link(db, body.token)
    return _auth_response(response, db, user, is_new or user.profile_pending)


@router.post("/register", response_model=MeOut)
def register(body: RegisterIn, user: CurrentUser, db: DbSession) -> MeOut:
    """Completa el perfil del usuario recién verificado.

    El celular es obligatorio si todavía no tiene (ingreso por email): es el
    WhatsApp de contacto. El email se ignora si ya es el verificado del ingreso.

    Solo sirve una vez, en el alta: después el perfil se edita en /users/me y la
    contraseña en /users/me/password (que pide la actual).
    """
    if not user.profile_pending:
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="Tu perfil ya está completo"
        )
    if not user.phone and not body.phone:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Ingresá tu celular: es por donde te contactan los compradores",
        )
    profile = UserUpdateIn(
        username=body.username,
        full_name=body.full_name,
        whatsapp_optin=body.whatsapp_optin,
    )
    if body.email and not user.email_verified:
        profile.email = body.email
    if body.phone and not user.phone_verified:
        profile.phone = body.phone
    user_service.update_profile(
        db, user, UserUpdateIn(**profile.model_dump(exclude_none=True))
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
    user = auth_service.login_with_password(db, body.identity, body.password)
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
