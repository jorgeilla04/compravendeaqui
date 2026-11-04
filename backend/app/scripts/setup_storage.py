"""Crea el bucket de imágenes y le da lectura pública.

Uso:  python -m app.scripts.setup_storage
"""

from __future__ import annotations

import time

from app.config import settings
from app.services.storage import ensure_bucket


def main(attempts: int = 10) -> None:
    # Al arrancar el stack, MinIO puede tardar unos segundos en aceptar conexiones.
    for attempt in range(1, attempts + 1):
        try:
            ensure_bucket(public_read=True)
            break
        except Exception:  # noqa: BLE001 - se reintenta y al final se propaga
            if attempt == attempts:
                raise
            time.sleep(2)
    print(f"Bucket listo: {settings.s3_bucket}")


if __name__ == "__main__":
    main()
