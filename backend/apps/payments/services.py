import requests
import uuid
from decimal import Decimal
from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils import timezone
from .models import Payment, Purchase, UserLibrary, SellerCommission, SellerEarnings, PayoutRequest
from products.models import Product
from users.utils import send_purchase_receipt_email, send_seller_notification_email, send_event_ticket_email

class FlutterwaveService:
    def __init__(self):
        self.secret_key = settings.FLUTTERWAVE_SECRET_KEY
        self.public_key = settings.FLUTTERWAVE_PUBLIC_KEY
        self.encryption_key = settings.FLUTTERWAVE_ENCRYPTION_KEY
        self.base_url = "https://api.flutterwave.com/v3"
        
        # Debug logging for API keys
        print(f"DEBUG: FlutterwaveService initialized")
        print(f"DEBUG: Secret key length: {len(self.secret_key) if self.secret_key else 0}")
        print(f"DEBUG: Public key length: {len(self.public_key) if self.public_key else 0}")
        print(f"DEBUG: Encryption key length: {len(self.encryption_key) if self.encryption_key else 0}")
        print(f"DEBUG: Base URL: {self.base_url}")
        
        # Check if keys are placeholder values
        if 'your_test_secret_key_here' in self.secret_key or 'your_actual_test_secret_key_here' in self.secret_key:
            print("WARNING: Flutterwave secret key appears to be a placeholder!")
        if 'your_test_public_key_here' in self.public_key or 'your_actual_test_public_key_here' in self.public_key:
            print("WARNING: Flutterwave public key appears to be a placeholder!")
        
    def _get_headers(self):
        return {
            'Authorization': f'Bearer {self.secret_key}',
            'Content-Type': 'application/json'
        }
    
    def initialize_payment(self, payment):
        """Initialize payment with Flutterwave"""
        url = f"{self.base_url}/payments"
        
        payload = {
            'tx_ref': payment.reference,  # This will now be DARRA_XXXX format
            'amount': float(payment.amount),  # Flutterwave uses float, not kobo
            'currency': payment.currency,
            'redirect_url': f"{settings.BASE_URL}/api/payments/verify/{payment.reference}/",
            'customer': {
                'email': payment.user.email,
                'name': payment.user.full_name,
                'phone_number': getattr(payment.user, 'phone_number', '')
            },
            'customizations': {
                'title': 'Darra App Payment',
                'description': f'Payment for order {payment.reference}',
                'logo': f'{settings.BASE_URL}/static/logo.png'
            },
            'meta': {
                'payment_id': payment.id,
                'user_id': payment.user.id
            }
        }
        
        try:
            response = requests.post(url, json=payload, headers=self._get_headers())
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            raise ValidationError(f"Flutterwave API error: {str(e)}")
    
    def verify_payment(self, reference):
        """Verify payment with Flutterwave"""
        url = f"{self.base_url}/transactions/verify_by_reference?tx_ref={reference}"
        
        try:
            response = requests.get(url, headers=self._get_headers())
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            raise ValidationError(f"Flutterwave API error: {str(e)}")

    def calculate_seller_commission(self, product_price):
        """Calculate 4% commission and seller payout"""
        commission = product_price * Decimal('0.04')
        seller_payout = product_price - commission
        return commission, seller_payout

    def create_seller_commission(self, purchase):
        """Create commission record for seller"""
        try:
            commission_amount, seller_payout = self.calculate_seller_commission(purchase.total_price)
            
            commission, created = SellerCommission.objects.get_or_create(
                seller=purchase.product.owner,
                purchase=purchase,
                defaults={
                    'product_price': purchase.total_price,
                    'commission_amount': commission_amount,
                    'seller_payout': seller_payout,
                    'status': 'pending'
                }
            )
            
            if created:
                print(f"DEBUG: Created commission record for {purchase.product.owner.email}: ₦{commission_amount}")
            
            return commission
        except Exception as e:
            print(f"DEBUG: Error creating commission: {str(e)}")
            return None

    def update_seller_earnings(self, seller):
        """Update seller's total earnings"""
        try:
            # Get all commissions for this seller
            commissions = SellerCommission.objects.filter(seller=seller)
            
            # Calculate totals
            total_sales = sum(c.product_price for c in commissions)
            total_commission = sum(c.commission_amount for c in commissions)
            
            # Get total payouts
            total_payouts = sum(p.amount for p in PayoutRequest.objects.filter(
                seller=seller, 
                status='completed'
            ))
            
            # Get or create earnings record
            earnings, created = SellerEarnings.objects.get_or_create(
                seller=seller,
                defaults={
                    'total_sales': total_sales,
                    'total_commission': total_commission,
                    'total_payouts': total_payouts,
                    'available_balance': total_sales - total_commission - total_payouts
                }
            )
            
            if not created:
                earnings.total_sales = total_sales
                earnings.total_commission = total_commission
                earnings.total_payouts = total_payouts
                earnings.available_balance = total_sales - total_commission - total_payouts
                earnings.save()
            
            print(f"DEBUG: Updated earnings for {seller.email}: Sales: ₦{total_sales}, Commission: ₦{total_commission}, Available: ₦{earnings.available_balance}")
            
            return earnings
        except Exception as e:
            print(f"DEBUG: Error updating earnings: {str(e)}")
            return None

