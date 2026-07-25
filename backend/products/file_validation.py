"""
File validation utilities for secure file uploads
"""

from django.core.exceptions import ValidationError
from django.conf import settings

# Try to import python-magic, fallback to extension-based validation
try:
    import magic
    MAGIC_AVAILABLE = True
except ImportError:
    MAGIC_AVAILABLE = False
    print("Warning: python-magic not available, using extension-based validation")

# Allowed file types and their MIME types
ALLOWED_FILE_TYPES = {
    'pdf': 'application/pdf',
    'mp3': 'audio/mpeg',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'zip': 'application/zip',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg'
}

# A single expected MIME string is too strict for container formats: a .docx
# is really a ZIP archive, so content detectors report it as application/zip
# (or application/octet-stream), never the long Word MIME. Same story for .zip
# and .mp3. Accept the known-safe aliases per type here and let the
# signature-byte check (validate_magic_bytes) be the real gate — that still
# blocks an executable renamed to .docx, because it won't start with "PK".
ACCEPTABLE_MIMES = {
    'pdf':  {'application/pdf'},
    'docx': {
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/zip',
        'application/x-zip-compressed',
        'application/octet-stream',
    },
    'zip':  {'application/zip', 'application/x-zip-compressed', 'application/octet-stream'},
    'mp3':  {'audio/mpeg', 'audio/mp3', 'application/octet-stream'},
    'png':  {'image/png'},
    'jpg':  {'image/jpeg'},
    'jpeg': {'image/jpeg'},
}

# File size limits (in bytes)
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB default for documents
# Cover images still travel through the Vercel serverless proxy, which has a
# hard 4.5MB request-body limit — keep covers safely under it.
MAX_IMAGE_SIZE = 4 * 1024 * 1024   # 4MB for images

# Product files (audio, zip bundles, ebooks) upload directly to R2, bypassing
# the proxy, so they can be much larger than a document form field.
MAX_SIZE_BY_TYPE = {
    'pdf':  25 * 1024 * 1024,
    'docx': 25 * 1024 * 1024,
    'mp3':  50 * 1024 * 1024,
    'zip':  50 * 1024 * 1024,
    'png':  MAX_IMAGE_SIZE,
    'jpg':  MAX_IMAGE_SIZE,
    'jpeg': MAX_IMAGE_SIZE,
}


def max_file_size_for(product_type):
    """Maximum allowed byte size for a given product type."""
    return MAX_SIZE_BY_TYPE.get(product_type, MAX_FILE_SIZE)

def validate_file_type(file, product_type):
    """
    Validate file type based on product type and actual file content
    
    Args:
        file: Django UploadedFile object
        product_type: The product type (pdf, mp3, docx, etc.)
    
    Returns:
        bool: True if valid, raises ValidationError if invalid
    """
    if not file:
        return True
    
    # Get the expected MIME type for the product type
    expected_mime = ALLOWED_FILE_TYPES.get(product_type)
    if not expected_mime:
        raise ValidationError(f"Unsupported product type: {product_type}")
    
    # Read first 1024 bytes to determine MIME type
    file.seek(0)
    file_content = file.read(1024)
    file.seek(0)  # Reset file pointer
    
    # Detect actual MIME type
    if MAGIC_AVAILABLE:
        try:
            actual_mime = magic.from_buffer(file_content, mime=True)
        except Exception as e:
            print(f"Warning: Could not detect MIME type: {e}")
            # Fallback to file extension check
            actual_mime = get_mime_from_extension(file.name)
    else:
        # Use extension-based validation as fallback
        actual_mime = get_mime_from_extension(file.name)

    # Validate MIME type against the set of acceptable aliases for this type
    # (a .docx legitimately reads as application/zip, etc.). When the type is
    # simply undetectable (actual_mime is None), don't hard-fail here — the
    # signature-byte check below is the authoritative gate.
    acceptable = ACCEPTABLE_MIMES.get(product_type, {expected_mime})
    if actual_mime and actual_mime not in acceptable:
        raise ValidationError(
            f"Invalid file type. Expected a {product_type.upper()} file, got {actual_mime}"
        )

    # Always check the file's own signature bytes as well. Without python-magic
    # the check above only trusts the filename, so renaming anything to .pdf
    # would pass. Magic-byte checking needs no extra dependency and cannot be
    # fooled by the extension.
    validate_magic_bytes(file_content, product_type)

    return True


