"""Rate limiting y bloqueos con Redis (ventana fija, atómico)."""

from __future__ import annotations

import ipaddress
from functools import lru_cache

from fastapi import HTTPException, Request, status

from app.config import settings
from app.core.redis import get_redis


def hit(key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
    """Cuenta un evento. Devuelve (permitido, segundos hasta el reset)."""
    r = get_redis()
    pipe = r.pipeline()
    pipe.incr(key)
    pipe.expire(key, window_seconds, nx=True)
    pipe.ttl(key)
    count, _, ttl = pipe.execute()
    return int(count) <= limit, max(int(ttl), 0)


def enforce(key: str, limit: int, window_seconds: int, detail: str) -> None:
    allowed, retry_after = hit(key, limit, window_seconds)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=detail,
            headers={"Retry-After": str(retry_after)},
        )


@lru_cache
def _trusted_networks(
    entries: tuple[str, ...],
) -> tuple[ipaddress.IPv4Network | ipaddress.IPv6Network, ...]:
    return tuple(ipaddress.ip_network(e, strict=False) for e in entries)


def is_trusted_proxy(peer: str | None) -> bool:
    """IP exacta o rango CIDR de TRUSTED_PROXIES (p. ej. 172.16.0.0/12 en Docker)."""
    if not peer:
        return False
    if peer in settings.trusted_proxies:
        return True
    try:
        address = ipaddress.ip_address(peer)
        networks = _trusted_networks(tuple(settings.trusted_proxies))
    except ValueError:
        return False
    return any(address in network for network in networks)


def client_ip(request: Request) -> str:
    """IP real del cliente.

    X-Real-IP solo se respeta si la conexión viene de un proxy de confianza
    (TRUSTED_PROXIES); si no, cualquiera podría falsificarlo para saltear los
    límites. Si Nginx no está en la lista, todas las requests parecen venir de
    su IP y comparten el límite: por eso se loguea la primera vez.
    """
    peer = request.client.host if request.client else None
    forwarded = request.headers.get("x-real-ip")
    if forwarded and is_trusted_proxy(peer):
        return forwarded.strip()
    if forwarded:
        _warn_untrusted_proxy(peer)
    return peer or "unknown"


@lru_cache(maxsize=32)
def _warn_untrusted_proxy(peer: str | None) -> None:
    from app.core.logging import get_logger

    get_logger(__name__).warning(
        "ratelimit.untrusted_proxy",
        peer=peer,
        hint="Llega X-Real-IP desde una IP fuera de TRUSTED_PROXIES; "
        "agregá la IP o el rango del proxy.",
    )


class Lockout:
    """Bloqueo tras N fallos (OTP y password): 5 intentos → 30 min."""

    def __init__(self, scope: str, identifier: str, max_attempts: int, minutes: int):
        self.fail_key = f"lock:{scope}:fails:{identifier}"
        self.lock_key = f"lock:{scope}:locked:{identifier}"
        self.max_attempts = max_attempts
        self.seconds = minutes * 60

    def remaining_lock(self) -> int:
        ttl = int(get_redis().ttl(self.lock_key))
        return ttl if ttl > 0 else 0

    def ensure_not_locked(self) -> None:
        remaining = self.remaining_lock()
        if remaining:
            minutes = max(1, remaining // 60)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    "Demasiados intentos fallidos. Probá de nuevo en " f"{minutes} min."
                ),
                headers={"Retry-After": str(remaining)},
            )

    def register_failure(self) -> int:
        """Registra un fallo; devuelve los intentos restantes (0 = bloqueado)."""
        r = get_redis()
        fails = int(r.incr(self.fail_key))
        r.expire(self.fail_key, self.seconds, nx=True)
        if fails >= self.max_attempts:
            r.set(self.lock_key, "1", ex=self.seconds)
            r.delete(self.fail_key)
            return 0
        return self.max_attempts - fails

    def reset(self) -> None:
        get_redis().delete(self.fail_key, self.lock_key)
