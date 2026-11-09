"""Mercado Pago Checkout Pro: preferencias de pago, consulta de pagos y firma.

Integración real contra la API REST (el SDK oficial hace lo mismo). Se activa
con MP_ACCESS_TOKEN; el token nunca sale del backend.
Docs: mercadopago.com.ar/developers/es/reference/preferences/_checkout_preferences/post
"""

from __future__ import annotations

import hashlib
import hmac
import time
from decimal import Decimal
from typing import Any

import httpx

from app.config import Settings, settings

HTTP_TIMEOUT = httpx.Timeout(15.0, connect=5.0)
# Antigüedad máxima de un aviso firmado (evita reenvíos de avisos viejos).
SIGNATURE_MAX_AGE_S = 300


class MercadoPagoError(Exception):
    """La API de Mercado Pago no respondió lo esperado."""


def _headers(config: Settings) -> dict[str, str]:
    return {"Authorization": f"Bearer {config.mp_access_token}"}


def _json(response: httpx.Response) -> dict[str, Any]:
    try:
        data = response.json()
    except ValueError:
        return {}
    return data if isinstance(data, dict) else {}


def preference_payload(
    *,
    pedido_id: str,
    codigo: str,
    titulo: str,
    monto: Decimal,
    cliente_nombre: str,
    cliente_email: str | None,
    config: Settings = settings,
) -> dict[str, Any]:
    site = config.public_site_url.rstrip("/")
    back = f"{site}/uniformes/pedido/{pedido_id}"
    payload: dict[str, Any] = {
        "items": [
            {
                "id": codigo,
                "title": titulo,
                "quantity": 1,
                "currency_id": "ARS",
                "unit_price": float(monto),
            }
        ],
        "payer": {"name": cliente_nombre},
        "external_reference": pedido_id,
        "back_urls": {"success": back, "failure": back, "pending": back},
        "auto_return": "approved",
        "statement_descriptor": config.mp_statement_descriptor[:22],
        "metadata": {"codigo": codigo},
    }
    if cliente_email:
        payload["payer"]["email"] = cliente_email
    # Mercado Pago solo avisa a URLs públicas por HTTPS.
    if site.startswith("https://"):
        payload["notification_url"] = (
            f"{site}/api/v1/uniformes/webhooks/mercadopago?source_news=webhooks"
        )
    return payload


def create_preference(
    payload: dict[str, Any], idempotency_key: str, config: Settings = settings
) -> tuple[str, str]:
    """Crea la preferencia. Devuelve (preference_id, init_point)."""
    try:
        response = httpx.post(
            f"{config.mp_api_base_url}/checkout/preferences",
            json=payload,
            headers={**_headers(config), "X-Idempotency-Key": idempotency_key},
            timeout=HTTP_TIMEOUT,
        )
    except httpx.HTTPError as exc:
        raise MercadoPagoError(f"preferencia: error de red ({exc})") from exc
    data = _json(response)
    if response.status_code >= 400:
        raise MercadoPagoError(
            f"preferencia: HTTP {response.status_code} {data.get('message')}"
        )
    try:
        return str(data["id"]), str(data["init_point"])
    except KeyError as exc:
        raise MercadoPagoError("preferencia: respuesta sin id/init_point") from exc


def get_payment(payment_id: str, config: Settings = settings) -> dict[str, Any]:
    """Consulta un pago: la única fuente de verdad sobre si se cobró."""
    if not payment_id.isdigit():
        raise MercadoPagoError("pago: id inválido")
    try:
        response = httpx.get(
            f"{config.mp_api_base_url}/v1/payments/{payment_id}",
            headers=_headers(config),
            timeout=HTTP_TIMEOUT,
        )
    except httpx.HTTPError as exc:
        raise MercadoPagoError(f"pago: error de red ({exc})") from exc
    data = _json(response)
    if response.status_code >= 400:
        raise MercadoPagoError(f"pago: HTTP {response.status_code}")
    return data


def valid_signature(
    *,
    x_signature: str | None,
    x_request_id: str | None,
    data_id: str,
    config: Settings = settings,
    now: float | None = None,
) -> bool:
    """Valida la firma de un aviso (x-signature: "ts=...,v1=<hmac sha256>").

    Docs: mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
    En producción MP_WEBHOOK_SECRET es obligatorio (lo exige la config). Sin
    él, solo en desarrollo, no se valida: igual el pago se confirma
    consultándolo a la API, así que un aviso falso no marca nada como pagado.
    """
    if not config.mp_webhook_secret:
        return not config.is_production
    if not x_signature or not x_request_id:
        return False
    parts = dict(
        item.strip().split("=", 1) for item in x_signature.split(",") if "=" in item
    )
    ts, v1 = parts.get("ts"), parts.get("v1")
    if not ts or not v1:
        return False
    try:
        sent = int(ts)
    except ValueError:
        return False
    # ts puede venir en segundos o milisegundos; avisos viejos se rechazan.
    sent_s = sent / 1000 if sent > 10**12 else sent
    if abs((now if now is not None else time.time()) - sent_s) > SIGNATURE_MAX_AGE_S:
        return False
    manifest = f"id:{data_id.lower()};request-id:{x_request_id};ts:{ts};"
    expected = hmac.new(
        config.mp_webhook_secret.encode(), manifest.encode(), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, v1)
