"""Endpoints de salud: liveness (/health) y readiness (/health/ready)."""

from __future__ import annotations

import redis
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app import __version__
from app.config import settings
from app.core.logging import get_logger
from app.database import check_database

router = APIRouter(tags=["health"])
log = get_logger(__name__)


@router.get("/health", summary="Liveness probe")
def health() -> dict[str, str]:
    """Liveness: el proceso está vivo. Siempre 200, sin dependencias."""
    return {
        "status": "ok",
        "service": settings.project_name,
        "version": __version__,
        "environment": settings.environment,
    }


@router.get("/health/ready", summary="Readiness probe")
def readiness() -> JSONResponse:
    """Readiness: verifica dependencias (PostgreSQL y Redis)."""
    checks: dict[str, str] = {}
    healthy = True

    try:
        check_database()
        checks["database"] = "ok"
    except Exception as exc:  # noqa: BLE001 - reportamos el estado, no rompemos
        healthy = False
        checks["database"] = "error"
        log.warning("readiness.database_failed", error=str(exc))

    try:
        client = redis.from_url(settings.redis_url, socket_connect_timeout=2)
        client.ping()
        checks["redis"] = "ok"
    except Exception as exc:  # noqa: BLE001
        healthy = False
        checks["redis"] = "error"
        log.warning("readiness.redis_failed", error=str(exc))

    status_code = 200 if healthy else 503
    return JSONResponse(
        status_code=status_code,
        content={"status": "ok" if healthy else "degraded", "checks": checks},
    )
