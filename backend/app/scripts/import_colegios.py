"""Carga o actualiza colegios de la tienda de uniformes desde un JSON.

Uso:  python -m app.scripts.import_colegios colegios.json

Formato (una lista):
    [{"nombre": "Colegio Santa Rosa de Lima", "departamento": "Capital",
      "categoria": "parroquiales", "color1": "#1E3A8A", "color2": "#FFFFFF"}]
categoria: parroquiales | privados | preuniversitarios
Si ya existe un colegio con el mismo nombre, se actualiza (no se duplica).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from sqlalchemy import select

from app.database import SessionLocal
from app.models import Colegio
from app.schemas.uniformes import ColegioIn
from app.services.uniformes import slugify, unique_slug


def import_colegios(rows: list[dict[str, Any]]) -> tuple[int, int]:
    """Devuelve (creados, actualizados). Valida todo antes de escribir."""
    data = [ColegioIn.model_validate(row) for row in rows]
    created = updated = 0
    with SessionLocal() as db:
        for item in data:
            colegio = db.scalars(
                select(Colegio).where(Colegio.slug == slugify(item.nombre))
            ).first()
            if colegio is None:
                db.add(Colegio(**item.model_dump(), slug=unique_slug(db, item.nombre)))
                db.flush()
                created += 1
            else:
                for key, value in item.model_dump().items():
                    setattr(colegio, key, value)
                updated += 1
        db.commit()
    return created, updated


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    rows = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    nuevos, actualizados = import_colegios(rows)
    print(f"Colegios: {nuevos} nuevos, {actualizados} actualizados")
