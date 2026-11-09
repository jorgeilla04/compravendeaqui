"""Proveedores OTP: el request que sale hacia Meta y Twilio es el correcto."""

from __future__ import annotations

import json
import smtplib
from email.message import EmailMessage

import httpx
import pytest
import respx

from app.config import Settings
from app.services.otp_delivery import (
    EmailOtpSender,
    OtpDeliveryError,
    OtpDeliveryUnavailable,
    OtpDispatcher,
    TwilioSmsSender,
    WhatsAppCloudSender,
    configured_senders,
)

PHONE = "+5492644123456"


def wa_settings(**kw: object) -> Settings:
    base: dict[str, object] = dict(
        whatsapp_phone_number_id="1234567890",
        whatsapp_access_token="EAAG-token",
        whatsapp_otp_template_name="codigo_ingreso",
        whatsapp_otp_template_language="es_AR",
        whatsapp_api_version="v21.0",
    )
    base.update(kw)
    return Settings(**base)  # type: ignore[arg-type]


def twilio_settings(**kw: object) -> Settings:
    base: dict[str, object] = dict(
        twilio_account_sid="AC123",
        twilio_auth_token="secret",
        twilio_messaging_service_sid="MG456",
    )
    base.update(kw)
    return Settings(**base)  # type: ignore[arg-type]


@respx.mock
def test_whatsapp_sends_authentication_template() -> None:
    route = respx.post("https://graph.facebook.com/v21.0/1234567890/messages").mock(
        return_value=httpx.Response(200, json={"messages": [{"id": "wamid.ABC"}]})
    )
    message_id = WhatsAppCloudSender(wa_settings()).send(PHONE, "482913")

    assert message_id == "wamid.ABC"
    request = route.calls.last.request
    assert request.headers["Authorization"] == "Bearer EAAG-token"
    body = json.loads(request.content)
    assert body["to"] == "5492644123456"
    assert body["type"] == "template"
    assert body["template"]["name"] == "codigo_ingreso"
    assert body["template"]["language"] == {"code": "es_AR"}
    body_cmp, button_cmp = body["template"]["components"]
    assert body_cmp["parameters"] == [{"type": "text", "text": "482913"}]
    assert button_cmp["sub_type"] == "url"
    assert button_cmp["parameters"] == [{"type": "text", "text": "482913"}]


@respx.mock
def test_whatsapp_api_error_raises() -> None:
    respx.post("https://graph.facebook.com/v21.0/1234567890/messages").mock(
        return_value=httpx.Response(
            400, json={"error": {"code": 132001, "message": "Template does not exist"}}
        )
    )
    with pytest.raises(OtpDeliveryError, match="132001"):
        WhatsAppCloudSender(wa_settings()).send(PHONE, "111111")


@respx.mock
def test_whatsapp_network_error_raises() -> None:
    respx.post("https://graph.facebook.com/v21.0/1234567890/messages").mock(
        side_effect=httpx.ConnectTimeout("timeout")
    )
    with pytest.raises(OtpDeliveryError, match="red"):
        WhatsAppCloudSender(wa_settings()).send(PHONE, "111111")


@respx.mock
def test_twilio_sends_sms_with_messaging_service() -> None:
    route = respx.post(
        "https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json"
    ).mock(return_value=httpx.Response(201, json={"sid": "SM789"}))
    assert TwilioSmsSender(twilio_settings()).send(PHONE, "482913") == "SM789"

    request = route.calls.last.request
    form = dict(httpx.QueryParams(request.content.decode()))
    assert form["To"] == PHONE
    assert form["MessagingServiceSid"] == "MG456"
    assert "482913" in form["Body"]
    assert request.headers["Authorization"].startswith("Basic ")


@respx.mock
def test_twilio_uses_from_number_when_no_service() -> None:
    route = respx.post(
        "https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json"
    ).mock(return_value=httpx.Response(201, json={"sid": "SM1"}))
    TwilioSmsSender(
        twilio_settings(
            twilio_messaging_service_sid="", twilio_from_number="+15005550006"
        )
    ).send(PHONE, "1")
    form = dict(httpx.QueryParams(route.calls.last.request.content.decode()))
    assert form["From"] == "+15005550006"
    assert "MessagingServiceSid" not in form


