"""Tienda de uniformes: catálogo, cotización, pedidos, pagos y aviso a la vendedora."""

from __future__ import annotations

import html
import re
import secrets
import unicodedata
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Any
from urllib.parse import quote

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.core.logging import get_logger
from app.core.phone import wa_digits
from app.models import Colegio, Pedido, PedidoItem, PrecioUniforme, Prenda
from app.services import images as image_service
from app.services import mailer, mercadopago, storage

log = get_logger(__name__)

CATEGORIAS: dict[str, str] = {
    "parroquiales": "Parroquiales y confesionales",
    "privados": "Privados laicos y bilingües",
    "preuniversitarios": "Preuniversitarios (UNSJ)",
}
# Departamentos del Gran San Juan con envío a domicilio.
DEPARTAMENTOS_ENVIO = [
    "Capital",
    "Chimbas",
    "Pocito",
    "Rawson",
    "Rivadavia",
    "Santa Lucía",
]
ESTADOS = (
    "pendiente_pago",
    "pagado",
    "rechazado",
    "a_coordinar",
    "en_preparacion",
    "entregado",
    "cancelado",
)
ESTADO_LABEL = {
    "pendiente_pago": "Pendiente de pago",
    "pagado": "Pagado",
    "rechazado": "Pago rechazado",
    "a_coordinar": "A coordinar por WhatsApp",
    "en_preparacion": "En preparación",
    "entregado": "Entregado",
    "cancelado": "Cancelado",
}
ENVIO_LABEL = {"estandar": "Estándar 48 hs", "express": "Express 24 hs"}
PAGO_LABEL = {"sena": "Seña", "total": "Pago total"}
NOT_FOUND = "No encontramos ese pedido"


def _pesos(value: Decimal) -> Decimal:
    return value.quantize(Decimal("1"), rounding=ROUND_HALF_UP)


def formato_pesos(value: Decimal) -> str:
    return "$" + f"{int(_pesos(value)):,}".replace(",", ".")


def slugify(text: str) -> str:
    plain = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", plain.lower()).strip("-")[:120]


# --- Catálogo -----------------------------------------------------------------


@dataclass
class PrendaPrecio:
    prenda: Prenda
    precio: Decimal


def list_colegios(db: Session, *, include_inactive: bool = False) -> list[Colegio]:
    query = select(Colegio).order_by(Colegio.categoria, Colegio.nombre)
    if not include_inactive:
        query = query.where(Colegio.activo.is_(True))
    return list(db.scalars(query))


def get_colegio(db: Session, slug: str, *, include_inactive: bool = False) -> Colegio:
    colegio = db.scalars(select(Colegio).where(Colegio.slug == slug)).first()
    if colegio is None or (not colegio.activo and not include_inactive):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Ese colegio no existe")
    return colegio


def list_prendas(db: Session, *, include_inactive: bool = False) -> list[Prenda]:
    query = select(Prenda).order_by(Prenda.orden)
    if not include_inactive:
        query = query.where(Prenda.activo.is_(True))
    return list(db.scalars(query))


def prendas_de(db: Session, colegio: Colegio) -> list[PrendaPrecio]:
    """Prendas que vende el colegio, con su precio (propio o el base)."""
    overrides = {
        p.prenda_id: p
        for p in db.scalars(
            select(PrecioUniforme).where(PrecioUniforme.colegio_id == colegio.id)
        )
    }
    result = []
    for prenda in list_prendas(db):
        override = overrides.get(prenda.id)
        if override is not None and not override.disponible:
            continue
        precio = (
            override.precio
            if override is not None and override.precio is not None
            else prenda.precio_base
        )
        result.append(PrendaPrecio(prenda, precio))
    return result


# --- Cotización ---------------------------------------------------------------


@dataclass
class Totales:
    subtotal: Decimal
    recargo_express: Decimal
    envio_monto: Decimal
    total: Decimal
    pagado_ahora: Decimal
    saldo: Decimal


