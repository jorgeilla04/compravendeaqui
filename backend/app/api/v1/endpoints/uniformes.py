"""Tienda de uniformes: catálogo, pedidos y avisos de pago de Mercado Pago."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Request, status

from app.api.deps import DbSession
from app.config import settings
from app.core import ratelimit
from app.models import Pedido
from app.schemas.uniformes import (
    CatalogoOut,
    CategoriaOut,
    ColegioDetalleOut,
    ColegioOut,
    PedidoCreadoOut,
    PedidoIn,
    PedidoItemOut,
    PedidoOut,
    PrendaOut,
    TiendaConfigOut,
)
from app.services import mercadopago
from app.services import uniformes as service

router = APIRouter(prefix="/uniformes", tags=["uniformes"])


def tienda_config() -> TiendaConfigOut:
    return TiendaConfigOut(
        envio_monto=settings.uniformes_envio_monto,
        express_recargo_pct=settings.uniformes_express_recargo_pct,
        sena_pct=settings.uniformes_sena_pct,
        departamentos_envio=service.DEPARTAMENTOS_ENVIO,
        pagos_online=settings.mp_configured,
        vendedora_nombre=settings.uniformes_vendedora_nombre,
        retiro_direccion=settings.uniformes_retiro_direccion,
    )


def pedido_out(pedido: Pedido, model: type[PedidoOut] = PedidoOut) -> Any:
    """Arma la respuesta (pública o de administración) desde el pedido."""
    extra = {
        "items": [PedidoItemOut.model_validate(i) for i in pedido.items],
        "whatsapp_url": service.whatsapp_vendedora_url(pedido),
        "cliente_whatsapp_url": service.whatsapp_cliente_url(pedido),
    }
    data = {
        name: extra[name] if name in extra else getattr(pedido, name)
        for name in model.model_fields
    }
    return model(**data)


@router.get("/catalogo", response_model=CatalogoOut)
def catalogo(db: DbSession) -> CatalogoOut:
    return CatalogoOut(
        categorias=[
            CategoriaOut(slug=k, nombre=v) for k, v in service.CATEGORIAS.items()
        ],
        colegios=[ColegioOut.model_validate(c) for c in service.list_colegios(db)],
        config=tienda_config(),
    )


@router.get("/colegios/{slug}", response_model=ColegioDetalleOut)
def colegio(slug: str, db: DbSession) -> ColegioDetalleOut:
    found = service.get_colegio(db, slug)
    return ColegioDetalleOut(
        **ColegioOut.model_validate(found).model_dump(),
        prendas=[
            PrendaOut(
                slug=pp.prenda.slug,
                nombre=pp.prenda.nombre,
                tipo=pp.prenda.tipo,
                precio=pp.precio,
                talles=pp.prenda.talles,
                foto_url=pp.prenda.foto_url,
            )
            for pp in service.prendas_de(db, found)
        ],
    )


@router.post(
    "/pedidos", response_model=PedidoCreadoOut, status_code=status.HTTP_201_CREATED
)
def crear_pedido(body: PedidoIn, request: Request, db: DbSession) -> PedidoCreadoOut:
    """Registra el pedido (precios del servidor) y devuelve el link de pago."""
    ratelimit.enforce(
        f"rl:uniformes:pedido:{ratelimit.client_ip(request)}",
        20,
        3600,
        "Hiciste muchos pedidos seguidos. Probá en un rato.",
    )
    creado = service.crear_pedido(
        db,
        items=[service.ItemPedido(**i.model_dump()) for i in body.items],
        envio=body.envio,
        modalidad_pago=body.modalidad_pago,
        cliente=service.DatosCliente(**body.cliente.model_dump()),
    )
    return PedidoCreadoOut(
        pedido=pedido_out(creado.pedido), init_point=creado.init_point
    )


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
        f"rl:uniformes:ver:{ratelimit.client_ip(request)}",
        120,
        900,
        "Demasiadas consultas. Probá en unos minutos.",
    )
    pedido = service.get_pedido(db, pedido_id)
    if payment_id and pedido.estado in ("pendiente_pago", "rechazado"):
        service.sincronizar_pago(db, payment_id)
        db.refresh(pedido)
    result: PedidoOut = pedido_out(pedido)
    return result


@router.post("/webhooks/mercadopago")
async def webhook_mercadopago(request: Request, db: DbSession) -> dict[str, bool]:
    """Aviso de Mercado Pago. Nunca se confía en el contenido: se consulta el pago."""
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
    data_id = str(data.get("id") or params.get("data.id") or params.get("id") or "")
    if kind != "payment" or not data_id:
        return {"ok": True}  # otros avisos (merchant_order, etc.): no se usan
    if not mercadopago.valid_signature(
        x_signature=request.headers.get("x-signature"),
        x_request_id=request.headers.get("x-request-id"),
        data_id=params.get("data.id") or data_id,
    ):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Firma inválida")
    service.sincronizar_pago(db, data_id)
    return {"ok": True}
