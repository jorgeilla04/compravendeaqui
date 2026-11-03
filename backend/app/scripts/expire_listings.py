"""Marca como vencidos los avisos con más de 90 días (correr por cron diario).

Uso:  python -m app.scripts.expire_listings
Cron (diario, 4 AM):
    0 4 * * *  cd <backend> && .venv/bin/python -m app.scripts.expire_listings
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import update

from app.database import SessionLocal
from app.models import Listing


def expire() -> int:
    with SessionLocal() as db:
        result = db.execute(
            update(Listing)
            .where(
                Listing.status == "active",
                Listing.deleted_at.is_(None),
                Listing.expires_at <= datetime.now(UTC),
            )
            .values(status="expired")
        )
        db.commit()
        return int(result.rowcount or 0)


if __name__ == "__main__":
    print(f"Avisos vencidos: {expire()}")
