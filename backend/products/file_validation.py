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

# File size limits (in bytes)
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
MAX_IMAGE_SIZE = 5 * 1024 * 1024   # 5MB for images

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
    
    # Validate MIME type
    if actual_mime != expected_mime:
        raise ValidationError(
            f"Invalid file type. Expected {expected_mime} for {product_type}, got {actual_mime}"
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
    
    # Different size limits for different file types
    if product_type in ['png', 'jpg', 'jpeg']:
        max_size = MAX_IMAGE_SIZE
        size_type = "image"
    else:
        max_size = MAX_FILE_SIZE
        size_type = "file"
    
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
