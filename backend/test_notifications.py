#!/usr/bin/env python3
"""
Test script to verify notification system is working
Run this from the backend directory: python test_notifications.py
"""

import os
import sys
import django

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model
from apps.notifications.services import NotificationService
from apps.notifications.models import Notification

User = get_user_model()

def test_notification_creation():
    """Test creating notifications"""
    print("🧪 Testing notification creation...")
    
    # Get a test user (first user in database)
    try:
        user = User.objects.first()
        if not user:
            print("❌ No users found in database. Please create a user first.")
            return False
        
        print(f"✅ Using test user: {user.email}")
        
        # Test payment notification
        print("\n1. Testing payment notification...")
        payment_notification = NotificationService.send_payment_notification(
            user=user,
            payment=type('Payment', (), {
                'id': 1,
                'amount': 100.00,
                'reference': 'TEST-REF-123',
                'status': 'success'
            })()
        )
        
        if payment_notification:
            print("✅ Payment notification created successfully")
        else:
            print("❌ Failed to create payment notification")
        
        # Test order notification
        print("\n2. Testing order notification...")
        order_notification = NotificationService.send_order_notification(
            user=user,
            purchase=type('Purchase', (), {
                'id': 1,
                'product': type('Product', (), {
                    'title': 'Test Product',
                    'owner': user
                })(),
                'payment': type('Payment', (), {
                    'user': user
                })(),
                'quantity': 1,
                'total_price': 100.00
            })()
        )
        
        if order_notification:
            print("✅ Order notification created successfully")
        else:
            print("❌ Failed to create order notification")
        
        # Test event ticket notification
        print("\n3. Testing event ticket notification...")
        event_notification = NotificationService.send_event_ticket_notification(
            user=user,
            product=type('Product', (), {
                'id': 1,
                'title': 'Test Event',
                'event_date': None
            })(),
            tickets=[{'id': 1}, {'id': 2}]
        )
        
        if event_notification:
            print("✅ Event ticket notification created successfully")
        else:
            print("❌ Failed to create event ticket notification")
        
        # Check total notifications
        total_notifications = Notification.objects.filter(user=user).count()
        print(f"\n📊 Total notifications for user: {total_notifications}")
        
        # List recent notifications
        recent_notifications = Notification.objects.filter(user=user).order_by('-created_at')[:5]
        print("\n📋 Recent notifications:")
        for notif in recent_notifications:
            print(f"  - {notif.type}: {notif.title}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error during testing: {str(e)}")
        return False

def clear_test_notifications():
    """Clear test notifications"""
    print("\n🧹 Clearing test notifications...")
    try:
        deleted_count, _ = Notification.objects.filter(data__test=True).delete()
        print(f"✅ Deleted {deleted_count} test notifications")
    except Exception as e:
        print(f"❌ Error clearing test notifications: {str(e)}")

if __name__ == "__main__":
    print("🚀 Starting notification system test...")
    
    success = test_notification_creation()
    
    if success:
        print("\n✅ Notification system test completed successfully!")
        print("\nTo test in the mobile app:")
        print("1. Make sure the backend is running")
        print("2. Open the mobile app")
        print("3. Check the notifications screen")
        print("4. You should see the test notifications")
    else:
        print("\n❌ Notification system test failed!")
    
    # Ask if user wants to clear test notifications
    response = input("\nClear test notifications? (y/n): ").lower().strip()
    if response == 'y':
        clear_test_notifications()
    
    print("\n🏁 Test completed!")
