"""Cliente Redis compartido (cache, rate limiting, bloqueos)."""

from __future__ import annotations

from functools import lru_cache
from typing import Any

import redis

from app.config import settings


@lru_cache
def get_redis() -> Any:
    # Any: los stubs de redis-py tipan los métodos sync como `Awaitable | Any`.
    return redis.Redis.from_url(
        settings.redis_url, decode_responses=True, socket_connect_timeout=2
    )
