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
            print(f"DEBUG: Creating payment notification for user {user.email}")
            print(f"DEBUG: Payment amount: {payment.amount}, Reference: {payment.reference}")
            
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
            
            if notification:
                print(f"✅ Payment notification created successfully for user {user.email}")
            else:
                print(f"❌ Failed to create payment notification for user {user.email}")
            
            return notification
        except Exception as e:
            print(f"❌ Error sending payment notification: {str(e)}")
            import traceback
            traceback.print_exc()
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
        """Send promotional notification to user - DISABLED to prevent spam"""
        # Promotional notifications are now handled by the frontend only
        # to prevent spam and ensure proper frequency control
        print(f"Promotional notification blocked for user {user.email} - handled by frontend")
        return None

    @staticmethod
    def send_event_ticket_notification(user, product, tickets):
        """Send event ticket notification to buyer"""
        try:
            title = "Event Tickets Generated!"
            body = f"Your tickets for {product.title} have been generated and sent to your email. Check your email for the QR codes."
            
            notification = NotificationService.create_notification(
                user=user,
                title=title,
                body=body,
                notification_type='event_ticket',
                data={
                    'product_id': product.id,
                    'product_title': product.title,
                    'ticket_count': len(tickets),
                    'event_date': product.event_date.isoformat() if product.event_date else None
                }
            )
            
            print(f"Event ticket notification created for user {user.email}")
            return notification
        except Exception as e:
            print(f"Error sending event ticket notification: {str(e)}")
            return None

    @staticmethod
    def send_bulk_promotional_notifications(title, body, data=None, user_filter=None):
        """Send promotional notification to multiple users - DISABLED to prevent spam"""
        # Bulk promotional notifications are now handled by the frontend only
        # to prevent spam and ensure proper frequency control
        print(f"Bulk promotional notifications blocked - handled by frontend")
        return 0