# Leading bytes each supported format must start with. A file claiming to be
# one of these but not starting with the right signature is rejected.
MAGIC_SIGNATURES = {
    'pdf': [b'%PDF-'],
    # DOCX/ZIP are both ZIP containers: "PK\x03\x04", or an empty/spanned archive.
    'docx': [b'PK\x03\x04', b'PK\x05\x06', b'PK\x07\x08'],
    'zip': [b'PK\x03\x04', b'PK\x05\x06', b'PK\x07\x08'],
    'png': [b'\x89PNG\r\n\x1a\n'],
    'jpg': [b'\xff\xd8\xff'],
    'jpeg': [b'\xff\xd8\xff'],
    # MP3 is either an ID3 tag or a raw frame sync (0xFF 0xFB/0xF3/0xF2).
    'mp3': [b'ID3', b'\xff\xfb', b'\xff\xf3', b'\xff\xf2'],
}


def validate_magic_bytes(file_content, product_type):
    """
    Verify the file's leading bytes match what its declared type requires.

    Args:
        file_content: first bytes of the file (at least 8)
        product_type: declared product type

    Returns:
        bool: True if valid or the type has no known signature; raises
        ValidationError if the signature clearly does not match.
    """
    signatures = MAGIC_SIGNATURES.get(product_type)
    if not signatures:
        # No signature defined for this type (e.g. video) — nothing to assert.
        return True

    if not file_content:
        raise ValidationError("File appears to be empty.")

    if not any(file_content.startswith(sig) for sig in signatures):
        raise ValidationError(
            f"File content does not look like a valid {product_type.upper()} file. "
            "The file may be corrupted or renamed from another format."
        )

    return True

def validate_file_size(file, product_type):
    """
    Validate file size based on product type
    
    Args:
        file: Django UploadedFile object
        product_type: The product type
    
    Returns:
        bool: True if valid, raises ValidationError if invalid
    """
    if not file:
        return True

    file_size = file.size
    max_size = max_file_size_for(product_type)
    size_type = "image" if product_type in ('png', 'jpg', 'jpeg') else "file"

    if file_size > max_size:
        raise ValidationError(
            f"{size_type.capitalize()} too large. Maximum size is {max_size // (1024*1024)}MB, got {file_size // (1024*1024)}MB"
        )

    return True

def get_mime_from_extension(filename):
    """
    Fallback method to get MIME type from file extension
    """
    if not filename:
        return None
    
    extension = filename.lower().split('.')[-1]
    extension_mime_map = {
        'pdf': 'application/pdf',
        'mp3': 'audio/mpeg',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'zip': 'application/zip',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg'
    }
    
    return extension_mime_map.get(extension)

def validate_uploaded_file(file, product_type):
    """
    Complete file validation including type and size

    Args:
        file: Django UploadedFile object
        product_type: The product type

    Returns:
        bool: True if valid, raises ValidationError if invalid
    """
    if not file:
        return True

    # Validate file type
    validate_file_type(file, product_type)

    # Validate file size
    validate_file_size(file, product_type)

    return True


# Cover images may be PNG or JPG/JPEG. The old code validated covers as 'png'
# only, so every JPG cover was rejected — the single most common image format.
COVER_IMAGE_TYPES = ('png', 'jpg', 'jpeg')


def validate_cover_image(file):
    """
    Validate a product cover image: must be a PNG or JPG/JPEG within the image
    size limit. Raises ValidationError with a plain-language message otherwise.
    """
    if not file:
        return True

    name = file.name or ''
    ext = name.rsplit('.', 1)[-1].lower() if '.' in name else ''
    if ext not in COVER_IMAGE_TYPES:
        raise ValidationError("Cover image must be a PNG or JPG file.")

    # validate_uploaded_file checks the signature bytes and the image size
    # limit for the matching image type.
    validate_uploaded_file(file, ext)
    return True

def get_allowed_extensions_for_type(product_type):
    """
    Get allowed file extensions for a product type
    
    Args:
        product_type: The product type
    
    Returns:
        list: List of allowed extensions
    """
    type_extensions = {
        'pdf': ['.pdf'],
        'mp3': ['.mp3'],
        'docx': ['.docx'],
        'zip': ['.zip'],
        'png': ['.png'],
        'jpg': ['.jpg', '.jpeg'],
        'jpeg': ['.jpg', '.jpeg']
    }
    
    return type_extensions.get(product_type, [])
