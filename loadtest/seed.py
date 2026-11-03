"""Carga avisos de prueba para la prueba de carga y los e2e.

Uso (con el entorno de e2e):  source e2e/env.sh && \
    backend/.venv/bin/python loadtest/seed.py 2000
"""

from __future__ import annotations

import random
import sys
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from sqlalchemy import select  # noqa: E402

from app.core.constants import DEPARTMENTS  # noqa: E402
from app.core.slug import unique_listing_slug  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models import Category, Listing, User  # noqa: E402

PRODUCTS = [
    ("Toyota Corolla XEI {y}", "autos", "USD", (9000, 25000)),
    ("Volkswagen Gol Trend {y}", "autos", "USD", (5000, 12000)),
    ("Ford Ranger XLT {y}", "camionetas", "USD", (15000, 40000)),
    ("Honda Wave 110 {y}", "motos", "ARS", (900000, 2500000)),
    ("Heladera Whirlpool No Frost", "electrodomesticos", "ARS", (300000, 900000)),
    ("Lavarropas Drean automático", "electrodomesticos", "ARS", (250000, 700000)),
    ("Samsung Galaxy A{n}", "celulares", "ARS", (150000, 700000)),
    ("iPhone {n} 128 GB", "celulares", "USD", (300, 1200)),
    ("Notebook Lenovo IdeaPad {n}", "computacion", "ARS", (500000, 1500000)),
    ("Sillón de 3 cuerpos", "muebles", "ARS", (150000, 600000)),
    ("Bicicleta rodado 29", "bicicletas", "ARS", (200000, 800000)),
    ("Casa 3 dormitorios con patio", "casas", "USD", (40000, 150000)),
    ("Terreno 300 m² con servicios", "terrenos-y-lotes", "USD", (8000, 40000)),
    ("Taladro percutor Bosch", "herramientas", "ARS", (60000, 200000)),
]
DESCRIPTIONS = [
    "Impecable, poco uso. Se entrega con caja y factura.",
    "Funciona perfecto. Se puede ver y probar sin compromiso.",
    "Único dueño, todo al día. Acepto permuta menor valor.",
    "Buen estado general, detalles mínimos de uso.",
]


def main(count: int) -> None:
    random.seed(42)
    with SessionLocal() as db:
        cats = {c.slug: c.id for c in db.scalars(select(Category))}
        users = []
        for i in range(20):
            phone = f"+549264500{i:04d}"
            user = db.scalars(select(User).where(User.phone == phone)).first()
            if user is None:
                user = User(
                    phone=phone,
                    phone_verified=True,
                    email_verified=False,
                    username=f"demo{i:02d}",
                    full_name=f"Vendedor Demo {i}",
                    role="user",
                    whatsapp_optin=True,
                    profile_pending=False,
                    is_active=True,
                )
                db.add(user)
            users.append(user)
        db.flush()
        now = datetime.now(UTC)
        for i in range(count):
            template, cat, currency, (low, high) = random.choice(PRODUCTS)
            title = template.format(y=random.randint(2010, 2024), n=random.randint(10, 15))
            price = Decimal(random.randint(low, high))
            created = now - timedelta(minutes=random.randint(0, 60 * 24 * 60))
            db.add(
                Listing(
                    user_id=random.choice(users).id,
                    category_id=cats[cat],
                    title=title,
                    slug=unique_listing_slug(title),
                    description=random.choice(DESCRIPTIONS),
                    price=price,
                    price_currency=currency,
                    price_usd_ref=price if currency == "USD" else (price / 1200).quantize(Decimal("0.01")),
                    fx_rate_at_publish=Decimal("1200"),
                    condition=random.choice(["nuevo", "usado", "usado", "reacondicionado"]),
                    department=random.choice(DEPARTMENTS),
                    status="active",
                    views_count=0,
                    contacts_count=0,
                    is_featured=False,
                    created_at=created,
                    updated_at=created,
                    expires_at=created + timedelta(days=90),
                )
            )
            if i % 500 == 499:
                db.flush()
        db.commit()
    print(f"{count} avisos cargados")


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 2000)
