from django.contrib import admin
from django.db import models
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
    readonly_fields = ('ticket_count', 'total_ticket_quantity', 'ticket_details_table')
    
    formfield_overrides = {
        models.TextField: {'widget': admin.widgets.AdminTextareaWidget(attrs={'rows': 10, 'cols': 80})},
    }
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('title', 'description', 'description_html', 'price', 'product_type', 'owner')
        }),
        ('Media', {
            'fields': ('file', 'cover_image')
        }),
        ('Event Details', {
            'fields': ('event_date', 'ticket_quantity', 'ticket_category', 'ticket_tiers', 'ticket_details_table'),
            'classes': ('collapse',)
        }),
    )
    
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
    
    def ticket_details_table(self, obj):
        if not obj.ticket_tiers.exists():
            return "No tickets available"
        
        from django.utils.html import format_html
        
        rows = []
        for tier in obj.ticket_tiers.all():
            rows.append(f"""
                <tr>
                    <td style="border: 1px solid #ddd; padding: 8px;"><strong>{tier.category.name}</strong></td>
                    <td style="border: 1px solid #ddd; padding: 8px;">₦{tier.price:,}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">{tier.quantity_available}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;">{tier.remaining_quantity}</td>
                </tr>
            """)
        
        html = f"""
        <table style="width: 100%; border-collapse: collapse; margin: 10px 0; border: 1px solid #ddd;">
            <thead>
                <tr style="background-color: #f8f9fa;">
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Category</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Price</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Quantity</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Remaining</th>
                </tr>
            </thead>
            <tbody>
                {''.join(rows)}
            </tbody>
        </table>
        """
        
        return format_html(html)
    
    ticket_details_table.short_description = "Ticket Details"
