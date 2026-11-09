"""Configuración central de la aplicación (pydantic-settings).

Las variables se leen de entorno o de un archivo .env. Ver .env.example.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

_DEV_JWT_SECRET = "dev-only-change-me-dev-only-change-me"  # nosec - solo dev


class Settings(BaseSettings):
    """Configuración tipada de la aplicación."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Entorno
    environment: str = "development"
    debug: bool = True

    # API
    project_name: str = "CompraVendeAqui"
    api_v1_prefix: str = "/api/v1"
    # URL pública del frontend: links de avisos, sitemap y mensaje de WhatsApp.
    public_site_url: str = "http://localhost:3000"

    # Infraestructura
    database_url: str = "postgresql+psycopg://admin:password@localhost:5432/compravende"
    redis_url: str = "redis://localhost:6379/0"
    # Loguea cada query SQL (solo para depurar).
    sql_echo: bool = False

    # CORS: coma-separado en el env, lista en el código.
    # NoDecode evita que pydantic-settings intente parsear el valor como JSON;
    # el _split_cors_origins de abajo hace el split por comas.
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:3000"]
    )

    # Logging
    log_level: str = "INFO"

    # --- Auth / JWT ---
    jwt_secret_key: str = _DEV_JWT_SECRET
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 15
    refresh_token_ttl_days: int = 7
    # Cookies httpOnly con los tokens (el frontend no toca los JWT).
    cookie_secure: bool = False
    cookie_domain: str | None = None
    # IPs o rangos CIDR de los proxies (Nginx) cuyo X-Real-IP se respeta.
    trusted_proxies: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["127.0.0.1", "::1"]
    )
    bcrypt_rounds: int = 12

    # Bloqueo por intentos fallidos (OTP y password)
    auth_max_attempts: int = 5
    auth_lock_minutes: int = 30

    # --- OTP ---
    # Con qué se ingresa: "email" (código + link por mail) o "phone"
    # (WhatsApp/SMS). Es el único interruptor: el frontend lo lee de
    # GET /auth/methods.
    login_method: Literal["email", "phone"] = "email"
    otp_length: int = 6
    otp_ttl_minutes: int = 5
    # El mail puede demorar o abrirse después en otro dispositivo.
    email_otp_ttl_minutes: int = 15
    otp_resend_cooldown_seconds: int = 60
    otp_max_sends_per_hour: int = 5
    # Pedidos de OTP por IP y por hora (anti-abuso del costo de envío).
    otp_max_requests_per_ip_hour: int = 20
    # Canales en orden de preferencia: si el primero falla se usa el siguiente.
    otp_channels: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["whatsapp", "sms"]
    )

    # WhatsApp Cloud API (Meta) — plantilla de categoría AUTHENTICATION
    whatsapp_api_base_url: str = "https://graph.facebook.com"
    whatsapp_api_version: str = "v21.0"
    whatsapp_phone_number_id: str = ""
    whatsapp_access_token: str = ""
    whatsapp_otp_template_name: str = ""
    whatsapp_otp_template_language: str = "es_AR"

    # Twilio Programmable Messaging (SMS de respaldo)
    twilio_api_base_url: str = "https://api.twilio.com"
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    # Uno de los dos: número remitente o Messaging Service.
    twilio_from_number: str = ""
    twilio_messaging_service_sid: str = ""

    # Email (SMTP): sirve cualquier proveedor (Gmail, Brevo, Resend, SES...).
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    # "starttls" (puerto 587), "ssl" (puerto 465) o "none" (solo pruebas locales).
    smtp_security: Literal["starttls", "ssl", "none"] = "starttls"
    # Remitente, ej: "CompraVendeAqui <no-responder@compravendeaqui.com.ar>"
    email_from: str = ""
    # Adónde lleva el link del mail si el usuario no venía de otra página.
    email_link_default_next: str = "/publicar"

    # --- Mercado Pago (Checkout Pro) ---
    # El Access Token vive solo en el backend; nunca llega al navegador.
    mp_access_token: str = ""
    # Clave secreta de las notificaciones (Tus integraciones → Webhooks):
    # si está, se valida la firma x-signature de cada aviso.
    mp_webhook_secret: str = ""
    mp_api_base_url: str = "https://api.mercadopago.com"
    # Texto que ve el comprador en el resumen de la tarjeta (máx. 22).
    mp_statement_descriptor: str = "COMPRAVENDEAQUI"

    # --- Cotización USD/ARS ---
    fx_api_url: str = "https://dolarapi.com/v1/dolares/blue"
    # Campo del JSON que se usa como cotización ("venta" o "compra").
    fx_rate_field: str = "venta"
    fx_cache_minutes: int = 30

    # --- Almacenamiento de imágenes (S3 compatible: AWS S3, MinIO, R2) ---
    s3_endpoint_url: str | None = None
    s3_region: str = "us-east-1"
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    s3_bucket: str = "compravende-media"
    # Base pública desde donde se sirven los objetos (CDN o bucket público).
    s3_public_base_url: str = ""
    image_max_upload_mb: int = 10
    image_max_per_listing: int = 10

    # --- Avisos ---
    listing_ttl_days: int = 90

    @field_validator("cors_origins", "otp_channels", "trusted_proxies", mode="before")
    @classmethod
    def _split_csv(cls, value: object) -> object:
        """Permite pasar listas como cadena separada por comas."""
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @model_validator(mode="after")
    def _check_production_secrets(self) -> Settings:
        if self.is_production and (
            self.jwt_secret_key == _DEV_JWT_SECRET or len(self.jwt_secret_key) < 32
        ):
            raise ValueError(
                "JWT_SECRET_KEY es obligatorio en producción (mínimo 32 caracteres)"
            )
        if self.is_production and not self.cookie_secure:
            raise ValueError("COOKIE_SECURE=true es obligatorio en producción")
        if self.is_production and self.mp_access_token and not self.mp_webhook_secret:
            raise ValueError(
                "MP_WEBHOOK_SECRET es obligatorio en producción si MP_ACCESS_TOKEN "
                "está configurado (Mercado Pago → Tus integraciones → Webhooks)"
            )
        return self

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def whatsapp_configured(self) -> bool:
        return bool(
            self.whatsapp_phone_number_id
            and self.whatsapp_access_token
            and self.whatsapp_otp_template_name
        )

    @property
    def twilio_configured(self) -> bool:
        return bool(
            self.twilio_account_sid
            and self.twilio_auth_token
            and (self.twilio_from_number or self.twilio_messaging_service_sid)
        )

    def otp_ttl_for(self, destination: str) -> int:
        """Minutos de vigencia del código según el canal (email o teléfono)."""
        return (
            self.email_otp_ttl_minutes if "@" in destination else self.otp_ttl_minutes
        )

    @property
    def email_configured(self) -> bool:
        return bool(self.smtp_host and self.email_from)

    @property
    def mp_configured(self) -> bool:
        return bool(self.mp_access_token)

    @property
    def s3_configured(self) -> bool:
        return bool(self.s3_access_key_id and self.s3_secret_access_key)


@lru_cache
def get_settings() -> Settings:
    """Devuelve una instancia cacheada de Settings."""
    return Settings()


settings = get_settings()
