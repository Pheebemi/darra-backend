from django.conf import settings
from .models import Notification
from django.contrib.auth import get_user_model

User = get_user_model()

class NotificationService:
    @staticmethod
    def create_notification(user, title, body, notification_type, data=None):
        """Create a notification in the database"""
        try:
            notification = Notification.objects.create(
                user=user,
                title=title,
                body=body,
                type=notification_type,
                data=data or {}
            )
            return notification
        except Exception as e:
            print(f"Error creating notification: {str(e)}")
            return None

    @staticmethod
    def send_payment_notification(payment, user):
        """Send payment notification to buyer"""
        try:
            title = "Payment Successful!"
            body = f"Your payment of ₦{payment.amount} has been processed successfully. Reference: {payment.reference}"
            
            notification = NotificationService.create_notification(
                user=user,
                title=title,
                body=body,
                notification_type='payment',
                data={
                    'payment_id': payment.id,
                    'amount': str(payment.amount),
                    'reference': payment.reference,
                    'status': payment.status
                }
            )
            
            print(f"Payment notification created for user {user.email}")
            return notification
        except Exception as e:
            print(f"Error sending payment notification: {str(e)}")
            return None

    @staticmethod
    def send_order_notification(purchase, seller):
        """Send order notification to seller"""
        try:
            title = "New Order Received!"
            body = f"You have received a new order for {purchase.product.title} from {purchase.payment.user.full_name or purchase.payment.user.email}"
            
            notification = NotificationService.create_notification(
                user=seller,
                title=title,
                body=body,
                notification_type='order',
                data={
                    'purchase_id': purchase.id,
                    'product_title': purchase.product.title,
                    'buyer_name': purchase.payment.user.full_name or purchase.payment.user.email,
                    'quantity': purchase.quantity,
                    'total_amount': str(purchase.total_price)
                }
            )
            
            print(f"Order notification created for seller {seller.email}")
            return notification
        except Exception as e:
            print(f"Error sending order notification: {str(e)}")
            return None

    @staticmethod
    def send_promotional_notification(user, title, body, data=None):
        """Send promotional notification to user"""
        try:
            notification = NotificationService.create_notification(
                user=user,
                title=title,
                body=body,
                notification_type='promotional',
                data=data or {}
            )
            
            print(f"Promotional notification created for user {user.email}")
            return notification
        except Exception as e:
            print(f"Error sending promotional notification: {str(e)}")
            return None

    @staticmethod
    def send_bulk_promotional_notifications(title, body, data=None, user_filter=None):
        """Send promotional notification to multiple users"""
        try:
            users = User.objects.all()
            if user_filter:
                users = users.filter(user_filter)
            
            notifications_created = 0
            for user in users:
                notification = NotificationService.send_promotional_notification(
                    user=user,
                    title=title,
                    body=body,
                    data=data
                )
                if notification:
                    notifications_created += 1
            
            print(f"Sent {notifications_created} promotional notifications")
            return notifications_created
        except Exception as e:
            print(f"Error sending bulk promotional notifications: {str(e)}")
            return 0






