"""Transporte para empresas: cotizador público y pedidos."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, Request, status

from app.api.deps import DbSession
from app.core import ratelimit
from app.schemas.transporte import (
    ConsultaCreadaOut,
    ConsultaIn,
    CotizacionOut,
    LugarOut,
    OpcionOut,
    PaqueteOut,
    PaqueteResumenOut,
    PedidoCreadoOut,
    PedidoTransporteIn,
    ReservaCreadaOut,
    ReservaIn,
    SalidaOut,
    TransportistaOut,
    UnidadOut,
    ViajeIn,
)
from app.services import paquetes
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
        whatsapp_url=paquetes.whatsapp_agencia(found),
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


# --- Paquetes -----------------------------------------------------------------


@router.get("/{slug}/paquetes", response_model=list[PaqueteResumenOut])
def listar_paquetes(slug: str, db: DbSession) -> list[PaqueteResumenOut]:
    found = service.get_transportista(db, slug)
    return [
        PaqueteResumenOut.model_validate(p) for p in paquetes.list_paquetes(db, found)
    ]


@router.get("/{slug}/paquetes/{paquete_slug}", response_model=PaqueteOut)
def ver_paquete(slug: str, paquete_slug: str, db: DbSession) -> PaqueteOut:
    found = service.get_transportista(db, slug)
    paquete = paquetes.get_paquete(db, found, paquete_slug)
    vencidos = paquetes.vencidos_por_salida(db, paquete)
    return PaqueteOut(
        **PaqueteResumenOut.model_validate(paquete).model_dump(),
        descripcion=paquete.descripcion,
        incluye=paquete.incluye,
        salidas=[
            SalidaOut(
                id=s.id,
                nombre=s.nombre,
                fecha=s.fecha,
                precio_persona=s.precio_persona,
                disponibles=min(s.cupos, s.disponibles + vencidos.get(s.id, 0)),
            )
            for s in paquetes.salidas_visibles(paquete)
        ],
        sena_pct=found.sena_pct,
        whatsapp_url=paquetes.whatsapp_paquete(paquete),
    )


@router.post(
    "/{slug}/paquetes/{paquete_slug}/reservas",
    response_model=ReservaCreadaOut,
    status_code=status.HTTP_201_CREATED,
)
def reservar(
    slug: str, paquete_slug: str, body: ReservaIn, request: Request, db: DbSession
) -> ReservaCreadaOut:
    ratelimit.enforce(
        f"rl:paquetes:reserva:{ratelimit.client_ip(request)}",
        8,
        3600,
        "Ya hiciste varias reservas. Si necesitás otra, escribinos por WhatsApp.",
    )
    found = service.get_transportista(db, slug)
    paquete = paquetes.get_paquete(db, found, paquete_slug)
    # Además del límite por IP, topes por email (por empresa y del sitio): los
    # mails de reserva no sirven para escribirle a alguien una y otra vez. Los
    # lugares en los contadores se toman de forma atómica y se devuelven si la
    # reserva no llega a guardarse: los intentos fallidos no bloquean a nadie.
    claves = paquetes.claves_email(found, body.email)
    permitidos = [ratelimit.hit(clave, tope, 86400)[0] for clave, tope in claves]

    def devolver() -> None:
        for clave, _ in claves:
            ratelimit.refund(clave, 86400)

    if not all(permitidos):
        devolver()
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            detail="No pudimos tomar la reserva. Escribinos por WhatsApp.",
        )
    try:
        reserva = paquetes.reservar(db, found, paquete, body)
    except HTTPException:
        # Sin lugar o salida inexistente: la reserva no se guardó.
        devolver()
        raise
    paquetes.notificar_reserva(reserva)
    return ReservaCreadaOut(
        codigo=reserva.codigo,
        total=reserva.total,
        sena=reserva.sena,
        sena_pct=found.sena_pct,
        datos_transferencia=found.datos_transferencia,
        whatsapp_url=paquetes.whatsapp_reserva(reserva),
    )


@router.post(
    "/{slug}/consultas",
    response_model=ConsultaCreadaOut,
    status_code=status.HTTP_201_CREATED,
)
def consultar(
    slug: str, body: ConsultaIn, request: Request, db: DbSession
) -> ConsultaCreadaOut:
    ratelimit.enforce(
        f"rl:paquetes:consulta:{ratelimit.client_ip(request)}",
        10,
        3600,
        "Ya nos dejaste varias consultas. Te respondemos a la brevedad.",
    )
    found = service.get_transportista(db, slug)
    _, url = paquetes.consultar(db, found, body)
    return ConsultaCreadaOut(whatsapp_url=url)
