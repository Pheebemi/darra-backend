"""
Direct-to-R2 uploads for product files.

Big files can't reach Django the normal way: the browser POSTs through the
Vercel serverless proxy, which has a hard 4.5 MB request-body limit, and it
can't call Django directly either because the JWT lives in an httpOnly cookie
the browser's JavaScript can't read. So the browser instead asks for a
short-lived presigned R2 URL and PUTs the bytes straight to Cloudflare R2.
Django never handles the file body — it only validates the finished object and
points the product's FileField at it.

Everything here is a no-op unless R2 is configured. On local disk the normal
multipart upload path is used instead (see the view's `file` branch).
"""

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError

from .models import _r2_configured
from .file_validation import validate_magic_bytes, max_file_size_for

# Must match Product.file's upload_to so the FileField and the presigned key
# resolve to the same object in the bucket.
FILE_KEY_PREFIX = 'products/files'
PRESIGN_EXPIRY = 600  # seconds (10 minutes)


def _r2_client():
    import boto3
    from botocore.config import Config
    return boto3.client(
        's3',
        endpoint_url=settings.R2_ENDPOINT_URL,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        region_name='auto',                       # R2 uses a single 'auto' region
        config=Config(signature_version='s3v4'),  # R2 requires SigV4
    )


def _safe_ext(filename):
    if filename and '.' in filename:
        ext = filename.rsplit('.', 1)[-1].lower()
        if ext.isalnum() and len(ext) <= 5:
            return '.' + ext
    return ''


def build_file_key(user_id, filename):
    """
    A unique object key namespaced by the uploader. The namespace is what lets
    finalize prove a seller is only ever attaching a file THEY just uploaded,
    not pointing at someone else's object.
    """
    return f"{FILE_KEY_PREFIX}/{user_id}/{uuid.uuid4().hex}{_safe_ext(filename)}"


def key_belongs_to_user(key, user_id):
    return bool(key) and key.startswith(f"{FILE_KEY_PREFIX}/{user_id}/")


def generate_presigned_put(key):
    """
    A presigned PUT URL for `key`. Content-Type is deliberately NOT part of the
    signature: browsers set it from the Blob and any mismatch would break the
    signature. The real bytes are validated on finalize regardless.
    """
    client = _r2_client()
    return client.generate_presigned_url(
        'put_object',
        Params={'Bucket': settings.R2_BUCKET_NAME, 'Key': key},
        ExpiresIn=PRESIGN_EXPIRY,
    )


def _delete_quietly(client, bucket, key):
    try:
        client.delete_object(Bucket=bucket, Key=key)
    except Exception:
        pass


def attach_r2_file(product, key, user, product_type):
    """
    Point product.file at an object the browser already uploaded to R2, after
    verifying it. The key must be one issued to THIS user, the object must
    exist, be non-empty, be within the size cap, and start with the right
    signature bytes for its type. On any failure the untrusted object is
    deleted and a ValidationError is raised.
    """
    if not _r2_configured():
        raise ValidationError("Direct upload is not available on this server.")
    if not key_belongs_to_user(key, user.id):
        raise ValidationError("Invalid upload reference.")

    from botocore.exceptions import ClientError
    client = _r2_client()
    bucket = settings.R2_BUCKET_NAME

    try:
        head = client.head_object(Bucket=bucket, Key=key)
    except ClientError:
        raise ValidationError("Uploaded file was not found. Please upload it again.")

    size = head.get('ContentLength', 0)
    if size == 0:
        _delete_quietly(client, bucket, key)
        raise ValidationError("Uploaded file is empty.")

    max_size = max_file_size_for(product_type)
    if size > max_size:
        _delete_quietly(client, bucket, key)
        raise ValidationError(
            f"File too large. Maximum size is {max_size // (1024 * 1024)}MB."
        )

    try:
        obj = client.get_object(Bucket=bucket, Key=key, Range='bytes=0-1023')
        head_bytes = obj['Body'].read()
    except ClientError:
        raise ValidationError("Could not read the uploaded file. Please try again.")

    try:
        validate_magic_bytes(head_bytes, product_type)
    except ValidationError:
        _delete_quietly(client, bucket, key)
        raise

    # Point the FileField at the already-uploaded object. Setting .name (rather
    # than assigning an UploadedFile) attaches it without re-uploading a byte.
    product.file.name = key
    product.save()