@respx.mock
def test_twilio_error_raises() -> None:
    respx.post("https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json").mock(
        return_value=httpx.Response(
            400, json={"code": 21211, "message": "Invalid 'To'"}
        )
    )
    with pytest.raises(OtpDeliveryError, match="21211"):
        TwilioSmsSender(twilio_settings()).send(PHONE, "1")


def test_configured_senders_respects_order_and_credentials() -> None:
    both = Settings(
        **{
            **wa_settings().model_dump(
                include={
                    "whatsapp_phone_number_id",
                    "whatsapp_access_token",
                    "whatsapp_otp_template_name",
                }
            ),
            **twilio_settings().model_dump(
                include={
                    "twilio_account_sid",
                    "twilio_auth_token",
                    "twilio_messaging_service_sid",
                }
            ),
            "otp_channels": ["sms", "whatsapp"],
        }
    )
    assert [s.channel for s in configured_senders(both)] == ["sms", "whatsapp"]
    assert configured_senders(Settings(whatsapp_access_token="x")) == []


class Failing:
    channel = "whatsapp"

    def send(self, phone: str, code: str, link: str | None = None) -> str:
        raise OtpDeliveryError("caído")


class Ok:
    channel = "sms"

    def send(self, phone: str, code: str, link: str | None = None) -> str:
        return "SM1"


def test_dispatcher_falls_back_to_next_channel() -> None:
    assert OtpDispatcher([Failing(), Ok()]).send(PHONE, "1") == "sms"


def test_dispatcher_without_channels_is_unavailable() -> None:
    with pytest.raises(OtpDeliveryUnavailable):
        OtpDispatcher([]).send(PHONE, "1")
    with pytest.raises(OtpDeliveryUnavailable):
        OtpDispatcher([Failing()]).send(PHONE, "1")


# --- Email (SMTP) ------------------------------------------------------------


def email_settings(**kw: object) -> Settings:
    base: dict[str, object] = dict(
        login_method="email",
        smtp_host="smtp.test",
        smtp_port=587,
        smtp_username="apikey",
        smtp_password="secreto",
        email_from="CompraVendeAqui <no-responder@compravendeaqui.com.ar>",
    )
    base.update(kw)
    return Settings(**base)  # type: ignore[arg-type]


class FakeSMTP:
    """Doble de smtplib.SMTP: registra lo que haría la conexión real."""

    instances: list[FakeSMTP] = []
    refuse: dict[str, tuple[int, bytes]] = {}
    fail: Exception | None = None

    def __init__(self, host: str, port: int, **kw: object) -> None:
        if FakeSMTP.fail:
            raise FakeSMTP.fail
        self.host, self.port, self.kw = host, port, kw
        self.calls: list[str] = []
        self.sent: list[EmailMessage] = []
        FakeSMTP.instances.append(self)

    def __enter__(self) -> FakeSMTP:
        return self

    def __exit__(self, *exc: object) -> None:
        self.calls.append("quit")

    def starttls(self, **kw: object) -> None:
        self.calls.append("starttls")

    def login(self, user: str, password: str) -> None:
        self.calls.append(f"login:{user}")

    def send_message(self, msg: EmailMessage) -> dict[str, tuple[int, bytes]]:
        self.sent.append(msg)
        return FakeSMTP.refuse


@pytest.fixture
def fake_smtp(monkeypatch: pytest.MonkeyPatch) -> type[FakeSMTP]:
    FakeSMTP.instances, FakeSMTP.refuse, FakeSMTP.fail = [], {}, None
    monkeypatch.setattr(smtplib, "SMTP", FakeSMTP)
    monkeypatch.setattr(smtplib, "SMTP_SSL", FakeSMTP)
    return FakeSMTP


LINK = "https://compravendeaqui.com.ar/ingresar/enlace?t=abc&next=%2Fpublicar"


