"""Administración del cotizador de transporte.

- Administradores del sitio: asignan encargados.
- Encargados: datos, tarifas, unidades, fotos y pedidos.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, File, HTTPException, Response, UploadFile, status
from sqlalchemy import delete, select

from app.api.deps import AdminUser, CompleteUser, DbSession
from app.models import (
    TransporteAdmin,
    TransportePedido,
    TransporteUnidad,
    Transportista,
    User,
)
from app.schemas.tiendas import TiendaResumenOut
from app.schemas.transporte import (
    EncargadoIn,
    EncargadoOut,
    PedidoEstadoIn,
    PedidoTransporteOut,
    TransportistaAdminOut,
    TransportistaConfigIn,
    UnidadIn,
)
from app.services import tiendas as imagenes
from app.services import transporte as service

router = APIRouter(prefix="/admin/transporte", tags=["transporte-admin"])


def _transportista(db: DbSession, user: User, slug: str) -> Transportista:
    """El transportista, si el usuario lo administra (si no, 404)."""
    found = service.get_transportista(db, slug, include_inactive=True)
    if not service.puede_administrar(db, user, found):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No encontramos eso")
    return found


def _out(db: DbSession, found: Transportista) -> TransportistaAdminOut:
    db.refresh(found)
    return TransportistaAdminOut.model_validate(found)


def _unidad(found: Transportista, unidad_id: uuid.UUID) -> TransporteUnidad:
    unidad = next((u for u in found.unidades if u.id == unidad_id), None)
    if unidad is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Esa unidad no existe")
    return unidad


@router.get("", response_model=list[TiendaResumenOut])
def mis_transportes(user: CompleteUser, db: DbSession) -> list[TiendaResumenOut]:
    return [
        TiendaResumenOut.model_validate(t) for t in service.que_administra(db, user)
    ]


@router.get("/{slug}", response_model=TransportistaAdminOut)
def ver(slug: str, user: CompleteUser, db: DbSession) -> TransportistaAdminOut:
    return TransportistaAdminOut.model_validate(_transportista(db, user, slug))


@router.put("/{slug}", response_model=TransportistaAdminOut)
def configurar(
    slug: str, body: TransportistaConfigIn, user: CompleteUser, db: DbSession
) -> TransportistaAdminOut:
    found = _transportista(db, user, slug)
    for key, value in body.model_dump().items():
        setattr(found, key, value)
    found.descripcion = (found.descripcion or "").strip() or None
    found.tarifas_revisadas = True
    db.commit()
    return _out(db, found)


@router.post("/{slug}/foto", response_model=TransportistaAdminOut)
async def subir_foto(
    slug: str,
    user: CompleteUser,
    db: DbSession,
    file: Annotated[UploadFile, File()],
) -> TransportistaAdminOut:
    """Foto de portada de la página del cotizador."""
    found = _transportista(db, user, slug)
    anterior = found.foto_url
    found.foto_url = await imagenes.subir_imagen(file, f"transporte/{found.slug}")
    db.commit()
    imagenes.borrar_imagenes([anterior])
    return _out(db, found)


# --- Unidades -----------------------------------------------------------------


@router.post(
    "/{slug}/unidades",
    response_model=TransportistaAdminOut,
    status_code=status.HTTP_201_CREATED,
)
def agregar_unidad(
    slug: str, body: UnidadIn, user: CompleteUser, db: DbSession
) -> TransportistaAdminOut:
    found = _transportista(db, user, slug)
    if len(found.unidades) >= 20:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Hasta 20 unidades")
    found.unidades.append(TransporteUnidad(**body.model_dump()))
    found.tarifas_revisadas = True
    db.commit()
    return _out(db, found)


@router.put("/{slug}/unidades/{unidad_id}", response_model=TransportistaAdminOut)
def editar_unidad(
    slug: str,
    unidad_id: uuid.UUID,
    body: UnidadIn,
    user: CompleteUser,
    db: DbSession,
) -> TransportistaAdminOut:
    found = _transportista(db, user, slug)
    unidad = _unidad(found, unidad_id)
    for key, value in body.model_dump().items():
        setattr(unidad, key, value)
    found.tarifas_revisadas = True
    db.commit()
    return _out(db, found)


@router.delete("/{slug}/unidades/{unidad_id}", response_model=TransportistaAdminOut)
def quitar_unidad(
    slug: str, unidad_id: uuid.UUID, user: CompleteUser, db: DbSession
) -> TransportistaAdminOut:
    found = _transportista(db, user, slug)
    unidad = _unidad(found, unidad_id)
    foto = unidad.foto_url
    found.unidades.remove(unidad)
    db.commit()
    imagenes.borrar_imagenes([foto])
    return _out(db, found)


@router.post("/{slug}/unidades/{unidad_id}/foto", response_model=TransportistaAdminOut)
async def subir_foto_unidad(
    slug: str,
    unidad_id: uuid.UUID,
    user: CompleteUser,
    db: DbSession,
    file: Annotated[UploadFile, File()],
) -> TransportistaAdminOut:
    found = _transportista(db, user, slug)
    unidad = _unidad(found, unidad_id)
    anterior = unidad.foto_url
    unidad.foto_url = await imagenes.subir_imagen(
        file, f"transporte/{found.slug}/unidades"
    )
    db.commit()
    imagenes.borrar_imagenes([anterior])
    return _out(db, found)


# --- Pedidos ------------------------------------------------------------------


@router.get("/{slug}/pedidos", response_model=list[PedidoTransporteOut])
def pedidos(slug: str, user: CompleteUser, db: DbSession) -> list[PedidoTransporteOut]:
    found = _transportista(db, user, slug)
    rows = db.scalars(
        select(TransportePedido)
        .where(TransportePedido.transportista_id == found.id)
        .order_by(TransportePedido.created_at.desc())
        .limit(200)
    )
    return [PedidoTransporteOut.model_validate(p) for p in rows]


@router.put("/{slug}/pedidos/{pedido_id}", response_model=PedidoTransporteOut)
def cambiar_estado(
    slug: str,
    pedido_id: uuid.UUID,
    body: PedidoEstadoIn,
    user: CompleteUser,
    db: DbSession,
) -> PedidoTransporteOut:
    found = _transportista(db, user, slug)
    pedido = db.scalars(
        select(TransportePedido).where(
            TransportePedido.id == pedido_id,
            TransportePedido.transportista_id == found.id,
        )
    ).first()
    if pedido is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Ese pedido no existe")
    pedido.estado = body.estado
    db.commit()
    db.refresh(pedido)
    return PedidoTransporteOut.model_validate(pedido)


# --- Encargados (solo admins del sitio) ---------------------------------------


@router.get("/{slug}/encargados", response_model=list[EncargadoOut])
def encargados(slug: str, _: AdminUser, db: DbSession) -> list[EncargadoOut]:
    found = service.get_transportista(db, slug, include_inactive=True)
    users = db.scalars(
        select(User)
        .join(TransporteAdmin, TransporteAdmin.user_id == User.id)
        .where(TransporteAdmin.transportista_id == found.id)
        .order_by(User.email)
    )
    return [EncargadoOut(id=u.id, email=u.email, nombre=u.display_name) for u in users]


@router.post(
    "/{slug}/encargados",
    response_model=EncargadoOut,
    status_code=status.HTTP_201_CREATED,
)
def agregar_encargado(
    slug: str, body: EncargadoIn, _: AdminUser, db: DbSession
) -> EncargadoOut:
    found = service.get_transportista(db, slug, include_inactive=True)
    # Solo un email verificado identifica a alguien.
    user = db.scalars(
        select(User).where(
            User.email == body.email,
            User.email_verified.is_(True),
            User.deleted_at.is_(None),
        )
    ).first()
    if user is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail=(
                "No hay ninguna cuenta con ese email: tiene que ingresar con él "
                "una vez antes"
            ),
        )
    exists = db.scalar(
        select(TransporteAdmin.id).where(
            TransporteAdmin.transportista_id == found.id,
            TransporteAdmin.user_id == user.id,
        )
    )
    if not exists:
        db.add(TransporteAdmin(transportista_id=found.id, user_id=user.id))
        db.commit()
    return EncargadoOut(id=user.id, email=user.email, nombre=user.display_name)


@router.delete(
    "/{slug}/encargados/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    response_model=None,
)
def quitar_encargado(
    slug: str, user_id: uuid.UUID, _: AdminUser, db: DbSession
) -> Response:
    found = service.get_transportista(db, slug, include_inactive=True)
    db.execute(
        delete(TransporteAdmin).where(
            TransporteAdmin.transportista_id == found.id,
            TransporteAdmin.user_id == user_id,
        )
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
