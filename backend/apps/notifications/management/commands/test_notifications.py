from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.notifications.services import NotificationService
from apps.notifications.models import Notification

User = get_user_model()

class Command(BaseCommand):
    help = 'Test notification creation'

    def add_arguments(self, parser):
        parser.add_argument(
            '--user-email',
            type=str,
            help='Email of user to send test notification to',
        )
        parser.add_argument(
            '--type',
            type=str,
            choices=['payment', 'order', 'event_ticket', 'general'],
            default='general',
            help='Type of notification to create',
        )

    def handle(self, *args, **options):
        user_email = options.get('user_email')
        notification_type = options.get('type')
        
        # Get user
        if user_email:
            try:
                user = User.objects.get(email=user_email)
            except User.DoesNotExist:
                self.stdout.write(
                    self.style.ERROR(f'User with email {user_email} not found')
                )
                return
        else:
            user = User.objects.first()
            if not user:
                self.stdout.write(
                    self.style.ERROR('No users found in database')
                )
                return
        
        self.stdout.write(f'Creating test notification for user: {user.email}')
        
        # Create test notification based on type
        if notification_type == 'payment':
            # Create a mock payment object
            mock_payment = type('Payment', (), {
                'id': 1,
                'amount': 100.00,
                'reference': 'TEST-REF-123',
                'status': 'success'
            })()
            
            notification = NotificationService.send_payment_notification(
                user=user,
                payment=mock_payment
            )
            
        elif notification_type == 'order':
            # Create a mock purchase object
            mock_purchase = type('Purchase', (), {
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
            
            notification = NotificationService.send_order_notification(
                user=user,
                purchase=mock_purchase
            )
            
        elif notification_type == 'event_ticket':
            # Create a mock product object
            mock_product = type('Product', (), {
                'id': 1,
                'title': 'Test Event',
                'event_date': None
            })()
            
            notification = NotificationService.send_event_ticket_notification(
                user=user,
                product=mock_product,
                tickets=[{'id': 1}, {'id': 2}]
            )
            
        else:  # general
            notification = NotificationService.create_notification(
                user=user,
                title='Test Notification',
                body='This is a test notification',
                notification_type='general',
                data={'test': True}
            )
        
        if notification:
            self.stdout.write(
                self.style.SUCCESS(
                    f'Successfully created {notification_type} notification: {notification.title}'
                )
            )
        else:
            self.stdout.write(
                self.style.ERROR(f'Failed to create {notification_type} notification')
            )