class PaystackService:
    def __init__(self):
        self.secret_key = settings.PAYSTACK_SECRET_KEY
        self.public_key = settings.PAYSTACK_PUBLIC_KEY
        self.base_url = "https://api.paystack.co"
        
    def _get_headers(self):
        return {
            'Authorization': f'Bearer {self.secret_key}',
            'Content-Type': 'application/json'
        }
    
    def initialize_payment(self, payment):
        """Initialize payment with Paystack"""
        url = f"{self.base_url}/transaction/initialize"
        
        payload = {
            'email': payment.user.email,
            'amount': int(payment.amount * 100),  # Convert to kobo (smallest currency unit)
            'reference': payment.reference,
            'callback_url': f"{settings.BASE_URL}/api/payments/verify/{payment.reference}/",
            'metadata': {
                'payment_id': payment.id,
                'user_id': payment.user.id
            }
        }
        
        try:
            response = requests.post(url, json=payload, headers=self._get_headers())
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            raise ValidationError(f"Paystack API error: {str(e)}")
    
    def verify_payment(self, reference):
        """Verify payment with Paystack"""
        url = f"{self.base_url}/transaction/verify/{reference}"
        
        try:
            response = requests.get(url, headers=self._get_headers())
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            raise ValidationError(f"Paystack API error: {str(e)}")

    def calculate_seller_commission(self, product_price):
        """Calculate 4% commission and seller payout"""
        commission = product_price * Decimal('0.04')
        seller_payout = product_price - commission
        return commission, seller_payout

    def create_seller_commission(self, purchase):
        """Create commission record for seller"""
        try:
            commission_amount, seller_payout = self.calculate_seller_commission(purchase.total_price)
            
            commission, created = SellerCommission.objects.get_or_create(
                seller=purchase.product.owner,
                purchase=purchase,
                defaults={
                    'product_price': purchase.total_price,
                    'commission_amount': commission_amount,
                    'seller_payout': seller_payout,
                    'status': 'pending'
                }
            )
            
            if created:
                print(f"DEBUG: Created commission record for {purchase.product.owner.email}: ₦{commission_amount}")
            
            return commission
        except Exception as e:
            print(f"DEBUG: Error creating commission: {str(e)}")
            return None

    def update_seller_earnings(self, seller):
        """Update seller's total earnings"""
        try:
            # Get all commissions for this seller
            commissions = SellerCommission.objects.filter(seller=seller)
            
            # Calculate totals
            total_sales = sum(c.product_price for c in commissions)
            total_commission = sum(c.commission_amount for c in commissions)
            
            # Get total payouts
            total_payouts = sum(p.amount for p in PayoutRequest.objects.filter(
                seller=seller, 
                status='completed'
            ))
            
            # Update or create earnings record
            earnings, created = SellerEarnings.objects.get_or_create(
                seller=seller,
                defaults={
                    'total_sales': total_sales,
                    'total_commission': total_commission,
                    'total_payouts': total_payouts
                }
            )
            
            if not created:
                earnings.total_sales = total_sales
                earnings.total_commission = total_commission
                earnings.total_payouts = total_payouts
            
            earnings.calculate_available_balance()
            earnings.save()
            
            print(f"DEBUG: Updated earnings for {seller.email}: Sales: ₦{total_sales}, Commission: ₦{total_commission}, Available: ₦{earnings.available_balance}")
            
            return earnings
        except Exception as e:
            print(f"DEBUG: Error updating earnings: {str(e)}")
            return None

    def process_successful_payment(self, payment, paystack_data):
        """Process successful payment and add products to user library"""
        print(f"DEBUG: Processing successful payment for user: {payment.user.email}")
        
        # Update payment status
        payment.status = Payment.PaymentStatus.SUCCESS
        payment.paystack_transaction_id = paystack_data.get('data', {}).get('id')
        payment.gateway_response = str(paystack_data)
        payment.save()
        print(f"DEBUG: Payment status updated to: {payment.status}")
        
        # Add products to user library
        purchases = payment.purchases.all()
        print(f"DEBUG: Found {purchases.count()} purchases to add to library")
        
        for purchase in purchases:
            try:
                # Create commission record for seller
                commission = self.create_seller_commission(purchase)
                
                if purchase.product.product_type == 'event':
                    # For event tickets, create separate library entries for each ticket
                    for ticket_number in range(purchase.quantity):
                        UserLibrary.objects.create(
                            user=payment.user,
                            product=purchase.product,
                            purchase=purchase,
                            quantity=1
                        )
                    print(f"DEBUG: Created {purchase.quantity} library entries for event: {purchase.product.title}")
                else:
                    # For digital products, create one library entry with the full quantity
                    UserLibrary.objects.create(
                        user=payment.user,
                        product=purchase.product,
                        purchase=purchase,
                        quantity=purchase.quantity
                    )
                    print(f"DEBUG: Created library entry for digital product: {purchase.product.title} x{purchase.quantity}")
                
                # Update seller earnings
                if commission:
                    self.update_seller_earnings(purchase.product.owner)
                    
            except Exception as e:
                print(f"DEBUG: Error adding product to library: {str(e)}")
                # Continue with other products even if one fails
                continue
        
        print(f"DEBUG: Successfully processed payment and added items to library")
        
        # Send emails and notifications after successful payment processing (non-blocking)
        try:
            # Import notification service
            from apps.notifications.services import NotificationService
                   
            # Check if any purchases are events
            has_events = any(p.product.product_type == 'event' for p in purchases)
            
            if has_events:
                # Handle event tickets
                for purchase in purchases:
                    if purchase.product.product_type == 'event':
                        # Import here to avoid circular imports
                        from apps.events.models import EventTicket
                        
                        # Create tickets based on quantity
                        tickets = []
                        for _ in range(purchase.quantity):
                            ticket = EventTicket.objects.create(
                                purchase=purchase,
                                buyer=payment.user,
                                event=purchase.product
                            )
                            tickets.append(ticket)
                        
                        # Send event ticket email
                        try:
                            send_event_ticket_email(payment.user, purchase.product, tickets)
                        except Exception as email_error:
                            print(f"DEBUG: Error sending event ticket email: {str(email_error)}")
                        
                        # Send notification
                        try:
                            NotificationService.send_event_ticket_notification(payment.user, purchase.product, tickets)
                        except Exception as notif_error:
                            print(f"DEBUG: Error sending event ticket notification: {str(notif_error)}")
                    else:
                        # Send regular purchase receipt email
                        try:
                            send_purchase_receipt_email(payment.user, purchase)
                        except Exception as email_error:
                            print(f"DEBUG: Error sending purchase receipt email: {str(email_error)}")
                        
                        # Send notification
                        try:
                            NotificationService.send_new_order_notification(purchase, purchase.product.owner)
                        except Exception as notif_error:
                            print(f"DEBUG: Error sending order notification: {str(notif_error)}")
            else:
                # Handle digital products
                for purchase in purchases:
                    # Send purchase receipt email
                    try:
                        send_purchase_receipt_email(payment.user, purchase)
                    except Exception as email_error:
                        print(f"DEBUG: Error sending purchase receipt email: {str(email_error)}")
                    
                    # Send notification
                    try:
                        NotificationService.send_new_order_notification(purchase, purchase.product.owner)
                    except Exception as notif_error:
                        print(f"DEBUG: Error sending order notification: {str(notif_error)}")
                        
        except Exception as e:
            print(f"DEBUG: Error sending emails/notifications: {str(e)}")
            # Don't fail the payment if emails/notifications fail
        
        return payment

