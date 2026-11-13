"""Carga (o actualiza) paquetes turísticos de un transportista desde un JSON.

Uso:
  python -m app.scripts.importar_paquetes paquetes.json [--dry-run]

Formato:
  {"transportista": "blanca-paloma", "paquetes": [{"titulo": ..., "resumen": ...,
   "descripcion": ..., "dias": 10, "noches": 7, "incluye": [...],
   "precio_desde": 700000, "foto": "fotos/mdq.jpg",
   "salidas": [{"nombre": "Enero 2027", "precio_persona": 700000, "cupos": 40}]}]}

Se identifica cada paquete por su título: volver a correrlo actualiza textos,
precio y foto; las salidas solo se cargan si el paquete no tiene ninguna.
"""

from __future__ import annotations

import argparse
import json
from decimal import Decimal
from pathlib import Path
from typing import Any

from sqlalchemy import select

from app.database import SessionLocal
from app.models import Paquete, Salida
from app.schemas.transporte import PaqueteIn, SalidaIn
from app.services import paquetes as service
from app.services import tiendas as imagenes
from app.services import transporte


def main(argv: list[str] | None = None) -> str:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("archivo", type=Path)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)
    data: dict[str, Any] = json.loads(args.archivo.read_text())
    base = args.archivo.parent
    nuevos = actualizados = 0
    with SessionLocal() as db:
        found = transporte.get_transportista(
            db, data["transportista"], include_inactive=True
        )
        for orden, item in enumerate(data["paquetes"]):
            body = PaqueteIn(
                **{k: v for k, v in item.items() if k not in ("foto", "salidas")},
                orden=orden,
            )
            salidas = [SalidaIn(**s) for s in item.get("salidas", [])]
            paquete = db.scalars(
                select(Paquete).where(
                    Paquete.transportista_id == found.id, Paquete.titulo == body.titulo
                )
            ).first()
            if paquete is None:
                paquete = Paquete(
                    transportista_id=found.id,
                    slug=service.unique_slug(db, found, body.titulo),
                )
                db.add(paquete)
                nuevos += 1
            else:
                actualizados += 1
            for key, value in body.model_dump().items():
                setattr(paquete, key, value)
            paquete.precio_desde = Decimal(str(body.precio_desde))
            if not paquete.salidas:
                paquete.salidas = [
                    Salida(**s.model_dump(), reservados=0) for s in salidas
                ]
            if item.get("foto") and not args.dry_run:
                anterior = paquete.foto_url
                paquete.foto_url = imagenes.guardar_imagen(
                    (base / item["foto"]).read_bytes(),
                    f"transporte/{found.slug}/paquetes",
                )
                imagenes.borrar_imagenes([anterior])
        if args.dry_run:
            db.rollback()
        else:
            db.commit()
    total = len(data["paquetes"])
    return f"{nuevos} paquetes nuevos y {actualizados} actualizados de {total}"


if __name__ == "__main__":
    print(main())