def test_email_sends_code_and_publish_button(fake_smtp: type[FakeSMTP]) -> None:
    sender = EmailOtpSender(email_settings())
    message_id = sender.send("juan@gmail.com", "482913", LINK)

    smtp = fake_smtp.instances[0]
    assert (smtp.host, smtp.port) == ("smtp.test", 587)
    assert smtp.calls == ["starttls", "login:apikey", "quit"]
    msg = smtp.sent[0]
    assert msg["To"] == "juan@gmail.com"
    assert msg["Subject"] == "482913 es tu código de CompraVendeAqui"
    assert message_id == msg["Message-ID"]
    assert "@compravendeaqui.com.ar>" in message_id
    text = msg.get_body(("plain",)).get_content()  # type: ignore[union-attr]
    page = msg.get_body(("html",)).get_content()  # type: ignore[union-attr]
    assert "482913" in text and LINK in text
    assert "482913" in page
    assert 'href="https://compravendeaqui.com.ar/ingresar/enlace?t=abc&amp;next' in page
    assert "Entrar y publicar mi aviso" in page
    assert "vencen en 15 minutos" in text
    assert "sacar las fotos" in page


def test_email_without_link_has_only_the_code(fake_smtp: type[FakeSMTP]) -> None:
    EmailOtpSender(email_settings()).send("juan@gmail.com", "111222")
    msg = fake_smtp.instances[0].sent[0]
    page = msg.get_body(("html",)).get_content()  # type: ignore[union-attr]
    assert "111222" in page and "Entrar y publicar" not in page


def test_email_ssl_and_no_auth(fake_smtp: type[FakeSMTP]) -> None:
    EmailOtpSender(
        email_settings(smtp_security="ssl", smtp_port=465, smtp_username="")
    ).send("juan@gmail.com", "111222", LINK)
    smtp = fake_smtp.instances[0]
    assert smtp.port == 465 and "context" in smtp.kw
    assert smtp.calls == ["quit"]


def test_email_errors_become_delivery_errors(fake_smtp: type[FakeSMTP]) -> None:
    sender = EmailOtpSender(email_settings())
    fake_smtp.fail = smtplib.SMTPAuthenticationError(535, b"bad credentials")
    with pytest.raises(OtpDeliveryError, match="SMTPAuthenticationError"):
        sender.send("juan@gmail.com", "111222", LINK)
    fake_smtp.fail = ConnectionRefusedError(61, "connection refused")
    with pytest.raises(OtpDeliveryError, match="ConnectionRefusedError code=61"):
        sender.send("juan@gmail.com", "111222", LINK)
    fake_smtp.fail = smtplib.SMTPRecipientsRefused(
        {"juan@gmail.com": (550, b"no such user")}
    )
    with pytest.raises(OtpDeliveryError) as refused_exc:
        sender.send("juan@gmail.com", "111222", LINK)
    # Los logs nunca llevan el email completo.
    assert "juan@gmail.com" not in str(refused_exc.value)
    fake_smtp.fail = None
    fake_smtp.refuse = {"juan@gmail.com": (550, b"no such user")}
    with pytest.raises(OtpDeliveryError, match="rechazado") as partial:
        sender.send("juan@gmail.com", "111222", LINK)
    assert "ju***@gmail.com" in str(partial.value)
    assert "juan@gmail.com" not in str(partial.value)


def test_configured_senders_follow_login_method() -> None:
    assert [s.channel for s in configured_senders(email_settings())] == ["email"]
    assert configured_senders(email_settings(smtp_host="")) == []
    # Con ingreso por email, WhatsApp configurado no se usa (queda oculto).
    both = email_settings(
        whatsapp_phone_number_id="1",
        whatsapp_access_token="t",
        whatsapp_otp_template_name="x",
    )
    assert [s.channel for s in configured_senders(both)] == ["email"]
    both.login_method = "phone"
    assert [s.channel for s in configured_senders(both)] == ["whatsapp"]


def test_dispatcher_passes_the_link_to_email(fake_smtp: type[FakeSMTP]) -> None:
    dispatcher = OtpDispatcher(configured_senders(email_settings()))
    assert dispatcher.send("juan@gmail.com", "482913", LINK) == "email"
    msg = fake_smtp.instances[0].sent[0]
    assert LINK in msg.get_body(("plain",)).get_content()  # type: ignore[union-attr]
