"""Publicar avisos en redes sociales: arma la imagen (JPG 1080×1080, la que
acepta Instagram) y el texto, y publica en la página de Facebook y en la
cuenta de Instagram profesional vinculada, con la API de Meta.

Sin el token de la página configurado, la vista previa funciona igual y la
publicación se rechaza con un mensaje claro.
"""

from __future__ import annotations

import io
import time
import uuid
from collections.abc import Callable
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

import httpx
from fastapi import HTTPException, status
from PIL import Image, ImageDraw, ImageFont, ImageOps
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.core.logging import get_logger
from app.database import SessionLocal
from app.models import Listing, PublicacionRed, User
from app.services import storage
from app.services.listings import public_url

log = get_logger(__name__)

REDES = ("facebook", "instagram")
FUENTES = Path(__file__).resolve().parent.parent / "assets" / "fonts"
LADO = 1080
AZUL, OCRE, CLARO, GRIS = "#16233f", "#e2a33b", "#f3f1ee", "#b8c3d9"
HTTP_TIMEOUT = httpx.Timeout(30.0, connect=10.0)
CONDICION = {"nuevo": "Nuevo", "usado": "Usado", "reacondicionado": "Reacondicionado"}


class MetaError(Exception):
    """La API de Meta rechazó la publicación (el mensaje es para mostrar)."""


def configurada(red: str) -> bool:
    if red == "facebook":
        return settings.facebook_configured
    return settings.instagram_configured


# --- Texto --------------------------------------------------------------------


def precio_texto(listing: Listing) -> str:
    if listing.price is None:
        return "Consultar precio"
    numero = f"{int(Decimal(listing.price)):,}".replace(",", ".")
    return f"US$ {numero}" if listing.price_currency == "USD" else f"$ {numero}"


def _hashtag(texto: str) -> str:
    limpio = "".join(p.capitalize() for p in texto.replace("-", " ").split())
    return "#" + "".join(c for c in limpio if c.isalnum())


def texto_para(listing: Listing, red: str) -> str:
    """Texto de la publicación: en Instagram los links no se pueden tocar, así
    que se indica dónde buscarlo."""
    lineas = [listing.title, f"💰 {precio_texto(listing)}"]
    lugar = listing.department or listing.location
    if lugar:
        lineas.append(f"📍 {lugar}, San Juan")
    if listing.condition in CONDICION:
        lineas.append(f"✔️ {CONDICION[listing.condition]}")
    url = (
        f"{public_url(listing)}?utm_source={red}&utm_medium=social"
        "&utm_campaign=redes"
    )
    lineas.append("")
    if red == "instagram":
        lineas.append("👉 Consultalo en compravendeaqui.com.ar (link en el perfil)")
    else:
        lineas.append(f"👉 Consultá y comprá acá: {url}")
    lineas += ["", f"#SanJuan #CompraVendeAqui {_hashtag(listing.category.name)}"]
    return "\n".join(lineas)


# --- Imagen -------------------------------------------------------------------


def _fuente(archivo: str, tamano: int, peso: str) -> ImageFont.FreeTypeFont:
    fuente = ImageFont.truetype(str(FUENTES / archivo), tamano)
    fuente.set_variation_by_name(peso)
    return fuente


def _foto(listing: Listing) -> Image.Image | None:
    """La foto principal del aviso (desde el bucket; si no, por su URL)."""
    if not listing.images:
        return None
    imagen = next((i for i in listing.images if i.is_primary), listing.images[0])
    try:
        if imagen.storage_key:
            data = storage.get_object(f"{imagen.storage_key}.webp")
        else:
            data = httpx.get(imagen.url, timeout=HTTP_TIMEOUT).content
        return ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert("RGB")
    except (storage.StorageError, httpx.HTTPError, OSError) as exc:
        log.warning("redes.foto_no_disponible", listing=str(listing.id), error=str(exc))
        return None


