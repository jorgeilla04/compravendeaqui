"""Slugs SEO en español (sin tildes, ñ → n)."""

from __future__ import annotations

import re
import secrets
import unicodedata


def slugify(value: str, max_length: int = 80) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore")
    text = re.sub(r"[^a-z0-9]+", "-", normalized.decode().lower()).strip("-")
    return text[:max_length].rstrip("-") or "aviso"


def unique_listing_slug(title: str) -> str:
    """toyota-corolla-2018-k3f9x2: legible + sufijo aleatorio no enumerable."""
    suffix = "".join(
        secrets.choice("abcdefghijkmnpqrstuvwxyz23456789") for _ in range(6)
    )
    return f"{slugify(title, 70)}-{suffix}"
