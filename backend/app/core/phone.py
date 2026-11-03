"""Normalización de teléfonos argentinos a E.164 móvil (+549...).

WhatsApp necesita el formato internacional móvil: +54 9 <área> <número>,
sin el 0 del área ni el 15 local. Aceptamos lo que la gente escribe de verdad:
"264 412-3456", "0264 15 412 3456", "+54 9 264 4123456", etc.
"""

from __future__ import annotations

import re

import phonenumbers


class InvalidPhoneError(ValueError):
    pass


def normalize_ar_mobile(raw: str) -> str:
    """Devuelve el teléfono como +549XXXXXXXXXX o lanza InvalidPhoneError."""
    cleaned = re.sub(r"[^\d+]", "", raw or "")
    if not cleaned:
        raise InvalidPhoneError("Teléfono vacío")

    try:
        parsed = phonenumbers.parse(cleaned, "AR")
    except phonenumbers.NumberParseException as exc:
        raise InvalidPhoneError("Teléfono inválido") from exc

    if parsed.country_code != 54:
        raise InvalidPhoneError("Solo se aceptan teléfonos de Argentina")

    national = str(parsed.national_number)
    # phonenumbers ya quita el 0 y convierte el 15 en 9 cuando lo reconoce;
    # si el usuario escribió el número sin 9 ni 15, lo tratamos como móvil.
    if not national.startswith("9"):
        national = "9" + national
    if len(national) != 11:
        raise InvalidPhoneError("El teléfono debe tener código de área y número")

    candidate = phonenumbers.parse("+54" + national)
    if not phonenumbers.is_valid_number(candidate):
        raise InvalidPhoneError("Teléfono inválido")
    return "+54" + national


def mask_phone(phone: str) -> str:
    """+5492644123456 → +54 9 264 ***-3456 (para mostrar/loguear)."""
    if len(phone) < 8:
        return "***"
    return f"{phone[:3]} {phone[3]} {phone[4:7]} ***-{phone[-4:]}"


def wa_digits(phone: str) -> str:
    """Formato que esperan wa.me y la Cloud API: solo dígitos."""
    return phone.lstrip("+")
