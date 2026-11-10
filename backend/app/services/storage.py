"""Almacenamiento de objetos S3 compatible (AWS S3, MinIO, Cloudflare R2)."""

from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from app.config import settings
from app.core.logging import get_logger

log = get_logger(__name__)


class StorageError(Exception):
    pass


@lru_cache
def _client() -> Any:
    if not settings.s3_configured:
        raise StorageError("Almacenamiento S3 no configurado (S3_ACCESS_KEY_ID)")
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url or None,
        region_name=settings.s3_region,
        aws_access_key_id=settings.s3_access_key_id,
        aws_secret_access_key=settings.s3_secret_access_key,
        config=Config(signature_version="s3v4", retries={"max_attempts": 3}),
    )


def public_url(key: str) -> str:
    base = settings.s3_public_base_url.rstrip("/")
    if not base:
        endpoint = (settings.s3_endpoint_url or "https://s3.amazonaws.com").rstrip("/")
        base = f"{endpoint}/{settings.s3_bucket}"
    return f"{base}/{key}"


def key_from_url(url: str | None, prefix: str) -> str | None:
    """Key de una URL pública propia, solo si cae bajo `prefix` (si no, None:
    nunca se borra algo que no subimos nosotros)."""
    base = public_url("")
    if not url or not url.startswith(base):
        return None
    key = url[len(base) :]
    if not key.startswith(prefix) or ".." in key:
        return None
    return key


def put_object(key: str, data: bytes, content_type: str) -> str:
    try:
        _client().put_object(
            Bucket=settings.s3_bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
            # Las imágenes son inmutables (la key lleva un uuid).
            CacheControl="public, max-age=31536000, immutable",
        )
    except (BotoCoreError, ClientError) as exc:
        log.error("storage.put_failed", key=key, error=str(exc))
        raise StorageError("No se pudo guardar la imagen") from exc
    return public_url(key)


def delete_objects(keys: list[str]) -> None:
    if not keys:
        return
    try:
        _client().delete_objects(
            Bucket=settings.s3_bucket,
            Delete={"Objects": [{"Key": k} for k in keys], "Quiet": True},
        )
    except (BotoCoreError, ClientError) as exc:
        # No bloquea la operación del usuario: queda en el log para limpiar.
        log.warning("storage.delete_failed", keys=keys, error=str(exc))


def ensure_bucket(public_read: bool = True) -> None:
    """Crea el bucket si no existe y, opcionalmente, lo deja de lectura pública."""
    client = _client()
    try:
        client.head_bucket(Bucket=settings.s3_bucket)
    except ClientError:
        client.create_bucket(Bucket=settings.s3_bucket)
        log.info("storage.bucket_created", bucket=settings.s3_bucket)
    if public_read:
        policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {"AWS": ["*"]},
                    "Action": ["s3:GetObject"],
                    "Resource": [f"arn:aws:s3:::{settings.s3_bucket}/*"],
                }
            ],
        }
        client.put_bucket_policy(Bucket=settings.s3_bucket, Policy=json.dumps(policy))
