"""JWT, hashing de passwords (bcrypt) y de secretos de un solo uso (HMAC)."""

from __future__ import annotations

import hashlib
import hmac
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt

from app.config import settings

ACCESS_TOKEN_TYPE = "access"


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=settings.bcrypt_rounds)
    return bcrypt.hashpw(password.encode(), salt).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except ValueError:
        return False


def hmac_digest(value: str) -> str:
    """HMAC-SHA256 con la clave del servidor (OTP y refresh tokens).

    A diferencia de un hash plano, sin la clave no se puede hacer fuerza bruta
    offline sobre un código de 6 dígitos filtrado de la DB.
    """
    return hmac.new(
        settings.jwt_secret_key.encode(), value.encode(), hashlib.sha256
    ).hexdigest()


def constant_time_equals(a: str, b: str) -> bool:
    return hmac.compare_digest(a, b)


def generate_otp() -> str:
    return "".join(secrets.choice("0123456789") for _ in range(settings.otp_length))


def generate_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def create_access_token(user_id: uuid.UUID, role: str) -> str:
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "role": role,
        "type": ACCESS_TOKEN_TYPE,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_ttl_minutes),
    }
    return jwt.encode(
        payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm
    )


def decode_access_token(token: str) -> dict[str, Any] | None:
    try:
        payload: dict[str, Any] = jwt.decode(
            token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
        )
    except jwt.PyJWTError:
        return None
    if payload.get("type") != ACCESS_TOKEN_TYPE:
        return None
    return payload
