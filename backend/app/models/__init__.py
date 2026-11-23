"""Modelos ORM. Importarlos acá registra las tablas en Base.metadata."""

from app.models.auth import OtpCode, RefreshToken
from app.models.base import Base
from app.models.category import Category
from app.models.listing import Listing, ListingImage
from app.models.moderation import ModerationLog
from app.models.redes import PublicacionRed
from app.models.tiendas import (
    Grupo,
    Pedido,
    PedidoItem,
    PrecioGrupo,
    Producto,
    Tienda,
    TiendaAdmin,
    TiendaConsulta,
)
from app.models.transporte import (
    Consulta,
    Paquete,
    Reserva,
    Salida,
    TransporteAdmin,
    TransportePedido,
    TransporteUnidad,
    Transportista,
)
from app.models.user import User

__all__ = [
    "Base",
    "Category",
    "Consulta",
    "Grupo",
    "Listing",
    "ListingImage",
    "ModerationLog",
    "OtpCode",
    "Paquete",
    "PublicacionRed",
    "Pedido",
    "PedidoItem",
    "PrecioGrupo",
    "Producto",
    "RefreshToken",
    "Reserva",
    "Salida",
    "Tienda",
    "TiendaAdmin",
    "TiendaConsulta",
    "TransporteAdmin",
    "TransportePedido",
    "Transportista",
    "TransporteUnidad",
    "User",
]
