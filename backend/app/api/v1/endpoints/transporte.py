"""Transporte para empresas: cotizador público y pedidos."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request, status

from app.api.deps import DbSession
from app.core import ratelimit
from app.schemas.transporte import (
    CotizacionOut,
    LugarOut,
    OpcionOut,
    PedidoCreadoOut,
    PedidoTransporteIn,
    TransportistaOut,
    UnidadOut,
    ViajeIn,
)
from app.services import transporte as service

router = APIRouter(prefix="/transporte", tags=["transporte"])


@router.get("/lugares", response_model=list[LugarOut])
def lugares(
    request: Request, q: str = Query(min_length=3, max_length=100)
) -> list[LugarOut]:
    """Sugerencias para origen y destino (el navegador no consulta a terceros)."""
    ratelimit.enforce(
        f"rl:transporte:lugares:{ratelimit.client_ip(request)}",
        120,
        600,
        "Demasiadas búsquedas. Probá en unos minutos.",
    )
    try:
        return service.lugares(q)
    except service.MapaError as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No pudimos buscar lugares ahora. Probá de nuevo en un momento.",
        ) from exc


@router.get("/{slug}", response_model=TransportistaOut)
def transportista(slug: str, db: DbSession) -> TransportistaOut:
    found = service.get_transportista(db, slug)
    return TransportistaOut(
        slug=found.slug,
        nombre=found.nombre,
        descripcion=found.descripcion,
        foto_url=found.foto_url,
        iva_incluido=found.iva_incluido,
        unidades=[UnidadOut.model_validate(u) for u in service.unidades_activas(found)],
    )


@router.post("/{slug}/cotizar", response_model=CotizacionOut)
def cotizar(slug: str, body: ViajeIn, request: Request, db: DbSession) -> CotizacionOut:
    ratelimit.enforce(
        f"rl:transporte:cotizar:{ratelimit.client_ip(request)}",
        60,
        600,
        "Demasiadas cotizaciones. Probá en unos minutos.",
    )
    found = service.get_transportista(db, slug)
    km, opciones = service.cotizar_viaje(found, body)
    return CotizacionOut(
        km=km,
        km_cobrados=service.km_cobrados(km, body.ida_vuelta),
        iva_incluido=found.iva_incluido,
        opciones=[
            OpcionOut(
                unidad_id=o.unidad.id,
                unidad=o.unidad.nombre,
                asientos=o.unidad.asientos,
                foto_url=o.unidad.foto_url,
                cantidad=o.cantidad,
                precio=o.precio,
            )
            for o in opciones
        ],
    )


@router.post(
    "/{slug}/pedidos",
    response_model=PedidoCreadoOut,
    status_code=status.HTTP_201_CREATED,
)
def crear_pedido(
    slug: str, body: PedidoTransporteIn, request: Request, db: DbSession
) -> PedidoCreadoOut:
    ratelimit.enforce(
        f"rl:transporte:pedido:{ratelimit.client_ip(request)}",
        10,
        3600,
        "Ya mandaste varios pedidos. Si necesitás otro, escribinos por WhatsApp.",
    )
    found = service.get_transportista(db, slug)
    pedido = service.crear_pedido(db, found, body)
    service.notificar(pedido)
    return PedidoCreadoOut(
        codigo=pedido.codigo,
        total=pedido.total,
        whatsapp_url=service.whatsapp_url(pedido),
    )
