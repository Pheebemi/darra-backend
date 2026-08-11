import logging
import requests
import uuid
from decimal import Decimal
from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils import timezone
from .models import Payment, Purchase, UserLibrary, SellerCommission, SellerEarnings, PayoutRequest
from products.models import Product
from users.utils import send_purchase_receipt_email, send_seller_notification_email, send_event_ticket_email
from apps.notifications.services import NotificationService

logger = logging.getLogger(__name__)


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
    
    def initialize_payment(self, payment, callback_url: str | None = None):
        """Initialize payment with Flutterwave"""
        url = f"{self.base_url}/payments"
        
        # Prefer a provided callback_url (from frontend) else fallback to settings.BASE_URL
        resolved_callback = callback_url or f"{settings.BASE_URL}/api/payments/verify/{payment.reference}/"
        
        payload = {
            'tx_ref': payment.reference,  # This will now be DARRA_XXXX format
            'amount': float(payment.amount),  # Flutterwave uses float, not kobo
            'currency': payment.currency,
            'redirect_url': resolved_callback,
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

    def _transfer_fee_tier(self, amount):
        """Flutterwave NGN transfer fee tiers — the fallback if the live fee
        lookup can't be reached. Kept slightly conservative so the platform is
        never left short."""
        amount = Decimal(str(amount))
        if amount <= Decimal('5000'):
            return Decimal('10')
        if amount <= Decimal('50000'):
            return Decimal('25')
        return Decimal('50')

    def get_transfer_fee(self, amount):
        """
        The Flutterwave fee for an NGN transfer of `amount`. The seller bears
        this fee (per business decision), so we deduct it from what we send.
        Asks Flutterwave's /transfers/fee for the exact figure, falling back to
        the known tier table if that call fails.
        """
        try:
            resp = requests.get(
                f"{self.base_url}/transfers/fee",
                params={'amount': float(amount), 'currency': 'NGN'},
                headers=self._get_headers(), timeout=15,
            )
            body = resp.json() if resp.content else {}
            rows = (body or {}).get('data') or []
            if resp.ok and rows and rows[0].get('fee') is not None:
                return Decimal(str(rows[0]['fee']))
        except Exception as e:
            logger.warning("Transfer-fee lookup failed (%s); using tier fallback.", e)
        return self._transfer_fee_tier(amount)

    def process_seller_payout(self, payout_request):
        """
        Initiate a Flutterwave transfer for an approved payout.

        Transfers are ASYNCHRONOUS: this only kicks the transfer off and moves
        the request to 'processing'. The final 'completed' / 'failed' outcome
        arrives later on the transfer.completed webhook — never mark it complete
        here. Returns True if the transfer was accepted for processing.

        Idempotent: refuses to send if the request isn't 'pending' or already
        has a transfer id, so a double-click can't pay twice.
        """
        if payout_request.status != 'pending' or payout_request.flutterwave_transfer_id:
            logger.warning("Payout %s not eligible to send (status=%s, txid=%s)",
                           payout_request.id, payout_request.status,
                           payout_request.flutterwave_transfer_id)
            return False

        bank_details = payout_request.bank_details
        reference = payout_request.transfer_reference or f"DARRA-PO-{payout_request.id}-{uuid.uuid4().hex[:8]}"
        payout_request.transfer_reference = reference

        # The seller bears the transfer fee: we send (requested amount − fee),
        # so their full requested amount still leaves their Darra balance but the
        # fee comes out of it. requested ₦1,000, fee ₦10 → seller receives ₦990.
        fee = self.get_transfer_fee(payout_request.amount)
        net_amount = payout_request.amount - fee
        if net_amount <= 0:
            payout_request.status = 'failed'
            payout_request.failure_reason = (
                f"Amount NGN {payout_request.amount} is too small to cover the "
                f"NGN {fee} transfer fee."
            )
            payout_request.save()
            self.update_seller_earnings(payout_request.seller)  # release reservation
            return False

        transfer_data = {
            'account_bank': bank_details.bank_code,
            'account_number': bank_details.account_number,
            'amount': float(net_amount),   # requested minus fee — seller pays the fee
            'narration': f'Darra payout - {payout_request.seller.brand_name or payout_request.seller.email}',
            'currency': 'NGN',
            'reference': reference,
            'beneficiary_name': bank_details.account_name,
        }

        try:
            response = requests.post(
                f"{self.base_url}/transfers", json=transfer_data,
                headers=self._get_headers(), timeout=30,
            )
            body = response.json() if response.content else {}
        except Exception as e:
            payout_request.status = 'failed'
            payout_request.failure_reason = f"Could not reach Flutterwave: {e}"
            payout_request.save()
            self.update_seller_earnings(payout_request.seller)  # release the reservation
            logger.error("Payout %s transfer request failed: %s", payout_request.id, e)
            return False

        data = (body or {}).get('data') or {}
        # FLW replies status='success' + data.status NEW/PENDING when queued.
        if response.ok and body.get('status') == 'success' and data.get('id'):
            payout_request.flutterwave_transfer_id = str(data['id'])
            payout_request.status = 'processing'
            payout_request.processed_at = timezone.now()
            payout_request.save()
            logger.info("Payout %s transfer initiated (ref %s)", payout_request.id, reference)
            return True

        payout_request.status = 'failed'
        payout_request.failure_reason = (
            body.get('message') if isinstance(body, dict) else None
        ) or 'Transfer was rejected by Flutterwave'
        payout_request.save()
        self.update_seller_earnings(payout_request.seller)  # release the reservation
        logger.error("Payout %s rejected by Flutterwave: %s",
                     payout_request.id, payout_request.failure_reason)
        return False

    def sync_payout_status(self, payout_request):
        """
        Reconcile a payout against Flutterwave's actual transfer status — for
        when the confirmation webhook was missed (downtime, a config gap, etc.).
        Mirrors the webhook: on SUCCESSFUL/FAILED it updates the record, releases
        the reserved balance if failed, and emails the seller. Idempotent — a
        payout that is already final, or was never sent, is left alone. Returns
        the resolved status.
        """
        if payout_request.status in ('completed', 'failed') or not payout_request.flutterwave_transfer_id:
            return payout_request.status

        try:
            resp = requests.get(
                f"{self.base_url}/transfers/{payout_request.flutterwave_transfer_id}",
                headers=self._get_headers(), timeout=30,
            )
            data = (resp.json() or {}).get('data') or {}
        except Exception as e:
            logger.error("Sync payout %s failed: %s", payout_request.id, e)
            return payout_request.status

        flw_status = str(data.get('status', '')).upper()
        if flw_status == 'SUCCESSFUL':
            payout_request.status = 'completed'
            if not payout_request.processed_at:
                payout_request.processed_at = timezone.now()
            payout_request.save()
            self.update_seller_earnings(payout_request.seller)
            try:
                from users.utils import send_payout_completed_email
                send_payout_completed_email(payout_request)
            except Exception as e:
                logger.error("Payout completed email failed for %s: %s", payout_request.id, e)
        elif flw_status == 'FAILED':
            payout_request.status = 'failed'
            payout_request.failure_reason = data.get('complete_message') or 'Transfer failed at Flutterwave'
            payout_request.save()
            self.update_seller_earnings(payout_request.seller)  # release reservation
            try:
                from users.utils import send_payout_failed_email
                send_payout_failed_email(payout_request)
            except Exception as e:
                logger.error("Payout failed email failed for %s: %s", payout_request.id, e)
        # else: still NEW/PENDING at Flutterwave — leave it processing.
        return payout_request.status

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
            
            # Count in-flight payouts (pending/processing) as reserved too, so a
            # seller cannot request two payouts against the same balance. A
            # 'failed' payout is excluded here, which releases its funds back.
            total_payouts = sum(p.amount for p in PayoutRequest.objects.filter(
                seller=seller,
                status__in=['pending', 'processing', 'completed'],
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
    
    def initialize_payment(self, payment, callback_url: str | None = None):
        """Initialize payment with Paystack"""
        url = f"{self.base_url}/transaction/initialize"
        
        # Prefer a provided callback_url (from frontend) else fallback to settings.BASE_URL
        resolved_callback = callback_url or f"{settings.BASE_URL}/api/payments/verify/{payment.reference}/"

        payload = {
            'email': payment.user.email,
            'amount': int(payment.amount * 100),  # Convert to kobo (smallest currency unit)
            'reference': payment.reference,
            'callback_url': resolved_callback,
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
            
            # Count in-flight payouts (pending/processing) as reserved too, so a
            # seller cannot request two payouts against the same balance. A
            # 'failed' payout is excluded here, which releases its funds back.
            total_payouts = sum(p.amount for p in PayoutRequest.objects.filter(
                seller=seller,
                status__in=['pending', 'processing', 'completed'],
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

                # Decrement ticket tier quantity_sold
                if purchase.selected_ticket_tier:
                    from django.db.models import F
                    from products.models import TicketTier
                    TicketTier.objects.filter(id=purchase.selected_ticket_tier.id).update(
                        quantity_sold=F('quantity_sold') + purchase.quantity
                    )
                    print(f"DEBUG: Updated quantity_sold for tier {purchase.selected_ticket_tier.id} by {purchase.quantity}")

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
            
            # Send purchase receipt email once with all purchases
            try:
                send_purchase_receipt_email(payment, purchases)
            except Exception as email_error:
                print(f"DEBUG: Error sending purchase receipt email: {str(email_error)}")
            
            # Send seller notification email once with all purchases
            try:
                send_seller_notification_email(payment, purchases)
            except Exception as email_error:
                print(f"DEBUG: Error sending seller notification email: {str(email_error)}")

            # FIRST FUNCTION - Create event tickets with better error handling
            if has_events:
                # Collect all event tickets first
                all_event_tickets = []
                event_products = {}
                
                for purchase in purchases:
                    if purchase.product.product_type == 'event':
                        print(f"DEBUG: Creating {purchase.quantity} tickets for event: {purchase.product.title}")
                        
                        # Import here to avoid circular imports
                        from apps.events.fast_models import FastEventTicket
                        
                        # Create fast PNG tickets based on quantity with error handling
                        tickets = []
                        for ticket_num in range(purchase.quantity):
                            try:
                                ticket = FastEventTicket.objects.create(
                                    purchase=purchase,
                                    buyer=payment.user,
                                    event=purchase.product
                                )
                                tickets.append(ticket)
                                print(f"DEBUG: ✅ Created fast ticket {ticket.ticket_id} for event {purchase.product.title}")
                            except Exception as ticket_error:
                                print(f"DEBUG: ❌ Error creating fast ticket {ticket_num + 1}: {str(ticket_error)}")
                                # Continue with other tickets even if one fails
                                continue
                        
                        # Group tickets by event product
                        if purchase.product.id not in event_products:
                            event_products[purchase.product.id] = {
                                'product': purchase.product,
                                'tickets': [],
                                'purchase': purchase
                            }
                        event_products[purchase.product.id]['tickets'].extend(tickets)
                        all_event_tickets.extend(tickets)
                
                print(f"DEBUG: Successfully created {len(all_event_tickets)} event tickets")
                
                # Send one event ticket email with all tickets grouped by event
                for product_id, event_data in event_products.items():
                    try:
                        send_event_ticket_email(payment.user, event_data['product'], event_data['tickets'])
                    except Exception as email_error:
                        print(f"DEBUG: Error sending event ticket email: {str(email_error)}")
                    
                    # Send notification
                    try:
                        NotificationService.send_event_ticket_notification(payment.user, event_data['product'], event_data['tickets'])
                    except Exception as notif_error:
                        print(f"DEBUG: Error sending event ticket notification: {str(notif_error)}")
                
                # Send payment notification once for the buyer (for events)
                try:
                    NotificationService.send_payment_notification(payment, payment.user)
                    print(f"DEBUG: ✅ Payment notification sent to buyer for event purchase")
                except Exception as notif_error:
                    print(f"DEBUG: ❌ Error sending payment notification: {str(notif_error)}")
                
                # Send order notifications for each purchase
                for purchase in purchases:
                    try:
                        NotificationService.send_order_notification(purchase, purchase.product.owner)
                    except Exception as notif_error:
                        print(f"DEBUG: Error sending order notification: {str(notif_error)}")
            else:
                # Handle digital products - send payment notification once for the buyer
                try:
                    NotificationService.send_payment_notification(payment, payment.user)
                    print(f"DEBUG: ✅ Payment notification sent to buyer for digital product purchase")
                except Exception as notif_error:
                    print(f"DEBUG: ❌ Error sending payment notification: {str(notif_error)}")
                
                # Send order notifications for each purchase
                for purchase in purchases:
                    try:
                        NotificationService.send_order_notification(purchase, purchase.product.owner)
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
                    
                    # Check if this is a ticket event with specific tier pricing
                    item_price = product.price
                    ticket_tier_id = item.get('ticket_tier_id')
                    
                    if ticket_tier_id and product.is_ticket_event and product.ticket_tiers:
                        try:
                            ticket_tier = product.ticket_tiers.get(id=ticket_tier_id)
                            item_price = ticket_tier.price
                            print(f"DEBUG: Using ticket tier price: ₦{item_price} for tier: {ticket_tier.name}")
                        except Exception as e:
                            print(f"DEBUG: Error getting ticket tier {ticket_tier_id}: {e}")
                            # Fall back to product price
                            item_price = product.price
                    
                    total_amount += item_price * quantity
                    processed_items.append({
                        'product': product,
                        'quantity': quantity,
                        'unit_price': item_price,
                        'ticket_tier_id': ticket_tier_id
                    })
                    print(f"DEBUG: Successfully processed product {product.id} with quantity {quantity} at price ₦{item_price}")
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
            purchase = Purchase.objects.create(
                payment=payment,
                product=item['product'],
                quantity=item['quantity'],
                unit_price=item['unit_price'],
                total_price=item['unit_price'] * item['quantity']
            )
            
            # Set ticket tier if specified
            if item.get('ticket_tier_id'):
                try:
                    from products.models import TicketTier
                    ticket_tier = TicketTier.objects.get(id=item['ticket_tier_id'])
                    purchase.selected_ticket_tier = ticket_tier
                    purchase.save()
                    print(f"DEBUG: Set ticket tier {ticket_tier.name} for purchase {purchase.id}")
                except Exception as e:
                    print(f"DEBUG: Error setting ticket tier: {e}")
        
        return payment

    @staticmethod
    def process_successful_payment(payment):
        """Process successful payment and add products to user library"""
        print(f"DEBUG: Processing successful payment for user: {payment.user.email}")

        # Idempotency guard. Providers retry webhooks, and the verify endpoint
        # can fire for the same payment, so without this a single purchase can
        # issue duplicate library entries and tickets and double-count
        # quantity_sold. Claim the payment atomically: only the caller that
        # actually flips the row from non-success proceeds.
        claimed = Payment.objects.filter(
            pk=payment.pk
        ).exclude(
            status=Payment.PaymentStatus.SUCCESS
        ).update(status=Payment.PaymentStatus.SUCCESS)

        if not claimed:
            print(f"DEBUG: Payment {payment.reference} already processed; skipping.")
            return payment

        payment.status = Payment.PaymentStatus.SUCCESS
        print(f"DEBUG: Payment status updated to: {payment.status}")
        
        # Now process everything else - if this fails, payment is still successful
        try:
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

                    # Decrement ticket tier quantity_sold
                    if purchase.selected_ticket_tier:
                        from django.db.models import F
                        from products.models import TicketTier
                        TicketTier.objects.filter(id=purchase.selected_ticket_tier.id).update(
                            quantity_sold=F('quantity_sold') + purchase.quantity
                        )
                        print(f"DEBUG: Updated quantity_sold for tier {purchase.selected_ticket_tier.id} by {purchase.quantity}")

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
                
                # Send purchase receipt email once with all purchases
                try:
                    send_purchase_receipt_email(payment, purchases)
                except Exception as email_error:
                    print(f"DEBUG: Error sending purchase receipt email: {str(email_error)}")
                
                # Send seller notification email once with all purchases
                try:
                    send_seller_notification_email(payment, purchases)
                except Exception as email_error:
                    print(f"DEBUG: Error sending seller notification email: {str(email_error)}")
                   
                # Check if any purchases are events
                has_events = any(p.product.product_type == 'event' for p in purchases)
                
                # SECOND FUNCTION - Create event tickets (this is the main function being called)
                print(f"DEBUG: Checking for events - has_events: {has_events}")
                if has_events:
                    print(f"DEBUG: Found events, starting ticket creation process")
                    # Collect all event tickets first
                    all_event_tickets = []
                    event_products = {}
                    
                    for purchase in purchases:
                        if purchase.product.product_type == 'event':
                            print(f"DEBUG: Creating {purchase.quantity} tickets for event: {purchase.product.title}")
                            
                            # Import here to avoid circular imports
                            from apps.events.fast_models import FastEventTicket
                            
                            # Create fast tickets based on quantity with error handling
                            tickets = []
                            for ticket_num in range(purchase.quantity):
                                try:
                                    print(f"DEBUG: Creating fast ticket {ticket_num + 1} for event {purchase.product.title}")
                                    
                                    # Create fast ticket (PNG generation happens automatically)
                                    ticket = FastEventTicket(
                                        purchase=purchase,
                                        buyer=payment.user,
                                        event=purchase.product
                                    )
                                    ticket.save()  # This will trigger QR code generation
                                    
                                    tickets.append(ticket)
                                    print(f"DEBUG: ✅ Created ticket {ticket.ticket_id} for event {purchase.product.title}")
                                    
                                except Exception as ticket_error:
                                    print(f"DEBUG: ❌ Error creating ticket {ticket_num + 1}: {str(ticket_error)}")
                                    import traceback
                                    traceback.print_exc()
                                    # Continue with other tickets even if one fails
                                    continue
                            
                            # Group tickets by event product
                            if purchase.product.id not in event_products:
                                event_products[purchase.product.id] = {
                                    'product': purchase.product,
                                    'tickets': [],
                                    'purchase': purchase
                                }
                            event_products[purchase.product.id]['tickets'].extend(tickets)
                            all_event_tickets.extend(tickets)
                    
                    print(f"DEBUG: Successfully created {len(all_event_tickets)} event tickets")
                    
                    # Send event ticket emails immediately (QR codes should be generated by now)
                    for product_id, event_data in event_products.items():
                        try:
                            send_event_ticket_email(payment.user, event_data['product'], event_data['tickets'])
                            print(f"DEBUG: ✅ Event ticket email sent for {event_data['product'].title}")
                        except Exception as email_error:
                            print(f"DEBUG: ❌ Error sending event ticket email: {str(email_error)}")
                        
                        # Send notification
                        try:
                            NotificationService.send_event_ticket_notification(payment.user, event_data['product'], event_data['tickets'])
                        except Exception as notif_error:
                            print(f"DEBUG: ❌ Error sending event ticket notification: {str(notif_error)}")
                
                # Send payment notification once for the buyer
                try:
                    NotificationService.send_payment_notification(payment, payment.user)
                    print(f"DEBUG: ✅ Payment notification sent to buyer")
                except Exception as notif_error:
                    print(f"DEBUG: ❌ Error sending payment notification: {str(notif_error)}")
                
                # Send order notifications for all purchases (both events and digital products)
                for purchase in purchases:
                    try:
                        NotificationService.send_order_notification(purchase, purchase.product.owner)
                    except Exception as notif_error:
                        print(f"DEBUG: Error sending order notification: {str(notif_error)}")
                        
            except Exception as e:
                print(f"DEBUG: Error sending emails/notifications: {str(e)}")
                # Don't fail the payment if emails/notifications fail
        
        except Exception as processing_error:
            print(f"DEBUG: Error in post-payment processing: {str(processing_error)}")
            print(f"DEBUG: Payment is still successful, but some processing failed")
            # Payment status is already set to SUCCESS, so we're good
        
        return payment

class PayoutService:
    """Handle seller payouts using Flutterwave Transfer API"""
    
    def __init__(self):
        self.flutterwave_service = FlutterwaveService()
    
    def process_payout(self, payout_request):
        """Process payout using Flutterwave Transfer API"""
        return self.flutterwave_service.process_seller_payout(payout_request)


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