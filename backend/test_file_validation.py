#!/usr/bin/env python
"""
Simple test script to verify file validation works
Run with: python test_file_validation.py
"""

import os
import sys
import django
from io import BytesIO

# Add the project directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from products.file_validation import validate_uploaded_file, ALLOWED_FILE_TYPES
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.exceptions import ValidationError

def test_file_validation():
    """Test file validation with different file types"""
    
    print("🧪 Testing File Validation System")
    print("=" * 50)
    
    # Test cases: (file_content, filename, product_type, should_pass)
    test_cases = [
        # Valid cases
        (b'%PDF-1.4\n', 'test.pdf', 'pdf', True),
        (b'ID3\x03\x00\x00', 'test.mp3', 'mp3', True),
        (b'PK\x03\x04', 'test.zip', 'zip', True),
        (b'\x89PNG\r\n\x1a\n', 'test.png', 'png', True),
        (b'\xff\xd8\xff\xe0', 'test.jpg', 'jpg', True),
        
        # Invalid cases
        (b'%PDF-1.4\n', 'test.pdf', 'mp3', False),  # PDF file for MP3 product
        (b'ID3\x03\x00\x00', 'test.mp3', 'pdf', False),  # MP3 file for PDF product
        (b'Not a valid file', 'test.txt', 'pdf', False),  # Invalid content
    ]
    
    passed = 0
    failed = 0
    
    for file_content, filename, product_type, should_pass in test_cases:
        try:
            # Create a mock uploaded file
            uploaded_file = SimpleUploadedFile(
                name=filename,
                content=file_content,
                content_type='application/octet-stream'
            )
            
            # Test validation
            validate_uploaded_file(uploaded_file, product_type)
            
            if should_pass:
                print(f"✅ PASS: {filename} as {product_type}")
                passed += 1
            else:
                print(f"❌ FAIL: {filename} as {product_type} (should have failed)")
                failed += 1
                
        except ValidationError as e:
            if not should_pass:
                print(f"✅ PASS: {filename} as {product_type} (correctly rejected: {str(e)})")
                passed += 1
            else:
                print(f"❌ FAIL: {filename} as {product_type} (incorrectly rejected: {str(e)})")
                failed += 1
        except Exception as e:
            print(f"❌ ERROR: {filename} as {product_type} (unexpected error: {str(e)})")
            failed += 1
    
    print("=" * 50)
    print(f"📊 Results: {passed} passed, {failed} failed")
    
    if failed == 0:
        print("🎉 All tests passed!")
        return True
    else:
        print("⚠️ Some tests failed!")
        return False

if __name__ == '__main__':
    success = test_file_validation()
    sys.exit(0 if success else 1)
