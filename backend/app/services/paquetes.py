"""Agencia de viajes: paquetes con salidas y cupos, reservas con seña y
consultas. Los importes y los cupos los controla siempre el servidor."""

from __future__ import annotations

import html
import secrets
from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal
from urllib.parse import quote

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.core.logging import get_logger
from app.core.phone import wa_digits
from app.models import Consulta, Paquete, Reserva, Salida, Transportista
from app.schemas.transporte import ConsultaIn, ReservaIn
from app.services import mailer
from app.services.tiendas import formato_pesos, slugify

log = get_logger(__name__)

ESTADO_RESERVA = {
    "pendiente_sena": "Pendiente de seña",
    "senada": "Señada",
    "confirmada": "Confirmada",
    "cancelada": "Cancelada",
}


def list_paquetes(
    db: Session, transportista: Transportista, *, include_inactive: bool = False
) -> list[Paquete]:
    query = (
        select(Paquete)
        .where(Paquete.transportista_id == transportista.id)
        .order_by(Paquete.orden, Paquete.titulo)
    )
    if not include_inactive:
        query = query.where(Paquete.activo.is_(True))
    return list(db.scalars(query))


def get_paquete(
    db: Session,
    transportista: Transportista,
    slug: str,
    *,
    include_inactive: bool = False,
) -> Paquete:
    paquete = db.scalars(
        select(Paquete).where(
            Paquete.transportista_id == transportista.id, Paquete.slug == slug
        )
    ).first()
    if paquete is None or (not paquete.activo and not include_inactive):
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Ese paquete no existe")
    return paquete


def salidas_visibles(paquete: Paquete) -> list[Salida]:
    return [s for s in paquete.salidas if s.activo]


def unique_slug(db: Session, transportista: Transportista, titulo: str) -> str:
    base = slugify(titulo)[:100] or "paquete"
    candidate, n = base, 2
    while db.scalar(
        select(Paquete.id).where(
            Paquete.transportista_id == transportista.id, Paquete.slug == candidate
        )
    ):
        candidate, n = f"{base}-{n}", n + 1
    return candidate


def _wa(numero: str, texto: str) -> str:
    return f"https://wa.me/{wa_digits(numero)}?text={quote(texto)}"


def whatsapp_agencia(transportista: Transportista) -> str:
    return _wa(transportista.whatsapp, "Hola, quiero consultar por un viaje.")


def whatsapp_paquete(paquete: Paquete) -> str:
    url = f"{settings.public_site_url}/transporte/{paquete.transportista.slug}"
    return _wa(
        paquete.transportista.whatsapp,
        f"Hola, quiero consultar por el paquete {paquete.titulo}: "
        f"{url}/paquetes/{paquete.slug}",
    )


# --- Reservas -----------------------------------------------------------------


def _codigo(db: Session) -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    while True:
        code = "R-" + "".join(secrets.choice(alphabet) for _ in range(6))
        if not db.scalar(select(Reserva.id).where(Reserva.codigo == code)):
            return code


def reservar(
    db: Session, transportista: Transportista, paquete: Paquete, body: ReservaIn
) -> Reserva:
    """Toma los lugares de la salida (con lock: dos reservas a la vez no
    sobrevenden) y deja la reserva pendiente de seña."""
    salida = db.scalars(
        select(Salida)
        .where(Salida.id == body.salida_id, Salida.paquete_id == paquete.id)
        .with_for_update()
    ).first()
    if salida is None or not salida.activo:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, detail="Esa salida ya no está disponible"
        )
    if salida.disponibles < body.pasajeros:
        db.rollback()
        detail = (
            f"Quedan {salida.disponibles} lugares en {salida.nombre}."
            if salida.disponibles
            else f"No quedan lugares en {salida.nombre}. Elegí otra salida."
        )
        raise HTTPException(status.HTTP_409_CONFLICT, detail=detail)
    total = salida.precio_persona * body.pasajeros
    sena = (total * transportista.sena_pct / 100).quantize(
        Decimal(1), rounding=ROUND_HALF_UP
    )
    salida.reservados += body.pasajeros
    reserva = Reserva(
        codigo=_codigo(db),
        transportista_id=transportista.id,
        salida_id=salida.id,
        estado="pendiente_sena",
        paquete_titulo=paquete.titulo,
        salida_nombre=salida.nombre,
        pasajeros=body.pasajeros,
        precio_persona=salida.precio_persona,
        total=total,
        sena=sena,
        nombre=body.nombre,
        email=body.email,
        telefono=body.telefono,
        dni=body.dni,
        notas=body.notas,
        created_at=datetime.now(UTC),
    )
    db.add(reserva)
    db.commit()
    db.refresh(reserva)
    return reserva


