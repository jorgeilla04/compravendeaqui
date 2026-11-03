"""Lógica de autenticación: OTP telefónico, password opcional y sesiones."""

from __future__ import annotations

import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.config import settings
from app.core import ratelimit
from app.core.logging import get_logger
from app.core.phone import mask_phone
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


def _now() -> datetime:
    return datetime.now(UTC)


def _otp_hash(phone: str, code: str) -> str:
    return hmac_digest(f"otp:{phone}:{code}")


def _otp_lockout(phone: str) -> ratelimit.Lockout:
    return ratelimit.Lockout(
        "otp", phone, settings.auth_max_attempts, settings.auth_lock_minutes
    )


def _password_lockout(phone: str) -> ratelimit.Lockout:
    return ratelimit.Lockout(
        "pwd", phone, settings.auth_max_attempts, settings.auth_lock_minutes
    )


# --- OTP -------------------------------------------------------------------


@dataclass
class OtpRequestResult:
    channel: str
    expires_in: int
    resend_in: int


def request_otp(
    db: Session, dispatcher: OtpDispatcher, phone: str, ip: str
) -> OtpRequestResult:
    _otp_lockout(phone).ensure_not_locked()

    # Límites de reenvío: por IP (anti-abuso de costo) y por teléfono.
    ratelimit.enforce(
        f"rl:otp:ip:{ip}", 20, 3600, "Demasiadas solicitudes. Probá más tarde."
    )
    cooldown_key = f"otp:cooldown:{phone}"
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
            f"rl:otp:phone:{phone}",
            settings.otp_max_sends_per_hour,
            3600,
            "Pediste demasiados códigos. Probá de nuevo en una hora.",
        )
    except HTTPException:
        r.delete(cooldown_key)
        raise

    # Un solo código vigente por teléfono: invalida los anteriores.
    db.execute(
        update(OtpCode)
        .where(
            OtpCode.phone == phone,
            OtpCode.purpose == OTP_PURPOSE_LOGIN,
            OtpCode.consumed.is_(False),
        )
        .values(consumed=True)
    )
    code = generate_otp()
    otp = OtpCode(
        phone=phone,
        code_hash=_otp_hash(phone, code),
        purpose=OTP_PURPOSE_LOGIN,
        attempts=0,
        consumed=False,
        expires_at=_now() + timedelta(minutes=settings.otp_ttl_minutes),
    )
    db.add(otp)
    db.flush()

    try:
        otp.channel = dispatcher.send(phone, code)
    except OtpDeliveryUnavailable as exc:
        db.rollback()
        r.delete(cooldown_key)
        log.error("otp.unavailable", phone=mask_phone(phone), error=str(exc))
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
        expires_in=settings.otp_ttl_minutes * 60,
        resend_in=settings.otp_resend_cooldown_seconds,
    )


def verify_otp(db: Session, phone: str, code: str) -> tuple[User, bool]:
    """Valida el código. Devuelve (usuario, es_nuevo)."""
    lockout = _otp_lockout(phone)
    lockout.ensure_not_locked()

    otp = db.scalars(
        select(OtpCode)
        .where(
            OtpCode.phone == phone,
            OtpCode.purpose == OTP_PURPOSE_LOGIN,
            OtpCode.consumed.is_(False),
            OtpCode.expires_at > _now(),
        )
        .order_by(OtpCode.created_at.desc())
        .limit(1)
        .with_for_update()
    ).first()

    if otp is None or not constant_time_equals(otp.code_hash, _otp_hash(phone, code)):
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

    user = db.scalars(
        select(User).where(User.phone == phone, User.deleted_at.is_(None))
    ).first()
    is_new = user is None
    if user is None:
        user = User(
            phone=phone,
            username=_provisional_username(db),
            role="user",
            profile_pending=True,
            whatsapp_optin=True,
            is_active=True,
            phone_verified=True,
            email_verified=False,
        )
        db.add(user)
    elif not user.is_active:
        db.commit()
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, detail="La cuenta está suspendida"
        )

    user.phone_verified = True
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


def login_with_password(db: Session, phone: str, password: str) -> User:
    lockout = _password_lockout(phone)
    lockout.ensure_not_locked()
    user = db.scalars(
        select(User).where(User.phone == phone, User.deleted_at.is_(None))
    ).first()
    if (
        user is None
        or not user.password_hash
        or not verify_password(password, user.password_hash)
    ):
        if lockout.register_failure() == 0:
            lockout.ensure_not_locked()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail=INVALID_CREDENTIALS)
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
