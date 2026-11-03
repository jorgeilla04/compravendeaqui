"""Esquemas de autenticación."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.phone import InvalidPhoneError, normalize_ar_mobile
from app.schemas.user import MeOut


class PhoneIn(BaseModel):
    phone: str = Field(min_length=6, max_length=30)

    @field_validator("phone")
    @classmethod
    def _normalize(cls, value: str) -> str:
        try:
            return normalize_ar_mobile(value)
        except InvalidPhoneError as exc:
            raise ValueError(str(exc)) from exc


class OtpRequestIn(PhoneIn):
    pass


class OtpRequestOut(BaseModel):
    phone: str  # enmascarado
    channel: Literal["whatsapp", "sms"] | str
    expires_in: int
    resend_in: int


class OtpVerifyIn(PhoneIn):
    code: str = Field(pattern=r"^\d{4,8}$")


class PasswordLoginIn(PhoneIn):
    password: str = Field(min_length=1, max_length=128)


class RegisterIn(BaseModel):
    """Completa el perfil tras el primer OTP (email y password opcionales)."""

    username: str = Field(min_length=3, max_length=30, pattern=r"^[a-z0-9_.]+$")
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)
    whatsapp_optin: bool = True
    accept_terms: bool

    @field_validator("accept_terms")
    @classmethod
    def _must_accept(cls, value: bool) -> bool:
        if not value:
            raise ValueError(
                "Tenés que aceptar los términos y la política de privacidad"
            )
        return value


class RefreshIn(BaseModel):
    refresh_token: str | None = None


class AuthOut(BaseModel):
    user: MeOut
    is_new_user: bool = False
    access_token: str
    token_type: str = "bearer"
    expires_in: int