def cotizar(subtotal: Decimal, envio: str, modalidad_pago: str) -> Totales:
    """Reglas del negocio (las mismas que muestra el carrito).

    - Envío Gran San Juan: monto fijo, 48 hs.
    - Express 24 hs: recargo % sobre el valor de los uniformes.
    - Seña: % del valor de los uniformes + el envío y el recargo express, que
      se pagan completos por adelantado. El saldo se paga contra entrega.
    - Total: se paga todo por adelantado.
    """
    subtotal = _pesos(subtotal)
    recargo = (
        _pesos(subtotal * settings.uniformes_express_recargo_pct / 100)
        if envio == "express"
        else Decimal(0)
    )
    envio_monto = _pesos(Decimal(settings.uniformes_envio_monto))
    total = subtotal + recargo + envio_monto
    if modalidad_pago == "sena":
        pagado = _pesos(subtotal * settings.uniformes_sena_pct / 100) + envio_monto
        pagado += recargo
    else:
        pagado = total
    return Totales(subtotal, recargo, envio_monto, total, pagado, total - pagado)


# --- Pedidos ------------------------------------------------------------------


def _codigo(db: Session) -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    while True:
        code = "U-" + "".join(secrets.choice(alphabet) for _ in range(6))
        if not db.scalar(select(Pedido.id).where(Pedido.codigo == code)):
            return code


def whatsapp_vendedora_url(pedido: Pedido) -> str:
    text = (
        f"Hola {settings.uniformes_vendedora_nombre.split()[0]}, "
        f"te escribo por mi pedido de uniformes {pedido.codigo}."
    )
    digits = wa_digits(settings.uniformes_vendedora_whatsapp)
    return f"https://wa.me/{digits}?text={quote(text)}"


def whatsapp_cliente_url(pedido: Pedido) -> str:
    text = (
        f"Hola {pedido.cliente_nombre.split()[0]}, te escribo de CompraVendeAquí "
        f"por tu pedido de uniformes {pedido.codigo}."
    )
    return f"https://wa.me/{wa_digits(pedido.cliente_tel)}?text={quote(text)}"


@dataclass
class ItemPedido:
    colegio: str
    prenda: str
    talle: str
    cantidad: int


@dataclass
class DatosCliente:
    nombre: str
    telefono: str
    email: str | None
    direccion: str
    departamento: str
    notas: str | None


@dataclass
class PedidoCreado:
    pedido: Pedido
    init_point: str | None


def crear_pedido(
    db: Session,
    items: list[ItemPedido],
    envio: str,
    modalidad_pago: str,
    cliente: DatosCliente,
) -> PedidoCreado:
    """Registra el pedido con precios del catálogo y arma el pago.

    Con Mercado Pago configurado devuelve el init_point para pagar; si no,
    el pedido queda "a coordinar" y se avisa a la vendedora en el momento.
    """
    colegios: dict[str, Colegio] = {}
    catalogo: dict[str, dict[str, PrendaPrecio]] = {}
    lineas: list[PedidoItem] = []
    subtotal = Decimal(0)
    for item in items:
        if item.colegio not in colegios:
            colegio = get_colegio(db, item.colegio)
            colegios[item.colegio] = colegio
            catalogo[item.colegio] = {
                pp.prenda.slug: pp for pp in prendas_de(db, colegio)
            }
        colegio = colegios[item.colegio]
        pp = catalogo[item.colegio].get(item.prenda)
        if pp is None:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"{colegio.nombre} no tiene esa prenda",
            )
        if item.talle not in pp.prenda.talles:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"No hay talle {item.talle} de {pp.prenda.nombre.lower()}",
            )
        subtotal += pp.precio * item.cantidad
        lineas.append(
            PedidoItem(
                colegio_id=colegio.id,
                prenda_id=pp.prenda.id,
                colegio_nombre=colegio.nombre,
                prenda_nombre=pp.prenda.nombre,
                talle=item.talle,
                cantidad=item.cantidad,
                precio_unit=pp.precio,
            )
        )

    totales = cotizar(subtotal, envio, modalidad_pago)
    pedido = Pedido(
        codigo=_codigo(db),
        cliente_nombre=cliente.nombre,
        cliente_tel=cliente.telefono,
        cliente_email=cliente.email,
        direccion=cliente.direccion,
        departamento=cliente.departamento,
        notas=cliente.notas,
        envio=envio,
        modalidad_pago=modalidad_pago,
        subtotal=totales.subtotal,
        recargo_express=totales.recargo_express,
        envio_monto=totales.envio_monto,
        total=totales.total,
        pagado_ahora=totales.pagado_ahora,
        saldo=totales.saldo,
        estado="pendiente_pago" if settings.mp_configured else "a_coordinar",
        items=lineas,
    )
    db.add(pedido)
    db.flush()

    init_point = None
    if settings.mp_configured:
        concepto = (
            f"Seña {settings.uniformes_sena_pct}% + envío"
            if modalidad_pago == "sena"
            else "Pago total"
        )
        payload = mercadopago.preference_payload(
            pedido_id=str(pedido.id),
            codigo=pedido.codigo,
            titulo=f"Uniformes escolares — {concepto} (pedido {pedido.codigo})",
            monto=pedido.pagado_ahora,
            cliente_nombre=pedido.cliente_nombre,
            cliente_email=pedido.cliente_email,
        )
        try:
            pedido.mp_preference_id, init_point = mercadopago.create_preference(
                payload, idempotency_key=str(pedido.id)
            )
        except mercadopago.MercadoPagoError as exc:
            db.rollback()
            log.error("uniformes.mp_preference_failed", error=str(exc))
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    "No pudimos conectar con Mercado Pago. Probá de nuevo en "
                    "unos minutos."
                ),
            ) from exc
    db.commit()
    db.refresh(pedido)
    log.info(
        "uniformes.pedido_creado",
        codigo=pedido.codigo,
        estado=pedido.estado,
        total=str(pedido.total),
    )
    if pedido.estado == "a_coordinar":
        notificar_vendedora(db, pedido)
    return PedidoCreado(pedido, init_point)


