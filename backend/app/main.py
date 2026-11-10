"""Entry point de la API FastAPI de CompraVendeAqui."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.health import router as health_router
from app.api.v1.router import api_router
from app.config import settings
from app.core.logging import configure_logging, get_logger
from app.core.middleware import OriginCheckMiddleware, SecurityHeadersMiddleware
from app.services.otp_delivery import configured_senders

configure_logging()
log = get_logger(__name__)


def _log_integrations() -> None:
    """Deja claro al arrancar qué integraciones externas están conectadas."""
    channels = [s.channel for s in configured_senders()]
    if channels:
        log.info("integrations.otp", channels=channels)
    else:
        faltan = (
            "SMTP_HOST y EMAIL_FROM"
            if settings.login_method == "email"
            else "WHATSAPP_* y/o TWILIO_*"
        )
        log.warning(
            "integrations.otp_not_configured",
            hint=f"Configurá {faltan} en .env: el ingreso por código "
            "responde 503 hasta entonces.",
        )
    if not settings.s3_configured:
        log.warning(
            "integrations.storage_not_configured",
            hint="Configurá S3_* en .env para poder subir fotos.",
        )
    if not settings.mp_configured:
        log.warning(
            "integrations.mercadopago_not_configured",
            hint="Configurá MP_ACCESS_TOKEN y MP_WEBHOOK_SECRET en .env: hasta "
            "entonces las tiendas toman pedidos pero no cobran online.",
        )


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Ciclo de vida de la app: startup / shutdown."""
    log.info(
        "app.startup",
        project=settings.project_name,
        version=__version__,
        environment=settings.environment,
    )
    _log_integrations()
    yield
    log.info("app.shutdown")


def create_app() -> FastAPI:
    """Fábrica de la aplicación FastAPI."""
    app = FastAPI(
        title=settings.project_name,
        version=__version__,
        docs_url="/docs" if not settings.is_production else None,
        redoc_url=None,
        lifespan=lifespan,
    )

    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(OriginCheckMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

    # Health checks (sin prefijo de versión, como esperan los orquestadores)
    app.include_router(health_router)
    app.include_router(api_router, prefix=settings.api_v1_prefix)

    return app


app = create_app()
