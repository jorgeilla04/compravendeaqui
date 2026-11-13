"""Cotizador de transporte para empresas: lugares, km por ruta y precio.

El precio lo calcula siempre el servidor: km por ruta (OSRM) × tarifa por km
de la unidad, más la espera, con un mínimo por viaje; por cada unidad que haga
falta para los pasajeros.
"""

from __future__ import annotations

import html
import math
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal
from functools import lru_cache
from typing import Any
from urllib.parse import quote

import httpx
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.core.logging import get_logger
from app.core.phone import wa_digits
from app.models import (
    TransporteAdmin,
    TransportePedido,
    TransporteUnidad,
    Transportista,
    User,
)
from app.schemas.transporte import LugarIn, LugarOut, PedidoTransporteIn, ViajeIn
from app.services import mailer
from app.services.tiendas import formato_pesos

log = get_logger(__name__)

HTTP_TIMEOUT = httpx.Timeout(10.0, connect=5.0)
USER_AGENT = "CompraVendeAqui/1.0 (cotizador de transporte; compravendeaqui.com.ar)"
# Más de esto en un solo viaje se coordina a mano.
MAX_UNIDADES = 10
# Centro de San Juan: las sugerencias priorizan lo cercano.
SAN_JUAN = (-31.5375, -68.5364)
ESTADO_LABEL = {
    "nuevo": "Nuevo",
    "confirmado": "Confirmado",
    "realizado": "Realizado",
    "cancelado": "Cancelado",
}


class MapaError(Exception):
    """El servicio de mapas no respondió o no encontró una ruta."""


# --- Transportistas y permisos -----------------------------------------------


def get_transportista(
    db: Session, slug: str, *, include_inactive: bool = False
) -> Transportista:
    found = db.scalars(select(Transportista).where(Transportista.slug == slug)).first()
    if found is None or (not found.activo and not include_inactive):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="No encontramos eso")
    return found


def puede_administrar(db: Session, user: User, transportista: Transportista) -> bool:
    if user.role == "admin":
        return True
    return bool(
        db.scalar(
            select(TransporteAdmin.id).where(
                TransporteAdmin.transportista_id == transportista.id,
                TransporteAdmin.user_id == user.id,
            )
        )
    )


def que_administra(db: Session, user: User) -> list[Transportista]:
    query = select(Transportista).order_by(Transportista.nombre)
    if user.role != "admin":
        query = query.join(
            TransporteAdmin, TransporteAdmin.transportista_id == Transportista.id
        ).where(TransporteAdmin.user_id == user.id)
    return list(db.scalars(query))


def unidades_activas(transportista: Transportista) -> list[TransporteUnidad]:
    return [u for u in transportista.unidades if u.activo]


# --- Mapas --------------------------------------------------------------------


def _get(url: str, params: dict[str, Any]) -> Any:
    try:
        response = httpx.get(
            url,
            params=params,
            timeout=HTTP_TIMEOUT,
            headers={"User-Agent": USER_AGENT},
        )
        response.raise_for_status()
        return response.json()
    except (httpx.HTTPError, ValueError) as exc:
        log.warning("transporte.mapa_error", url=url, error=str(exc))
        raise MapaError from exc


def lugares(q: str) -> list[LugarOut]:
    """Sugerencias de lugares en Argentina, primero los cercanos a San Juan."""
    data = _get(
        settings.photon_url,
        {
            "q": q,
            "limit": 6,
            "lat": SAN_JUAN[0],
            "lon": SAN_JUAN[1],
            "bbox": "-74,-56,-53,-21",
        },
    )
    out: list[LugarOut] = []
    vistos: set[str] = set()
    for feature in data.get("features", []):
        props = feature.get("properties", {})
        if props.get("countrycode", "AR") != "AR":
            continue
        lon, lat = feature["geometry"]["coordinates"]
        nombre = props.get("name") or props.get("street") or ""
        if props.get("street") and props.get("name") != props.get("street"):
            calle = f"{props['street']} {props.get('housenumber', '')}".strip()
            nombre = f"{nombre}, {calle}" if nombre else calle
        partes = [props.get("city") or props.get("county"), props.get("state")]
        detalle = ", ".join(p for p in partes if p and p != nombre)
        clave = f"{nombre}|{detalle}"
        if not nombre or clave in vistos:
            continue
        vistos.add(clave)
        out.append(LugarOut(nombre=nombre, detalle=detalle, lat=lat, lon=lon))
    return out


@lru_cache(maxsize=512)
def _ruta_km(o_lat: float, o_lon: float, d_lat: float, d_lon: float) -> float:
    data = _get(
        f"{settings.osrm_url}/route/v1/driving/{o_lon},{o_lat};{d_lon},{d_lat}",
        {"overview": "false"},
    )
    routes = data.get("routes") or []
    if data.get("code") != "Ok" or not routes:
        raise MapaError("sin ruta")
    return float(routes[0]["distance"]) / 1000


def distancia_km(origen: LugarIn, destino: LugarIn) -> Decimal:
    """Km por ruta (coordenadas redondeadas a ~100 m para aprovechar la caché)."""
    km = _ruta_km(
        round(origen.lat, 3),
        round(origen.lon, 3),
        round(destino.lat, 3),
        round(destino.lon, 3),
    )
    return Decimal(str(km)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)


# --- Precio -------------------------------------------------------------------


@dataclass
class Opcion:
    unidad: TransporteUnidad
    cantidad: int
    precio: Decimal


def km_cobrados(km: Decimal, ida_vuelta: bool) -> Decimal:
    return km * 2 if ida_vuelta else km


