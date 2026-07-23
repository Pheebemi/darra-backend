from django.contrib import admin
from django.utils.html import format_html

from .models import Contact


@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'email', 'short_message', 'source', 'status',
        'admin_notified', 'created_at',
    ]
    list_filter = ['status', 'source', 'admin_notified', 'created_at']
    list_editable = ['status']
    search_fields = ['name', 'email', 'message']
    readonly_fields = ['name', 'email', 'message', 'conversation', 'source',
                       'user', 'admin_notified', 'created_at']
    ordering = ['-created_at']

    fieldsets = (
        ('Who', {'fields': ('name', 'email', 'user')}),
        ('Message', {'fields': ('message', 'conversation')}),
        ('Handling', {'fields': ('status', 'source', 'admin_notified', 'created_at')}),
    )

    actions = ['mark_in_progress', 'mark_resolved']

    def short_message(self, obj):
        text = obj.message or ''
        return format_html('{}', text[:70] + ('…' if len(text) > 70 else ''))
    short_message.short_description = 'Message'

    def has_add_permission(self, request):
        # These arrive from the site; creating one by hand in admin would just
        # be confusing.
        return False

    def mark_in_progress(self, request, queryset):
        updated = queryset.update(status=Contact.Status.IN_PROGRESS)
        self.message_user(request, f"{updated} marked as in progress.")
    mark_in_progress.short_description = "Mark as in progress"

    def mark_resolved(self, request, queryset):
        updated = queryset.update(status=Contact.Status.RESOLVED)
        self.message_user(request, f"{updated} marked as resolved.")
    mark_resolved.short_description = "Mark as resolved"
