import logging
import os

from django.db import models
from django.conf import settings
from django.core.exceptions import SuspiciousFileOperation
from django.core.files.storage import FileSystemStorage
from users.models import User
# from cloudinary_storage.storage import MediaCloudinaryStorage  # Commented out for local storage

logger = logging.getLogger(__name__)


def media_url_for(filefield):
    """
    Public /media/ URL for a FileField, or None if it's empty.

    Only for genuinely public assets such as cover images. Paid product files
    must never go through here — they are not served by URL at all.
    """
    if not filefield:
        return None
    return f"{settings.MEDIA_URL}{filefield.name}"


def private_product_storage():
    """
    Storage for paid product files. Points at PRIVATE_MEDIA_ROOT, which sits
    outside MEDIA_ROOT so the web server never serves these files directly —
    buyers can only get them via the authenticated download endpoint.

    This is a callable (not an instance) on purpose: Django serialises the
    reference rather than the resolved absolute path, so the same migration
    works on local and on the server where BASE_DIR differs.
    """
    return FileSystemStorage(location=settings.PRIVATE_MEDIA_ROOT)

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
    """
    One ticket type on one event, named by the seller.

    `name` is free text the seller types per event — "Regular", "Table for 2",
    "Gold", "Twitter". Ticket names are inherently per-event, so they cannot
    come from a shared global list: one organiser's "VIP" is another's
    "Table for 2".

    `category` is legacy. It used to be a required link to a global,
    admin-managed TicketCategory whose name was what actually got displayed,
    while this `name` field held a generated value like "VIP_a3f9c2b1" purely
    to satisfy a unique_together constraint. It is now optional and kept only
    so existing rows keep working.
    """
    category = models.ForeignKey(
        TicketCategory,
        on_delete=models.SET_NULL,
        related_name='tiers',
        null=True,
        blank=True,
        help_text="Legacy. New ticket types are named directly by the seller.",
    )
    name = models.CharField(max_length=100)  # "Regular", "VIP", "Table for 2"
    color = models.CharField(
        max_length=7,
        default='#5465FF',
        help_text="Badge colour in the UI.",
    )
    price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity_available = models.PositiveIntegerField()
    quantity_sold = models.PositiveIntegerField(default=0)
    description = models.TextField(blank=True)
    benefits = models.TextField(blank=True)  # What's included in this tier
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.display_name

    @property
    def display_name(self):
        """
        The label to show anyone.

        Rows created before sellers named their own categories have a
        generated `name` like "VIP_a3f9c2b1" with the real label on the linked
        category. Prefer the category for those; otherwise `name` is what the
        seller typed. After `manage.py fix_ticket_tier_names` this is just
        `name`.
        """
        head, sep, tail = self.name.rpartition('_')
        looks_generated = (
            sep and head and len(tail) == 8
            and all(c in '0123456789abcdef' for c in tail.lower())
        )
        if looks_generated:
            return self.category.name if self.category else head
        return self.name

    @property
    def display_color(self):
        if self.color:
            return self.color
        return self.category.color if self.category else '#5465FF'

    @property
    def remaining_quantity(self):
        return self.quantity_available - self.quantity_sold
    
    @property
    def is_sold_out(self):
        return self.remaining_quantity <= 0
    
    class Meta:
        # No unique_together on (category, name). It was what forced tier names
        # to be generated as "VIP_<uuid>", and it is wrong anyway: two
        # different events should both be allowed a ticket called "Regular".
        # Uniqueness is enforced per product in the serializer instead.
        ordering = ['price']
        verbose_name = 'Ticket category'
        verbose_name_plural = 'Ticket categories'

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
    file = models.FileField(
        upload_to='products/files/',
        storage=private_product_storage,
        blank=True,
        null=True,
    )
    cover_image = models.ImageField(upload_to='products/covers/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # For events/tickets
    event_date = models.DateTimeField(blank=True, null=True)
    event_end_date = models.DateTimeField(blank=True, null=True)
    venue_name = models.CharField(max_length=255, blank=True, null=True)
    location = models.CharField(max_length=500, blank=True, null=True)
    speakers = models.TextField(blank=True, null=True)
    ticket_quantity = models.PositiveIntegerField(blank=True, null=True)
    
    # New ticket system fields
    ticket_category = models.ForeignKey(TicketCategory, on_delete=models.SET_NULL, blank=True, null=True, related_name='products')
    ticket_tiers = models.ManyToManyField(TicketTier, blank=True, related_name='products')

    def __str__(self):
        return self.title

    @property
    def cover_image_url(self):
        return media_url_for(self.cover_image)

    def _legacy_public_path(self):
        """
        Path to this file under the old public MEDIA_ROOT, if it is still
        sitting there, else None.

        Anything found here is a file that has NOT yet been moved by
        `manage.py move_product_files_private` — which means it is still being
        served publicly and can be downloaded without paying. Callers get a
        loud warning so this state is visible instead of silently permanent.
        """
        if not self.file:
            return None

        # Contain the join. self.file.name comes from the database; an absolute
        # or '../'-containing value would otherwise escape MEDIA_ROOT and be
        # streamed to the user by the download endpoint.
        media_root = os.path.abspath(settings.MEDIA_ROOT)
        candidate = os.path.abspath(os.path.join(media_root, self.file.name))
        try:
            contained = os.path.commonpath([media_root, candidate]) == media_root
        except ValueError:
            # Different drives on Windows — definitely not contained.
            contained = False

        if not contained:
            logger.error(
                "Product %s has a file name that escapes MEDIA_ROOT (%r); refusing to serve it.",
                self.pk, self.file.name,
            )
            return None

        if not os.path.exists(candidate):
            return None

        logger.warning(
            "Product %s file %r is still in public MEDIA_ROOT and is currently "
            "downloadable WITHOUT PURCHASE at %s%s. Run "
            "'manage.py move_product_files_private' to close this.",
            self.pk, self.file.name, settings.MEDIA_URL, self.file.name,
        )
        return candidate

    def resolve_file_path(self):
        """
        Absolute on-disk path of the product file, or None if it isn't there.

        Prefers the private location, falling back to the pre-migration public
        one so downloads keep working whether the code reload or the file move
        happens first. Filesystem storage only — use open_file() if the backend
        might not be local.

        NOTE: there is deliberately no `file_url` here. Building a public
        /media/ URL for a paid file is what allowed it to be downloaded
        without buying. Delivery goes through the authenticated
        /payments/library/<id>/download/ endpoint only.
        """
        if not self.file:
            return None

        try:
            private_path = self.file.path
        except (ValueError, NotImplementedError, SuspiciousFileOperation):
            # SuspiciousFileOperation: Django's safe_join rejected the stored
            # name because it escapes the storage root. Treat as "not there"
            # rather than letting it 500 out of the download endpoint.
            private_path = None

        if private_path and os.path.exists(private_path):
            return private_path

        return self._legacy_public_path()

    def open_file(self):
        """
        Open the product file for reading and return the file object, or None.

        Works for any storage backend: tries the configured storage first (which
        is all a remote backend like S3/Cloudinary supports), then falls back to
        the legacy on-disk location for files not yet moved. Caller closes it.
        """
        if not self.file:
            return None

        try:
            return self.file.storage.open(self.file.name, 'rb')
        except (FileNotFoundError, OSError, ValueError, NotImplementedError,
                SuspiciousFileOperation):
            pass

        legacy_path = self._legacy_public_path()
        if legacy_path:
            return open(legacy_path, 'rb')

        return None

    @property
    def is_ticket_event(self):
        return self.product_type == 'event' and (self.ticket_category is not None or self.ticket_tiers.exists())
    
    @property
    def available_ticket_tiers(self):
        """Get only active ticket tiers with remaining quantity"""
        return self.ticket_tiers.filter(is_active=True).exclude(quantity_sold__gte=models.F('quantity_available'))
