from django.contrib import admin
from django.utils.html import format_html
from .models import Notification
from .services import NotificationService

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'type', 'title', 'read', 'created_at', 'notification_preview')
    list_filter = ('type', 'read', 'created_at')
    search_fields = ('title', 'body', 'user__email')
    readonly_fields = ('created_at', 'data_display')
    ordering = ('-created_at',)
    actions = ['mark_as_read', 'mark_as_unread', 'send_promotional']
    
    def notification_preview(self, obj):
        """Show a preview of the notification body"""
        return obj.body[:50] + "..." if len(obj.body) > 50 else obj.body
    notification_preview.short_description = "Preview"
    
    def data_display(self, obj):
        """Display notification data in a readable format"""
        if obj.data:
            return format_html('<pre>{}</pre>', str(obj.data))
        return "No data"
    data_display.short_description = "Data"
    
    def mark_as_read(self, request, queryset):
        """Mark selected notifications as read"""
        count = queryset.update(read=True)
        self.message_user(request, f"Marked {count} notifications as read.")
    mark_as_read.short_description = "Mark as read"
    
    def mark_as_unread(self, request, queryset):
        """Mark selected notifications as unread"""
        count = queryset.update(read=False)
        self.message_user(request, f"Marked {count} notifications as unread.")
    mark_as_unread.short_description = "Mark as unread"
    
    def send_promotional(self, request, queryset):
        """Send promotional notification to all users"""
        try:
            title = "📢 New Update Available!"
            body = "🎉 Check out our latest products and deals!"
            
            count = NotificationService.send_bulk_promotional_notifications(
                title=title,
                body=body
            )
            
            self.message_user(request, f"Successfully sent {count} promotional notifications.")
        except Exception as e:
            self.message_user(request, f"Error sending promotional notifications: {str(e)}", level='ERROR')
    send_promotional.short_description = "Send promotional notification to all users"
