from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
import uuid
import qrcode
from io import BytesIO
from django.core.files import File
from PIL import Image
from cloudinary_storage.storage import MediaCloudinaryStorage
from .ticket_service import ticket_service

User = get_user_model()

class EventTicket(models.Model):
    """Individual ticket for an event"""
    ticket_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    purchase = models.ForeignKey('payments.Purchase', on_delete=models.CASCADE, related_name='event_tickets')
    buyer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='purchased_tickets')
    event = models.ForeignKey('products.Product', on_delete=models.CASCADE, related_name='tickets')
    quantity = models.PositiveIntegerField(default=1)
    qr_code = models.ImageField(upload_to='tickets/qr_codes/', blank=True, null=True, storage=MediaCloudinaryStorage())
    qr_code_cloudinary_id = models.CharField(max_length=255, blank=True, null=True)  # Store Cloudinary public_id
    pdf_ticket = models.FileField(upload_to='tickets/pdf/', blank=True, null=True, storage=MediaCloudinaryStorage())
    pdf_ticket_cloudinary_id = models.CharField(max_length=255, blank=True, null=True)  # Store Cloudinary public_id
    is_used = models.BooleanField(default=False)
    used_at = models.DateTimeField(null=True, blank=True)
    verified_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='verified_tickets')
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"Ticket {self.ticket_id} for {self.event.title}"
    
    def generate_qr_code(self):
        """Generate QR code for this ticket and upload to Cloudinary"""
        if self.qr_code and self.qr_code_cloudinary_id:
            return self.qr_code
            
        try:
            # Generate QR code using the service
            qr_buffer = ticket_service.generate_qr_code(
                str(self.ticket_id), 
                self.event.title
            )
            
            # Check if QR generation was successful
            if qr_buffer is None:
                print(f"⚠️ QR code generation failed for ticket {self.ticket_id}, using fallback")
                return self._generate_local_qr_code()
            
            # Upload to Cloudinary
            cloudinary_result = ticket_service.upload_qr_code_to_cloudinary(
                qr_buffer, 
                str(self.ticket_id), 
                self.event.id
            )
            
            # Check if upload was successful
            if cloudinary_result is None:
                print(f"⚠️ Cloudinary upload failed for ticket {self.ticket_id}, using fallback")
                return self._generate_local_qr_code()
            
            # Save Cloudinary ID
            self.qr_code_cloudinary_id = cloudinary_result['public_id']
            
            # Save the file reference
            filename = f"ticket_{self.ticket_id}.png"
            self.qr_code.save(filename, File(qr_buffer), save=False)
            
            return self.qr_code
            
        except Exception as e:
            # Only log if it's not the "Empty file" error (which is harmless)
            if "Empty file" not in str(e):
                print(f"❌ Error generating QR code: {str(e)}")
            else:
                print(f"ℹ️ QR code generation warning (harmless): {str(e)}")
            # Fallback to local generation
            return self._generate_local_qr_code()
    
    def _generate_local_qr_code(self):
        """Fallback local QR code generation"""
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
    
    def generate_pdf_ticket(self):
        """Generate PDF ticket and upload to Cloudinary"""
        if self.pdf_ticket and self.pdf_ticket_cloudinary_id:
            return self.pdf_ticket
            
        try:
            # Prepare ticket data
            ticket_data = {
                'ticket_id': str(self.ticket_id),
                'event_title': self.event.title,
                'event_date': self.event.event_date.strftime('%Y-%m-%d %H:%M') if self.event.event_date else 'TBD',
                'buyer_name': f"{self.buyer.first_name} {self.buyer.last_name}",
                'quantity': self.quantity
            }
            
            # Generate PDF using the service
            pdf_buffer = ticket_service.generate_pdf_ticket(ticket_data)
            
            # Check if PDF generation was successful
            if pdf_buffer is None:
                print(f"⚠️ PDF generation failed for ticket {self.ticket_id}")
                return None
            
            # Upload to Cloudinary
            cloudinary_result = ticket_service.upload_pdf_ticket_to_cloudinary(
                pdf_buffer, 
                str(self.ticket_id), 
                self.event.id
            )
            
            # Check if upload was successful
            if cloudinary_result is None:
                print(f"⚠️ PDF upload failed for ticket {self.ticket_id}")
                return None
            
            # Save Cloudinary ID
            self.pdf_ticket_cloudinary_id = cloudinary_result['public_id']
            
            # Save the file reference
            filename = f"ticket_{self.ticket_id}.pdf"
            self.pdf_ticket.save(filename, File(pdf_buffer), save=False)
            
            return self.pdf_ticket
            
        except Exception as e:
            print(f"❌ Error generating PDF ticket: {str(e)}")
            return None
    
    def get_qr_code_url(self, transformation: str = None) -> str:
        """Get optimized QR code URL from Cloudinary"""
        if self.qr_code_cloudinary_id:
            return ticket_service.get_ticket_url(self.qr_code_cloudinary_id, transformation)
        return self.qr_code.url if self.qr_code else None
    
    def get_pdf_ticket_url(self) -> str:
        """Get PDF ticket URL from Cloudinary"""
        if self.pdf_ticket_cloudinary_id:
            return ticket_service.get_ticket_url(self.pdf_ticket_cloudinary_id)
        return self.pdf_ticket.url if self.pdf_ticket else None
    
    def save(self, *args, **kwargs):
        """Override save to generate QR code on creation"""
        is_new = self.pk is None
        super().save(*args, **kwargs)
        
        if is_new and not self.qr_code:
            try:
                self.generate_qr_code()
                super().save(update_fields=['qr_code', 'qr_code_cloudinary_id'])
            except Exception as e:
                # Don't let QR code generation errors break the ticket creation
                print(f"⚠️ QR code generation failed during save, but ticket created successfully: {str(e)}")
                # Ticket is still created, just without QR code initially
                # QR code can be generated later if needed
    
    def delete(self, *args, **kwargs):
        """Override delete to clean up Cloudinary files"""
        # Delete from Cloudinary before deleting the model
        if self.qr_code_cloudinary_id:
            ticket_service.delete_ticket_from_cloudinary(self.qr_code_cloudinary_id)
        if self.pdf_ticket_cloudinary_id:
            ticket_service.delete_ticket_from_cloudinary(self.pdf_ticket_cloudinary_id)
        
        super().delete(*args, **kwargs)
    
    class Meta:
        ordering = ['-created_at']
