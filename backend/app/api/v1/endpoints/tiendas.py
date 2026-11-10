"""Tiendas virtuales: catálogo, pedidos y avisos de pago de Mercado Pago."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import DbSession
from app.config import settings
from app.core import ratelimit
from app.models import Pedido, Tienda
from app.schemas.tiendas import (
    GrupoDetalleOut,
    GrupoOut,
    PedidoCreadoOut,
    PedidoIn,
    PedidoItemOut,
    PedidoOut,
    ProductoOut,
    TiendaBusquedaOut,
    TiendaOut,
    TiendaResumenOut,
)
from app.services import mercadopago
from app.services import tiendas as service

router = APIRouter(prefix="/tiendas", tags=["tiendas"])


def tienda_out(db: Session, tienda: Tienda) -> TiendaOut:
    return TiendaOut(
        slug=tienda.slug,
        nombre=tienda.nombre,
        descripcion=tienda.descripcion,
        grupo_label=tienda.grupo_label,
        opcion_label=tienda.opcion_label,
        categorias=tienda.categorias,
        vendedor_nombre=tienda.vendedor_nombre,
        whatsapp_url=service.whatsapp_consulta_url(tienda),
        entregas=service.entregas(tienda),
        modalidades=service.modalidades(tienda),
        envio_monto=tienda.envio_monto,
        envio_gratis_desde=tienda.envio_gratis_desde,
        envio_demora=tienda.envio_demora,
        departamentos_envio=tienda.departamentos_envio,
        express_recargo_pct=tienda.express_recargo_pct,
        express_monto=tienda.express_monto,
        express_demora=tienda.express_demora,
        retiro_direccion=tienda.retiro_direccion if tienda.retiro_habilitado else None,
        sena_pct=tienda.sena_pct,
        pagos_online=settings.mp_configured,
        grupos=[GrupoOut.model_validate(g) for g in service.list_grupos(db, tienda)],
    )


def pedido_out(pedido: Pedido, model: type[PedidoOut] = PedidoOut) -> Any:
    """Arma la respuesta (pública o de administración) desde el pedido."""
    extra = {
        "tienda": TiendaResumenOut.model_validate(pedido.tienda),
        "opcion_label": pedido.tienda.opcion_label,
        "entrega_label": service.entrega_label(pedido.tienda, pedido.entrega),
        "items": [PedidoItemOut.model_validate(i) for i in pedido.items],
        "whatsapp_url": service.whatsapp_vendedor_url(pedido),
        "cliente_whatsapp_url": service.whatsapp_cliente_url(pedido),
        "pago_url": (
            pedido.mp_init_point
            if pedido.estado in ("pendiente_pago", "rechazado")
            else None
        ),
    }
    data = {
        name: extra[name] if name in extra else getattr(pedido, name)
        for name in model.model_fields
    }
    return model(**data)


@router.get("", response_model=list[TiendaResumenOut])
def tiendas(db: DbSession) -> list[TiendaResumenOut]:
    return [TiendaResumenOut.model_validate(t) for t in service.list_tiendas(db)]


@router.get("/buscar", response_model=list[TiendaBusquedaOut])
def buscar(
    db: DbSession, q: str = Query(default="", max_length=100)
) -> list[TiendaBusquedaOut]:
    """Tiendas y grupos (colegios) que coinciden con la búsqueda del sitio."""
    return [
        TiendaBusquedaOut(
            tienda=TiendaResumenOut.model_validate(e.tienda),
            grupo_label=e.tienda.grupo_label,
            grupos=[GrupoOut.model_validate(g) for g in e.grupos],
            total_grupos=e.total_grupos,
        )
        for e in service.buscar(db, q)
    ]


@router.get("/pedidos/{pedido_id}", response_model=PedidoOut)
def ver_pedido(
    pedido_id: uuid.UUID,
    request: Request,
    db: DbSession,
    payment_id: str | None = None,
) -> PedidoOut:
    """Estado del pedido. Al volver de Mercado Pago trae payment_id: se confirma
    consultando el pago, por si el aviso (webhook) todavía no llegó."""
    ratelimit.enforce(
        f"rl:tiendas:ver:{ratelimit.client_ip(request)}",
        120,
        900,
        "Demasiadas consultas. Probá en unos minutos.",
    )
    pedido = service.get_pedido(db, pedido_id)
    if (
        payment_id
        and payment_id.isdigit()
        and pedido.estado in ("pendiente_pago", "rechazado")
    ):
        # Solo se aplica si ese pago es de este pedido.
        service.sincronizar_pago(db, payment_id, solo_pedido=pedido.id)
        db.refresh(pedido)
    result: PedidoOut = pedido_out(pedido)
    return result


@router.post("/webhooks/mercadopago")
async def webhook_mercadopago(request: Request, db: DbSession) -> dict[str, bool]:
    """Aviso de Mercado Pago. Nunca se confía en el contenido: se consulta el pago."""
    ratelimit.enforce(
        f"rl:tiendas:webhook:{ratelimit.client_ip(request)}",
        600,
        60,
        "Demasiados avisos.",
    )
    params = request.query_params
    body: dict[str, Any] = {}
    try:
        parsed = await request.json()
        body = parsed if isinstance(parsed, dict) else {}
    except ValueError:
        body = {}
    kind = body.get("type") or params.get("type") or params.get("topic")
    raw_data = body.get("data")
    data: dict[str, Any] = raw_data if isinstance(raw_data, dict) else {}
    # Mercado Pago firma el id que manda en la URL: es el único que se usa.
    signed_id = params.get("data.id") or params.get("id") or ""
    body_id = str(data.get("id") or "")
    if signed_id and body_id and signed_id != body_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Id inconsistente")
    data_id = signed_id or body_id
    if kind != "payment" or not data_id:
        return {"ok": True}  # otros avisos (merchant_order, etc.): no se usan
    if not mercadopago.valid_signature(
        x_signature=request.headers.get("x-signature"),
        x_request_id=request.headers.get("x-request-id"),
        data_id=data_id,
    ):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Firma inválida")
    service.sincronizar_pago(db, data_id)
    return {"ok": True}


@router.get("/{slug}", response_model=TiendaOut)
def tienda(slug: str, db: DbSession) -> TiendaOut:
    return tienda_out(db, service.get_tienda(db, slug))


@router.get("/{slug}/grupos/{grupo_slug}", response_model=GrupoDetalleOut)
def grupo(slug: str, grupo_slug: str, db: DbSession) -> GrupoDetalleOut:
    found_tienda = service.get_tienda(db, slug)
    found = service.get_grupo(db, found_tienda, grupo_slug)
    return GrupoDetalleOut(
        **GrupoOut.model_validate(found).model_dump(),
        fotos=found.fotos or [],
        productos=[
            ProductoOut(
                slug=pp.producto.slug,
                nombre=pp.producto.nombre,
                descripcion=pp.producto.descripcion,
                tipo=pp.producto.tipo,
                precio=pp.precio,
                opciones=pp.producto.opciones,
                foto_url=pp.foto_url,
                medidas=pp.producto.medidas,
            )
            for pp in service.productos_de(db, found_tienda, found)
        ],
    )


@router.post(
    "/{slug}/pedidos",
    response_model=PedidoCreadoOut,
    status_code=status.HTTP_201_CREATED,
)
def crear_pedido(
    slug: str, body: PedidoIn, request: Request, db: DbSession
) -> PedidoCreadoOut:
    """Registra el pedido (precios del servidor) y devuelve el link de pago."""
    ratelimit.enforce(
        f"rl:tiendas:pedido:{ratelimit.client_ip(request)}",
        20,
        3600,
        "Hiciste muchos pedidos seguidos. Probá en un rato.",
    )
    creado = service.crear_pedido(
        db,
        service.get_tienda(db, slug),
        items=[service.ItemPedido(**i.model_dump()) for i in body.items],
        entrega=body.entrega,
        modalidad_pago=body.modalidad_pago,
        cliente=service.DatosCliente(**body.cliente.model_dump()),
    )
    return PedidoCreadoOut(
        pedido=pedido_out(creado.pedido), init_point=creado.init_point
    )
