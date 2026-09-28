"""Entry point de la API FastAPI de CompraVendeAqui."""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.health import router as health_router
from app.config import settings
from app.core.logging import configure_logging, get_logger

configure_logging()
log = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Ciclo de vida de la app: startup / shutdown."""
    log.info(
        "app.startup",
        project=settings.project_name,
        version=__version__,
        environment=settings.environment,
    )
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

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Health checks (sin prefijo de versión, como esperan los orquestadores)
    app.include_router(health_router)

    return app


app = create_app()
