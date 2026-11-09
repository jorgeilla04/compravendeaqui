"""Carga o actualiza los grupos de una tienda (ej.: colegios) desde un JSON.

Uso:  python -m app.scripts.import_grupos uniformes colegios.json

Formato (una lista):
    [{"nombre": "Colegio Santa Rosa de Lima", "subtitulo": "Capital",
      "categoria": "Parroquiales y confesionales",
      "color1": "#1E3A8A", "color2": "#FFFFFF"}]
La categoría tiene que ser una de las de la tienda. Si ya existe un grupo con
el mismo nombre, se actualiza (no se duplica).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from sqlalchemy import select

from app.database import SessionLocal
from app.models import Grupo, Tienda
from app.schemas.tiendas import GrupoIn
from app.services.tiendas import slugify, unique_slug


def import_grupos(tienda_slug: str, rows: list[dict[str, Any]]) -> tuple[int, int]:
    """Devuelve (creados, actualizados). Valida todo antes de escribir."""
    data = [GrupoIn.model_validate(row) for row in rows]
    created = updated = 0
    with SessionLocal() as db:
        tienda = db.scalars(select(Tienda).where(Tienda.slug == tienda_slug)).first()
        if tienda is None:
            raise ValueError(f"No existe la tienda {tienda_slug}")
        invalid = {g.categoria for g in data if g.categoria} - set(tienda.categorias)
        if invalid:
            raise ValueError(f"Categorías que la tienda no tiene: {sorted(invalid)}")
        for item in data:
            grupo = db.scalars(
                select(Grupo).where(
                    Grupo.tienda_id == tienda.id, Grupo.slug == slugify(item.nombre)
                )
            ).first()
            if grupo is None:
                db.add(
                    Grupo(
                        **item.model_dump(),
                        tienda_id=tienda.id,
                        slug=unique_slug(db, Grupo, item.nombre, tienda),
                    )
                )
                db.flush()
                created += 1
            else:
                for key, value in item.model_dump().items():
                    setattr(grupo, key, value)
                updated += 1
        db.commit()
    return created, updated


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    rows = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
    nuevos, actualizados = import_grupos(sys.argv[1], rows)
    print(f"Grupos: {nuevos} nuevos, {actualizados} actualizados")
