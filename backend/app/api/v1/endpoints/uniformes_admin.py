"""Administración de la tienda de uniformes: pedidos, colegios, prendas y precios."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from sqlalchemy import select

from app.api.deps import AdminUser, DbSession
from app.api.v1.endpoints.uniformes import pedido_out
from app.models import Colegio, Pedido, PrecioUniforme, Prenda
from app.schemas.uniformes import (
    CatalogoAdminOut,
    ColegioAdminOut,
    ColegioIn,
    ColegioUpdateIn,
    EstadoPedido,
    PedidoAdminOut,
    PedidoEstadoIn,
    PrecioIn,
    PrecioOut,
    PrendaAdminOut,
    PrendaUpdateIn,
)
from app.services import uniformes as service

router = APIRouter(prefix="/admin/uniformes", tags=["uniformes-admin"])


def _prenda(db: DbSession, slug: str) -> Prenda:
    prenda = db.scalars(select(Prenda).where(Prenda.slug == slug)).first()
    if prenda is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Esa prenda no existe")
    return prenda


# --- Pedidos ------------------------------------------------------------------


@router.get("/pedidos", response_model=list[PedidoAdminOut])
def pedidos(
    _: AdminUser, db: DbSession, estado: EstadoPedido | None = None
) -> list[PedidoAdminOut]:
    query = select(Pedido).order_by(Pedido.created_at.desc()).limit(200)
    if estado:
        query = query.where(Pedido.estado == estado)
    return [pedido_out(p, PedidoAdminOut) for p in db.scalars(query)]


@router.put("/pedidos/{pedido_id}", response_model=PedidoAdminOut)
def cambiar_estado(
    pedido_id: uuid.UUID, body: PedidoEstadoIn, _: AdminUser, db: DbSession
) -> PedidoAdminOut:
    pedido = service.get_pedido(db, pedido_id)
    # Normalmente "pagado" lo marca Mercado Pago; a mano sirve si se cobró
    # por fuera (efectivo, transferencia) o para avanzar la entrega.
    pedido.estado = body.estado
    db.commit()
    db.refresh(pedido)
    result: PedidoAdminOut = pedido_out(pedido, PedidoAdminOut)
    return result


# --- Catálogo -----------------------------------------------------------------


@router.get("/catalogo", response_model=CatalogoAdminOut)
def catalogo(_: AdminUser, db: DbSession) -> CatalogoAdminOut:
    colegios = service.list_colegios(db, include_inactive=True)
    prendas = service.list_prendas(db, include_inactive=True)
    slug_colegio = {c.id: c.slug for c in colegios}
    slug_prenda = {p.id: p.slug for p in prendas}
    return CatalogoAdminOut(
        colegios=[ColegioAdminOut.model_validate(c) for c in colegios],
        prendas=[PrendaAdminOut.model_validate(p) for p in prendas],
        precios=[
            PrecioOut(
                colegio=slug_colegio[p.colegio_id],
                prenda=slug_prenda[p.prenda_id],
                precio=p.precio,
                disponible=p.disponible,
            )
            for p in db.scalars(select(PrecioUniforme))
        ],
    )


@router.post(
    "/colegios", response_model=ColegioAdminOut, status_code=status.HTTP_201_CREATED
)
def crear_colegio(body: ColegioIn, _: AdminUser, db: DbSession) -> ColegioAdminOut:
    colegio = Colegio(**body.model_dump(), slug=service.unique_slug(db, body.nombre))
    db.add(colegio)
    db.commit()
    db.refresh(colegio)
    return ColegioAdminOut.model_validate(colegio)


@router.put("/colegios/{slug}", response_model=ColegioAdminOut)
def editar_colegio(
    slug: str, body: ColegioUpdateIn, _: AdminUser, db: DbSession
) -> ColegioAdminOut:
    colegio = service.get_colegio(db, slug, include_inactive=True)
    for key, value in body.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(colegio, key, value)
    db.commit()
    db.refresh(colegio)
    return ColegioAdminOut.model_validate(colegio)


@router.post("/colegios/{slug}/logo", response_model=ColegioAdminOut)
async def subir_logo(
    slug: str,
    _: AdminUser,
    db: DbSession,
    file: Annotated[UploadFile, File()],
) -> ColegioAdminOut:
    """Escudo oficial (con autorización del colegio)."""
    colegio = service.get_colegio(db, slug, include_inactive=True)
    colegio.logo_url = await service.subir_imagen(file, f"escudos/{colegio.slug}")
    db.commit()
    db.refresh(colegio)
    return ColegioAdminOut.model_validate(colegio)


@router.put("/prendas/{slug}", response_model=PrendaAdminOut)
def editar_prenda(
    slug: str, body: PrendaUpdateIn, _: AdminUser, db: DbSession
) -> PrendaAdminOut:
    prenda = _prenda(db, slug)
    for key, value in body.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(prenda, key, value)
    db.commit()
    db.refresh(prenda)
    return PrendaAdminOut.model_validate(prenda)


@router.post("/prendas/{slug}/foto", response_model=PrendaAdminOut)
async def subir_foto(
    slug: str,
    _: AdminUser,
    db: DbSession,
    file: Annotated[UploadFile, File()],
) -> PrendaAdminOut:
    prenda = _prenda(db, slug)
    prenda.foto_url = await service.subir_imagen(file, f"prendas/{prenda.slug}")
    db.commit()
    db.refresh(prenda)
    return PrendaAdminOut.model_validate(prenda)


@router.put("/precios", response_model=PrecioOut)
def fijar_precio(body: PrecioIn, _: AdminUser, db: DbSession) -> PrecioOut:
    """Precio de una prenda en un colegio (o que ese colegio no la usa)."""
    colegio = service.get_colegio(db, body.colegio, include_inactive=True)
    prenda = _prenda(db, body.prenda)
    fila = db.scalars(
        select(PrecioUniforme).where(
            PrecioUniforme.colegio_id == colegio.id,
            PrecioUniforme.prenda_id == prenda.id,
        )
    ).first()
    if fila is None:
        fila = PrecioUniforme(colegio_id=colegio.id, prenda_id=prenda.id)
        db.add(fila)
    fila.precio = body.precio
    fila.disponible = body.disponible
    db.commit()
    return PrecioOut(
        colegio=colegio.slug,
        prenda=prenda.slug,
        precio=fila.precio,
        disponible=fila.disponible,
    )