def cambiar_estado(db: Session, reserva: Reserva, estado: str) -> None:
    """Cancelar libera los lugares; reactivar los vuelve a tomar si quedan."""
    if estado == reserva.estado:
        return
    salida = db.scalars(
        select(Salida).where(Salida.id == reserva.salida_id).with_for_update()
    ).one()
    if estado == "cancelada":
        salida.reservados = max(0, salida.reservados - reserva.pasajeros)
    elif reserva.estado == "cancelada":
        if salida.disponibles < reserva.pasajeros:
            db.rollback()
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                detail=f"Ya no quedan {reserva.pasajeros} lugares en esa salida",
            )
        salida.reservados += reserva.pasajeros
    reserva.estado = estado
    db.commit()


def whatsapp_reserva(reserva: Reserva) -> str:
    return _wa(
        reserva.transportista.whatsapp,
        f"Hola, soy {reserva.nombre}. Hice la reserva {reserva.codigo} de "
        f"{reserva.paquete_titulo} ({reserva.salida_nombre}, {reserva.pasajeros} "
        f"pasajeros). Les mando el comprobante de la seña de "
        f"{formato_pesos(reserva.sena)}.",
    )


def _resumen_reserva(reserva: Reserva) -> str:
    t = reserva.transportista
    lineas = [
        f"Reserva {reserva.codigo} — {reserva.paquete_titulo}",
        "",
        f"Salida: {reserva.salida_nombre}",
        f"Pasajeros: {reserva.pasajeros} × {formato_pesos(reserva.precio_persona)}",
        f"Total: {formato_pesos(reserva.total)}",
        f"Seña ({t.sena_pct}%): {formato_pesos(reserva.sena)}",
        "",
        f"Titular: {reserva.nombre}" + (f" · DNI {reserva.dni}" if reserva.dni else ""),
        f"Contacto: {reserva.telefono} · {reserva.email}",
    ]
    if reserva.notas:
        lineas += ["", f"Notas: {reserva.notas}"]
    return "\n".join(lineas)


def _send(to: str, asunto: str, texto: str, reply_to: str | None = None) -> None:
    if not settings.email_configured:
        log.warning("paquetes.mail_sin_configurar", asunto=asunto)
        return
    msg = mailer.new_message(to, asunto)
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.set_content(texto)
    msg.add_alternative(
        '<pre style="font-family:Arial,Helvetica,sans-serif;font-size:15px;'
        f'line-height:1.5;white-space:pre-wrap">{html.escape(texto)}</pre>',
        subtype="html",
    )
    try:
        mailer.send(msg)
    except mailer.MailError as exc:
        log.error("paquetes.mail_fallido", asunto=asunto, error=str(exc))


def notificar_reserva(reserva: Reserva) -> None:
    """A la agencia, con el detalle; al cliente, con cómo pagar la seña."""
    t = reserva.transportista
    resumen = _resumen_reserva(reserva)
    _send(
        t.email,
        f"Nueva reserva {reserva.codigo} — {reserva.paquete_titulo}",
        resumen,
        reply_to=reserva.email,
    )
    pago = (
        f"Para confirmarla, transferí la seña de {formato_pesos(reserva.sena)}:\n"
        f"{t.datos_transferencia}\n\n"
        if t.datos_transferencia
        else "Te escribimos para coordinar el pago de la seña.\n\n"
    )
    _send(
        reserva.email,
        f"Tu reserva {reserva.codigo} — {reserva.paquete_titulo}",
        f"Hola {reserva.nombre.split()[0]}, recibimos tu reserva. Los lugares "
        f"quedan apartados mientras se acredita la seña.\n\n{pago}"
        f"Mandanos el comprobante por WhatsApp: {whatsapp_reserva(reserva)}\n\n"
        f"{resumen}\n\n{t.nombre}",
        reply_to=t.email,
    )


# --- Consultas ----------------------------------------------------------------


def consultar(
    db: Session, transportista: Transportista, body: ConsultaIn
) -> tuple[Consulta, str]:
    paquete = get_paquete(db, transportista, body.paquete) if body.paquete else None
    consulta = Consulta(
        transportista_id=transportista.id,
        paquete_id=paquete.id if paquete else None,
        paquete_titulo=paquete.titulo if paquete else None,
        nombre=body.nombre,
        telefono=body.telefono,
        email=body.email,
        mensaje=body.mensaje,
        estado="nueva",
        created_at=datetime.now(UTC),
    )
    db.add(consulta)
    db.commit()
    sobre = f" por {paquete.titulo}" if paquete else ""
    _send(
        transportista.email,
        f"Nueva consulta{sobre} — {consulta.nombre}",
        "\n".join(
            [
                f"Consulta{sobre}",
                "",
                f"Nombre: {consulta.nombre}",
                f"Teléfono: {consulta.telefono}",
                f"Email: {consulta.email or '—'}",
                "",
                consulta.mensaje or "(sin mensaje)",
                "",
                f"Responder por WhatsApp: https://wa.me/{wa_digits(consulta.telefono)}",
            ]
        ),
        reply_to=consulta.email,
    )
    url = whatsapp_paquete(paquete) if paquete else whatsapp_agencia(transportista)
    return consulta, url
