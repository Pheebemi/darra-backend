from django.conf import settings
from django.db import models


class Contact(models.Model):
    """
    A message from someone who wants a human to reply.

    Deliberately generic rather than chat-specific: the support chat creates
    these when the assistant can't help, and a contact form can create them
    too. `source` records which one it came from.
    """

    class Source(models.TextChoices):
        CHAT = 'chat', 'Support chat'
        CONTACT_FORM = 'contact_form', 'Contact form'

    class Status(models.TextChoices):
        NEW = 'new', 'New'
        IN_PROGRESS = 'in_progress', 'In progress'
        RESOLVED = 'resolved', 'Resolved'

    name = models.CharField(max_length=150)
    email = models.EmailField()
    message = models.TextField()

    source = models.CharField(
        max_length=20, choices=Source.choices, default=Source.CONTACT_FORM
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.NEW, db_index=True
    )

    # What the person already asked the assistant, so whoever replies isn't
    # making them repeat themselves.
    conversation = models.TextField(
        blank=True,
        help_text="Chat transcript leading up to the request, when it came from the chat widget.",
    )

    # Set when the sender happened to be logged in. Not required — most people
    # asking for help are not signed in.
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='contact_messages',
    )

    admin_notified = models.BooleanField(
        default=False,
        help_text="Whether the alert email to admins was sent successfully.",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Contact'
        verbose_name_plural = 'Contacts'

    def __str__(self):
        return f"{self.name} <{self.email}> — {self.get_status_display()}"
