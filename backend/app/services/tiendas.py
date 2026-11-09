"""Tiendas virtuales: catálogo, cotización, pedidos, pagos y aviso al dueño."""

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
from app.models import Grupo, Pedido, PedidoItem, PrecioGrupo, Producto, Tienda, User
from app.models.tiendas import TiendaAdmin
from app.services import images as image_service
from app.services import mailer, mercadopago, storage

log = get_logger(__name__)

ESTADO_LABEL = {
    "pendiente_pago": "Pendiente de pago",
    "pagado": "Pagado",
    "rechazado": "Pago rechazado",
    "a_coordinar": "A coordinar por WhatsApp",
    "en_preparacion": "En preparación",
    "entregado": "Entregado",
    "cancelado": "Cancelado",
}
PAGO_LABEL = {"sena": "Seña", "total": "Pago total"}
# Formas de los dibujos de productos (el resto usa uno genérico).
TIPOS_ILUSTRACION = (
    "remera",
    "pantalon",
    "pollera",
    "corbata",
    "buzo",
    "campera",
    "bermuda",
    "jogging",
    "generico",
)
# Rutas de la tienda (/tiendas/<tienda>/<grupo>): un grupo no puede llamarse así.
RESERVED_SLUGS = {"admin", "carrito", "pedido"}
NOT_FOUND = "No encontramos ese pedido"


def _pesos(value: Decimal) -> Decimal:
    return value.quantize(Decimal("1"), rounding=ROUND_HALF_UP)


def formato_pesos(value: Decimal) -> str:
    return "$" + f"{int(_pesos(value)):,}".replace(",", ".")


def slugify(text: str) -> str:
    plain = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", plain.lower()).strip("-")[:100]


def _primer_nombre(nombre: str) -> str:
    return (nombre.split() or [""])[0]


# --- Tiendas y permisos -------------------------------------------------------


def list_tiendas(db: Session) -> list[Tienda]:
    return list(
        db.scalars(
            select(Tienda).where(Tienda.activo.is_(True)).order_by(Tienda.nombre)
        )
    )


def get_tienda(db: Session, slug: str, *, include_inactive: bool = False) -> Tienda:
    tienda = db.scalars(select(Tienda).where(Tienda.slug == slug)).first()
    if tienda is None or (not tienda.activo and not include_inactive):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Esa tienda no existe")
    return tienda


def puede_administrar(db: Session, user: User, tienda: Tienda) -> bool:
    if user.role == "admin":
        return True
    return bool(
        db.scalar(
            select(TiendaAdmin.id).where(
                TiendaAdmin.tienda_id == tienda.id, TiendaAdmin.user_id == user.id
            )
        )
    )


def tiendas_que_administra(db: Session, user: User) -> list[Tienda]:
    query = select(Tienda).order_by(Tienda.nombre)
    if user.role != "admin":
        query = query.join(TiendaAdmin, TiendaAdmin.tienda_id == Tienda.id).where(
            TiendaAdmin.user_id == user.id
        )
    return list(db.scalars(query))


def entregas(tienda: Tienda) -> list[str]:
    opciones = []
    if tienda.envio_habilitado:
        opciones.append("estandar")
        if tienda.express_habilitado:
            opciones.append("express")
    if tienda.retiro_habilitado:
        opciones.append("retiro")
    return opciones


def modalidades(tienda: Tienda) -> list[str]:
    return [
        m
        for m, ok in (
            ("sena", tienda.sena_habilitada),
            ("total", tienda.total_habilitado),
        )
        if ok
    ]


def validar_config(tienda: Tienda) -> None:
    """Una tienda tiene que poder entregar y cobrar de alguna forma."""
    if not entregas(tienda):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Habilitá el envío a domicilio o el retiro en el local",
        )
    if not modalidades(tienda):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Habilitá la seña o el pago total",
        )
    if tienda.retiro_habilitado and not (tienda.retiro_direccion or "").strip():
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cargá la dirección de retiro",
        )
    if tienda.envio_habilitado and not tienda.departamentos_envio:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Elegí al menos un departamento de envío",
        )


# --- Catálogo -----------------------------------------------------------------