def get_pedido(db: Session, pedido_id: uuid.UUID) -> Pedido:
    pedido = db.get(Pedido, pedido_id)
    if pedido is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=NOT_FOUND)
    return pedido


# --- Pagos --------------------------------------------------------------------


def aplicar_pago(db: Session, payment: dict[str, Any]) -> Pedido | None:
    """Actualiza el pedido según un pago consultado a la API de Mercado Pago.

    Solo marca "pagado" si el pago está aprobado, es en pesos, corresponde al
    pedido (external_reference) y cubre exactamente lo que había que pagar.
    """
    try:
        pedido_id = uuid.UUID(str(payment.get("external_reference")))
    except ValueError:
        return None
    pedido = db.get(Pedido, pedido_id, with_for_update=True)
    if pedido is None:
        return None
    if pedido.estado not in ("pendiente_pago", "rechazado"):
        db.commit()
        return pedido  # ya resuelto (pagado o gestionado a mano)

    estado_mp = payment.get("status")
    if estado_mp == "approved":
        amount = Decimal(str(payment.get("transaction_amount", "0")))
        if payment.get("currency_id") != "ARS" or _pesos(amount) != _pesos(
            pedido.pagado_ahora
        ):
            log.error(
                "uniformes.pago_monto_distinto",
                codigo=pedido.codigo,
                esperado=str(pedido.pagado_ahora),
                recibido=str(amount),
            )
            db.commit()
            return pedido
        pedido.estado = "pagado"
        pedido.mp_payment_id = str(payment.get("id"))
        pedido.pagado_at = datetime.now(UTC)
        db.commit()
        log.info("uniformes.pedido_pagado", codigo=pedido.codigo)
        notificar_vendedora(db, pedido)
    elif estado_mp in ("rejected", "cancelled"):
        pedido.estado = "rechazado"
        pedido.mp_payment_id = str(payment.get("id"))
        db.commit()
    else:
        db.commit()  # pending / in_process: sigue esperando
    return pedido


def sincronizar_pago(db: Session, payment_id: str) -> Pedido | None:
    """Consulta el pago a Mercado Pago y lo aplica (webhook o vuelta del cliente)."""
    if not settings.mp_configured:
        return None
    try:
        payment = mercadopago.get_payment(payment_id)
    except mercadopago.MercadoPagoError as exc:
        log.warning("uniformes.mp_payment_lookup_failed", error=str(exc))
        return None
    return aplicar_pago(db, payment)


# --- Aviso a la vendedora -----------------------------------------------------


