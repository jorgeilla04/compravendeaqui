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
    Consulta,
    Paquete,
    Reserva,
    Salida,
    TransporteAdmin,
    TransportePedido,
    TransporteUnidad,
    Transportista,
    User,
)
from app.schemas.tiendas import TiendaResumenOut
from app.schemas.transporte import (
    ConsultaAdminOut,
    ConsultaEstadoIn,
    EncargadoIn,
    EncargadoOut,
    PaqueteAdminOut,
    PaqueteIn,
    PedidoEstadoIn,
    PedidoTransporteOut,
    ReservaAdminOut,
    ReservaEstadoIn,
    SalidaIn,
    TransportistaAdminOut,
    TransportistaConfigIn,
    UnidadIn,
)
from app.services import paquetes
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
    # Lo que no viene (seña y transferencia, en paneles viejos) no se toca.
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(found, key, value)
    if found.datos_transferencia is not None:
        found.datos_transferencia = found.datos_transferencia.strip() or None
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


# --- Paquetes -----------------------------------------------------------------


def _paquete(db: DbSession, found: Transportista, paquete_slug: str) -> Paquete:
    return paquetes.get_paquete(db, found, paquete_slug, include_inactive=True)


def _salida(db: DbSession, paquete: Paquete, salida_id: uuid.UUID) -> Salida:
    """La salida bloqueada (el mismo lock que toman las reservas)."""
    salida = db.scalars(
        select(Salida)
        .where(Salida.id == salida_id, Salida.paquete_id == paquete.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    ).first()
    if salida is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Esa salida no existe")
    return salida


def _paquete_out(db: DbSession, paquete: Paquete) -> PaqueteAdminOut:
    db.refresh(paquete)
    return PaqueteAdminOut.model_validate(paquete)


@router.get("/{slug}/paquetes", response_model=list[PaqueteAdminOut])
def listar_paquetes(
    slug: str, user: CompleteUser, db: DbSession
) -> list[PaqueteAdminOut]:
    found = _transportista(db, user, slug)
    return [
        PaqueteAdminOut.model_validate(p)
        for p in paquetes.list_paquetes(db, found, include_inactive=True)
    ]


@router.post(
    "/{slug}/paquetes",
    response_model=PaqueteAdminOut,
    status_code=status.HTTP_201_CREATED,
)
def crear_paquete(
    slug: str, body: PaqueteIn, user: CompleteUser, db: DbSession
) -> PaqueteAdminOut:
    found = _transportista(db, user, slug)
    paquete = Paquete(
        transportista_id=found.id,
        slug=paquetes.unique_slug(db, found, body.titulo),
        **body.model_dump(),
    )
    db.add(paquete)
    db.commit()
    return _paquete_out(db, paquete)


@router.put("/{slug}/paquetes/{paquete_slug}", response_model=PaqueteAdminOut)
def editar_paquete(
    slug: str, paquete_slug: str, body: PaqueteIn, user: CompleteUser, db: DbSession
) -> PaqueteAdminOut:
    paquete = _paquete(db, _transportista(db, user, slug), paquete_slug)
    for key, value in body.model_dump().items():
        setattr(paquete, key, value)
    paquete.descripcion = (paquete.descripcion or "").strip() or None
    db.commit()
    return _paquete_out(db, paquete)


@router.delete(
    "/{slug}/paquetes/{paquete_slug}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    response_model=None,
)
def borrar_paquete(
    slug: str, paquete_slug: str, user: CompleteUser, db: DbSession
) -> Response:
    paquete = _paquete(db, _transportista(db, user, slug), paquete_slug)
    if any(s.reservados for s in paquete.salidas):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Tiene reservas: desactivalo en vez de borrarlo",
        )
    foto = paquete.foto_url
    db.delete(paquete)
    db.commit()
    imagenes.borrar_imagenes([foto])
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{slug}/paquetes/{paquete_slug}/foto", response_model=PaqueteAdminOut)
async def subir_foto_paquete(
    slug: str,
    paquete_slug: str,
    user: CompleteUser,
    db: DbSession,
    file: Annotated[UploadFile, File()],
) -> PaqueteAdminOut:
    found = _transportista(db, user, slug)
    paquete = _paquete(db, found, paquete_slug)
    anterior = paquete.foto_url
    paquete.foto_url = await imagenes.subir_imagen(
        file, f"transporte/{found.slug}/paquetes"
    )
    db.commit()
    imagenes.borrar_imagenes([anterior])
    return _paquete_out(db, paquete)


