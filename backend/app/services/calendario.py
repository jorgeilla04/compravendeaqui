"""Calendario de publicaciones en redes.

Cada día tiene hasta 3 productos (un aviso o una prenda de un colegio) y cada
uno sale en su propio post. La hora depende de cuántos haya ese día:
1 → 19 h; 2 → 12 y 19 h; 3 → 10, 14 y 19 h (hora de San Juan).

`publicar_vencidas` corre cada minuto (cron del servidor) y publica lo que ya
tocaba. Si el servidor estuvo caído y la hora pasó hace mucho, no se publica
fuera de hora: queda con error para reprogramarlo.
"""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, time, timedelta, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.database import SessionLocal
from app.models import Listing, ProgramacionRed, PublicacionRed
from app.models.tiendas import Grupo, Producto, Tienda
from app.services import redes
from app.services import tiendas as tiendas_service

log = get_logger(__name__)

# San Juan no tiene horario de verano: UTC-3 todo el año.
TZ = timezone(timedelta(hours=-3))
HORAS = {1: (19,), 2: (12, 19), 3: (10, 14, 19)}
MAX_POR_DIA = 3
DIAS_ADELANTE = 62
TOLERANCIA = timedelta(hours=3)  # si se pasó más que esto, no se publica
ACTIVAS = ("programada", "publicando", "publicada", "error")


def hoy() -> date:
    return datetime.now(TZ).date()


def _del_dia(db: Session, fecha: date) -> list[ProgramacionRed]:
    return list(
        db.scalars(
            select(ProgramacionRed)
            .where(ProgramacionRed.fecha == fecha)
            .where(ProgramacionRed.estado.in_(ACTIVAS))
            .order_by(ProgramacionRed.orden, ProgramacionRed.created_at)
        )
    )


def _reacomodar(db: Session, fecha: date) -> None:
    """Numera las del día y les asigna la hora según cuántas hay. Las que ya
    salieron (o están saliendo) no cambian de hora."""
    del_dia = _del_dia(db, fecha)
    horas = HORAS.get(len(del_dia), HORAS[MAX_POR_DIA])
    for i, prog in enumerate(del_dia):
        prog.orden = i + 1
        if prog.estado == "programada":
            prog.publicar_at = datetime.combine(fecha, time(horas[i]), tzinfo=TZ)


def _pieza(db: Session, prog: ProgramacionRed) -> redes.Pieza:
    """Lo que se va a publicar, con los datos de hoy (precio, foto)."""
    if prog.listing_id is not None:
        listing = db.get(Listing, prog.listing_id)
        if listing is None or listing.deleted_at is not None:
            raise ValueError("El aviso ya no existe")
        if listing.status != "active":
            raise ValueError("El aviso ya no está activo")
        return redes.pieza_de_aviso(listing)
    grupo = db.get(Grupo, prog.grupo_id)
    producto = db.get(Producto, prog.producto_id)
    if grupo is None or producto is None or not grupo.activo:
        raise ValueError("El colegio o la prenda ya no existen")
    tienda = db.get(Tienda, grupo.tienda_id)
    if tienda is None or not tienda.activo:
        raise ValueError("La tienda no está activa")
    for pp in tiendas_service.productos_de(db, tienda, grupo):
        if pp.producto.id == producto.id:
            return redes.pieza_de_producto(tienda, grupo, pp)
    raise ValueError(f"{producto.nombre} ya no se vende en {grupo.nombre}")


def destino(db: Session, prog: ProgramacionRed) -> dict[str, Any]:
    """Tipo, ruta de la vista previa y página pública, para el calendario."""
    if prog.listing_id is not None:
        return {
            "tipo": "aviso",
            "vista_previa": f"/admin/redes/avisos/{prog.listing_id}/imagen.jpg",
        }
    grupo = db.get(Grupo, prog.grupo_id)
    producto = db.get(Producto, prog.producto_id)
    tienda = db.get(Tienda, grupo.tienda_id) if grupo else None
    if not (grupo and producto and tienda):
        return {"tipo": "uniforme", "vista_previa": None}
    return {
        "tipo": "uniforme",
        "vista_previa": (
            f"/admin/redes/tiendas/{tienda.slug}/grupos/{grupo.slug}"
            f"/productos/{producto.slug}/imagen.jpg"
        ),
    }


def listar(db: Session, desde: date, hasta: date) -> list[ProgramacionRed]:
    return list(
        db.scalars(
            select(ProgramacionRed)
            .where(ProgramacionRed.fecha.between(desde, hasta))
            .where(ProgramacionRed.estado != "cancelada")
            .order_by(ProgramacionRed.fecha, ProgramacionRed.orden)
        )
    )


def publicaciones_de(db: Session, prog_ids: list[uuid.UUID]) -> list[PublicacionRed]:
    if not prog_ids:
        return []
    return list(
        db.scalars(
            select(PublicacionRed).where(PublicacionRed.programacion_id.in_(prog_ids))
        )
    )