def cotizar(transportista: Transportista, km: Decimal, viaje: ViajeIn) -> list[Opcion]:
    """Precio por cada unidad que sirve, de la más barata a la más cara."""
    recorrido = km_cobrados(km, viaje.ida_vuelta)
    espera = transportista.espera_hora * viaje.horas_espera
    opciones = []
    for unidad in unidades_activas(transportista):
        cantidad = math.ceil(viaje.pasajeros / unidad.asientos)
        if cantidad > MAX_UNIDADES:
            continue
        por_unidad = max(transportista.minimo, recorrido * unidad.precio_km + espera)
        precio = (por_unidad * cantidad).quantize(Decimal(1), rounding=ROUND_HALF_UP)
        opciones.append(Opcion(unidad, cantidad, precio))
    return sorted(opciones, key=lambda o: (o.precio, o.cantidad))


def cotizar_viaje(
    transportista: Transportista, viaje: ViajeIn
) -> tuple[Decimal, list[Opcion]]:
    try:
        km = distancia_km(viaje.origen, viaje.destino)
    except MapaError as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "No pudimos calcular la distancia entre esos lugares. Probá de "
                "nuevo o elegí otro punto cercano."
            ),
        ) from exc
    return km, cotizar(transportista, km, viaje)


# --- Pedidos ------------------------------------------------------------------


def _codigo(db: Session) -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    while True:
        code = "T-" + "".join(secrets.choice(alphabet) for _ in range(6))
        if not db.scalar(
            select(TransportePedido.id).where(TransportePedido.codigo == code)
        ):
            return code


def crear_pedido(
    db: Session, transportista: Transportista, body: PedidoTransporteIn
) -> TransportePedido:
    """Recalcula el presupuesto con la unidad elegida y guarda el pedido."""
    km, opciones = cotizar_viaje(transportista, body)
    opcion = next((o for o in opciones if o.unidad.id == body.unidad_id), None)
    if opcion is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Esa unidad ya no está disponible para este viaje. Cotizá de nuevo.",
        )
    pedido = TransportePedido(
        codigo=_codigo(db),
        transportista_id=transportista.id,
        estado="nuevo",
        nombre=body.nombre,
        email=body.email,
        telefono=body.telefono,
        empresa=body.empresa,
        origen=body.origen.nombre,
        destino=body.destino.nombre,
        km=km,
        ida_vuelta=body.ida_vuelta,
        fecha=body.fecha,
        horas_espera=body.horas_espera,
        pasajeros=body.pasajeros,
        unidad=opcion.unidad.nombre,
        cantidad_unidades=opcion.cantidad,
        total=opcion.precio,
        notas=body.notas,
        created_at=datetime.now(UTC),
    )
    db.add(pedido)
    db.commit()
    db.refresh(pedido)
    return pedido


def resumen(pedido: TransportePedido) -> str:
    t = pedido.transportista
    unidades = (
        pedido.unidad
        if pedido.cantidad_unidades == 1
        else f"{pedido.cantidad_unidades} × {pedido.unidad}"
    )
    lineas = [
        f"Pedido {pedido.codigo} — {t.nombre}",
        "",
        f"Empresa: {pedido.empresa}",
        f"Contacto: {pedido.nombre} · {pedido.telefono} · {pedido.email}",
        "",
        f"Origen: {pedido.origen}",
        f"Destino: {pedido.destino}",
        f"Recorrido: {pedido.km} km{' (ida y vuelta)' if pedido.ida_vuelta else ''}",
        f"Fecha: {pedido.fecha.strftime('%d/%m/%Y') if pedido.fecha else 'a definir'}",
        f"Pasajeros: {pedido.pasajeros}",
        f"Unidad: {unidades}",
    ]
    if pedido.horas_espera:
        lineas.append(f"Espera: {pedido.horas_espera} h")
    iva = "IVA incluido" if t.iva_incluido else "más IVA"
    lineas += ["", f"Presupuesto estimado: {formato_pesos(pedido.total)} ({iva})"]
    if pedido.notas:
        lineas += ["", f"Notas: {pedido.notas}"]
    return "\n".join(lineas)


def whatsapp_url(pedido: TransportePedido) -> str:
    """Para que el cliente le escriba al transportista con el pedido."""
    texto = (
        f"Hola, soy {pedido.nombre} de {pedido.empresa}. Les dejé el pedido "
        f"{pedido.codigo} en CompraVendeAquí: {pedido.origen} → {pedido.destino}, "
        f"{pedido.pasajeros} pasajeros, presupuesto {formato_pesos(pedido.total)}."
    )
    return (
        f"https://wa.me/{wa_digits(pedido.transportista.whatsapp)}?text={quote(texto)}"
    )


def notificar(pedido: TransportePedido) -> None:
    """Mail al transportista con el pedido. Si falla, el pedido igual queda."""
    if not settings.email_configured:
        log.warning("transporte.aviso_sin_email", codigo=pedido.codigo)
        return
    texto = resumen(pedido)
    msg = mailer.new_message(
        pedido.transportista.email,
        f"Nuevo pedido de traslado {pedido.codigo} — {pedido.empresa}",
    )
    msg["Reply-To"] = pedido.email
    msg.set_content(texto)
    msg.add_alternative(
        '<pre style="font-family:Arial,Helvetica,sans-serif;font-size:15px;'
        f'line-height:1.5;white-space:pre-wrap">{html.escape(texto)}</pre>',
        subtype="html",
    )
    try:
        mailer.send(msg)
    except mailer.MailError as exc:
        log.error("transporte.aviso_fallido", codigo=pedido.codigo, error=str(exc))
