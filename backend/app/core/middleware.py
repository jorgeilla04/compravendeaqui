"""Middlewares de seguridad: chequeo de Origin (CSRF) y headers."""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings

UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


class OriginCheckMiddleware(BaseHTTPMiddleware):
    """Defensa CSRF para la sesión por cookie.

    Las cookies son SameSite=Lax; además, toda request que modifica estado y
    trae Origin/Referer debe venir de un origen propio (CORS_ORIGINS).
    Clientes sin navegador (sin Origin) usan Bearer y no son vulnerables.
    """

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        if request.method in UNSAFE_METHODS:
            origin = request.headers.get("origin")
            if origin is None:
                referer = request.headers.get("referer")
                if referer:
                    parts = referer.split("/")
                    origin = "/".join(parts[:3]) if len(parts) >= 3 else referer
            if origin is not None and origin not in settings.cors_origins:
                return JSONResponse(
                    status_code=403, content={"detail": "Origen no permitido"}
                )
        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault(
            "Referrer-Policy", "strict-origin-when-cross-origin"
        )
        if settings.is_production:
            response.headers.setdefault(
                "Strict-Transport-Security", "max-age=63072000; includeSubDomains"
            )
        return response
