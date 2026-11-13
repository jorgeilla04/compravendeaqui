"""Carga la portada y las fotos de unidades de un transportista desde archivos.

Uso:
  python -m app.scripts.foto_transporte blanca-paloma --portada bus.jpg
  python -m app.scripts.foto_transporte blanca-paloma --unidad Minibús mini.png

Lo mismo se puede hacer desde el panel del cotizador.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from app.database import SessionLocal
from app.services import tiendas as imagenes
from app.services import transporte as service


def main(argv: list[str] | None = None) -> str:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("transportista")
    parser.add_argument("--portada", type=Path)
    parser.add_argument(
        "--unidad", nargs=2, action="append", default=[], metavar=("NOMBRE", "ARCHIVO")
    )
    args = parser.parse_args(argv)
    with SessionLocal() as db:
        found = service.get_transportista(db, args.transportista, include_inactive=True)
        reemplazadas: list[str | None] = []
        if args.portada:
            reemplazadas.append(found.foto_url)
            found.foto_url = imagenes.guardar_imagen(
                args.portada.read_bytes(), f"transporte/{found.slug}"
            )
        for nombre, archivo in args.unidad:
            unidad = next((u for u in found.unidades if u.nombre == nombre), None)
            if unidad is None:
                raise SystemExit(f"No existe la unidad {nombre}")
            reemplazadas.append(unidad.foto_url)
            unidad.foto_url = imagenes.guardar_imagen(
                Path(archivo).read_bytes(), f"transporte/{found.slug}/unidades"
            )
        db.commit()
        imagenes.borrar_imagenes(reemplazadas)
        portada = 1 if args.portada else 0
        return f"Fotos cargadas: {portada} portada, {len(args.unidad)} unidades"


if __name__ == "__main__":
    print(main())
