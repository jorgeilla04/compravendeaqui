"""Middlewares de seguridad: chequeo de Origin (CSRF) y headers."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from urllib.parse import urlsplit

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings

UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


class OriginCheckMiddleware(BaseHTTPMiddleware):
    """Defensa CSRF para la sesión por cookie.

    Las cookies son SameSite=Lax; además, toda request que modifica estado
    debe venir de un origen propio (CORS_ORIGINS). Si usa la sesión por cookie
    y no trae Origin ni Referer, se rechaza. Los clientes sin navegador usan
    Bearer y no son vulnerables a CSRF.
    """

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        if request.method in UNSAFE_METHODS:
            origin = request.headers.get("origin") or _origin_of(
                request.headers.get("referer")
            )
            uses_cookie_session = not request.headers.get("authorization") and bool(
                request.cookies
            )
            if origin is None and uses_cookie_session:
                # Sesión por cookie sin Origin ni Referer: no se puede verificar.
                return _forbidden()
            if origin is not None and origin not in settings.cors_origins:
                return _forbidden()
        return await call_next(request)


def _origin_of(url: str | None) -> str | None:
    if not url:
        return None
    parts = urlsplit(url)
    if not parts.scheme or not parts.netloc:
        return None
    return f"{parts.scheme}://{parts.netloc}"


def _forbidden() -> JSONResponse:
    return JSONResponse(status_code=403, content={"detail": "Origen no permitido"})


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
