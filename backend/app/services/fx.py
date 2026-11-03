"""Cotización USD→ARS para normalizar precios (contexto inflacionario).

Fuente: DolarApi (dolarapi.com), configurable con FX_API_URL. Se cachea en
Redis; si la API no responde se usa la última cotización conocida.
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation

import httpx

from app.config import settings
from app.core.logging import get_logger
from app.core.redis import get_redis

log = get_logger(__name__)

CACHE_KEY = "fx:usd_ars"
LAST_KNOWN_KEY = "fx:usd_ars:last"


def fetch_rate() -> Decimal:
    response = httpx.get(settings.fx_api_url, timeout=httpx.Timeout(4.0))
    response.raise_for_status()
    value = response.json()[settings.fx_rate_field]
    rate = Decimal(str(value))
    if rate <= 0:
        raise ValueError(f"cotización inválida: {value}")
    return rate


def get_usd_ars_rate() -> Decimal | None:
    r = get_redis()
    cached = r.get(CACHE_KEY)
    if cached:
        return Decimal(str(cached))
    try:
        rate = fetch_rate()
    except (httpx.HTTPError, KeyError, ValueError, InvalidOperation) as exc:
        last = r.get(LAST_KNOWN_KEY)
        log.warning("fx.fetch_failed", error=str(exc), fallback=bool(last))
        return Decimal(str(last)) if last else None
    r.set(CACHE_KEY, str(rate), ex=settings.fx_cache_minutes * 60)
    r.set(LAST_KNOWN_KEY, str(rate))
    return rate


def to_usd(
    price: Decimal | None, currency: str, rate: Decimal | None
) -> Decimal | None:
    if price is None:
        return None
    if currency == "USD":
        return price
    if not rate:
        return None
    return (price / rate).quantize(Decimal("0.01"))
