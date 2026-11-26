"""Pedidos que se le pasan al proveedor por su API (por ejemplo, Kanji).

Cada tienda puede tener una integración: una función que recibe el pedido ya
guardado y se lo manda al proveedor para que lo prepare y lo envíe. Por ahora
no hay ninguna conectada (los pedidos le llegan por mail a quien atiende la
tienda); cuando el proveedor publique su API, se registra acá con el slug de
la tienda.
"""

from __future__ import annotations

from collections.abc import Callable

from app.core.logging import get_logger
from app.models import Pedido

log = get_logger(__name__)

INTEGRACIONES: dict[str, Callable[[Pedido], None]] = {}


def enviar_pedido(pedido: Pedido) -> None:
    """Pasa el pedido al proveedor de la tienda, si tiene integración.

    Un error del proveedor nunca rompe el pedido: queda en el log y el pedido
    se atiende a mano.
    """
    enviar = INTEGRACIONES.get(pedido.tienda.slug)
    if enviar is None:
        return
    try:
        enviar(pedido)
    except Exception as exc:  # el pedido ya está guardado y avisado
        log.error("proveedores.envio_fallido", codigo=pedido.codigo, error=repr(exc))
