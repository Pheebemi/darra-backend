#!/usr/bin/env python
"""
Test script for the ticket service
Run this to verify that ticket generation and Cloudinary upload works
"""

import os
import sys
import django

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.events.ticket_service import ticket_service
from io import BytesIO

def test_qr_code_generation():
    """Test QR code generation"""
    print("🧪 Testing QR code generation...")
    
    try:
        # Generate a test QR code
        qr_buffer = ticket_service.generate_qr_code(
            ticket_id="test-123",
            event_title="Test Event"
        )
        
        print(f"✅ QR code generated successfully!")
        print(f"📏 Buffer size: {len(qr_buffer.getvalue())} bytes")
        
        return qr_buffer
        
    except Exception as e:
        print(f"❌ QR code generation failed: {str(e)}")
        return None

def test_cloudinary_upload():
    """Test Cloudinary upload (requires valid credentials)"""
    print("\n🧪 Testing Cloudinary upload...")
    
    try:
        # Generate test QR code
        qr_buffer = test_qr_code_generation()
        if not qr_buffer:
            return False
        
        # Test upload to Cloudinary
        result = ticket_service.upload_qr_code_to_cloudinary(
            qr_buffer, 
            "test-123", 
            1  # Test event ID
        )
        
        print(f"✅ Upload successful!")
        print(f"🌐 Public ID: {result['public_id']}")
        print(f"🔗 URL: {result['url']}")
        
        return True
        
    except Exception as e:
        print(f"❌ Cloudinary upload failed: {str(e)}")
        print("💡 Make sure your Cloudinary credentials are set in .env file")
        return False

def test_pdf_generation():
    """Test PDF ticket generation"""
    print("\n🧪 Testing PDF ticket generation...")
    
    try:
        # Test ticket data
        ticket_data = {
            'ticket_id': 'test-123',
            'event_title': 'Test Event',
            'event_date': '2024-01-15 19:00',
            'buyer_name': 'John Doe',
            'quantity': 2
        }
        
        # Generate PDF
        pdf_buffer = ticket_service.generate_pdf_ticket(ticket_data)
        
        print(f"✅ PDF ticket generated successfully!")
        print(f"📏 Buffer size: {len(pdf_buffer.getvalue())} bytes")
        
        return pdf_buffer
        
    except Exception as e:
        print(f"❌ PDF generation failed: {str(e)}")
        return None

if __name__ == "__main__":
    print("🚀 Starting ticket service tests...\n")
    
    # Test QR code generation
    test_qr_code_generation()
    
    # Test PDF generation
    test_pdf_generation()
    
    # Test Cloudinary upload (optional)
    print("\n" + "="*50)
    print("💡 To test Cloudinary upload, make sure you have:")
    print("   1. CLOUDINARY_CLOUD_NAME in your .env file")
    print("   2. CLOUDINARY_API_KEY in your .env file")
    print("   3. CLOUDINARY_API_SECRET in your .env file")
    print("   4. CLOUDINARY_SECURE=True in your .env file")
    print("="*50)
    
    # Uncomment the line below to test Cloudinary upload
    # test_cloudinary_upload()
    
    print("\n🎉 Tests completed!")
