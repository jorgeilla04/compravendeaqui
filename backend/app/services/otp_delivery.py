"""Envío de códigos OTP por WhatsApp Cloud API (Meta) y SMS (Twilio).

Cada proveedor es una integración real contra la API del servicio. Se activan
solo con configurar sus variables de entorno (ver .env.example); el
despachador prueba los canales en el orden de OTP_CHANNELS y usa el siguiente
si uno falla.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

import httpx

from app.config import Settings, settings
from app.core.logging import get_logger
from app.core.phone import mask_phone, wa_digits

log = get_logger(__name__)

HTTP_TIMEOUT = httpx.Timeout(10.0, connect=5.0)


class OtpDeliveryError(Exception):
    """Un proveedor no pudo entregar el código."""


class OtpDeliveryUnavailable(Exception):
    """No hay ningún canal configurado o fallaron todos."""


class OtpSender(Protocol):
    channel: str

    def send(self, phone: str, code: str) -> str:
        """Envía el código; devuelve el id de mensaje del proveedor."""
        ...


@dataclass
class WhatsAppCloudSender:
    """WhatsApp Cloud API: plantilla de categoría AUTHENTICATION.

    La plantilla se crea y aprueba en Meta Business Manager con el botón
    "Copiar código"; Meta exige mandar el código tanto en el cuerpo como en el
    parámetro del botón.
    Docs: developers.facebook.com/docs/whatsapp/business-management-api/
    authentication-templates
    """

    config: Settings
    channel: str = "whatsapp"

    @property
    def url(self) -> str:
        c = self.config
        return (
            f"{c.whatsapp_api_base_url}/{c.whatsapp_api_version}/"
            f"{c.whatsapp_phone_number_id}/messages"
        )

    def payload(self, phone: str, code: str) -> dict[str, object]:
        return {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": wa_digits(phone),
            "type": "template",
            "template": {
                "name": self.config.whatsapp_otp_template_name,
                "language": {"code": self.config.whatsapp_otp_template_language},
                "components": [
                    {"type": "body", "parameters": [{"type": "text", "text": code}]},
                    {
                        "type": "button",
                        "sub_type": "url",
                        "index": "0",
                        "parameters": [{"type": "text", "text": code}],
                    },
                ],
            },
        }

    def send(self, phone: str, code: str) -> str:
        try:
            response = httpx.post(
                self.url,
                json=self.payload(phone, code),
                headers={
                    "Authorization": f"Bearer {self.config.whatsapp_access_token}"
                },
                timeout=HTTP_TIMEOUT,
            )
        except httpx.HTTPError as exc:
            raise OtpDeliveryError(f"whatsapp: error de red ({exc})") from exc

        data = _json(response)
        if response.status_code >= 400:
            error = data.get("error", {}) if isinstance(data, dict) else {}
            raise OtpDeliveryError(
                f"whatsapp: HTTP {response.status_code} "
                f"code={error.get('code')} {error.get('message')}"
            )
        try:
            return str(data["messages"][0]["id"])
        except (KeyError, IndexError, TypeError) as exc:
            raise OtpDeliveryError("whatsapp: respuesta sin id de mensaje") from exc


@dataclass
class TwilioSmsSender:
    """Twilio Programmable Messaging (SMS).

    Docs: twilio.com/docs/messaging/api/message-resource#create-a-message-resource
    """

    config: Settings
    channel: str = "sms"

    @property
    def url(self) -> str:
        c = self.config
        return (
            f"{c.twilio_api_base_url}/2010-04-01/Accounts/"
            f"{c.twilio_account_sid}/Messages.json"
        )

    def form(self, phone: str, code: str) -> dict[str, str]:
        body = (
            f"{code} es tu código de CompraVendeAqui. "
            f"Vence en {self.config.otp_ttl_minutes} min. No lo compartas."
        )
        data = {"To": phone, "Body": body}
        if self.config.twilio_messaging_service_sid:
            data["MessagingServiceSid"] = self.config.twilio_messaging_service_sid
        else:
            data["From"] = self.config.twilio_from_number
        return data

    def send(self, phone: str, code: str) -> str:
        try:
            response = httpx.post(
                self.url,
                data=self.form(phone, code),
                auth=(self.config.twilio_account_sid, self.config.twilio_auth_token),
                timeout=HTTP_TIMEOUT,
            )
        except httpx.HTTPError as exc:
            raise OtpDeliveryError(f"sms: error de red ({exc})") from exc

        data = _json(response)
        if response.status_code >= 400:
            raise OtpDeliveryError(
                f"sms: HTTP {response.status_code} "
                f"code={data.get('code')} {data.get('message')}"
            )
        sid = data.get("sid")
        if not sid:
            raise OtpDeliveryError("sms: respuesta sin sid")
        return str(sid)


def _json(response: httpx.Response) -> dict[str, Any]:
    try:
        data = response.json()
    except ValueError:
        return {}
    return data if isinstance(data, dict) else {}


def configured_senders(config: Settings = settings) -> list[OtpSender]:
    """Proveedores configurados, en el orden de OTP_CHANNELS."""
    available: dict[str, OtpSender] = {}
    if config.whatsapp_configured:
        available["whatsapp"] = WhatsAppCloudSender(config)
    if config.twilio_configured:
        available["sms"] = TwilioSmsSender(config)
    return [available[ch] for ch in config.otp_channels if ch in available]


class OtpDispatcher:
    """Prueba cada canal en orden hasta que uno entregue el código."""

    def __init__(self, senders: list[OtpSender]):
        self.senders = senders

    def send(self, phone: str, code: str) -> str:
        if not self.senders:
            raise OtpDeliveryUnavailable("No hay ningún canal de OTP configurado")
        for sender in self.senders:
            try:
                message_id = sender.send(phone, code)
            except OtpDeliveryError as exc:
                log.warning(
                    "otp.delivery_failed",
                    channel=sender.channel,
                    phone=mask_phone(phone),
                    error=str(exc),
                )
                continue
            log.info(
                "otp.sent",
                channel=sender.channel,
                phone=mask_phone(phone),
                message_id=message_id,
            )
            return sender.channel
        raise OtpDeliveryUnavailable("Fallaron todos los canales de OTP")


def get_otp_dispatcher() -> OtpDispatcher:
    """Dependencia de FastAPI (los tests la reemplazan por un doble)."""
    return OtpDispatcher(configured_senders())
