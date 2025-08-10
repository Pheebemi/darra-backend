import requests
import uuid
from decimal import Decimal
from django.conf import settings
from django.core.exceptions import ValidationError
from .models import Payment, Purchase, UserLibrary
from products.models import Product

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
                # Check if library item already exists
                existing_library_item = UserLibrary.objects.filter(
                    user=payment.user,
                    product=purchase.product
                ).first()
                
                if existing_library_item:
                    print(f"DEBUG: Library item already exists for product: {purchase.product.title}")
                    # Update the existing library item with the new purchase reference
                    existing_library_item.purchase = purchase
                    existing_library_item.save()
                else:
                    # Create new library item
                    UserLibrary.objects.create(
                        user=payment.user,
                        product=purchase.product,
                        purchase=purchase
                    )
                    print(f"DEBUG: Created new library item for product: {purchase.product.title}")
                    
            except Exception as e:
                print(f"DEBUG: Error adding product to library: {str(e)}")
                # Continue with other products even if one fails
                continue
        
        print(f"DEBUG: Successfully processed payment and added items to library")
        return payment

class PaymentService:
    @staticmethod
    def create_payment_from_cart(user, cart_items):
        """Create payment and purchase records from cart items"""
        # Generate unique reference
        reference = f"DARRA_{uuid.uuid4().hex[:16].upper()}"
        
        # Calculate total amount
        total_amount = Decimal('0.00')
        purchases_data = []
        
        for item in cart_items:
            try:
                product = Product.objects.get(id=item['product_id'])
                quantity = item.get('quantity', 1)
                item_total = product.price * quantity
                total_amount += item_total
                
                purchases_data.append({
                    'product': product,
                    'quantity': quantity,
                    'unit_price': product.price,
                    'total_price': item_total
                })
            except Product.DoesNotExist:
                raise ValidationError(f"Product with id {item['product_id']} does not exist")
        
        # Create payment
        payment = Payment.objects.create(
            user=user,
            reference=reference,
            amount=total_amount,
            currency=settings.CURRENCY
        )
        
        # Create purchases
        for purchase_data in purchases_data:
            Purchase.objects.create(
                payment=payment,
                **purchase_data
            )
        
        return payment 