class PaymentService:
    @staticmethod
    def create_payment_from_cart(user, cart_items, payment_provider=None):
        """Create payment from cart items"""
        print(f"DEBUG: PaymentService.create_payment_from_cart called with cart_items: {cart_items}")
        print(f"DEBUG: Type of cart_items: {type(cart_items)}")
        print(f"DEBUG: Length of cart_items: {len(cart_items)}")
        print(f"DEBUG: Requested payment provider: {payment_provider}")
        
        # Generate unique reference
        reference = f"DARRA_{uuid.uuid4().hex[:8].upper()}"
        
        # Fetch products and calculate total amount
        total_amount = 0
        processed_items = []
        
        for i, item in enumerate(cart_items):
            print(f"DEBUG: Processing item {i}: {item}")
            print(f"DEBUG: Item type: {type(item)}")
            print(f"DEBUG: Item keys: {list(item.keys()) if isinstance(item, dict) else 'Not a dict'}")
            
            if 'product_id' in item:
                print(f"DEBUG: Found product_id: {item['product_id']}")
                # Frontend is sending product_id, fetch the product
                try:
                    product = Product.objects.get(id=item['product_id'])
                    quantity = item['quantity']
                    total_amount += product.price * quantity
                    processed_items.append({
                        'product': product,
                        'quantity': quantity
                    })
                    print(f"DEBUG: Successfully processed product {product.id} with quantity {quantity}")
                except Product.DoesNotExist:
                    raise ValidationError(f"Product with ID {item['product_id']} not found")
            elif 'product' in item:
                print(f"DEBUG: Found product object: {item['product']}")
                product = item['product']
                quantity = item['quantity']
                total_amount += product.price * quantity
                processed_items.append({
                    'product': product,
                    'quantity': quantity
                })
            else:
                print(f"DEBUG: Item missing both product_id and product fields")
                print(f"DEBUG: Available keys: {list(item.keys()) if isinstance(item, dict) else 'Not a dict'}")
                raise ValidationError("Each item must have either 'product_id' or 'product' field")
        
        # Create payment with provider
        payment = Payment.objects.create(
            user=user,
            reference=reference,
            amount=total_amount,
            currency='NGN',
            payment_provider=payment_provider if payment_provider else getattr(settings, 'PAYMENT_PROVIDER', 'paystack')
        )
        
        # Create purchases
        for item in processed_items:
            Purchase.objects.create(
                payment=payment,
                product=item['product'],
                quantity=item['quantity'],
                unit_price=item['product'].price,
                total_price=item['product'].price * item['quantity']
            )
        
        return payment

    @staticmethod
    def process_successful_payment(payment):
        """Process successful payment and add products to user library"""
        print(f"DEBUG: Processing successful payment for user: {payment.user.email}")
        
        # Update payment status
        payment.status = Payment.PaymentStatus.SUCCESS
        payment.save()
        print(f"DEBUG: Payment status updated to: {payment.status}")
        
        # Add products to user library
        purchases = payment.purchases.all()
        print(f"DEBUG: Found {purchases.count()} purchases to add to library")
        
        for purchase in purchases:
            try:
                # Create commission record for seller
                commission = None
                if payment.payment_provider == 'flutterwave':
                    from .services import FlutterwaveService
                    flutterwave_service = FlutterwaveService()
                    commission = flutterwave_service.create_seller_commission(purchase)
                else:
                    from .services import PaystackService
                    paystack_service = PaystackService()
                    commission = paystack_service.create_seller_commission(purchase)
                
                if purchase.product.product_type == 'event':
                    # For event tickets, create separate library entries for each ticket
                    for ticket_number in range(purchase.quantity):
                        UserLibrary.objects.create(
                            user=payment.user,
                            product=purchase.product,
                            purchase=purchase,
                            quantity=1
                        )
                    print(f"DEBUG: Created {purchase.quantity} library entries for event: {purchase.product.title}")
                else:
                    # For digital products, create one library entry with the full quantity
                    UserLibrary.objects.create(
                        user=payment.user,
                        product=purchase.product,
                        purchase=purchase,
                        quantity=purchase.quantity
                    )
                    print(f"DEBUG: Created library entry for digital product: {purchase.product.title} x{purchase.quantity}")
                
                # Update seller earnings
                if commission:
                    if payment.payment_provider == 'flutterwave':
                        flutterwave_service.update_seller_earnings(purchase.product.owner)
                    else:
                        paystack_service.update_seller_earnings(purchase.product.owner)
                        
            except Exception as e:
                print(f"DEBUG: Error adding product to library: {str(e)}")
                # Continue with other products even if one fails
                continue
        
        print(f"DEBUG: Successfully processed payment and added items to library")
        
        # Send emails and notifications after successful payment processing (non-blocking)
        try:
            # Import notification service
            from apps.notifications.services import NotificationService
                   
            # Check if any purchases are events
            has_events = any(p.product.product_type == 'event' for p in purchases)
            
            if has_events:
                # Handle event tickets
                for purchase in purchases:
                    if purchase.product.product_type == 'event':
                        # Import here to avoid circular imports
                        from apps.events.models import EventTicket
                        
                        # Create tickets based on quantity
                        tickets = []
                        for _ in range(purchase.quantity):
                            ticket = EventTicket.objects.create(
                                purchase=purchase,
                                buyer=payment.user,
                                event=purchase.product
                            )
                            tickets.append(ticket)
                        
                        # Send event ticket email
                        try:
                            send_event_ticket_email(payment.user, purchase.product, tickets)
                        except Exception as email_error:
                            print(f"DEBUG: Error sending event ticket email: {str(email_error)}")
                        
                        # Send notification
                        try:
                            NotificationService.send_event_ticket_notification(payment.user, purchase.product, tickets)
                        except Exception as notif_error:
                            print(f"DEBUG: Error sending event ticket notification: {str(notif_error)}")
                    else:
                        # Send regular purchase receipt email
                        try:
                            send_purchase_receipt_email(payment.user, purchase)
                        except Exception as email_error:
                            print(f"DEBUG: Error sending purchase receipt email: {str(email_error)}")
                        
                        # Send notification
                        try:
                            NotificationService.send_new_order_notification(purchase, purchase.product.owner)
                        except Exception as notif_error:
                            print(f"DEBUG: Error sending order notification: {str(notif_error)}")
            else:
                # Handle digital products
                for purchase in purchases:
                    # Send purchase receipt email
                    try:
                        send_purchase_receipt_email(payment.user, purchase)
                    except Exception as email_error:
                        print(f"DEBUG: Error sending purchase receipt email: {str(email_error)}")
                    
                    # Send notification
                    try:
                        NotificationService.send_new_order_notification(purchase, purchase.product.owner)
                    except Exception as notif_error:
                        print(f"DEBUG: Error sending order notification: {str(notif_error)}")
                        
        except Exception as e:
            print(f"DEBUG: Error sending emails/notifications: {str(e)}")
            # Don't fail the payment if emails/notifications fail
        
        return payment