@dataclass
class ProductoPrecio:
    producto: Producto
    precio: Decimal


def list_grupos(
    db: Session, tienda: Tienda, *, include_inactive: bool = False
) -> list[Grupo]:
    query = select(Grupo).where(Grupo.tienda_id == tienda.id).order_by(Grupo.nombre)
    if not include_inactive:
        query = query.where(Grupo.activo.is_(True))
    grupos = list(db.scalars(query))
    orden = {c: i for i, c in enumerate(tienda.categorias)}
    return sorted(grupos, key=lambda g: orden.get(g.categoria or "", len(orden)))


def get_grupo(
    db: Session, tienda: Tienda, slug: str, *, include_inactive: bool = False
) -> Grupo:
    grupo = db.scalars(
        select(Grupo).where(Grupo.tienda_id == tienda.id, Grupo.slug == slug)
    ).first()
    if grupo is None or (not grupo.activo and not include_inactive):
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            detail=f"No encontramos ese {tienda.grupo_label.lower()}",
        )
    return grupo


def list_productos(
    db: Session, tienda: Tienda, *, include_inactive: bool = False
) -> list[Producto]:
    query = (
        select(Producto)
        .where(Producto.tienda_id == tienda.id)
        .order_by(Producto.orden, Producto.nombre)
    )
    if not include_inactive:
        query = query.where(Producto.activo.is_(True))
    return list(db.scalars(query))


def get_producto(db: Session, tienda: Tienda, slug: str) -> Producto:
    producto = db.scalars(
        select(Producto).where(Producto.tienda_id == tienda.id, Producto.slug == slug)
    ).first()
    if producto is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Ese producto no existe")
    return producto


def productos_de(db: Session, tienda: Tienda, grupo: Grupo) -> list[ProductoPrecio]:
    """Productos que se venden en el grupo, con su precio (propio o el base)."""
    overrides = {
        p.producto_id: p
        for p in db.scalars(select(PrecioGrupo).where(PrecioGrupo.grupo_id == grupo.id))
    }
    result = []
    for producto in list_productos(db, tienda):
        override = overrides.get(producto.id)
        disponible = (
            override.disponible if override is not None else tienda.productos_en_todos
        )
        if not disponible:
            continue
        precio = (
            override.precio
            if override is not None and override.precio is not None
            else producto.precio_base
        )
        result.append(ProductoPrecio(producto, precio))
    return result


# --- Cotización ---------------------------------------------------------------


@dataclass
class Totales:
    subtotal: Decimal
    envio_monto: Decimal
    recargo_express: Decimal
    total: Decimal
    pagado_ahora: Decimal
    saldo: Decimal


def cotizar(tienda: Tienda, subtotal: Decimal, entrega: str, modalidad: str) -> Totales:
    """Reglas de cada tienda (las mismas que muestra el carrito).

    - Envío: monto fijo (0 = gratis); gratis si los productos llegan a
      "gratis desde". Retiro en el local: sin costo.
    - Express: el envío más un recargo (% de los productos + monto fijo).
    - Seña: % de los productos + envío y express, por adelantado; el saldo,
      contra entrega. Total: todo por adelantado.
    """
    subtotal = _pesos(subtotal)
    envio = Decimal(0)
    recargo = Decimal(0)
    if entrega in ("estandar", "express"):
        gratis = (
            tienda.envio_gratis_desde is not None
            and subtotal >= tienda.envio_gratis_desde
        )
        envio = Decimal(0) if gratis else _pesos(tienda.envio_monto)
    if entrega == "express":
        recargo = _pesos(subtotal * tienda.express_recargo_pct / 100) + _pesos(
            tienda.express_monto
        )
    total = subtotal + envio + recargo
    if modalidad == "sena":
        pagado = _pesos(subtotal * tienda.sena_pct / 100) + envio + recargo
    else:
        pagado = total
    return Totales(subtotal, envio, recargo, total, pagado, total - pagado)


# --- Pedidos ------------------------------------------------------------------


