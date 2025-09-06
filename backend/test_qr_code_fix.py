#!/usr/bin/env python3
"""
Test QR code generation and saving
"""
import os
import sys
import django

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from apps.events.models import EventTicket
from apps.payments.models import Payment, Purchase
from products.models import Product
from django.contrib.auth import get_user_model

User = get_user_model()

def test_qr_code_generation():
    """Test QR code generation and saving"""
    print("🧪 TESTING QR CODE GENERATION AND SAVING")
    print("=" * 50)
    
    try:
        # Get or create a test user
        user, created = User.objects.get_or_create(
            email='test@example.com',
            defaults={'first_name': 'Test', 'last_name': 'User'}
        )
        print(f"✅ User: {user.email}")
        
        # Get or create a test product
        product, created = Product.objects.get_or_create(
            title='Test Event',
            defaults={
                'description': 'Test event for QR code testing',
                'price': 100.00,
                'product_type': 'event',
                'owner': user  # Add the required owner field
            }
        )
        print(f"✅ Product: {product.title}")
        
        # Create a test payment
        payment = Payment.objects.create(
            user=user,
            reference=f"TEST_QR_{int(time.time())}",
            amount=100.00,
            status='success'
        )
        print(f"✅ Payment: {payment.reference}")
        
        # Create a test purchase
        purchase = Purchase.objects.create(
            payment=payment,
            product=product,
            quantity=1,
            unit_price=100.00,
            total_price=100.00
        )
        print(f"✅ Purchase: {purchase.id}")
        
        # Create a test ticket
        ticket = EventTicket.objects.create(
            purchase=purchase,
            buyer=user,
            event=product,
            quantity=1
        )
        print(f"✅ Ticket created: {ticket.ticket_id}")
        
        # Check initial state
        print(f"\n📊 INITIAL STATE:")
        print(f"   QR code field: {ticket.qr_code}")
        print(f"   QR code file path: {ticket.qr_code_file_path}")
        print(f"   QR code URL: {ticket.get_qr_code_url()}")
        
        # Generate QR code
        print(f"\n🔄 GENERATING QR CODE...")
        qr_code = ticket.generate_qr_code()
        
        # Refresh from database
        ticket.refresh_from_db()
        
        # Check final state
        print(f"\n📊 FINAL STATE:")
        print(f"   QR code field: {ticket.qr_code}")
        print(f"   QR code file path: {ticket.qr_code_file_path}")
        print(f"   QR code URL: {ticket.get_qr_code_url()}")
        
        # Verify QR code was saved
        if ticket.qr_code:
            print(f"   ✅ QR code file saved: {ticket.qr_code.name}")
        else:
            print(f"   ❌ QR code file NOT saved!")
            
        if ticket.qr_code_file_path:
            print(f"   ✅ QR code file path saved: {ticket.qr_code_file_path}")
        else:
            print(f"   ❌ QR code file path NOT saved!")
            
        if ticket.get_qr_code_url():
            print(f"   ✅ QR code URL available: {ticket.get_qr_code_url()}")
        else:
            print(f"   ❌ QR code URL NOT available!")
        
        # Test admin display
        print(f"\n🔍 ADMIN DISPLAY TEST:")
        print(f"   QR code field value: {ticket.qr_code}")
        print(f"   QR code field name: {ticket.qr_code.name if ticket.qr_code else 'None'}")
        print(f"   QR code field url: {ticket.qr_code.url if ticket.qr_code else 'None'}")
        
        return ticket
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == "__main__":
    import time
    ticket = test_qr_code_generation()
    
    if ticket:
        print(f"\n🎉 TEST COMPLETED!")
        print(f"   Ticket ID: {ticket.ticket_id}")
        print(f"   QR code saved: {'Yes' if ticket.qr_code else 'No'}")
        print(f"   QR code URL: {ticket.get_qr_code_url()}")
    else:
        print(f"\n❌ TEST FAILED!")
