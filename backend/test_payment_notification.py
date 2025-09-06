#!/usr/bin/env python3
"""
Test script to verify payment notification is working
Run this from the backend directory: python test_payment_notification.py
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

def test_payment_notification():
    """Test payment notification creation"""
    print("🧪 Testing payment notification...")
    
    # Get a test user
    try:
        user = User.objects.first()
        if not user:
            print("❌ No users found in database. Please create a user first.")
            return False
        
        print(f"✅ Using test user: {user.email}")
        
        # Create a mock payment object
        class MockPayment:
            def __init__(self):
                self.id = 1
                self.amount = 100.00
                self.reference = "TEST-PAYMENT-123"
                self.status = "success"
        
        mock_payment = MockPayment()
        
        # Test payment notification
        print("\n1. Testing payment notification...")
        payment_notification = NotificationService.send_payment_notification(
            payment=mock_payment,
            user=user
        )
        
        if payment_notification:
            print("✅ Payment notification created successfully")
            print(f"   - Title: {payment_notification.title}")
            print(f"   - Body: {payment_notification.body}")
            print(f"   - Type: {payment_notification.type}")
        else:
            print("❌ Failed to create payment notification")
            return False
        
        # Check if notification appears in database
        db_notification = Notification.objects.filter(
            user=user,
            type='payment'
        ).order_by('-created_at').first()
        
        if db_notification:
            print("✅ Payment notification found in database")
            print(f"   - ID: {db_notification.id}")
            print(f"   - Title: {db_notification.title}")
            print(f"   - Read: {db_notification.read}")
        else:
            print("❌ Payment notification not found in database")
            return False
        
        return True
        
    except Exception as e:
        print(f"❌ Error during testing: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def clear_test_notifications():
    """Clear test notifications"""
    print("\n🧹 Clearing test notifications...")
    try:
        deleted_count, _ = Notification.objects.filter(
            title__contains="Payment Successful"
        ).delete()
        print(f"✅ Deleted {deleted_count} test payment notifications")
    except Exception as e:
        print(f"❌ Error clearing test notifications: {str(e)}")

if __name__ == "__main__":
    print("🚀 Starting payment notification test...")
    
    success = test_payment_notification()
    
    if success:
        print("\n✅ Payment notification test completed successfully!")
        print("\nTo test in the mobile app:")
        print("1. Make sure the backend is running")
        print("2. Open the mobile app")
        print("3. Check the notifications screen")
        print("4. You should see the payment notification")
    else:
        print("\n❌ Payment notification test failed!")
    
    # Ask if user wants to clear test notifications
    response = input("\nClear test notifications? (y/n): ").lower().strip()
    if response == 'y':
        clear_test_notifications()
    
    print("\n🏁 Test completed!")