def _lineas(
    draw: ImageDraw.ImageDraw, texto: str, fuente: ImageFont.FreeTypeFont, ancho: int
) -> list[str]:
    """Corta el texto en hasta 2 líneas que entren en el ancho."""
    palabras, lineas, actual = texto.split(), [], ""
    for palabra in palabras:
        prueba = f"{actual} {palabra}".strip()
        if draw.textlength(prueba, font=fuente) <= ancho:
            actual = prueba
            continue
        lineas.append(actual)
        actual = palabra
        if len(lineas) == 2:
            break
    if len(lineas) < 2 and actual:
        lineas.append(actual)
    if len(lineas) == 2 and " ".join(lineas) != " ".join(palabras):
        while draw.textlength(lineas[1] + "…", font=fuente) > ancho:
            lineas[1] = lineas[1][:-1]
        lineas[1] = lineas[1].rstrip() + "…"
    return [linea for linea in lineas if linea]


def _pin(draw: ImageDraw.ImageDraw, x: float, y: float, alto: float) -> None:
    """Isologo: pin de ubicación con una etiqueta de precio."""
    k = alto / 106
    cx, r = x + 40 * k, 38 * k
    draw.ellipse([cx - r, y, cx + r, y + 2 * r], fill="#a3391e")
    draw.polygon(
        [(cx - r * 0.94, y + r * 1.35), (cx + r * 0.94, y + r * 1.35), (cx, y + alto)],
        fill="#a3391e",
    )
    draw.rounded_rectangle(
        [cx - r * 0.5, y + r * 0.7, cx + r * 0.42, y + r * 1.3],
        radius=r * 0.12,
        fill=OCRE,
    )
    draw.ellipse(
        [cx + r * 0.12, y + r * 0.88, cx + r * 0.3, y + r * 1.06], fill="#a3391e"
    )


