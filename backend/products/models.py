from django.db import models
from users.models import User

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
    price = models.DecimalField(max_digits=10, decimal_places=2)
    product_type = models.CharField(max_length=10, choices=ProductType.choices)
    file = models.FileField(upload_to='products/files/', blank=True, null=True)
    cover_image = models.ImageField(upload_to='products/covers/', blank=True, null=True)  # <-- new field
    created_at = models.DateTimeField(auto_now_add=True)

    # For events/tickets
    event_date = models.DateTimeField(blank=True, null=True)
    ticket_quantity = models.PositiveIntegerField(blank=True, null=True)

    def __str__(self):
        return self.title
