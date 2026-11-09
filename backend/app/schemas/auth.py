"""Esquemas de autenticación."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.phone import InvalidPhoneError, normalize_ar_mobile
from app.schemas.fields import Email
from app.schemas.user import MeOut


def _normalize_phone(value: str | None) -> str | None:
    if value is None:
        return None
    try:
        return normalize_ar_mobile(value)
    except InvalidPhoneError as exc:
        raise ValueError(str(exc)) from exc


class IdentityIn(BaseModel):
    """Email o celular (uno de los dos), según LOGIN_METHOD."""

    email: Email | None = None
    phone: str | None = Field(default=None, min_length=6, max_length=30)

    @field_validator("phone")
    @classmethod
    def _phone(cls, value: str | None) -> str | None:
        return _normalize_phone(value)

    @model_validator(mode="after")
    def _one(self) -> IdentityIn:
        if bool(self.email) == bool(self.phone):
            raise ValueError("Mandá tu email o tu celular")
        return self

    @property
    def identity(self) -> str:
        return self.email or self.phone or ""


class OtpRequestIn(IdentityIn):
    # Adónde lleva el link del mail después de entrar (ruta interna).
    next: str | None = Field(default=None, max_length=300)


class OtpRequestOut(BaseModel):
    destination: str  # enmascarado
    channel: Literal["email", "whatsapp", "sms"] | str
    expires_in: int
    resend_in: int


class OtpVerifyIn(IdentityIn):
    code: str = Field(pattern=r"^\d{4,8}$")


class OtpLinkIn(BaseModel):
    token: str = Field(min_length=20, max_length=200)


class PasswordLoginIn(IdentityIn):
    password: str = Field(min_length=1, max_length=128)


class LoginMethodsOut(BaseModel):
    otp: Literal["email", "phone"]


class RegisterIn(BaseModel):
    """Completa el perfil tras el primer OTP.

    Si se ingresó por email, el celular es obligatorio: es el WhatsApp por el que
    los compradores contactan al vendedor.
    """

    username: str = Field(min_length=3, max_length=30, pattern=r"^[a-z0-9_.]+$")
    full_name: str = Field(min_length=2, max_length=120)
    email: Email | None = None
    phone: str | None = Field(default=None, min_length=6, max_length=30)
    password: str | None = Field(default=None, min_length=8, max_length=128)
    whatsapp_optin: bool = True
    accept_terms: bool

    @field_validator("phone")
    @classmethod
    def _phone(cls, value: str | None) -> str | None:
        return _normalize_phone(value)

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