def componer_imagen(listing: Listing) -> bytes:
    """JPG 1080×1080: la foto arriba y una franja con precio, título y marca."""
    lienzo = Image.new("RGB", (LADO, LADO), "#ffffff")
    draw = ImageDraw.Draw(lienzo)
    franja = 330
    foto = _foto(listing)
    if foto is not None:
        caja = (LADO - 100, LADO - franja - 90)
        foto.thumbnail(caja, Image.Resampling.LANCZOS)
        lienzo.paste(
            foto, ((LADO - foto.width) // 2, 45 + (caja[1] - foto.height) // 2)
        )
    else:
        draw.rectangle([0, 0, LADO, LADO - franja], fill=CLARO)
        _pin(draw, LADO / 2 - 80, (LADO - franja) / 2 - 110, 220)

    if listing.condition in CONDICION:
        etiqueta = CONDICION[listing.condition]
        fuente = _fuente("NunitoSans.ttf", 34, "Bold")
        ancho = draw.textlength(etiqueta, font=fuente) + 44
        draw.rounded_rectangle([40, 36, 40 + ancho, 96], radius=30, fill=AZUL)
        draw.text((62, 44), etiqueta, font=fuente, fill=CLARO)

    y0 = LADO - franja
    draw.rectangle([0, y0, LADO, LADO], fill=AZUL)
    draw.text(
        (60, y0 + 34),
        precio_texto(listing),
        font=_fuente("Rubik.ttf", 88, "Bold"),
        fill=OCRE,
    )
    titulo = _fuente("NunitoSans.ttf", 42, "SemiBold")
    for i, linea in enumerate(_lineas(draw, listing.title, titulo, LADO - 120)):
        draw.text((60, y0 + 148 + i * 54), linea, font=titulo, fill=CLARO)
    marca = _fuente("Rubik.ttf", 34, "ExtraBold")
    texto_marca, resto = "CompraVende", "Aqui"
    ancho = draw.textlength(texto_marca + resto, font=marca)
    xm = LADO - 60 - ancho
    _pin(draw, xm - 46, LADO - 72, 46)
    draw.text((xm, LADO - 66), texto_marca, font=marca, fill=CLARO)
    draw.text(
        (xm + draw.textlength(texto_marca, font=marca), LADO - 66),
        resto,
        font=marca,
        fill=OCRE,
    )
    draw.text(
        (60, LADO - 62),
        "compravendeaqui.com.ar",
        font=_fuente("NunitoSans.ttf", 30, "SemiBold"),
        fill=GRIS,
    )

    salida = io.BytesIO()
    lienzo.save(salida, "JPEG", quality=88, optimize=True)
    return salida.getvalue()


# --- Meta ---------------------------------------------------------------------


def _meta(method: str, path: str, data: dict[str, Any] | None = None) -> dict[str, Any]:
    payload = {**(data or {}), "access_token": settings.meta_page_token}
    try:
        response = httpx.request(
            method,
            f"{settings.meta_graph_url}/{path}",
            data=payload if method == "POST" else None,
            params=payload if method == "GET" else None,
            timeout=HTTP_TIMEOUT,
        )
        body: dict[str, Any] = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise MetaError("No pudimos conectarnos con Meta. Probá de nuevo.") from exc
    if response.status_code >= 400 or "error" in body:
        mensaje = body.get("error", {}).get("message", "Error desconocido de Meta")
        raise MetaError(mensaje)
    return body


def publicar_facebook(imagen_url: str, texto: str) -> tuple[str, str]:
    body = _meta(
        "POST", f"{settings.meta_page_id}/photos", {"url": imagen_url, "caption": texto}
    )
    post_id = str(body.get("post_id") or body["id"])
    return post_id, f"https://www.facebook.com/{post_id}"


def publicar_instagram(
    imagen_url: str, texto: str, esperar: Callable[[float], None] = time.sleep
) -> tuple[str, str]:
    """Instagram arma un "contenedor", lo procesa y recién después se publica."""
    ig = settings.meta_ig_user_id
    contenedor = _meta(
        "POST", f"{ig}/media", {"image_url": imagen_url, "caption": texto}
    )
    creation_id = str(contenedor["id"])
    for _ in range(15):
        estado = _meta("GET", creation_id, {"fields": "status_code"})
        if estado.get("status_code") == "FINISHED":
            break
        if estado.get("status_code") == "ERROR":
            raise MetaError("Instagram no pudo procesar la imagen")
        esperar(2)
    else:
        raise MetaError("Instagram tardó demasiado en procesar la imagen")
    media = _meta("POST", f"{ig}/media_publish", {"creation_id": creation_id})
    media_id = str(media["id"])
    link = _meta("GET", media_id, {"fields": "permalink"}).get("permalink", "")
    return media_id, str(link)


# --- Publicaciones ------------------------------------------------------------


def get_listing(db: Session, listing_id: uuid.UUID) -> Listing:
    listing = db.get(Listing, listing_id)
    if listing is None or listing.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Ese aviso no existe")
    return listing


def crear_publicaciones(
    db: Session, listing: Listing, redes: list[str], user: User
) -> list[PublicacionRed]:
    if listing.status != "active":
        raise HTTPException(
            status.HTTP_409_CONFLICT, detail="Solo se publican avisos activos"
        )
    faltan = [r for r in redes if not configurada(r)]
    if faltan:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail=f"Falta conectar {', '.join(r.capitalize() for r in faltan)}",
        )
    imagen_url = storage.put_object(
        f"redes/{listing.id}/{uuid.uuid4().hex}.jpg",
        componer_imagen(listing),
        "image/jpeg",
    )
    ahora = datetime.now(UTC)
    filas = [
        PublicacionRed(
            listing_id=listing.id,
            red=red,
            estado="pendiente",
            texto=texto_para(listing, red),
            imagen_url=imagen_url,
            creada_por=user.id,
            created_at=ahora,
        )
        for red in redes
    ]
    db.add_all(filas)
    db.commit()
    for fila in filas:
        db.refresh(fila)
    return filas


def publicar(db: Session, fila: PublicacionRed) -> None:
    """Publica una fila pendiente (o con error, al reintentar)."""
    try:
        if fila.red == "facebook":
            post_id, link = publicar_facebook(fila.imagen_url or "", fila.texto)
        else:
            post_id, link = publicar_instagram(fila.imagen_url or "", fila.texto)
    except MetaError as exc:
        fila.estado, fila.error = "error", str(exc)
        log.warning("redes.error", id=str(fila.id), red=fila.red, error=str(exc))
    else:
        fila.estado, fila.error = "publicada", None
        fila.post_id, fila.permalink = post_id, link
        fila.publicada_at = datetime.now(UTC)
    db.commit()


def publicar_en_segundo_plano(ids: list[uuid.UUID]) -> None:
    with SessionLocal() as db:
        for fila in db.scalars(
            select(PublicacionRed).where(PublicacionRed.id.in_(ids))
        ):
            publicar(db, fila)
