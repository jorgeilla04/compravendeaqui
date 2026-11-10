"""Carga fotos de un grupo (ej.: un colegio) desde archivos del servidor.

Uso:
  python -m app.scripts.fotos_grupo uniformes colegio-san-pablo --galeria a.jpg b.jpg
  python -m app.scripts.fotos_grupo uniformes colegio-san-pablo --producto remera r.png

--galeria agrega fotos del uniforme completo; --producto fija la foto de esa
prenda solo para ese grupo. Lo mismo se puede hacer desde el panel.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from sqlalchemy import select

from app.database import SessionLocal
from app.models import Tienda
from app.services import tiendas as service


def main(argv: list[str] | None = None) -> str:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("tienda")
    parser.add_argument("grupo")
    parser.add_argument("--galeria", nargs="+", type=Path, default=[])
    parser.add_argument(
        "--producto", nargs=2, action="append", default=[], metavar=("SLUG", "ARCHIVO")
    )
    args = parser.parse_args(argv)
    with SessionLocal() as db:
        tienda = db.scalars(select(Tienda).where(Tienda.slug == args.tienda)).first()
        if tienda is None:
            raise SystemExit(f"No existe la tienda {args.tienda}")
        grupo = service.get_grupo(db, tienda, args.grupo, include_inactive=True)
        fotos = list(grupo.fotos or [])
        for path in args.galeria:
            if len(fotos) >= service.MAX_FOTOS_GRUPO:
                raise SystemExit(f"Hasta {service.MAX_FOTOS_GRUPO} fotos por grupo")
            fotos.append(
                service.guardar_imagen(
                    path.read_bytes(), f"{tienda.slug}/grupos/{grupo.slug}"
                )
            )
        grupo.fotos = fotos
        for slug, archivo in args.producto:
            producto = service.get_producto(db, tienda, slug)
            fila = service.fila_precio(db, tienda, grupo, producto)
            fila.foto_url = service.guardar_imagen(
                Path(archivo).read_bytes(),
                f"{tienda.slug}/grupos/{grupo.slug}/{producto.slug}",
            )
        db.commit()
        prendas = len(args.producto)
        return (
            f"{grupo.nombre}: {len(fotos)} fotos en la galería, "
            f"{prendas} prendas con foto"
        )


if __name__ == "__main__":
    print(main())
