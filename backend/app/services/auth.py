"""Lógica de autenticación: OTP (email o teléfono), password opcional y sesiones."""

from __future__ import annotations

import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.config import settings
from app.core import ratelimit
from app.core.logging import get_logger
from app.core.phone import mask_destination
from app.core.redis import get_redis
from app.core.security import (
    constant_time_equals,
    create_access_token,
    generate_otp,
    generate_refresh_token,
    hash_password,
    hmac_digest,
    verify_password,
)
from app.models import OtpCode, RefreshToken, User
from app.services.otp_delivery import OtpDeliveryUnavailable, OtpDispatcher

log = get_logger(__name__)

OTP_PURPOSE_LOGIN = "login"
INVALID_CREDENTIALS = "Teléfono o contraseña incorrectos"
INVALID_EMAIL_CREDENTIALS = "Email o contraseña incorrectos"


def _now() -> datetime:
    return datetime.now(UTC)


def _otp_hash(destination: str, code: str) -> str:
    return hmac_digest(f"otp:{destination}:{code}")


def _link_hash(token: str) -> str:
    return hmac_digest(f"otplink:{token}")


def _is_email(destination: str) -> bool:
    return "@" in destination


def _otp_lockout(destination: str) -> ratelimit.Lockout:
    return ratelimit.Lockout(
        "otp", destination, settings.auth_max_attempts, settings.auth_lock_minutes
    )


def _password_lockout(identifier: str) -> ratelimit.Lockout:
    return ratelimit.Lockout(
        "pwd", identifier, settings.auth_max_attempts, settings.auth_lock_minutes
    )


def safe_next(path: str | None) -> str:
    """Ruta interna a la que lleva el link del mail (nunca a otro sitio)."""
    if path and path.startswith("/") and not path.startswith(("//", "/\\")):
        return path[:300]
    return settings.email_link_default_next


def login_link(token: str, next_path: str | None) -> str:
    query = urlencode({"t": token, "next": safe_next(next_path)})
    return f"{settings.public_site_url.rstrip('/')}/ingresar/enlace?{query}"


# --- OTP -------------------------------------------------------------------


@dataclass
class OtpRequestResult:
    channel: str
    expires_in: int
    resend_in: int


def request_otp(
    db: Session,
    dispatcher: OtpDispatcher,
    destination: str,
    ip: str,
    next_path: str | None = None,
) -> OtpRequestResult:
    """Manda un código al teléfono o email. Por email va también un link de entrada."""
    _otp_lockout(destination).ensure_not_locked()

    # Límites de reenvío: por IP (anti-abuso de costo) y por destino.
    ratelimit.enforce(
        f"rl:otp:ip:{ip}",
        settings.otp_max_requests_per_ip_hour,
        3600,
        "Demasiadas solicitudes. Probá más tarde.",
    )
    cooldown_key = f"otp:cooldown:{destination}"
    r = get_redis()
    if not r.set(cooldown_key, "1", ex=settings.otp_resend_cooldown_seconds, nx=True):
        wait = max(int(r.ttl(cooldown_key)), 1)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Esperá {wait} segundos para pedir otro código.",
            headers={"Retry-After": str(wait)},
        )
    try:
        ratelimit.enforce(
            f"rl:otp:destination:{destination}",
            settings.otp_max_sends_per_hour,
            3600,
            "Pediste demasiados códigos. Probá de nuevo en una hora.",
        )
    except HTTPException:
        r.delete(cooldown_key)
        raise

    # Un solo código vigente por destino: invalida los anteriores.
    db.execute(
        update(OtpCode)
        .where(
            OtpCode.destination == destination,
            OtpCode.purpose == OTP_PURPOSE_LOGIN,
            OtpCode.consumed.is_(False),
        )
        .values(consumed=True)
    )
    code = generate_otp()
    token = secrets.token_urlsafe(32) if _is_email(destination) else None
    otp = OtpCode(
        destination=destination,
        code_hash=_otp_hash(destination, code),
        link_hash=_link_hash(token) if token else None,
        purpose=OTP_PURPOSE_LOGIN,
        attempts=0,
        consumed=False,
        expires_at=_now() + timedelta(minutes=settings.otp_ttl_for(destination)),
    )
    db.add(otp)
    db.flush()

    try:
        otp.channel = dispatcher.send(
            destination, code, login_link(token, next_path) if token else None
        )
    except OtpDeliveryUnavailable as exc:
        db.rollback()
        r.delete(cooldown_key)
        log.error("otp.unavailable", to=mask_destination(destination), error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "No pudimos enviarte el código en este momento. "
                "Probá de nuevo en unos minutos."
            ),
        ) from exc
    db.commit()
    return OtpRequestResult(
        channel=otp.channel or "",
        expires_in=settings.otp_ttl_for(destination) * 60,
        resend_in=settings.otp_resend_cooldown_seconds,
    )


