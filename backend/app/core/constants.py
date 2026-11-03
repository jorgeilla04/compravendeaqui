"""Constantes de dominio de San Juan."""

from __future__ import annotations

# Los 19 departamentos de la provincia de San Juan.
DEPARTMENTS: tuple[str, ...] = (
    "Albardón",
    "Angaco",
    "Calingasta",
    "Capital",
    "Caucete",
    "Chimbas",
    "Iglesia",
    "Jáchal",
    "Nueve de Julio",
    "Pocito",
    "Rawson",
    "Rivadavia",
    "San Martín",
    "Santa Lucía",
    "Sarmiento",
    "Ullum",
    "Valle Fértil",
    "Veinticinco de Mayo",
    "Zonda",
)

CONDITIONS: tuple[str, ...] = ("nuevo", "usado", "reacondicionado")
CURRENCIES: tuple[str, ...] = ("ARS", "USD")
LISTING_STATUSES: tuple[str, ...] = (
    "active",
    "sold",
    "expired",
    "draft",
    "suspended",
)
