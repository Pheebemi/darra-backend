#!/usr/bin/env python3
"""
Quick test of fast PNG-only ticket generation
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
from apps.payments.models import Payment, Purchase
from apps.events.fast_models import FastEventTicket

def test_fast_ticket_generation():
    """Test fast ticket generation with timing"""
    print("🚀 Testing Fast PNG-Only Ticket Generation")
    print("=" * 50)
    
    # Clear existing test data first
    User.objects.filter(email__startswith='test_fast_').delete()
    FastEventTicket.objects.filter(buyer__email__startswith='test_fast_').delete()
    
    # Create test data
    user = User.objects.create(
        email='test_fast_user@example.com',
        full_name='Test Fast User',
        user_type='buyer'
    )
    
    event = Product.objects.create(
        owner=user,
        title='Fast Test Event',
        description='Testing fast ticket generation',
        price=100.00,
        product_type='event',
        event_date='2024-12-31 18:00:00'
    )
    
    payment = Payment.objects.create(
        user=user,
        reference='FAST_TEST_REF',
        amount=100.00,
        status='success'
    )
    
    purchase = Purchase.objects.create(
        payment=payment,
        product=event,
        quantity=1,
        unit_price=100.00,
        total_price=100.00
    )
    
    # Test 1: Single ticket generation
    print("\n📊 Test 1: Single Fast Ticket")
    start_time = time.time()
    
    ticket = FastEventTicket.objects.create(
        purchase=purchase,
        buyer=user,
        event=event,
        quantity=1
    )
    
    single_ticket_time = time.time() - start_time
    print(f"   ✅ Single ticket created in {single_ticket_time:.3f}s")
    print(f"   📱 Ticket PNG: {ticket.get_ticket_url()}")
    
    # Test 2: Multiple tickets (5)
    print("\n📊 Test 2: 5 Fast Tickets")
    start_time = time.time()
    
    tickets = []
    for i in range(5):
        ticket = FastEventTicket.objects.create(
            purchase=purchase,
            buyer=user,
            event=event,
            quantity=1
        )
        tickets.append(ticket)
    
    multiple_tickets_time = time.time() - start_time
    print(f"   ✅ 5 tickets created in {multiple_tickets_time:.3f}s")
    print(f"   📊 Average time per ticket: {multiple_tickets_time / 5:.3f}s")
    
    # Test 3: QR code generation
    print("\n📊 Test 3: QR Code Generation")
    start_time = time.time()
    
    qr_code = tickets[0].generate_qr_only()
    qr_time = time.time() - start_time
    
    print(f"   ✅ QR code generated in {qr_time:.3f}s")
    print(f"   📱 QR Code: {tickets[0].get_qr_url()}")
    
    # Summary
    print(f"\n🎯 Performance Summary:")
    print(f"   - Single ticket: {single_ticket_time:.3f}s")
    print(f"   - 5 tickets: {multiple_tickets_time:.3f}s")
    print(f"   - QR code: {qr_time:.3f}s")
    print(f"   - Average per ticket: {multiple_tickets_time / 5:.3f}s")
    
    # Compare with previous system
    print(f"\n📈 Comparison with Previous System:")
    print(f"   - Previous (PDF): ~6.0s per ticket")
    print(f"   - Fast (PNG): {multiple_tickets_time / 5:.3f}s per ticket")
    
    improvement = ((6.0 - (multiple_tickets_time / 5)) / 6.0) * 100
    speedup = 6.0 / (multiple_tickets_time / 5)
    
    print(f"   - Improvement: {improvement:.1f}% faster")
    print(f"   - Speedup: {speedup:.1f}x faster")
    
    print(f"\n✅ Fast ticket test completed!")
    print(f"💡 The PNG-only system is {speedup:.1f}x faster!")

if __name__ == "__main__":
    try:
        test_fast_ticket_generation()
    except Exception as e:
        print(f"❌ Test failed: {str(e)}")
        import traceback
        traceback.print_exc()
