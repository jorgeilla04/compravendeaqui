"""Administración de tiendas.

- Administradores del sitio (rol admin): crean tiendas y asignan encargados.
- Encargados de una tienda: su configuración (envío, express, retiro, pagos),
  grupos, productos, precios y pedidos.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, File, HTTPException, Response, UploadFile, status
from sqlalchemy import delete, select

from app.api.deps import AdminUser, CompleteUser, DbSession
from app.api.v1.endpoints.tiendas import pedido_out
from app.models import Grupo, Pedido, PrecioGrupo, Producto, Tienda, User
from app.models.tiendas import TiendaAdmin
from app.schemas.tiendas import (
    CatalogoAdminOut,
    EncargadoIn,
    EncargadoOut,
    EstadoPedido,
    GrupoAdminOut,
    GrupoIn,
    GrupoUpdateIn,
    PedidoAdminOut,
    PedidoEstadoIn,
    PrecioIn,
    PrecioOut,
    ProductoAdminOut,
    ProductoIn,
    ProductoUpdateIn,
    TiendaAdminOut,
    TiendaConfigIn,
    TiendaIn,
    TiendaResumenOut,
)
from app.services import tiendas as service

router = APIRouter(prefix="/admin/tiendas", tags=["tiendas-admin"])


def _tienda(db: DbSession, user: User, slug: str) -> Tienda:
    """La tienda, si el usuario la administra (si no, 404: no revela que existe)."""
    tienda = service.get_tienda(db, slug, include_inactive=True)
    if not service.puede_administrar(db, user, tienda):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Esa tienda no existe")
    return tienda


def _apply_config(tienda: Tienda, body: TiendaConfigIn | TiendaIn) -> None:
    for key, value in body.model_dump().items():
        setattr(tienda, key, value)
    if tienda.retiro_direccion:
        tienda.retiro_direccion = tienda.retiro_direccion.strip() or None
    service.validar_config(tienda)


# --- Tiendas ------------------------------------------------------------------


@router.get("", response_model=list[TiendaResumenOut])
def mis_tiendas(user: CompleteUser, db: DbSession) -> list[TiendaResumenOut]:
    """Tiendas que administra el usuario (todas, si es admin del sitio)."""
    return [
        TiendaResumenOut.model_validate(t)
        for t in service.tiendas_que_administra(db, user)
    ]


@router.post("", response_model=TiendaAdminOut, status_code=status.HTTP_201_CREATED)
def crear_tienda(body: TiendaIn, _: AdminUser, db: DbSession) -> TiendaAdminOut:
    tienda = Tienda(slug=service.unique_slug(db, Tienda, body.nombre))
    _apply_config(tienda, body)
    db.add(tienda)
    db.commit()
    db.refresh(tienda)
    return TiendaAdminOut.model_validate(tienda)


@router.get("/{slug}/catalogo", response_model=CatalogoAdminOut)
def catalogo(slug: str, user: CompleteUser, db: DbSession) -> CatalogoAdminOut:
    tienda = _tienda(db, user, slug)
    grupos = service.list_grupos(db, tienda, include_inactive=True)
    productos = service.list_productos(db, tienda, include_inactive=True)
    slug_grupo = {g.id: g.slug for g in grupos}
    slug_producto = {p.id: p.slug for p in productos}
    precios = db.scalars(
        select(PrecioGrupo).where(PrecioGrupo.grupo_id.in_(slug_grupo.keys()))
    )
    return CatalogoAdminOut(
        tienda=TiendaAdminOut.model_validate(tienda),
        grupos=[GrupoAdminOut.model_validate(g) for g in grupos],
        productos=[ProductoAdminOut.model_validate(p) for p in productos],
        precios=[
            PrecioOut(
                grupo=slug_grupo[p.grupo_id],
                producto=slug_producto[p.producto_id],
                precio=p.precio,
                disponible=p.disponible,
                foto_url=p.foto_url,
            )
            for p in precios
        ],
    )


@router.put("/{slug}", response_model=TiendaAdminOut)
def configurar(
    slug: str, body: TiendaConfigIn, user: CompleteUser, db: DbSession
) -> TiendaAdminOut:
    """Envío, express, retiro, formas de pago, datos del dueño y textos."""
    tienda = _tienda(db, user, slug)
    _apply_config(tienda, body)
    db.commit()
    db.refresh(tienda)
    return TiendaAdminOut.model_validate(tienda)


# --- Encargados (solo admins del sitio) --------------------------------------


@router.get("/{slug}/encargados", response_model=list[EncargadoOut])
def encargados(slug: str, _: AdminUser, db: DbSession) -> list[EncargadoOut]:
    tienda = service.get_tienda(db, slug, include_inactive=True)
    users = db.scalars(
        select(User)
        .join(TiendaAdmin, TiendaAdmin.user_id == User.id)
        .where(TiendaAdmin.tienda_id == tienda.id)
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
    tienda = service.get_tienda(db, slug, include_inactive=True)
    # Solo un email verificado identifica a alguien: uno cargado en un perfil
    # sin verificar no da permisos sobre la tienda.
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
        select(TiendaAdmin.id).where(
            TiendaAdmin.tienda_id == tienda.id, TiendaAdmin.user_id == user.id
        )
    )
    if not exists:
        db.add(TiendaAdmin(tienda_id=tienda.id, user_id=user.id))
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
    """Se quita por el id de la cuenta (estable), no por un email."""
    tienda = service.get_tienda(db, slug, include_inactive=True)
    result = db.execute(
        delete(TiendaAdmin).where(
            TiendaAdmin.tienda_id == tienda.id, TiendaAdmin.user_id == user_id
        )
    )
    if not result.rowcount:
        db.rollback()
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail="Esa persona no es encargada de la tienda"
        )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Pedidos ------------------------------------------------------------------


@router.get("/{slug}/pedidos", response_model=list[PedidoAdminOut])
def pedidos(
    slug: str,
    user: CompleteUser,
    db: DbSession,
    estado: EstadoPedido | None = None,
) -> list[PedidoAdminOut]:
    tienda = _tienda(db, user, slug)
    query = (
        select(Pedido)
        .where(Pedido.tienda_id == tienda.id)
        .order_by(Pedido.created_at.desc())
        .limit(200)
    )
    if estado:
        query = query.where(Pedido.estado == estado)
    return [pedido_out(p, PedidoAdminOut) for p in db.scalars(query)]


@router.put("/{slug}/pedidos/{pedido_id}", response_model=PedidoAdminOut)
def cambiar_estado(
    slug: str,
    pedido_id: uuid.UUID,
    body: PedidoEstadoIn,
    user: CompleteUser,
    db: DbSession,
) -> PedidoAdminOut:
    tienda = _tienda(db, user, slug)
    pedido = service.get_pedido(db, pedido_id)
    if pedido.tienda_id != tienda.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=service.NOT_FOUND)
    # Normalmente "pagado" lo marca Mercado Pago; a mano sirve si se cobró por
    # fuera (efectivo, transferencia) o para avanzar la entrega.
    pedido.estado = body.estado
    db.commit()
    db.refresh(pedido)
    result: PedidoAdminOut = pedido_out(pedido, PedidoAdminOut)
    return result


# --- Grupos -------------------------------------------------------------------


@router.post(
    "/{slug}/grupos",
    response_model=GrupoAdminOut,
    status_code=status.HTTP_201_CREATED,
)
def crear_grupo(
    slug: str, body: GrupoIn, user: CompleteUser, db: DbSession
) -> GrupoAdminOut:
    tienda = _tienda(db, user, slug)
    grupo = Grupo(
        **body.model_dump(),
        tienda_id=tienda.id,
        slug=service.unique_slug(db, Grupo, body.nombre, tienda),
    )
    db.add(grupo)
    db.commit()
    db.refresh(grupo)
    return GrupoAdminOut.model_validate(grupo)


@router.put("/{slug}/grupos/{grupo_slug}", response_model=GrupoAdminOut)
def editar_grupo(
    slug: str,
    grupo_slug: str,
    body: GrupoUpdateIn,
    user: CompleteUser,
    db: DbSession,
) -> GrupoAdminOut:
    tienda = _tienda(db, user, slug)
    grupo = service.get_grupo(db, tienda, grupo_slug, include_inactive=True)
    for key, value in body.model_dump(exclude_unset=True).items():
        if value is not None or key in ("subtitulo", "categoria"):
            setattr(grupo, key, value)
    db.commit()
    db.refresh(grupo)
    return GrupoAdminOut.model_validate(grupo)


@router.post("/{slug}/grupos/{grupo_slug}/logo", response_model=GrupoAdminOut)
async def subir_logo(
    slug: str,
    grupo_slug: str,
    user: CompleteUser,
    db: DbSession,
    file: Annotated[UploadFile, File()],
) -> GrupoAdminOut:
    """Escudo o logo oficial (con autorización de la institución)."""
    tienda = _tienda(db, user, slug)
    grupo = service.get_grupo(db, tienda, grupo_slug, include_inactive=True)
    grupo.logo_url = await service.subir_imagen(
        file, f"{tienda.slug}/logos/{grupo.slug}"
    )
    db.commit()
    db.refresh(grupo)
    return GrupoAdminOut.model_validate(grupo)


@router.post("/{slug}/grupos/{grupo_slug}/fotos", response_model=GrupoAdminOut)
async def agregar_foto_grupo(
    slug: str,
    grupo_slug: str,
    user: CompleteUser,
    db: DbSession,
    file: Annotated[UploadFile, File()],
) -> GrupoAdminOut:
    """Foto del uniforme completo (galería del grupo)."""
    tienda = _tienda(db, user, slug)
    grupo = service.get_grupo(db, tienda, grupo_slug, include_inactive=True)
    if len(grupo.fotos or []) >= service.MAX_FOTOS_GRUPO:
        etiqueta = tienda.grupo_label.lower()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=f"Hasta {service.MAX_FOTOS_GRUPO} fotos por {etiqueta}",
        )
    url = await service.subir_imagen(file, f"{tienda.slug}/grupos/{grupo.slug}")
    grupo.fotos = [*(grupo.fotos or []), url]
    db.commit()
    db.refresh(grupo)
    return GrupoAdminOut.model_validate(grupo)


@router.delete(
    "/{slug}/grupos/{grupo_slug}/fotos/{indice}", response_model=GrupoAdminOut
)
def quitar_foto_grupo(
    slug: str, grupo_slug: str, indice: int, user: CompleteUser, db: DbSession
) -> GrupoAdminOut:
    tienda = _tienda(db, user, slug)
    grupo = service.get_grupo(db, tienda, grupo_slug, include_inactive=True)
    fotos = list(grupo.fotos or [])
    if not 0 <= indice < len(fotos):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No existe esa foto")
    del fotos[indice]
    grupo.fotos = fotos
    db.commit()
    db.refresh(grupo)
    return GrupoAdminOut.model_validate(grupo)


# --- Productos y precios ------------------------------------------------------


@router.post(
    "/{slug}/productos",
    response_model=ProductoAdminOut,
    status_code=status.HTTP_201_CREATED,
)
def crear_producto(
    slug: str, body: ProductoIn, user: CompleteUser, db: DbSession
) -> ProductoAdminOut:
    tienda = _tienda(db, user, slug)
    orden = len(service.list_productos(db, tienda, include_inactive=True))
    producto = Producto(
        **body.model_dump(),
        tienda_id=tienda.id,
        slug=service.unique_slug(db, Producto, body.nombre, tienda),
        orden=orden,
    )
    db.add(producto)
    db.commit()
    db.refresh(producto)
    return ProductoAdminOut.model_validate(producto)


@router.put("/{slug}/productos/{producto_slug}", response_model=ProductoAdminOut)
def editar_producto(
    slug: str,
    producto_slug: str,
    body: ProductoUpdateIn,
    user: CompleteUser,
    db: DbSession,
) -> ProductoAdminOut:
    tienda = _tienda(db, user, slug)
    producto = service.get_producto(db, tienda, producto_slug)
    for key, value in body.model_dump(exclude_unset=True).items():
        if value is not None or key == "descripcion":
            setattr(producto, key, value)
    db.commit()
    db.refresh(producto)
    return ProductoAdminOut.model_validate(producto)


@router.post("/{slug}/productos/{producto_slug}/foto", response_model=ProductoAdminOut)
async def subir_foto(
    slug: str,
    producto_slug: str,
    user: CompleteUser,
    db: DbSession,
    file: Annotated[UploadFile, File()],
) -> ProductoAdminOut:
    tienda = _tienda(db, user, slug)
    producto = service.get_producto(db, tienda, producto_slug)
    producto.foto_url = await service.subir_imagen(
        file, f"{tienda.slug}/productos/{producto.slug}"
    )
    db.commit()
    db.refresh(producto)
    return ProductoAdminOut.model_validate(producto)


@router.put("/{slug}/precios", response_model=PrecioOut)
def fijar_precio(
    slug: str, body: PrecioIn, user: CompleteUser, db: DbSession
) -> PrecioOut:
    """Precio de un producto en un grupo (o si ese grupo lo vende o no)."""
    tienda = _tienda(db, user, slug)
    grupo = service.get_grupo(db, tienda, body.grupo, include_inactive=True)
    producto = service.get_producto(db, tienda, body.producto)
    fila = service.fila_precio(db, tienda, grupo, producto)
    fila.precio = body.precio
    fila.disponible = body.disponible
    db.commit()
    return _precio_out(grupo, producto, fila)


def _precio_out(grupo: Grupo, producto: Producto, fila: PrecioGrupo) -> PrecioOut:
    return PrecioOut(
        grupo=grupo.slug,
        producto=producto.slug,
        precio=fila.precio,
        disponible=fila.disponible,
        foto_url=fila.foto_url,
    )


@router.post(
    "/{slug}/grupos/{grupo_slug}/productos/{producto_slug}/foto",
    response_model=PrecioOut,
)
async def subir_foto_en_grupo(
    slug: str,
    grupo_slug: str,
    producto_slug: str,
    user: CompleteUser,
    db: DbSession,
    file: Annotated[UploadFile, File()],
) -> PrecioOut:
    """Foto del producto para este grupo (ej.: la remera de un colegio)."""
    tienda = _tienda(db, user, slug)
    grupo = service.get_grupo(db, tienda, grupo_slug, include_inactive=True)
    producto = service.get_producto(db, tienda, producto_slug)
    url = await service.subir_imagen(
        file, f"{tienda.slug}/grupos/{grupo.slug}/{producto.slug}"
    )
    fila = service.fila_precio(db, tienda, grupo, producto)
    fila.foto_url = url
    db.commit()
    return _precio_out(grupo, producto, fila)


@router.delete(
    "/{slug}/grupos/{grupo_slug}/productos/{producto_slug}/foto",
    response_model=PrecioOut,
)
def quitar_foto_en_grupo(
    slug: str,
    grupo_slug: str,
    producto_slug: str,
    user: CompleteUser,
    db: DbSession,
) -> PrecioOut:
    tienda = _tienda(db, user, slug)
    grupo = service.get_grupo(db, tienda, grupo_slug, include_inactive=True)
    producto = service.get_producto(db, tienda, producto_slug)
    fila = service.fila_precio(db, tienda, grupo, producto)
    fila.foto_url = None
    db.commit()
    return _precio_out(grupo, producto, fila)
