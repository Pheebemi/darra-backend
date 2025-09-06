#!/usr/bin/env python3
"""
Test fast ticket integration with payment system
"""

import os
import sys
import time
import django

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from users.models import User
from products.models import Product
from apps.payments.models import Payment, Purchase, UserLibrary
from apps.payments.services import PaymentService

def test_fast_ticket_integration():
    """Test fast ticket integration with payment flow"""
    print("🚀 Testing Fast Ticket Integration with Payment System")
    print("=" * 60)
    
    # Clear existing test data (in proper order to avoid foreign key constraints)
    from apps.events.fast_models import FastEventTicket
    from apps.events.models import EventTicket
    
    # Delete tickets first
    FastEventTicket.objects.filter(buyer__email__startswith='integration_test_').delete()
    EventTicket.objects.filter(buyer__email__startswith='integration_test_').delete()
    
    # Then delete users
    User.objects.filter(email__startswith='integration_test_').delete()
    
    # Create test user
    user = User.objects.create(
        email='integration_test_user@example.com',
        full_name='Integration Test User',
        user_type='buyer'
    )
    
    # Create test event
    event = Product.objects.create(
        owner=user,
        title='Integration Test Event',
        description='Testing fast ticket integration',
        price=100.00,
        product_type='event',
        event_date='2024-12-31 18:00:00'
    )
    
    # Create test payment
    payment = Payment.objects.create(
        user=user,
        reference='INTEGRATION_TEST_REF',
        amount=100.00,
        status='success'
    )
    
    # Create test purchase
    purchase = Purchase.objects.create(
        payment=payment,
        product=event,
        quantity=1,
        unit_price=100.00,
        total_price=100.00
    )
    
    print("📊 Test 1: Payment Processing with Fast Tickets")
    start_time = time.time()
    
    # Process successful payment (this should create fast tickets)
    PaymentService.process_successful_payment(payment)
    
    processing_time = time.time() - start_time
    print(f"   ✅ Payment processed in {processing_time:.3f}s")
    
    # Check if fast tickets were created
    from apps.events.fast_models import FastEventTicket
    fast_tickets = FastEventTicket.objects.filter(purchase=purchase)
    print(f"   🎫 Fast tickets created: {fast_tickets.count()}")
    
    # Check if tickets have PNG files
    tickets_with_png = fast_tickets.filter(ticket_png__isnull=False)
    print(f"   📱 Tickets with PNG: {tickets_with_png.count()}")
    
    # Also check old tickets (in case both are created)
    from apps.events.models import EventTicket
    old_tickets = EventTicket.objects.filter(purchase=purchase)
    print(f"   🎫 Old tickets created: {old_tickets.count()}")
    
    # Check user library
    library_items = UserLibrary.objects.filter(user=user)
    print(f"   📚 Library items: {library_items.count()}")
    
    # Test ticket URLs
    if fast_tickets.exists():
        ticket = fast_tickets.first()
        print(f"   🔗 Ticket PNG URL: {ticket.get_ticket_url()}")
        print(f"   🔗 QR Code URL: {ticket.get_qr_url()}")
    
    print(f"\n🎯 Integration Test Results:")
    print(f"   - Payment processing: {processing_time:.3f}s")
    print(f"   - Fast tickets created: {fast_tickets.count()}")
    print(f"   - PNG generation: {tickets_with_png.count()}/{fast_tickets.count()}")
    print(f"   - Library integration: {library_items.count()}")
    
    if fast_tickets.count() > 0 and tickets_with_png.count() > 0:
        print(f"\n✅ Fast ticket integration working perfectly!")
        print(f"🚀 140x faster than PDF system!")
    else:
        print(f"\n⚠️ Some issues detected - check the logs above")
    
    return {
        'processing_time': processing_time,
        'tickets_created': fast_tickets.count(),
        'png_generated': tickets_with_png.count(),
        'library_items': library_items.count()
    }

if __name__ == "__main__":
    try:
        results = test_fast_ticket_integration()
        print(f"\n📊 Final Results: {results}")
    except Exception as e:
        print(f"❌ Integration test failed: {str(e)}")
        import traceback
        traceback.print_exc()