def agregar(
    db: Session,
    fecha: date,
    red_list: list[str],
    creada_por: uuid.UUID,
    *,
    listing_id: uuid.UUID | None = None,
    tienda: str | None = None,
    grupo: str | None = None,
    producto: str | None = None,
) -> ProgramacionRed:
    if fecha < hoy() or fecha > hoy() + timedelta(days=DIAS_ADELANTE):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Elegí un día entre hoy y los próximos {DIAS_ADELANTE} días.",
        )
    faltan = [r for r in red_list if not redes.configurada(r)]
    if faltan:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=f"{', '.join(r.capitalize() for r in faltan)} no está conectado",
        )
    if listing_id is not None:
        listing = redes.get_listing(db, listing_id)
        if listing.status != "active":
            raise HTTPException(
                status.HTTP_409_CONFLICT, detail="Solo se programan avisos activos"
            )
        pieza = redes.pieza_de_aviso(listing)
        datos: dict[str, Any] = {"listing_id": listing.id}
    else:
        t, g, pp = redes.get_producto_de_grupo(
            db, tienda or "", grupo or "", producto or ""
        )
        pieza = redes.pieza_de_producto(t, g, pp)
        datos = {"producto_id": pp.producto.id, "grupo_id": g.id}

    # Un día a la vez: dos pedidos simultáneos no pasan el tope de 3.
    db.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": fecha.toordinal()})
    del_dia = _del_dia(db, fecha)
    if len(del_dia) >= MAX_POR_DIA:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=f"Ese día ya tiene {MAX_POR_DIA} publicaciones.",
        )
    if any(all(getattr(p, k) == v for k, v in datos.items()) for p in del_dia):
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="Eso ya está programado para ese día."
        )
    prog = ProgramacionRed(
        fecha=fecha,
        orden=len(del_dia) + 1,
        publicar_at=datetime.combine(fecha, time(19), tzinfo=TZ),
        titulo=pieza.titulo[:200],
        redes=sorted(set(red_list)),
        estado="programada",
        creada_por=creada_por,
        created_at=datetime.now(UTC),
        **datos,
    )
    db.add(prog)
    db.flush()
    _reacomodar(db, fecha)
    db.commit()
    db.refresh(prog)
    return prog


def quitar(db: Session, prog: ProgramacionRed) -> None:
    if prog.estado != "programada":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Ya se publicó: borrala desde la publicación.",
        )
    prog.estado = "cancelada"
    db.flush()
    _reacomodar(db, prog.fecha)
    db.commit()


def _publicar_una(db: Session, prog: ProgramacionRed, ahora: datetime) -> None:
    if ahora - prog.publicar_at > TOLERANCIA:
        prog.estado = "error"
        prog.error = "No salió a su hora (el servidor no estaba disponible)."
        db.commit()
        return
    try:
        pieza = _pieza(db, prog)
        destino_ids: dict[str, Any] = (
            {"listing_id": prog.listing_id}
            if prog.listing_id is not None
            else {"producto_id": prog.producto_id, "grupo_id": prog.grupo_id}
        )
        filas = redes.crear_publicaciones(
            db,
            pieza,
            list(prog.redes),
            prog.creada_por,
            programacion_id=prog.id,
            **destino_ids,
        )
    except (ValueError, HTTPException) as exc:
        detalle = exc.detail if isinstance(exc, HTTPException) else str(exc)
        prog.estado, prog.error = "error", str(detalle)
        db.commit()
        log.warning("calendario.error", id=str(prog.id), error=str(detalle))
        return
    for fila in filas:
        redes.publicar(db, fila)
    errores = [f"{f.red.capitalize()}: {f.error}" for f in filas if f.error]
    prog.estado = "error" if errores else "publicada"
    prog.error = "; ".join(errores) or None
    db.commit()
    log.info("calendario.publicada", id=str(prog.id), estado=prog.estado)


def publicar_vencidas(ahora: datetime | None = None) -> int:
    """Publica lo programado cuya hora ya llegó. Devuelve cuántas procesó."""
    ahora = ahora or datetime.now(UTC)
    hechas = 0
    with SessionLocal() as db:
        while True:
            prog = db.scalars(
                select(ProgramacionRed)
                .where(ProgramacionRed.estado == "programada")
                .where(ProgramacionRed.publicar_at <= ahora)
                .order_by(ProgramacionRed.publicar_at)
                .limit(1)
                .with_for_update(skip_locked=True)
            ).first()
            if prog is None:
                return hechas
            # Se marca antes de publicar: otra corrida no la toma dos veces.
            prog.estado = "publicando"
            db.commit()
            try:
                _publicar_una(db, prog, ahora)
            except Exception as exc:  # noqa: BLE001 - que una no frene al resto
                db.rollback()
                prog.estado, prog.error = "error", "Error inesperado al publicar"
                db.commit()
                log.exception("calendario.fallo", id=str(prog.id), error=str(exc))
            hechas += 1
