#!/usr/bin/env python
import os
import sys
import django

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model
from apps.events.models import EventTicket
from apps.events.fast_models import FastEventTicket
from products.models import Product
from apps.payments.models import Purchase, Payment

User = get_user_model()

def test_ticket_visibility():
    print("🔍 Testing ticket visibility...")
    
    # Clear test data
    User.objects.filter(email__startswith='test_visibility_').delete()
    FastEventTicket.objects.filter(buyer__email__startswith='test_visibility_').delete()
    EventTicket.objects.filter(buyer__email__startswith='test_visibility_').delete()
    
    # Create test user
    user = User.objects.create_user(
        email='test_visibility_user@example.com',
        password='testpass123',
        full_name='Test User'
    )
    print(f"✅ Created test user: {user.email}")
    
    # Create test event
    event = Product.objects.create(
        title='Test Event for Visibility',
        description='Test event description',
        price=50.00,
        product_type='event',
        owner=user,
        event_date='2024-12-31 20:00:00'
    )
    print(f"✅ Created test event: {event.title}")
    
    # Create test payment
    payment = Payment.objects.create(
        user=user,
        amount=50.00,
        reference='TEST_VIS_001',
        status='completed'
    )
    print(f"✅ Created test payment: {payment.reference}")
    
    # Create test purchase
    purchase = Purchase.objects.create(
        payment=payment,
        product=event,
        quantity=1,
        unit_price=50.00,
        total_price=50.00
    )
    print(f"✅ Created test purchase: {purchase.id}")
    
    # Create fast ticket
    fast_ticket = FastEventTicket.objects.create(
        purchase=purchase,
        buyer=user,
        event=event
    )
    print(f"✅ Created fast ticket: {fast_ticket.ticket_id}")
    
    # Test admin visibility
    print("\n📊 Admin Panel Visibility:")
    print(f"   FastEventTicket count: {FastEventTicket.objects.count()}")
    print(f"   EventTicket count: {EventTicket.objects.count()}")
    print(f"   Total tickets: {FastEventTicket.objects.count() + EventTicket.objects.count()}")
    
    # Test seller view
    print("\n👤 Seller View Visibility:")
    seller_fast_tickets = FastEventTicket.objects.filter(event__owner=user)
    seller_old_tickets = EventTicket.objects.filter(event__owner=user)
    print(f"   Seller fast tickets: {seller_fast_tickets.count()}")
    print(f"   Seller old tickets: {seller_old_tickets.count()}")
    print(f"   Total seller tickets: {seller_fast_tickets.count() + seller_old_tickets.count()}")
    
    # Test API endpoint simulation
    print("\n🌐 API Endpoint Test:")
    from apps.events.views import SellerEventTicketsView
    from django.test import RequestFactory
    
    factory = RequestFactory()
    request = factory.get('/events/seller-tickets/')
    request.user = user
    
    view = SellerEventTicketsView()
    view.request = request
    
    try:
        queryset = view.get_queryset()
        print(f"   Queryset length: {len(queryset)}")
        
        # Test the list method
        response = view.list(request)
        print(f"   API response status: {response.status_code}")
        print(f"   API response data length: {len(response.data)}")
        
        if response.data:
            print(f"   First ticket ID: {response.data[0].get('ticket_id')}")
            print(f"   First ticket type: {'Fast' if 'ticket_png_url' in response.data[0] else 'Old'}")
        
    except Exception as e:
        print(f"   ❌ API Error: {str(e)}")
    
    print("\n✅ Test completed!")

if __name__ == '__main__':
    test_ticket_visibility()
