from django.db import models
from users.models import User
from cloudinary_storage.storage import MediaCloudinaryStorage

class TicketCategory(models.Model):
    """Different types of tickets (VIP, Regular, Premium, etc.)"""
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    color = models.CharField(max_length=7, default='#007AFF')  # Hex color for UI
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.name
    
    class Meta:
        verbose_name_plural = "Ticket Categories"
        ordering = ['name']

class TicketTier(models.Model):
    """Different pricing tiers within a ticket category"""
    category = models.ForeignKey(TicketCategory, on_delete=models.CASCADE, related_name='tiers')
    name = models.CharField(max_length=100)  # e.g., "Early Bird", "Regular", "Late"
    price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity_available = models.PositiveIntegerField()
    quantity_sold = models.PositiveIntegerField(default=0)
    description = models.TextField(blank=True)
    benefits = models.TextField(blank=True)  # What's included in this tier
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.category.name} - {self.name}"
    
    @property
    def remaining_quantity(self):
        return self.quantity_available - self.quantity_sold
    
    @property
    def is_sold_out(self):
        return self.remaining_quantity <= 0
    
    class Meta:
        unique_together = ['category', 'name']
        ordering = ['price']

class Product(models.Model):
    class ProductType(models.TextChoices):
        PDF = 'pdf', 'PDF'
        MP3 = 'mp3', 'MP3'
        DOCX = 'docx', 'DOCX'
        PNG = 'png', 'PNG'
        ZIP = 'zip', 'ZIP'
        VIDEO = 'video', 'Video'
        EVENT = 'event', 'Event'

    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='products')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    description_html = models.TextField(blank=True)  # Rich text HTML content
    price = models.DecimalField(max_digits=10, decimal_places=2)
    product_type = models.CharField(max_length=10, choices=ProductType.choices)
    file = models.URLField(blank=True, null=True)  # Store Cloudinary URL instead of file
    cover_image = models.URLField(blank=True, null=True)  # Store Cloudinary URL instead of file
    created_at = models.DateTimeField(auto_now_add=True)

    # For events/tickets
    event_date = models.DateTimeField(blank=True, null=True)
    ticket_quantity = models.PositiveIntegerField(blank=True, null=True)
    
    # New ticket system fields
    ticket_category = models.ForeignKey(TicketCategory, on_delete=models.SET_NULL, blank=True, null=True, related_name='products')
    ticket_tiers = models.ManyToManyField(TicketTier, blank=True, related_name='products')

    def __str__(self):
        return self.title

    @property
    def cover_image_url(self):
        if self.cover_image:
            try:
                return self.cover_image
            except ValueError:
                return None
        return None

    @property
    def file_url(self):
        if self.file:
            try:
                return self.file
            except ValueError:
                return None
        return None
    
    @property
    def is_ticket_event(self):
        return self.product_type == 'event' and (self.ticket_category is not None or self.ticket_tiers.exists())
    
    @property
    def available_ticket_tiers(self):
        """Get only active ticket tiers with remaining quantity"""
        return self.ticket_tiers.filter(is_active=True).exclude(quantity_sold__gte=models.F('quantity_available'))
