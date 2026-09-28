"""Logging estructurado con structlog.

En desarrollo usa salida coloreada legible; en producción, JSON para que
los agregadores (Sentry, etc.) lo parseen.
"""

from __future__ import annotations

import logging
import sys

import structlog

from app.config import settings


def configure_logging() -> None:
    """Configura structlog + stdlib logging una sola vez al arrancar."""
    log_level = getattr(logging, settings.log_level.upper(), logging.INFO)

    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=log_level,
    )

    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
    ]

    if settings.is_production:
        renderer: structlog.types.Processor = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer()

    structlog.configure(
        processors=[*shared_processors, renderer],
        wrapper_class=structlog.make_filtering_bound_logger(log_level),
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    """Devuelve un logger estructurado."""
    return structlog.get_logger(name)
