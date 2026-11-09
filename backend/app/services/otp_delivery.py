"""Envío de códigos OTP por email (SMTP), WhatsApp Cloud API (Meta) y SMS (Twilio).

Cada proveedor es una integración real contra el servicio. Se activan solo con
configurar sus variables de entorno (ver .env.example). LOGIN_METHOD elige el
canal: "email" manda el código y un link para entrar directo; "phone" prueba
los canales de OTP_CHANNELS en orden y usa el siguiente si uno falla.
"""

from __future__ import annotations

import html
import smtplib
import ssl
from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import make_msgid
from typing import Any, Protocol

import httpx

from app.config import Settings, settings
from app.core.logging import get_logger
from app.core.phone import mask_destination, wa_digits

log = get_logger(__name__)

HTTP_TIMEOUT = httpx.Timeout(10.0, connect=5.0)
SMTP_TIMEOUT = 15


class OtpDeliveryError(Exception):
    """Un proveedor no pudo entregar el código."""


class OtpDeliveryUnavailable(Exception):
    """No hay ningún canal configurado o fallaron todos."""


class OtpSender(Protocol):
    channel: str

    def send(self, destination: str, code: str, link: str | None = None) -> str:
        """Envía el código (y el link, si el canal lo admite).

        Devuelve el id de mensaje del proveedor.
        """
        ...


@dataclass
class EmailOtpSender:
    """Mail con el código y un botón que entra directo (link de un solo uso)."""

    config: Settings
    channel: str = "email"

    def message(self, destination: str, code: str, link: str | None) -> EmailMessage:
        minutes = self.config.email_otp_ttl_minutes
        msg = EmailMessage()
        msg["Subject"] = f"{code} es tu código de CompraVendeAqui"
        msg["From"] = self.config.email_from
        msg["To"] = destination
        domain = self.config.email_from.rpartition("@")[2].strip("> ") or None
        msg["Message-ID"] = make_msgid(domain=domain)

        lines = [
            "¡Hola!",
            "",
            f"Tu código para ingresar a CompraVendeAqui es: {code}",
            "",
        ]
        if link:
            lines += [
                "O tocá este link y entrás directo a publicar tu aviso.",
                "Si lo abrís en el celular, podés sacar las fotos en el momento:",
                link,
                "",
            ]
        lines += [
            f"El código y el link vencen en {minutes} minutos y sirven una sola vez.",
            "Si no pediste ingresar, ignorá este mail: nadie puede entrar sin él.",
        ]
        msg.set_content("\n".join(lines))
        msg.add_alternative(_email_html(code, link, minutes), subtype="html")
        return msg

    def send(self, destination: str, code: str, link: str | None = None) -> str:
        c = self.config
        msg = self.message(destination, code, link)
        try:
            smtp: smtplib.SMTP
            if c.smtp_security == "ssl":
                smtp = smtplib.SMTP_SSL(
                    c.smtp_host,
                    c.smtp_port,
                    timeout=SMTP_TIMEOUT,
                    context=ssl.create_default_context(),
                )
            else:
                smtp = smtplib.SMTP(c.smtp_host, c.smtp_port, timeout=SMTP_TIMEOUT)
            with smtp:
                if c.smtp_security == "starttls":
                    smtp.starttls(context=ssl.create_default_context())
                if c.smtp_username:
                    smtp.login(c.smtp_username, c.smtp_password)
                refused = smtp.send_message(msg)
        except (smtplib.SMTPException, OSError) as exc:
            # Sin str(exc): algunos errores SMTP incluyen las direcciones.
            err = getattr(exc, "smtp_code", None) or getattr(exc, "errno", None)
            raise OtpDeliveryError(f"email: {type(exc).__name__} code={err}") from exc
        if refused:
            codes = {mask_destination(addr): err[0] for addr, err in refused.items()}
            raise OtpDeliveryError(f"email: destinatario rechazado {codes}")
        return str(msg["Message-ID"])


def _email_html(code: str, link: str | None, minutes: int) -> str:
    """HTML simple con estilos en línea (los clientes de mail no leen CSS)."""
    button = ""
    if link:
        href = html.escape(link, quote=True)
        button = f"""
      <tr><td style="padding:8px 0 4px">
        <a href="{href}" style="display:inline-block;background:#15803d;color:#ffffff;
          font-weight:700;font-size:17px;text-decoration:none;padding:14px 28px;
          border-radius:10px">Entrar y publicar mi aviso</a>
      </td></tr>
      <tr><td style="padding:4px 0 20px;color:#475569;font-size:14px;line-height:1.5">
        Si lo abrís en el celular, podés sacar las fotos en el momento.
      </td></tr>"""
    return f"""<!DOCTYPE html>
<html lang="es"><body style="margin:0;background:#eff6ff;
  font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
    style="background:#eff6ff;padding:24px 12px">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0"
      style="max-width:480px;width:100%;background:#ffffff;
      border-radius:14px;padding:28px">
      <tr><td style="color:#1e40af;font-size:22px;font-weight:700;padding-bottom:12px">
        CompraVendeAqui
      </td></tr>
      <tr><td style="color:#1e293b;font-size:16px;line-height:1.5;padding-bottom:8px">
        Tu código para ingresar es:
      </td></tr>
      <tr><td style="color:#1e40af;font-size:34px;font-weight:700;
        letter-spacing:8px;padding-bottom:20px">{html.escape(code)}</td></tr>{button}
      <tr><td style="color:#475569;font-size:13px;line-height:1.5;
        border-top:1px solid #e2e8f0;padding-top:16px">
        El código y el link vencen en {minutes} minutos y sirven una sola vez.
        Si no pediste ingresar, ignorá este mail: nadie puede entrar sin él.
      </td></tr>
    </table>
  </td></tr></table>
</body></html>"""


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

    def send(self, destination: str, code: str, link: str | None = None) -> str:
        try:
            response = httpx.post(
                self.url,
                json=self.payload(destination, code),
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

    def send(self, destination: str, code: str, link: str | None = None) -> str:
        try:
            response = httpx.post(
                self.url,
                data=self.form(destination, code),
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
    """Proveedores configurados para LOGIN_METHOD (teléfono: orden de OTP_CHANNELS)."""
    if config.login_method == "email":
        return [EmailOtpSender(config)] if config.email_configured else []
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

    def send(self, destination: str, code: str, link: str | None = None) -> str:
        if not self.senders:
            raise OtpDeliveryUnavailable("No hay ningún canal de OTP configurado")
        for sender in self.senders:
            try:
                message_id = sender.send(destination, code, link)
            except OtpDeliveryError as exc:
                log.warning(
                    "otp.delivery_failed",
                    channel=sender.channel,
                    to=mask_destination(destination),
                    error=str(exc),
                )
                continue
            log.info(
                "otp.sent",
                channel=sender.channel,
                to=mask_destination(destination),
                message_id=message_id,
            )
            return sender.channel
        raise OtpDeliveryUnavailable("Fallaron todos los canales de OTP")


def get_otp_dispatcher() -> OtpDispatcher:
    """Dependencia de FastAPI (los tests la reemplazan por un doble)."""
    return OtpDispatcher(configured_senders())