@router.post(
    "/{slug}/paquetes/{paquete_slug}/salidas",
    response_model=PaqueteAdminOut,
    status_code=status.HTTP_201_CREATED,
)
def agregar_salida(
    slug: str, paquete_slug: str, body: SalidaIn, user: CompleteUser, db: DbSession
) -> PaqueteAdminOut:
    paquete = _paquete(db, _transportista(db, user, slug), paquete_slug)
    if len(paquete.salidas) >= 40:
        raise HTTPException(status.HTTP_409_CONFLICT, detail="Hasta 40 salidas")
    paquete.salidas.append(Salida(**body.model_dump(), reservados=0))
    db.commit()
    return _paquete_out(db, paquete)


@router.put(
    "/{slug}/paquetes/{paquete_slug}/salidas/{salida_id}",
    response_model=PaqueteAdminOut,
)
def editar_salida(
    slug: str,
    paquete_slug: str,
    salida_id: uuid.UUID,
    body: SalidaIn,
    user: CompleteUser,
    db: DbSession,
) -> PaqueteAdminOut:
    paquete = _paquete(db, _transportista(db, user, slug), paquete_slug)
    salida = _salida(db, paquete, salida_id)
    if body.cupos < salida.reservados:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=f"Ya hay {salida.reservados} lugares reservados: no puede tener "
            "menos cupos",
        )
    for key, value in body.model_dump().items():
        setattr(salida, key, value)
    db.commit()
    return _paquete_out(db, paquete)


@router.delete(
    "/{slug}/paquetes/{paquete_slug}/salidas/{salida_id}",
    response_model=PaqueteAdminOut,
)
def borrar_salida(
    slug: str,
    paquete_slug: str,
    salida_id: uuid.UUID,
    user: CompleteUser,
    db: DbSession,
) -> PaqueteAdminOut:
    paquete = _paquete(db, _transportista(db, user, slug), paquete_slug)
    salida = _salida(db, paquete, salida_id)
    if salida.reservados:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail="Tiene reservas: desactivala en vez de borrarla",
        )
    db.delete(salida)
    db.commit()
    return _paquete_out(db, paquete)


@router.get("/{slug}/reservas", response_model=list[ReservaAdminOut])
def reservas(slug: str, user: CompleteUser, db: DbSession) -> list[ReservaAdminOut]:
    found = _transportista(db, user, slug)
    # La agencia ve las vencidas ya canceladas y sus lugares devueltos.
    paquetes.liberar_vencidas_de(db, found)
    rows = db.scalars(
        select(Reserva)
        .where(Reserva.transportista_id == found.id)
        .order_by(Reserva.created_at.desc())
        .limit(300)
    )
    return [ReservaAdminOut.model_validate(r) for r in rows]


@router.put("/{slug}/reservas/{reserva_id}", response_model=ReservaAdminOut)
def estado_reserva(
    slug: str,
    reserva_id: uuid.UUID,
    body: ReservaEstadoIn,
    user: CompleteUser,
    db: DbSession,
) -> ReservaAdminOut:
    found = _transportista(db, user, slug)
    reserva = db.scalars(
        select(Reserva).where(
            Reserva.id == reserva_id, Reserva.transportista_id == found.id
        )
    ).first()
    if reserva is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Esa reserva no existe")
    paquetes.cambiar_estado(db, reserva, body.estado)
    db.refresh(reserva)
    return ReservaAdminOut.model_validate(reserva)


@router.get("/{slug}/consultas", response_model=list[ConsultaAdminOut])
def consultas(slug: str, user: CompleteUser, db: DbSession) -> list[ConsultaAdminOut]:
    found = _transportista(db, user, slug)
    rows = db.scalars(
        select(Consulta)
        .where(Consulta.transportista_id == found.id)
        .order_by(Consulta.created_at.desc())
        .limit(300)
    )
    return [ConsultaAdminOut.model_validate(c) for c in rows]


@router.put("/{slug}/consultas/{consulta_id}", response_model=ConsultaAdminOut)
def estado_consulta(
    slug: str,
    consulta_id: uuid.UUID,
    body: ConsultaEstadoIn,
    user: CompleteUser,
    db: DbSession,
) -> ConsultaAdminOut:
    found = _transportista(db, user, slug)
    consulta = db.scalars(
        select(Consulta).where(
            Consulta.id == consulta_id, Consulta.transportista_id == found.id
        )
    ).first()
    if consulta is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Esa consulta no existe")
    consulta.estado = body.estado
    db.commit()
    db.refresh(consulta)
    return ConsultaAdminOut.model_validate(consulta)
