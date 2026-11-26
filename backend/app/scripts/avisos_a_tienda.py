"""Pasa avisos a una tienda de catálogo: cada aviso queda como producto en su
rubro (grupo), con la foto principal, y el aviso se da de baja (borrador).

Uso:
  python -m app.scripts.avisos_a_tienda kanji.json [--dry-run]

Formato:
  {"tienda": {"slug": "kanji", "nombre": "Kanji", "descripcion": "...",
              "copiar_config_de": "uniformes", "envio_demora": "7 a 10 días",
              "stock_demora": "24 hs", ...},
   "encargados": ["email@..."],
   "rubros": [{"nombre": "Heladeras y freezers", "categoria": "Hogar",
               "color1": "#1E3A8A", "color2": "#FFFFFF"}],
   "productos": [{"aviso": "<id del aviso>", "rubro": "Heladeras y freezers"}]}

La tienda se crea si no existe (copiando vendedor, envío y pagos de
"copiar_config_de"); si existe, no se toca su configuración. Se puede correr
de nuevo: un aviso ya pasado (producto con el mismo nombre) no se duplica.
"""

from __future__ import annotations

import argparse
import json
import uuid
from pathlib import Path
from typing import Any

from sqlalchemy import select

from app.database import SessionLocal
from app.models import Grupo, Listing, PrecioGrupo, Producto, Tienda, User
from app.models.tiendas import TiendaAdmin
from app.services import storage
from app.services import tiendas as service

# Lo que se copia de la tienda modelo (quién atiende, envío y pagos).
CONFIG = (
    "vendedor_nombre",
    "vendedor_email",
    "vendedor_whatsapp",
    "envio_habilitado",
    "envio_monto",
    "envio_gratis_desde",
    "envio_demora",
    "departamentos_envio",
    "express_habilitado",
    "express_recargo_pct",
    "express_monto",
    "express_demora",
    "retiro_habilitado",
    "retiro_direccion",
    "sena_habilitada",
    "sena_pct",
    "total_habilitado",
)
SLUG_MAX = 60


def _slug_producto(db: Any, tienda: Tienda, nombre: str, usados: set[str]) -> str:
    base = service.slugify(nombre)[: SLUG_MAX - 4].rstrip("-") or "producto"
    candidato, n = base, 2
    while candidato in usados or db.scalar(
        select(Producto.id).where(
            Producto.tienda_id == tienda.id, Producto.slug == candidato
        )
    ):
        candidato, n = f"{base}-{n}", n + 1
    usados.add(candidato)
    return candidato


def _tienda(db: Any, datos: dict[str, Any], rubros: list[dict[str, Any]]) -> Tienda:
    tienda = db.scalars(select(Tienda).where(Tienda.slug == datos["slug"])).first()
    if tienda is not None:
        return tienda
    modelo = db.scalars(
        select(Tienda).where(Tienda.slug == datos["copiar_config_de"])
    ).first()
    if modelo is None:
        raise SystemExit(f"No existe la tienda {datos['copiar_config_de']}")
    tienda = Tienda(
        slug=datos["slug"],
        nombre=datos["nombre"],
        descripcion=datos.get("descripcion"),
        grupo_label=datos.get("grupo_label", "Rubro"),
        opcion_label=datos.get("opcion_label", "Variante"),
        categorias=list(dict.fromkeys(r["categoria"] for r in rubros)),
        productos_en_todos=False,
        activo=True,
    )
    for campo in CONFIG:
        setattr(tienda, campo, datos.get(campo, getattr(modelo, campo)))
    tienda.stock_demora = datos.get("stock_demora")
    service.validar_config(tienda)
    db.add(tienda)
    db.flush()
    return tienda


def main(argv: list[str] | None = None) -> str:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("archivo", type=Path)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(argv)
    data: dict[str, Any] = json.loads(args.archivo.read_text())
    rubros = {r["nombre"]: r for r in data["rubros"]}
    faltan = {p["rubro"] for p in data["productos"]} - set(rubros)
    if faltan:
        raise SystemExit(f"Rubros sin definir: {sorted(faltan)}")

    with SessionLocal() as db:
        avisos = {
            str(a.id): a
            for a in db.scalars(
                select(Listing).where(
                    Listing.id.in_([uuid.UUID(p["aviso"]) for p in data["productos"]])
                )
            )
        }
        sin_aviso = [p["aviso"] for p in data["productos"] if p["aviso"] not in avisos]
        if sin_aviso:
            raise SystemExit(f"Avisos que no existen: {sin_aviso[:5]}")
        sin_foto = [a.title for a in avisos.values() if not a.images]
        if sin_foto:
            raise SystemExit(f"Avisos sin foto: {sin_foto[:5]}")
        if args.dry_run:
            return (
                f"{len(data['productos'])} productos válidos en "
                f"{len(rubros)} rubros (sin cambios)"
            )

        tienda = _tienda(db, data["tienda"], data["rubros"])
        for email in data.get("encargados", []):
            user = db.scalars(select(User).where(User.email == email)).first()
            if user is None:
                raise SystemExit(f"No existe el usuario {email}")
            if not db.scalar(
                select(TiendaAdmin.id).where(
                    TiendaAdmin.tienda_id == tienda.id, TiendaAdmin.user_id == user.id
                )
            ):
                db.add(TiendaAdmin(tienda_id=tienda.id, user_id=user.id))

        grupos: dict[str, Grupo] = {
            g.nombre: g
            for g in db.scalars(select(Grupo).where(Grupo.tienda_id == tienda.id))
        }
        for r in data["rubros"]:
            if r["nombre"] not in grupos:
                grupo = Grupo(
                    tienda_id=tienda.id,
                    slug=service.unique_slug(db, Grupo, r["nombre"], tienda),
                    nombre=r["nombre"],
                    categoria=r["categoria"],
                    color1=r.get("color1", "#1E293B"),
                    color2=r.get("color2", "#FFFFFF"),
                    fotos=[],
                )
                db.add(grupo)
                db.flush()
                grupos[r["nombre"]] = grupo
        db.commit()

        existentes = {
            p.nombre
            for p in db.scalars(select(Producto).where(Producto.tienda_id == tienda.id))
        }
        usados: set[str] = set()
        creados = 0
        for orden, item in enumerate(data["productos"]):
            aviso = avisos[item["aviso"]]
            nombre = aviso.title[:120]
            if nombre not in existentes:
                slug = _slug_producto(db, tienda, nombre, usados)
                foto = aviso.images[0]
                key = storage.key_from_url(foto.url, "listings/") or (
                    f"{foto.storage_key}.webp"
                )
                foto_url = service.guardar_imagen(
                    storage.get_object(key), f"{tienda.slug}/productos/{slug}"
                )
                producto = Producto(
                    tienda_id=tienda.id,
                    slug=slug,
                    nombre=nombre,
                    descripcion=aviso.description,
                    tipo="generico",
                    precio_base=aviso.price,
                    opciones=[],
                    foto_url=foto_url,
                    tramos=[],
                    en_stock=False,
                    orden=orden,
                    activo=True,
                )
                db.add(producto)
                db.flush()
                db.add(
                    PrecioGrupo(
                        grupo_id=grupos[item["rubro"]].id,
                        producto_id=producto.id,
                        precio=None,
                        disponible=True,
                    )
                )
                existentes.add(nombre)
                creados += 1
            aviso.status = "draft"
            db.commit()
    return (
        f"{creados} productos nuevos en la tienda {tienda.slug}; avisos dados de baja"
    )


if __name__ == "__main__":
    print(main())