def _codigo(db: Session) -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    while True:
        code = "P-" + "".join(secrets.choice(alphabet) for _ in range(6))
        if not db.scalar(select(Pedido.id).where(Pedido.codigo == code)):
            return code


def _wa(numero: str, texto: str) -> str:
    return f"https://wa.me/{wa_digits(numero)}?text={quote(texto)}"


def whatsapp_consulta_url(tienda: Tienda) -> str:
    return _wa(
        tienda.vendedor_whatsapp,
        f"Hola {_primer_nombre(tienda.vendedor_nombre)}, te escribo por "
        f"{tienda.nombre} de CompraVendeAquí.",
    )


def whatsapp_vendedor_url(pedido: Pedido) -> str:
    return _wa(
        pedido.tienda.vendedor_whatsapp,
        f"Hola {_primer_nombre(pedido.tienda.vendedor_nombre)}, te escribo por mi "
        f"pedido {pedido.codigo} de {pedido.tienda.nombre}.",
    )


def whatsapp_cliente_url(pedido: Pedido) -> str:
    return _wa(
        pedido.cliente_tel,
        f"Hola {_primer_nombre(pedido.cliente_nombre)}, te escribo de "
        f"{pedido.tienda.nombre} (CompraVendeAquí) por tu pedido {pedido.codigo}.",
    )


def entrega_label(tienda: Tienda, entrega: str) -> str:
    return {
        "estandar": f"Envío a domicilio ({tienda.envio_demora})",
        "express": f"Envío express ({tienda.express_demora})",
        "retiro": "Retiro en el local",
    }[entrega]


@dataclass
class ItemPedido:
    grupo: str
    producto: str
    opcion: str | None
    cantidad: int


@dataclass
class DatosCliente:
    nombre: str
    telefono: str
    email: str | None
    direccion: str | None
    departamento: str | None
    notas: str | None


@dataclass
class PedidoCreado:
    pedido: Pedido
    init_point: str | None


def _validar_entrega(
    tienda: Tienda, entrega: str, modalidad: str, cliente: DatosCliente
) -> None:
    if entrega not in entregas(tienda):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Esa forma de entrega no está disponible",
        )
    if modalidad not in modalidades(tienda):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Esa forma de pago no está disponible",
        )
    if entrega != "retiro":
        if not cliente.direccion:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Escribí la dirección de entrega",
            )
        if cliente.departamento not in tienda.departamentos_envio:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Por ahora enviamos a: " + ", ".join(tienda.departamentos_envio),
            )


