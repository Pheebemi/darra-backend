from django.db import models
from django.conf import settings
from products.models import Product

class Payment(models.Model):
    class PaymentStatus(models.TextChoices):
        PENDING = 'pending', 'Pending'
        SUCCESS = 'success', 'Success'
        FAILED = 'failed', 'Failed'
        CANCELLED = 'cancelled', 'Cancelled'

    class PaymentProvider(models.TextChoices):
        PAYSTACK = 'paystack', 'Paystack'
        FLUTTERWAVE = 'flutterwave', 'Flutterwave'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='payments')
    reference = models.CharField(max_length=100, unique=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='NGN')
    status = models.CharField(max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.PENDING)
    payment_provider = models.CharField(max_length=20, choices=PaymentProvider.choices, default=PaymentProvider.PAYSTACK)
    paystack_transaction_id = models.CharField(max_length=100, blank=True, null=True)
    flutterwave_transaction_id = models.CharField(max_length=100, blank=True, null=True)
    gateway_response = models.TextField(blank=True, null=True)
    channel = models.CharField(max_length=50, blank=True, null=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.email} - {self.reference} - {self.status}"

    @property
    def transaction_id(self):
        """Get the appropriate transaction ID based on payment provider"""
        if self.payment_provider == self.PaymentProvider.FLUTTERWAVE:
            return self.flutterwave_transaction_id
        return self.paystack_transaction_id

class Purchase(models.Model):
    payment = models.ForeignKey(Payment, on_delete=models.CASCADE, related_name='purchases')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='purchases')
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    total_price = models.DecimalField(max_digits=10, decimal_places=2)
    selected_ticket_tier = models.ForeignKey('products.TicketTier', on_delete=models.SET_NULL, null=True, blank=True, related_name='purchases')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.payment.user.email} - {self.product.title}"

    def save(self, *args, **kwargs):
        if not self.total_price:
            self.total_price = self.unit_price * self.quantity
        super().save(*args, **kwargs)

class UserLibrary(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='library_items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='library_items')
    purchase = models.ForeignKey(Purchase, on_delete=models.CASCADE, related_name='library_items')
    quantity = models.PositiveIntegerField(default=1)
    added_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.email} - {self.product.title}"

    def get_event_tickets(self):
        """Get the actual EventTicket objects for event products"""
        if self.product.product_type == 'event':
            from apps.events.models import EventTicket
            return EventTicket.objects.filter(purchase=self.purchase)
        return []

class SellerCommission(models.Model):
    """Track 4% commission for each sale"""
    seller = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='commissions')
    purchase = models.ForeignKey(Purchase, on_delete=models.CASCADE, related_name='commissions')
    product_price = models.DecimalField(max_digits=10, decimal_places=2)
    commission_amount = models.DecimalField(max_digits=10, decimal_places=2)  # 4% of product price
    seller_payout = models.DecimalField(max_digits=10, decimal_places=2)  # 96% of product price
    status = models.CharField(max_length=20, choices=[
        ('pending', 'Pending'),
        ('paid', 'Paid'),
        ('failed', 'Failed')
    ], default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.seller.email} - ₦{self.seller_payout} from {self.purchase.product.title}"

    class Meta:
        unique_together = ['seller', 'purchase']

class PayoutRequest(models.Model):
    """Track seller payout requests"""
    seller = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='payout_requests')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    bank_details = models.ForeignKey('users.BankDetail', on_delete=models.CASCADE, related_name='payout_requests')
    status = models.CharField(max_length=20, choices=[
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed')
    ], default='pending')
    paystack_transfer_id = models.CharField(max_length=100, blank=True, null=True)
    flutterwave_transfer_id = models.CharField(max_length=100, blank=True, null=True)
    transfer_reference = models.CharField(max_length=100, unique=True, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    failure_reason = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.seller.email} - ₦{self.amount} ({self.status})"

    def save(self, *args, **kwargs):
        if not self.transfer_reference:
            import uuid
            self.transfer_reference = f"PAYOUT_{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)

class SellerEarnings(models.Model):
    """Track seller's total earnings and payouts"""
    seller = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='earnings')
    total_sales = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_commission = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_payouts = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    available_balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    last_updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.seller.email} - Available: ₦{self.available_balance}"

    def calculate_available_balance(self):
        """Calculate available balance for payout"""
        self.available_balance = self.total_sales - self.total_commission - self.total_payouts
        return self.available_balance 