class PayoutService:
    """Handle seller payouts using Paystack Transfer API"""
    
    def __init__(self):
        self.secret_key = settings.PAYSTACK_SECRET_KEY
        self.base_url = "https://api.paystack.co"
    
    def _get_headers(self):
        return {
            'Authorization': f'Bearer {self.secret_key}',
            'Content-Type': 'application/json'
        }
    
    def process_payout(self, payout_request):
        """Process payout using Paystack Transfer API"""
        try:
            # Get seller's bank details
            bank_details = payout_request.bank_details
            
            # Always use the actual bank code from the user's bank details
            # Paystack will handle test mode validation on their end
            recipient_data = {
                'type': 'nuban',
                'name': bank_details.account_name,
                'account_number': bank_details.account_number,
                'bank_code': bank_details.bank_code,  # Use actual bank code from user's details
                'currency': 'NGN'
            }
            
            print(f"DEBUG: Creating recipient with data: {recipient_data}")
            
            # Create recipient on Paystack
            recipient_response = requests.post(
                f'{self.base_url}/transferrecipient',
                headers=self._get_headers(),
                json=recipient_data
            )
            
            print(f"DEBUG: Recipient response status: {recipient_response.status_code}")
            print(f"DEBUG: Recipient response: {recipient_response.text}")
            
            # Check if recipient creation was successful
            if recipient_response.status_code in [200, 201]:  # Accept both 200 and 201 as success
                recipient_data = recipient_response.json()
                
                # Double-check the response status from Paystack
                if recipient_data.get('status') == True:
                    recipient_code = recipient_data['data']['recipient_code']
                    print(f"DEBUG: Recipient created successfully with code: {recipient_code}")
                else:
                    # Paystack returned success but with false status
                    payout_request.status = 'failed'
                    payout_request.failure_reason = f"Paystack rejected recipient creation: {recipient_response.text}"
                    payout_request.save()
                    print(f"DEBUG: Paystack rejected recipient creation: {recipient_response.text}")
                    return False
            else:
                # HTTP error
                payout_request.status = 'failed'
                payout_request.failure_reason = f"HTTP error creating recipient: {recipient_response.status_code} - {recipient_response.text}"
                payout_request.save()
                print(f"DEBUG: HTTP error creating recipient: {recipient_response.status_code} - {recipient_response.text}")
                return False
            
            # Generate transfer reference (required by Paystack)
            import uuid
            transfer_reference = f"payout_{uuid.uuid4().hex[:16]}"
            
            # Now initiate the transfer
            transfer_data = {
                'source': 'balance',  # From your Paystack balance
                'amount': int(payout_request.amount * 100),  # Convert to kobo
                'recipient': recipient_code,  # Use the recipient code from Paystack
                'reference': transfer_reference,  # Required by Paystack
                'reason': f'Payout for {payout_request.seller.brand_name or payout_request.seller.email}'
            }
            
            print(f"DEBUG: Initiating transfer with data: {transfer_data}")
            
            # Call Paystack Transfer API
            response = requests.post(
                f'{self.base_url}/transfer',
                headers=self._get_headers(),
                json=transfer_data
            )
            
            print(f"DEBUG: Transfer response status: {response.status_code}")
            print(f"DEBUG: Transfer response: {response.text}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Update payout request
                payout_request.status = 'completed'
                payout_request.paystack_transfer_id = data['data']['id']
                payout_request.transfer_reference = transfer_reference
                payout_request.processed_at = timezone.now()
                payout_request.save()
                
                # Update seller earnings
                try:
                    earnings = payout_request.seller.earnings
                    earnings.total_payouts += payout_request.amount
                    earnings.calculate_available_balance()
                    earnings.save()
                except Exception as e:
                    print(f"DEBUG: Warning - Could not update earnings: {str(e)}")
                
                print(f"DEBUG: Payout successful for {payout_request.seller.email}: ₦{payout_request.amount}")
                return True
            else:
                # Transfer failed
                payout_request.status = 'failed'
                payout_request.failure_reason = response.text
                payout_request.save()
                
                print(f"DEBUG: Payout failed for {payout_request.seller.email}: {response.text}")
                return False
                
        except Exception as e:
            payout_request.status = 'failed'
            payout_request.failure_reason = str(e)
            payout_request.save()
            
            print(f"DEBUG: Error processing payout: {str(e)}")
            return False


class PaymentProviderFactory:
    """Factory class to get the appropriate payment service based on settings"""
    
    @staticmethod
    def get_payment_service():
        """Get the payment service based on PAYMENT_PROVIDER setting"""
        provider = getattr(settings, 'PAYMENT_PROVIDER', 'paystack')
        print(f"DEBUG: PaymentProviderFactory - PAYMENT_PROVIDER setting: {provider}")
        print(f"DEBUG: PaymentProviderFactory - Available providers: paystack, flutterwave")
        
        if provider == 'flutterwave':
            print(f"DEBUG: PaymentProviderFactory - Returning FlutterwaveService")
            return FlutterwaveService()
        else:
            print(f"DEBUG: PaymentProviderFactory - Returning PaystackService (default)")
            return PaystackService()  # Default to Paystack
    
    @staticmethod
    def get_payment_service_by_provider(provider_name):
        """Get a specific payment service by name"""
        if provider_name == 'flutterwave':
            return FlutterwaveService()
        elif provider_name == 'paystack':
            return PaystackService()
        else:
            raise ValueError(f"Unknown payment provider: {provider_name}")


# Legacy function for backward compatibility
def get_payment_service():
    """Get the default payment service (for backward compatibility)"""
    return PaymentProviderFactory.get_payment_service() 