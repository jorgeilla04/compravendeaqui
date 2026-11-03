"""Crea el bucket de imágenes y le da lectura pública.

Uso:  python -m app.scripts.setup_storage
"""

from __future__ import annotations

from app.config import settings
from app.services.storage import ensure_bucket

if __name__ == "__main__":
    ensure_bucket(public_read=True)
    print(f"Bucket listo: {settings.s3_bucket}")