def verify_otp(db: Session, destination: str, code: str) -> tuple[User, bool]:
    """Valida el código del teléfono o email. Devuelve (usuario, es_nuevo)."""
    lockout = _otp_lockout(destination)
    lockout.ensure_not_locked()

    otp = db.scalars(
        select(OtpCode)
        .where(
            OtpCode.destination == destination,
            OtpCode.purpose == OTP_PURPOSE_LOGIN,
            OtpCode.consumed.is_(False),
            OtpCode.expires_at > _now(),
        )
        .order_by(OtpCode.created_at.desc())
        .limit(1)
        .with_for_update()
    ).first()

    if otp is None or not constant_time_equals(
        otp.code_hash, _otp_hash(destination, code)
    ):
        if otp is not None:
            otp.attempts += 1
            if otp.attempts >= settings.auth_max_attempts:
                otp.consumed = True
            db.commit()
        remaining = lockout.register_failure()
        if remaining == 0:
            lockout.ensure_not_locked()
        detail = (
            "El código es incorrecto o venció."
            f" Te quedan {remaining} intento{'s' if remaining != 1 else ''}."
        )
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail=detail)

    otp.consumed = True
    lockout.reset()
    return _sign_in(db, destination)


def verify_link(db: Session, token: str) -> tuple[User, bool]:
    """Valida el link del mail (token de 256 bits, un solo uso)."""
    otp = db.scalars(
        select(OtpCode)
        .where(
            OtpCode.link_hash == _link_hash(token),
            OtpCode.purpose == OTP_PURPOSE_LOGIN,
            OtpCode.consumed.is_(False),
            OtpCode.expires_at > _now(),
        )
        .with_for_update()
    ).first()
    if otp is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="El link venció o ya se usó. Pedí un código nuevo.",
        )
    otp.consumed = True
    _otp_lockout(otp.destination).reset()
    return _sign_in(db, otp.destination)


def _find_or_create(db: Session, destination: str) -> tuple[User, bool]:
    """Usuario dueño del destino verificado; si no hay, lo da de alta.

    Solo cuenta quien lo tiene verificado: un email o teléfono cargado en otro
    perfil sin verificar no da acceso a esa cuenta (evita que alguien "reserve"
    el email ajeno y después reciba la sesión de su dueño).
    """
    if _is_email(destination):
        column, verified = User.email, User.email_verified
    else:
        column, verified = User.phone, User.phone_verified
    user = db.scalars(
        select(User).where(
            column == destination, verified.is_(True), User.deleted_at.is_(None)
        )
    ).first()
    if user is not None:
        return user, False

    if _is_email(destination):
        # El email es único: se lo saca al perfil que lo tenía sin verificar.
        db.execute(
            update(User)
            .where(User.email == destination, User.email_verified.is_(False))
            .values(email=None)
        )
    else:
        # Quien verifica el celular es su dueño: deja de ser el contacto de
        # perfiles que lo habían cargado sin verificar.
        db.execute(
            update(User)
            .where(User.phone == destination, User.phone_verified.is_(False))
            .values(phone=None)
        )
    user = User(
        phone=None if _is_email(destination) else destination,
        email=destination if _is_email(destination) else None,
        username=_provisional_username(db),
        role="user",
        profile_pending=True,
        whatsapp_optin=True,
        is_active=True,
        phone_verified=not _is_email(destination),
        email_verified=_is_email(destination),
    )
    db.add(user)
    return user, True


