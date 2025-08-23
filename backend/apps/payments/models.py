from django.db import models
from django.conf import settings
from products.models import Product

class Payment(models.Model):
    class PaymentStatus(models.TextChoices):
        PENDING = 'pending', 'Pending'
        SUCCESS = 'success', 'Success'
        FAILED = 'failed', 'Failed'
        CANCELLED = 'cancelled', 'Cancelled'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='payments')
    reference = models.CharField(max_length=100, unique=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='NGN')
    status = models.CharField(max_length=20, choices=PaymentStatus.choices, default=PaymentStatus.PENDING)
    paystack_transaction_id = models.CharField(max_length=100, blank=True, null=True)
    gateway_response = models.TextField(blank=True, null=True)
    channel = models.CharField(max_length=50, blank=True, null=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.email} - {self.reference} - {self.status}"

class Purchase(models.Model):
    payment = models.ForeignKey(Payment, on_delete=models.CASCADE, related_name='purchases')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='purchases')
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    total_price = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.payment.user.email} - {self.product.title}"

    def save(self, *args, **kwargs):
        if not self.total_price:
            self.total_price = self.unit_price * self.quantity
        super().save(*args, **kwargs)

class UserLibrary(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='library_items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='library_owners')
    purchase = models.ForeignKey(Purchase, on_delete=models.CASCADE, related_name='library_entries')
    quantity = models.PositiveIntegerField(default=1)
    added_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.email} - {self.product.title} x{self.quantity}"
    
    def get_event_tickets(self):
        """Get the actual EventTicket objects for event products"""
        if self.product.product_type == 'event':
            from apps.events.models import EventTicket
            return EventTicket.objects.filter(purchase=self.purchase)
        return [] 