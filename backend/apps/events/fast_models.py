"""
Fast ticket models - PNG only, optimized for speed
"""

from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.core.files import File
import uuid
from .fast_ticket_service import fast_ticket_service

User = get_user_model()

class FastEventTicket(models.Model):
    """
    Fast event ticket - PNG only, no PDF generation
    Optimized for speed and mobile experience
    """
    ticket_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    purchase = models.ForeignKey('payments.Purchase', on_delete=models.CASCADE, related_name='fast_tickets')
    buyer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='fast_purchased_tickets')
    event = models.ForeignKey('products.Product', on_delete=models.CASCADE, related_name='fast_tickets')
    quantity = models.PositiveIntegerField(default=1)
    
    # PNG ticket (no PDF)
    ticket_png = models.ImageField(upload_to='tickets/png/', blank=True, null=True)
    ticket_png_path = models.CharField(max_length=500, blank=True, null=True)
    
    # QR code only (optional - can be embedded in ticket_png)
    qr_code = models.ImageField(upload_to='tickets/qr_codes/', blank=True, null=True)
    qr_code_path = models.CharField(max_length=500, blank=True, null=True)
    
    # Ticket status
    is_used = models.BooleanField(default=False)
    used_at = models.DateTimeField(null=True, blank=True)
    verified_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='verified_fast_tickets')
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Fast Ticket {self.ticket_id} for {self.event.title}"
    
    def generate_fast_ticket(self):
        """
        Generate fast PNG ticket (no PDF, no cloud upload)
        """
        try:
            # Prepare ticket data
            ticket_data = {
                'ticket_id': str(self.ticket_id),
                'event_title': self.event.title,
                'event_date': self.event.event_date.strftime('%Y-%m-%d %H:%M') if self.event.event_date else 'TBD',
                'buyer_name': f"{self.buyer.first_name} {self.buyer.last_name}".strip() or self.buyer.email,
                'quantity': self.quantity
            }
            
            # Generate PNG ticket
            png_buffer = fast_ticket_service.generate_ticket_png(ticket_data)
            
            if png_buffer:
                # Save locally (fast)
                result = fast_ticket_service.save_ticket_locally(png_buffer, str(self.ticket_id), self.event.id)
                
                if result['success']:
                    # Save file reference
                    filename = f"fast_ticket_{self.ticket_id}.png"
                    self.ticket_png.save(filename, File(png_buffer), save=False)
                    self.ticket_png_path = result['file_path']
                    self.save(update_fields=['ticket_png', 'ticket_png_path'])
                    
                    return self.ticket_png
                else:
                    print(f"Failed to save ticket: {result.get('error')}")
                    return None
            else:
                print("Failed to generate PNG ticket")
                return None
                
        except Exception as e:
            print(f"Error generating fast ticket: {str(e)}")
            return None
    
    def generate_qr_only(self):
        """
        Generate just QR code (fastest option)
        """
        try:
            qr_buffer = fast_ticket_service.generate_qr_code_only(
                str(self.ticket_id), 
                self.event.title
            )
            
            if qr_buffer:
                # Save locally
                result = fast_ticket_service.save_ticket_locally(qr_buffer, f"qr_{self.ticket_id}", self.event.id)
                
                if result['success']:
                    filename = f"qr_{self.ticket_id}.png"
                    self.qr_code.save(filename, File(qr_buffer), save=False)
                    self.qr_code_path = result['file_path']
                    self.save(update_fields=['qr_code', 'qr_code_path'])
                    
                    return self.qr_code
                else:
                    print(f"Failed to save QR code: {result.get('error')}")
                    return None
            else:
                print("Failed to generate QR code")
                return None
                
        except Exception as e:
            print(f"Error generating QR code: {str(e)}")
            return None
    
    def get_ticket_url(self):
        """Get ticket PNG URL"""
        if self.ticket_png:
            return self.ticket_png.url
        return None
    
    def get_qr_url(self):
        """Get QR code URL"""
        if self.qr_code:
            return self.qr_code.url
        return None
    
    def save(self, *args, **kwargs):
        """Override save to generate ticket immediately (synchronous)"""
        is_new = self.pk is None
        super().save(*args, **kwargs)
        
        # Generate ticket immediately for new tickets
        if is_new and not self.ticket_png:
            print(f"🚀 Generating fast ticket for {self.ticket_id}")
            self.generate_fast_ticket()
    
    class Meta:
        ordering = ['-created_at']
        verbose_name = "Fast Event Ticket"
        verbose_name_plural = "Fast Event Tickets"
