"""Procesamiento de imágenes: webp optimizado, sin metadatos (EXIF/GPS)."""

from __future__ import annotations

import io
from dataclasses import dataclass

from PIL import Image, ImageOps, UnidentifiedImageError

# Límite anti "decompression bomb" (≈ 40 MP).
Image.MAX_IMAGE_PIXELS = 40_000_000

ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP", "MPO"}
FULL_MAX_SIDE = 1600
THUMB_MAX_SIDE = 480


class InvalidImageError(ValueError):
    pass


@dataclass
class ProcessedImage:
    full: bytes
    thumb: bytes
    width: int
    height: int


def _encode(img: Image.Image, max_side: int, quality: int) -> tuple[bytes, int, int]:
    copy = img.copy()
    copy.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    out = io.BytesIO()
    # Guardar sin exif= descarta los metadatos (incluida la ubicación GPS).
    copy.save(out, format="WEBP", quality=quality, method=6)
    return out.getvalue(), copy.width, copy.height


def process_image(data: bytes) -> ProcessedImage:
    try:
        with Image.open(io.BytesIO(data)) as probe:
            fmt = probe.format
            probe.verify()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise InvalidImageError("El archivo no es una imagen válida") from exc
    if fmt not in ALLOWED_FORMATS:
        raise InvalidImageError("Formato no soportado: usá JPG, PNG o WEBP")

    with Image.open(io.BytesIO(data)) as source:
        img: Image.Image = ImageOps.exif_transpose(source)  # rotación del celular
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGB")
        full, width, height = _encode(img, FULL_MAX_SIDE, 78)
        thumb, _, _ = _encode(img, THUMB_MAX_SIDE, 70)
    return ProcessedImage(full=full, thumb=thumb, width=width, height=height)
