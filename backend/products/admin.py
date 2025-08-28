from django.contrib import admin
from .models import Product, TicketCategory, TicketTier

@admin.register(TicketCategory)
class TicketCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'description', 'color', 'created_at')
    search_fields = ('name', 'description')
    list_filter = ('created_at',)
    ordering = ('name',)

@admin.register(TicketTier)
class TicketTierAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'price', 'quantity_available', 'quantity_sold', 'remaining_quantity', 'is_active')
    list_filter = ('category', 'is_active', 'created_at')
    search_fields = ('name', 'category__name', 'description')
    readonly_fields = ('quantity_sold', 'remaining_quantity')
    ordering = ('category__name', 'price')
    
    def remaining_quantity(self, obj):
        return obj.remaining_quantity
    remaining_quantity.short_description = 'Remaining'

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('title', 'owner', 'product_type', 'price', 'ticket_category', 'created_at', 'cover_image')
    search_fields = ('title', 'owner__email', 'product_type', 'ticket_category__name')
    list_filter = ('product_type', 'ticket_category', 'created_at')
    filter_horizontal = ('ticket_tiers',)
