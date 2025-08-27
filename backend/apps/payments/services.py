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
        
        # Create payment with requested provider or default
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
    """Handle seller payouts using Flutterwave Transfer API"""
    
    def __init__(self):
        self.secret_key = settings.FLUTTERWAVE_SECRET_KEY
        self.base_url = "https://api.flutterwave.com/v3"  # Use the API that works for payments
        
        print(f"DEBUG: PayoutService initialized")
        print(f"DEBUG: Secret key length: {len(self.secret_key) if self.secret_key else 0}")
        print(f"DEBUG: Base URL: {self.base_url}")
        
        print(f"DEBUG: PayoutService initialized")
        print(f"DEBUG: Secret key length: {len(self.secret_key) if self.secret_key else 0}")
        print(f"DEBUG: Base URL: {self.base_url}")
    
    def _get_headers(self):
        return {
            'Authorization': f'Bearer {self.secret_key}',
            'Content-Type': 'application/json'
        }
    
    def process_payout(self, payout_request):
        """Process payout using Flutterwave General Transfer Flow"""
        try:
            # Get seller's bank details
            bank_details = payout_request.bank_details
            
            # Skip account verification for now and go straight to transfer
            # The Direct Transfer API will handle account validation
            print(f"DEBUG: Skipping account verification for {payout_request.seller.email}")
            print(f"DEBUG: Bank code: {bank_details.bank_code}, Account number: {bank_details.account_number}")
            print(f"DEBUG: Account name: {bank_details.account_name}")
            
            # Generate transfer reference
            import uuid
            transfer_reference = f"DARRA_PAYOUT_{uuid.uuid4().hex[:16].upper()}"
            
            # Use simple transfer structure for the old API
            transfer_data = {
                'account_bank': bank_details.bank_code,
                'account_number': bank_details.account_number,
                'amount': int(payout_request.amount),  # Amount in Naira
                'narration': f'Payout for {payout_request.seller.brand_name or payout_request.seller.email}',
                'currency': 'NGN',
                'reference': transfer_reference,
                'beneficiary_name': bank_details.account_name,
                'meta': [
                    {
                        'metaname': 'seller_email',
                        'metavalue': payout_request.seller.email
                    },
                    {
                        'metaname': 'payout_id',
                        'metavalue': str(payout_request.id)
                    }
                ]
            }
            
            print(f"DEBUG: Initiating Flutterwave transfer with data: {transfer_data}")
            
            # Call Flutterwave Transfer API (using the API that works for payments)
            response = requests.post(
                f'{self.base_url}/transfers',
                headers=self._get_headers(),
                json=transfer_data
            )
            
            print(f"DEBUG: Flutterwave transfer response status: {response.status_code}")
            print(f"DEBUG: Flutterwave transfer response: {response.text}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Check Flutterwave Direct Transfer response status
                if data.get('status') == 'success':
                    # Update payout request
                    payout_request.status = 'processing'  # Status will be 'NEW' initially
                    payout_request.flutterwave_transfer_id = data['data']['id']
                    payout_request.transfer_reference = transfer_reference
                    payout_request.save()
                    
                    print(f"DEBUG: Flutterwave Direct Transfer initiated successfully for {payout_request.seller.email}: ₦{payout_request.amount}")
                    print(f"DEBUG: Transfer ID: {data['data']['id']}, Status: {data['data']['status']}")
                    
                    # Note: The transfer status will be updated via webhook or manual verification
                    # For now, we mark it as processing since the status is 'NEW'
                    return True
                else:
                    # Flutterwave returned error
                    payout_request.status = 'failed'
                    payout_request.failure_reason = f"Flutterwave error: {data.get('message', 'Unknown error')}"
                    payout_request.save()
                    
                    print(f"DEBUG: Flutterwave Direct Transfer failed for {payout_request.seller.email}: {data.get('message', 'Unknown error')}")
                    return False
            else:
                # HTTP error
                payout_request.status = 'failed'
                
                # Handle specific error cases
                if response.status_code == 400:
                    try:
                        error_data = response.json()
                        error_message = error_data.get('message', '')
                        
                        if 'IP Whitelisting' in error_message:
                            failure_reason = "IP Whitelisting required - Contact admin to configure Flutterwave IP access"
                            print(f"DEBUG: IP Whitelisting error - Seller needs to configure Flutterwave IP whitelist")
                        elif 'insufficient balance' in error_message.lower():
                            failure_reason = "Insufficient balance in Flutterwave account"
                            print(f"DEBUG: Insufficient balance in Flutterwave account")
                        else:
                            failure_reason = f"Flutterwave error: {error_message}"
                            print(f"DEBUG: Other Flutterwave error: {error_message}")
                    except:
                        failure_reason = f"HTTP error: {response.status_code} - {response.text}"
                else:
                    failure_reason = f"HTTP error: {response.status_code} - {response.text}"
                
                payout_request.failure_reason = failure_reason
                payout_request.save()
                
                print(f"DEBUG: Flutterwave payout HTTP error for {payout_request.seller.email}: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            payout_request.status = 'failed'
            payout_request.failure_reason = str(e)
            payout_request.save()
            
            print(f"DEBUG: Error processing Flutterwave payout: {str(e)}")
            return False
    
    def verify_account(self, account_number, bank_code):
        """Verify bank account number using Flutterwave API"""
        try:
            # Try the new API endpoint first
            url = f"{self.transfer_base_url}/accounts/resolve"
            headers = self._get_headers()
            data = {
                "account_number": account_number,
                "account_bank": bank_code
            }
            
            print(f"DEBUG: Verifying account with new Flutterwave API: {data}")
            
            response = requests.post(url, json=data, headers=headers)
            print(f"DEBUG: Account verification response status: {response.status_code}")
            print(f"DEBUG: Account verification response: {response.text}")
            
            if response.status_code == 200:
                result = response.json()
                if result.get('status') == 'success':
                    print(f"DEBUG: Account verification successful: {result.get('data', {}).get('account_name')}")
                    return result
                else:
                    print(f"DEBUG: Account verification failed: {result.get('message')}")
                    return result
            else:
                print(f"DEBUG: Account verification HTTP error: {response.status_code}")
                return {
                    'status': 'error',
                    'message': f"HTTP error: {response.status_code} - {response.text}"
                }
                
        except Exception as e:
            print(f"DEBUG: Account verification exception: {str(e)}")
            return {
                'status': 'error',
                'message': f"Verification error: {str(e)}"
            }


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