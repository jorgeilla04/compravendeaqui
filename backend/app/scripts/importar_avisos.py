"""Publica avisos en lote a nombre de un usuario desde un archivo JSON.

Uso:
  python -m app.scripts.importar_avisos lista.json [--dry-run]

El JSON trae el usuario y los avisos; las fotos son rutas relativas al JSON:
  {"usuario": "virginia",
   "avisos": [{"titulo": "...", "descripcion": "...", "categoria": "electrodomesticos",
               "precio": 319999, "condicion": "nuevo", "departamento": "Capital",
               "ubicacion": "...", "fotos": ["fotos/a.jpg"]}]}

Se puede correr de nuevo: un aviso del usuario con el mismo título no se
duplica, se le actualizan precio, descripción y rubro.
"""

from __future__ import annotations

import argparse
import json
from decimal import Decimal
from pathlib import Path
from typing import Any

from sqlalchemy import select

from app.config import settings
from app.database import SessionLocal
from app.models import Category, Listing, User
from app.schemas.listing import ListingCreate, ListingUpdate
from app.services import listings as service


def main(argv: list[str] | None = None) -> str:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("archivo", type=Path)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)
    data: dict[str, Any] = json.loads(args.archivo.read_text())
    base = args.archivo.parent
    creados = actualizados = 0
    with SessionLocal() as db:
        user = db.scalars(select(User).where(User.username == data["usuario"])).first()
        if user is None:
            raise SystemExit(f"No existe el usuario {data['usuario']}")
        categorias = {c.slug: c.id for c in db.scalars(select(Category))}
        existentes = {
            listing.title: listing
            for listing in db.scalars(
                select(Listing).where(
                    Listing.user_id == user.id, Listing.deleted_at.is_(None)
                )
            )
        }
        for item in data["avisos"]:
            if item["categoria"] not in categorias:
                raise SystemExit(f"Rubro desconocido: {item['categoria']}")
            fotos = [base / f for f in item.get("fotos", [])]
            for foto in fotos:
                if not foto.is_file():
                    raise SystemExit(f"No encuentro la foto {foto}")
            alta = ListingCreate(
                title=item["titulo"],
                description=item["descripcion"],
                category_id=categorias[item["categoria"]],
                price=Decimal(item["precio"]) if item.get("precio") else None,
                condition=item.get("condicion", "nuevo"),
                department=item["departamento"],
                location=item.get("ubicacion"),
            )
            if args.dry_run:
                continue
            previo = existentes.get(alta.title)
            if previo is not None:
                service.update_listing(
                    db,
                    previo,
                    ListingUpdate(
                        price=alta.price,
                        description=alta.description,
                        category_id=alta.category_id,
                    ),
                )
                actualizados += 1
                continue
            listing = service.create(db, user, alta)
            for orden, foto in enumerate(fotos[: settings.image_max_per_listing]):
                listing.images.append(
                    service.store_image(listing, foto.read_bytes(), orden)
                )
            db.commit()
            existentes[listing.title] = listing
            creados += 1
    total = len(data["avisos"])
    if args.dry_run:
        return f"{total} avisos válidos (sin publicar)"
    return f"{creados} avisos nuevos y {actualizados} actualizados de {total}"


if __name__ == "__main__":
    print(main())
