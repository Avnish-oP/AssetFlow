"""MinIO object storage helpers for asset / maintenance photos."""

from __future__ import annotations

import io
import uuid
from functools import lru_cache

from fastapi import HTTPException, UploadFile
from minio import Minio
from minio.error import S3Error

from core.config import get_settings

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
}
MAX_BYTES = 8 * 1024 * 1024


@lru_cache
def _client() -> Minio:
    settings = get_settings()
    return Minio(
        settings.minio_endpoint,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=settings.minio_secure,
    )


def ensure_bucket() -> None:
    settings = get_settings()
    client = _client()
    try:
        if not client.bucket_exists(settings.minio_bucket):
            client.make_bucket(settings.minio_bucket)
    except S3Error as exc:
        raise HTTPException(status_code=503, detail=f"Object storage unavailable: {exc.code}") from exc


async def upload_file(file: UploadFile, folder: str = "uploads") -> str:
    settings = get_settings()
    content_type = file.content_type or "application/octet-stream"
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {content_type}")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="File too large (max 8MB)")

    ensure_bucket()
    ext = ""
    if file.filename and "." in file.filename:
        ext = "." + file.filename.rsplit(".", 1)[-1].lower()[:8]
    object_name = f"{folder}/{uuid.uuid4().hex}{ext}"

    try:
        _client().put_object(
            settings.minio_bucket,
            object_name,
            io.BytesIO(data),
            length=len(data),
            content_type=content_type,
        )
    except S3Error as exc:
        raise HTTPException(status_code=503, detail=f"Upload failed: {exc.code}") from exc

    base = settings.minio_public_base.rstrip("/")
    return f"{base}/{settings.minio_bucket}/{object_name}"