def _resumen_texto(pedido: Pedido) -> str:
    lineas = [
        f"Pedido {pedido.codigo} — {ESTADO_LABEL[pedido.estado]}",
        "",
        *(
            f"• {i.cantidad} × {i.prenda_nombre} talle {i.talle} — "
            f"{i.colegio_nombre} ({formato_pesos(i.precio_unit)} c/u)"
            for i in pedido.items
        ),
        "",
        f"Uniformes: {formato_pesos(pedido.subtotal)}",
    ]
    if pedido.recargo_express:
        lineas.append(f"Recargo express: {formato_pesos(pedido.recargo_express)}")
    lineas += [
        f"Envío ({ENVIO_LABEL[pedido.envio]}): {formato_pesos(pedido.envio_monto)}",
        f"Total: {formato_pesos(pedido.total)}",
        (
            f"{PAGO_LABEL[pedido.modalidad_pago]} pagado: "
            f"{formato_pesos(pedido.pagado_ahora)}"
            if pedido.estado == "pagado"
            else f"A pagar por adelantado: {formato_pesos(pedido.pagado_ahora)}"
        ),
        f"Saldo contra entrega: {formato_pesos(pedido.saldo)}",
        "",
        f"Cliente: {pedido.cliente_nombre}",
        f"Teléfono: {pedido.cliente_tel}",
    ]
    if pedido.cliente_email:
        lineas.append(f"Email: {pedido.cliente_email}")
    lineas.append(f"Entrega: {pedido.direccion}, {pedido.departamento}")
    if pedido.notas:
        lineas.append(f"Notas: {pedido.notas}")
    if pedido.mp_payment_id:
        lineas.append(f"Pago Mercado Pago N° {pedido.mp_payment_id}")
    lineas += ["", f"Escribile por WhatsApp: {whatsapp_cliente_url(pedido)}"]
    return "\n".join(lineas)


def notificar_vendedora(db: Session, pedido: Pedido) -> None:
    """Mail a la vendedora con el detalle. Si falla, el pedido igual queda."""
    if not settings.email_configured:
        log.warning("uniformes.aviso_sin_email", codigo=pedido.codigo)
        return
    asunto = (
        f"Nuevo pedido pagado {pedido.codigo}"
        if pedido.estado == "pagado"
        else f"Nuevo pedido a coordinar {pedido.codigo}"
    )
    texto = _resumen_texto(pedido)
    msg = mailer.new_message(settings.uniformes_vendedora_email, asunto)
    if pedido.cliente_email:
        msg["Reply-To"] = pedido.cliente_email
    msg.set_content(texto)
    msg.add_alternative(
        '<pre style="font-family:Arial,Helvetica,sans-serif;font-size:15px;'
        f'line-height:1.5;white-space:pre-wrap">{html.escape(texto)}</pre>',
        subtype="html",
    )
    try:
        mailer.send(msg)
    except mailer.MailError as exc:
        log.error("uniformes.aviso_fallido", codigo=pedido.codigo, error=str(exc))
        return
    pedido.notificado_at = datetime.now(UTC)
    db.commit()


# --- Administración -----------------------------------------------------------


def unique_slug(db: Session, nombre: str, exclude: uuid.UUID | None = None) -> str:
    base = slugify(nombre) or "colegio"
    candidate, n = base, 2
    while True:
        query = select(Colegio.id).where(Colegio.slug == candidate)
        if exclude is not None:
            query = query.where(Colegio.id != exclude)
        if not db.scalar(query):
            return candidate
        candidate, n = f"{base}-{n}", n + 1


async def subir_imagen(upload: UploadFile, carpeta: str) -> str:
    raw = await upload.read(image_service_max_bytes() + 1)
    if len(raw) > image_service_max_bytes():
        raise HTTPException(
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"La imagen puede pesar hasta {settings.image_max_upload_mb} MB",
        )
    try:
        processed = image_service.process_image(raw)
    except image_service.InvalidImageError as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc
    key = f"uniformes/{carpeta}/{uuid.uuid4().hex}.webp"
    try:
        return storage.put_object(key, processed.full, "image/webp")
    except storage.StorageError as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc


def image_service_max_bytes() -> int:
    return settings.image_max_upload_mb * 1024 * 1024
