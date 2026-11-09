"""Tipos de campo compartidos, con mensajes de error en castellano."""

from __future__ import annotations

from typing import Annotated

from email_validator import EmailNotValidError, validate_email
from pydantic import AfterValidator, StringConstraints


def _email(value: str) -> str:
    try:
        result = validate_email(value, check_deliverability=False)
    except EmailNotValidError as exc:
        raise ValueError(
            "Revisá el email, parece que está mal escrito (ej: juan@gmail.com)."
        ) from exc
    return result.normalized.lower()


# Reemplaza a EmailStr: mismo chequeo, error legible y en minúsculas.
Email = Annotated[
    str,
    StringConstraints(strip_whitespace=True, max_length=255),
    AfterValidator(_email),
]