def crear_pedido(
    db: Session,
    tienda: Tienda,
    items: list[ItemPedido],
    entrega: str,
    modalidad_pago: str,
    cliente: DatosCliente,
) -> PedidoCreado:
    """Registra el pedido con precios del catálogo y arma el pago.

    Con Mercado Pago configurado devuelve el init_point; si no, el pedido queda
    "a coordinar" y se avisa al dueño en el momento.
    """
    _validar_entrega(tienda, entrega, modalidad_pago, cliente)
    grupos: dict[str, Grupo] = {}
    catalogo: dict[str, dict[str, ProductoPrecio]] = {}
    lineas: list[PedidoItem] = []
    subtotal = Decimal(0)
    for item in items:
        if item.grupo not in grupos:
            grupo = get_grupo(db, tienda, item.grupo)
            grupos[item.grupo] = grupo
            catalogo[item.grupo] = {
                pp.producto.slug: pp for pp in productos_de(db, tienda, grupo)
            }
        grupo = grupos[item.grupo]
        pp = catalogo[item.grupo].get(item.producto)
        if pp is None:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"{grupo.nombre} no tiene ese producto",
            )
        opciones = pp.producto.opciones
        if (opciones and item.opcion not in opciones) or (not opciones and item.opcion):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    f"Elegí {tienda.opcion_label.lower()} de "
                    f"{pp.producto.nombre.lower()}"
                    if opciones
                    else f"{pp.producto.nombre} no tiene {tienda.opcion_label.lower()}"
                ),
            )
        subtotal += pp.precio * item.cantidad
        lineas.append(
            PedidoItem(
                grupo_id=grupo.id,
                producto_id=pp.producto.id,
                grupo_nombre=grupo.nombre,
                producto_nombre=pp.producto.nombre,
                opcion=item.opcion if opciones else None,
                cantidad=item.cantidad,
                precio_unit=pp.precio,
            )
        )

    t = cotizar(tienda, subtotal, entrega, modalidad_pago)
    retiro = entrega == "retiro"
    pedido = Pedido(
        tienda_id=tienda.id,
        codigo=_codigo(db),
        cliente_nombre=cliente.nombre,
        cliente_tel=cliente.telefono,
        cliente_email=cliente.email,
        direccion=None if retiro else cliente.direccion,
        departamento=None if retiro else cliente.departamento,
        notas=cliente.notas,
        entrega=entrega,
        modalidad_pago=modalidad_pago,
        subtotal=t.subtotal,
        envio_monto=t.envio_monto,
        recargo_express=t.recargo_express,
        total=t.total,
        pagado_ahora=t.pagado_ahora,
        saldo=t.saldo,
        estado="pendiente_pago" if settings.mp_configured else "a_coordinar",
        items=lineas,
    )
    db.add(pedido)
    db.flush()
    pedido.tienda = tienda

    init_point = None
    if settings.mp_configured:
        concepto = (
            f"Seña {tienda.sena_pct}%" + ("" if retiro else " + envío")
            if modalidad_pago == "sena"
            else "Pago total"
        )
        payload = mercadopago.preference_payload(
            pedido_id=str(pedido.id),
            codigo=pedido.codigo,
            titulo=f"{tienda.nombre} — {concepto} (pedido {pedido.codigo})",
            monto=pedido.pagado_ahora,
            cliente_nombre=pedido.cliente_nombre,
            cliente_email=pedido.cliente_email,
        )
        try:
            pedido.mp_preference_id, init_point = mercadopago.create_preference(
                payload, idempotency_key=str(pedido.id)
            )
            pedido.mp_init_point = init_point
        except mercadopago.MercadoPagoError as exc:
            db.rollback()
            log.error("tiendas.mp_preference_failed", error=str(exc))
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
        "tiendas.pedido_creado",
        tienda=tienda.slug,
        codigo=pedido.codigo,
        estado=pedido.estado,
        total=str(pedido.total),
    )
    if pedido.estado == "a_coordinar":
        notificar_vendedor(db, pedido)
    return PedidoCreado(pedido, init_point)


def get_pedido(db: Session, pedido_id: uuid.UUID) -> Pedido:
    pedido = db.get(Pedido, pedido_id)
    if pedido is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=NOT_FOUND)
    return pedido


# --- Pagos --------------------------------------------------------------------


def aplicar_pago(
    db: Session, payment: dict[str, Any], solo_pedido: uuid.UUID | None = None
) -> Pedido | None:
    """Actualiza el pedido según un pago consultado a la API de Mercado Pago.

    Solo marca "pagado" si el pago está aprobado, es en pesos, corresponde al
    pedido (external_reference) y cubre exactamente lo que había que pagar.
    """
    try:
        pedido_id = uuid.UUID(str(payment.get("external_reference")))
    except ValueError:
        return None
    if solo_pedido is not None and pedido_id != solo_pedido:
        log.warning("tiendas.pago_de_otro_pedido", pedido=str(solo_pedido))
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
                "tiendas.pago_monto_distinto",
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
        log.info("tiendas.pedido_pagado", codigo=pedido.codigo)
        notificar_vendedor(db, pedido)
    elif estado_mp in ("rejected", "cancelled"):
        pedido.estado = "rechazado"
        pedido.mp_payment_id = str(payment.get("id"))
        db.commit()
    else:
        db.commit()  # pending / in_process: sigue esperando
    return pedido


def sincronizar_pago(
    db: Session, payment_id: str, solo_pedido: uuid.UUID | None = None
) -> Pedido | None:
    """Consulta el pago a Mercado Pago y lo aplica (webhook o vuelta del cliente).

    solo_pedido: si viene, el pago solo se aplica a ese pedido.
    """
    if not settings.mp_configured:
        return None
    try:
        payment = mercadopago.get_payment(payment_id)
    except mercadopago.MercadoPagoError as exc:
        log.warning("tiendas.mp_payment_lookup_failed", error=str(exc))
        return None
    return aplicar_pago(db, payment, solo_pedido)


