from django.contrib import admin
from .models import EventTicket

@admin.register(EventTicket)
class EventTicketAdmin(admin.ModelAdmin):
    list_display = [
        'ticket_id', 
        'event', 
        'buyer', 
        'quantity', 
        'is_used', 
        'created_at'
    ]
    list_filter = [
        'is_used', 
        'event', 
        'created_at', 
        'verified_by'
    ]
    search_fields = [
        'ticket_id', 
        'event__title', 
        'buyer__email', 
        'buyer__full_name'
    ]
    readonly_fields = [
        'ticket_id', 
        'created_at', 
        'qr_code',
        'qr_code_display'
    ]
    ordering = ['-created_at']
    
    fieldsets = (
        ('Ticket Information', {
            'fields': ('ticket_id', 'event', 'buyer', 'quantity', 'qr_code')
        }),
        ('Status', {
            'fields': ('is_used', 'used_at', 'verified_by', 'verified_at')
        }),
        ('Purchase Details', {
            'fields': ('purchase', 'created_at')
        }),
    )
    
    def has_add_permission(self, request):
        # Only allow viewing existing tickets, not creating new ones manually
        return False
    
    actions = ['regenerate_qr_codes', 'mark_as_unused']
    
    def regenerate_qr_codes(self, request, queryset):
        """Regenerate QR codes for selected tickets"""
        count = 0
        for ticket in queryset:
            try:
                ticket.generate_qr_code()
                ticket.save()
                count += 1
            except Exception as e:
                self.message_user(request, f"Error regenerating QR for ticket {ticket.ticket_id}: {str(e)}", level='ERROR')
        
        self.message_user(request, f"Successfully regenerated QR codes for {count} tickets.")
    regenerate_qr_codes.short_description = "Regenerate QR codes for selected tickets"
    
    def mark_as_unused(self, request, queryset):
        """Mark selected tickets as unused (for testing)"""
        count = queryset.update(is_used=False, used_at=None, verified_by=None, verified_at=None)
        self.message_user(request, f"Marked {count} tickets as unused.")
    mark_as_unused.short_description = "Mark tickets as unused (for testing)"
    
    def qr_code_display(self, obj):
        """Display QR code image in admin"""
        if obj.qr_code:
            return f'<img src="{obj.qr_code.url}" width="100" height="100" />'
        return "No QR code generated"
    qr_code_display.allow_tags = True
    qr_code_display.short_description = "QR Code Preview"
