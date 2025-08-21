from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
import uuid
import qrcode
from io import BytesIO
from django.core.files import File
from PIL import Image

User = get_user_model()

class EventTicket(models.Model):
    """Individual ticket for an event"""
    ticket_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    purchase = models.ForeignKey('payments.Purchase', on_delete=models.CASCADE, related_name='event_tickets')
    buyer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='purchased_tickets')
    event = models.ForeignKey('products.Product', on_delete=models.CASCADE, related_name='tickets')
    quantity = models.PositiveIntegerField(default=1)
    qr_code = models.ImageField(upload_to='qr_codes/', blank=True, null=True)
    is_used = models.BooleanField(default=False)
    used_at = models.DateTimeField(null=True, blank=True)
    verified_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='verified_tickets')
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Ticket {self.ticket_id} for {self.event.title}"
    
    def generate_qr_code(self):
        """Generate QR code for this ticket"""
        if self.qr_code:
            return self.qr_code
            
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=10,
            border=4,
        )
        qr.add_data(str(self.ticket_id))
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        
        filename = f"ticket_{self.ticket_id}.png"
        self.qr_code.save(filename, File(buffer), save=False)
        return self.qr_code
    
    def save(self, *args, **kwargs):
        """Override save to generate QR code on creation"""
        is_new = self.pk is None
        super().save(*args, **kwargs)
        
        if is_new and not self.qr_code:
            self.generate_qr_code()
            super().save(update_fields=['qr_code'])
    
    class Meta:
        ordering = ['-created_at']