def _sign_in(db: Session, destination: str) -> tuple[User, bool]:
    user, is_new = _find_or_create(db, destination)
    if not user.is_active:
        db.commit()
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, detail="La cuenta está suspendida"
        )
    user.last_login = _now()
    db.commit()
    db.refresh(user)
    if is_new:
        log.info("auth.user_created", user_id=str(user.id))
    return user, is_new


def _provisional_username(db: Session) -> str:
    while True:
        candidate = f"usuario{secrets.randbelow(10**7):07d}"
        if not db.scalar(select(User.id).where(User.username == candidate)):
            return candidate


# --- Password (método secundario) ------------------------------------------


def login_with_password(db: Session, identifier: str, password: str) -> User:
    """identifier: email (en minúsculas) o teléfono normalizado."""
    lockout = _password_lockout(identifier)
    lockout.ensure_not_locked()
    if _is_email(identifier):
        where = (User.email == identifier, User.email_verified.is_(True))
    else:
        where = (User.phone == identifier, User.phone_verified.is_(True))
    user = db.scalars(select(User).where(*where, User.deleted_at.is_(None))).first()
    if (
        user is None
        or not user.password_hash
        or not verify_password(password, user.password_hash)
    ):
        if lockout.register_failure() == 0:
            lockout.ensure_not_locked()
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            detail=(
                INVALID_EMAIL_CREDENTIALS
                if _is_email(identifier)
                else INVALID_CREDENTIALS
            ),
        )
    if not user.is_active:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, detail="La cuenta está suspendida"
        )
    lockout.reset()
    user.last_login = _now()
    db.commit()
    return user


def set_password(user: User, new_password: str) -> None:
    user.password_hash = hash_password(new_password)


# --- Sesiones (access + refresh con rotación) -------------------------------


@dataclass
class AuthTokens:
    access_token: str
    refresh_token: str


def issue_session(db: Session, user: User) -> AuthTokens:
    raw = generate_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hmac_digest(f"rt:{raw}"),
            expires_at=_now() + timedelta(days=settings.refresh_token_ttl_days),
            revoked=False,
        )
    )
    db.commit()
    return AuthTokens(create_access_token(user.id, user.role), raw)


def rotate_refresh(db: Session, raw: str) -> tuple[User, AuthTokens]:
    token = db.scalars(
        select(RefreshToken)
        .where(RefreshToken.token_hash == hmac_digest(f"rt:{raw}"))
        .with_for_update()
    ).first()
    unauthorized = HTTPException(
        status.HTTP_401_UNAUTHORIZED, detail="Sesión vencida. Ingresá de nuevo."
    )
    if token is None:
        raise unauthorized
    if token.revoked:
        # Reuso de un token ya rotado: posible robo → se cierran todas las sesiones.
        revoke_all(db, token.user_id)
        log.warning("auth.refresh_reuse", user_id=str(token.user_id))
        raise unauthorized
    if token.expires_at <= _now():
        raise unauthorized
    user = db.get(User, token.user_id)
    if user is None or not user.is_active or user.deleted_at is not None:
        raise unauthorized
    token.revoked = True
    db.flush()
    return user, issue_session(db, user)


def revoke_refresh(db: Session, raw: str) -> None:
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.token_hash == hmac_digest(f"rt:{raw}"))
        .values(revoked=True)
    )
    db.commit()


def revoke_all(db: Session, user_id: object) -> None:
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked.is_(False))
        .values(revoked=True)
    )
    db.commit()
