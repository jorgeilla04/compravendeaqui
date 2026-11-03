"""Proveedores OTP: el request que sale hacia Meta y Twilio es el correcto."""

from __future__ import annotations

import json

import httpx
import pytest
import respx

from app.config import Settings
from app.services.otp_delivery import (
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

    def send(self, phone: str, code: str) -> str:
        raise OtpDeliveryError("caído")


class Ok:
    channel = "sms"

    def send(self, phone: str, code: str) -> str:
        return "SM1"


def test_dispatcher_falls_back_to_next_channel() -> None:
    assert OtpDispatcher([Failing(), Ok()]).send(PHONE, "1") == "sms"


def test_dispatcher_without_channels_is_unavailable() -> None:
    with pytest.raises(OtpDeliveryUnavailable):
        OtpDispatcher([]).send(PHONE, "1")
    with pytest.raises(OtpDeliveryUnavailable):
        OtpDispatcher([Failing()]).send(PHONE, "1")
