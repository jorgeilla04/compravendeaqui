"""Envío de mails por SMTP (cualquier proveedor: Gmail, Brevo, Resend, SES...)."""

from __future__ import annotations

import smtplib
import ssl
from email.message import EmailMessage
from email.utils import make_msgid

from app.config import Settings, settings
from app.core.phone import mask_destination

SMTP_TIMEOUT = 15


class MailError(Exception):
    """No se pudo entregar el mail (sin direcciones en el mensaje: va a logs)."""


def new_message(to: str, subject: str, config: Settings = settings) -> EmailMessage:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = config.email_from
    msg["To"] = to
    domain = config.email_from.rpartition("@")[2].strip("> ") or None
    msg["Message-ID"] = make_msgid(domain=domain)
    return msg


def send(msg: EmailMessage, config: Settings = settings) -> str:
    """Manda el mail y devuelve su Message-ID."""
    c = config
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
        raise MailError(f"{type(exc).__name__} code={err}") from exc
    if refused:
        codes = {mask_destination(addr): e[0] for addr, e in refused.items()}
        raise MailError(f"destinatario rechazado {codes}")
    return str(msg["Message-ID"])