# --- Aviso al dueño de la tienda ---------------------------------------------


def _resumen_texto(pedido: Pedido) -> str:
    tienda = pedido.tienda
    opcion = tienda.opcion_label.lower()
    lineas = [
        f"{tienda.nombre} — pedido {pedido.codigo} ({ESTADO_LABEL[pedido.estado]})",
        "",
        *(
            f"• {i.cantidad} × {i.producto_nombre}"
            + (f" {opcion} {i.opcion}" if i.opcion else "")
            + f" — {i.grupo_nombre} ({formato_pesos(i.precio_unit)} c/u)"
            for i in pedido.items
        ),
        "",
        f"Productos: {formato_pesos(pedido.subtotal)}",
        f"{entrega_label(tienda, pedido.entrega)}: {formato_pesos(pedido.envio_monto)}",
    ]
    if pedido.recargo_express:
        lineas.append(f"Recargo express: {formato_pesos(pedido.recargo_express)}")
    lineas += [
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
    if pedido.entrega == "retiro":
        lineas.append(f"Retira en: {tienda.retiro_direccion}")
    else:
        lineas.append(f"Entrega: {pedido.direccion}, {pedido.departamento}")
    if pedido.notas:
        lineas.append(f"Notas: {pedido.notas}")
    if pedido.mp_payment_id:
        lineas.append(f"Pago Mercado Pago N° {pedido.mp_payment_id}")
    lineas += ["", f"Escribile por WhatsApp: {whatsapp_cliente_url(pedido)}"]
    return "\n".join(lineas)


def notificar_vendedor(db: Session, pedido: Pedido) -> None:
    """Mail al dueño de la tienda con el detalle. Si falla, el pedido igual queda."""
    try:
        _notificar_vendedor(db, pedido)
    except Exception as exc:  # nunca romper un pedido ya guardado
        log.error("tiendas.aviso_error", codigo=pedido.codigo, error=repr(exc))


def _notificar_vendedor(db: Session, pedido: Pedido) -> None:
    if not settings.email_configured:
        log.warning("tiendas.aviso_sin_email", codigo=pedido.codigo)
        return
    tipo = "pagado" if pedido.estado == "pagado" else "a coordinar"
    asunto = f"Nuevo pedido {tipo} {pedido.codigo} — {pedido.tienda.nombre}"
    texto = _resumen_texto(pedido)
    msg = mailer.new_message(pedido.tienda.vendedor_email, asunto)
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
        log.error("tiendas.aviso_fallido", codigo=pedido.codigo, error=str(exc))
        return
    pedido.notificado_at = datetime.now(UTC)
    db.commit()


# --- Administración -----------------------------------------------------------


def unique_slug(
    db: Session,
    model: type[Grupo] | type[Producto] | type[Tienda],
    nombre: str,
    tienda: Tienda | None = None,
) -> str:
    base = slugify(nombre) or "item"
    if model is Grupo and base in RESERVED_SLUGS:
        base = f"{slugify(tienda.grupo_label) if tienda else 'grupo'}-{base}"
    if model is Tienda and base in RESERVED_SLUGS | {"pedidos", "webhooks"}:
        base = f"tienda-{base}"
    candidate, n = base, 2
    while True:
        query = select(model.id).where(model.slug == candidate)
        if tienda is not None and model is not Tienda:
            query = query.where(getattr(model, "tienda_id") == tienda.id)
        if not db.scalar(query):
            return candidate
        candidate, n = f"{base}-{n}", n + 1


async def subir_imagen(upload: UploadFile, carpeta: str) -> str:
    max_bytes = settings.image_max_upload_mb * 1024 * 1024
    raw = await upload.read(max_bytes + 1)
    if len(raw) > max_bytes:
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
    key = f"tiendas/{carpeta}/{uuid.uuid4().hex}.webp"
    try:
        return storage.put_object(key, processed.full, "image/webp")
    except storage.StorageError as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc
