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
    list_display = ('name', 'category', 'price', 'quantity_available', 'quantity_sold', 'remaining_quantity', 'product_title', 'is_active')
    list_filter = ('category', 'is_active', 'created_at')
    search_fields = ('name', 'category__name', 'description', 'product__title')
    readonly_fields = ('quantity_sold', 'remaining_quantity', 'product_title')
    ordering = ('category__name', 'price')
    
    def remaining_quantity(self, obj):
        return obj.remaining_quantity
    remaining_quantity.short_description = 'Remaining'
    
    def product_title(self, obj):
        if obj.product_set.exists():
            return obj.product_set.first().title
        return "No product"
    product_title.short_description = 'Event'

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('title', 'owner', 'product_type', 'price', 'ticket_category', 'ticket_count', 'total_ticket_quantity', 'created_at')
    search_fields = ('title', 'owner__email', 'product_type', 'ticket_category__name')
    list_filter = ('product_type', 'ticket_category', 'created_at')
    filter_horizontal = ('ticket_tiers',)
    readonly_fields = ('ticket_count', 'total_ticket_quantity')
    
    def ticket_count(self, obj):
        if obj.ticket_tiers.exists():
            return f"{obj.ticket_tiers.count()} types"
        return "No tickets"
    ticket_count.short_description = "Ticket Types"
    
    def total_ticket_quantity(self, obj):
        if obj.ticket_tiers.exists():
            total = sum(tier.quantity_available for tier in obj.ticket_tiers.all())
            return f"{total} total"
        return "0"
    total_ticket_quantity.short_description = "Total Quantity"
