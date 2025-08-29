from django.contrib import admin
from django.db import models
from django import forms
from django.utils.html import format_html
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

class ProductAdminForm(forms.ModelForm):
    """Custom form for Product admin that includes ticket management like the frontend"""
    
    # Ticket management fields (like your frontend)
    ticket_category_id = forms.ModelChoiceField(
        queryset=TicketCategory.objects.all(),
        required=False,
        label="Select Category",
        empty_label="Select a category"
    )
    ticket_price = forms.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=False,
        label="Price (₦)"
    )
    ticket_quantity = forms.IntegerField(
        required=False,
        label="Quantity Available"
    )
    
    class Meta:
        model = Product
        fields = '__all__'
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Make ticket_tiers read-only since we'll manage them through our custom interface
        if 'ticket_tiers' in self.fields:
            self.fields['ticket_tiers'].widget = forms.HiddenInput()

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    form = ProductAdminForm
    list_display = ('title', 'owner', 'product_type', 'price', 'ticket_summary', 'created_at')
    search_fields = ('title', 'owner__email', 'product_type', 'ticket_category__name')
    list_filter = ('product_type', 'ticket_category', 'created_at')
    readonly_fields = ('ticket_details_table', 'current_tickets_summary')
    
    formfield_overrides = {
        models.TextField: {'widget': admin.widgets.AdminTextareaWidget(attrs={'rows': 10, 'cols': 80})},
    }
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('title', 'description', 'description_html', 'product_type', 'owner'),
            'description': 'For events, the main price will be set to 0 automatically. Individual ticket prices are set below.'
        }),
        ('Media', {
            'fields': ('file', 'cover_image')
        }),
        ('Event Details', {
            'fields': ('event_date', 'ticket_category'),
            'classes': ('collapse',)
        }),
        ('Ticket Management (Like Frontend)', {
            'fields': ('ticket_category_id', 'ticket_price', 'ticket_quantity', 'current_tickets_summary'),
            'classes': ('collapse',),
            'description': 'Add ticket types one by one, just like in your mobile app. Select category, enter price and quantity, then save to add them to the list below.'
        }),
    )
    

    
    def ticket_summary(self, obj):
        if obj.product_type != 'event':
            return "—"
        
        if not obj.ticket_tiers.exists():
            return "No tickets"
        
        # Show a clean summary like your frontend
        ticket_count = obj.ticket_tiers.count()
        total_quantity = sum(tier.quantity_available for tier in obj.ticket_tiers.all())
        
        # Get the first few categories for display
        categories = [tier.category.name for tier in obj.ticket_tiers.all()[:3]]
        categories_display = ", ".join(categories)
        if ticket_count > 3:
            categories_display += f" +{ticket_count - 3} more"
        
        return f"{ticket_count} types • {total_quantity} total • {categories_display}"
    
    ticket_summary.short_description = "🎫 Tickets"
    
    def ticket_details_table(self, obj):
        if not obj.ticket_tiers.exists():
            return "No tickets available"
        
        from django.utils.html import format_html
        
        # Calculate total quantity (like your frontend)
        total_quantity = sum(tier.quantity_available for tier in obj.ticket_tiers.all())
        
        rows = []
        for tier in obj.ticket_tiers.all():
            rows.append(f"""
                <tr>
                    <td style="border: 1px solid #ddd; padding: 8px; background-color: {tier.category.color or '#007bff'}; color: white; border-radius: 4px; text-align: center; font-weight: bold;">{tier.category.name}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; font-size: 18px; font-weight: bold; color: #28a745;">₦{tier.price:,}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: 600;">{tier.quantity_available}</td>
                </tr>
            """)
        
        html = f"""
        <div style="margin: 20px 0;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <h3 style="margin: 0; font-size: 18px;">🎫 Ticket Summary</h3>
                <p style="margin: 5px 0 0 0; opacity: 0.9;">Total Available: <strong>{total_quantity} tickets</strong></p>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin: 10px 0; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <thead>
                    <tr style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);">
                        <th style="border: 1px solid #ddd; padding: 12px; text-align: left; font-weight: bold; color: #495057;">Category</th>
                        <th style="border: 1px solid #ddd; padding: 12px; text-align: left; font-weight: bold; color: #495057;">Price</th>
                        <th style="border: 1px solid #ddd; padding: 12px; text-align: left; font-weight: bold; color: #495057;">Quantity</th>
                    </tr>
                </thead>
                <tbody>
                    {''.join(rows)}
                </tbody>
            </table>
            
            <div style="background: #f8f9fa; padding: 10px; border-radius: 6px; margin-top: 10px; border-left: 4px solid #007bff;">
                <small style="color: #6c757d; font-style: italic;">
                    💡 This matches exactly how tickets appear in your mobile app - simple and clean!
                </small>
            </div>
        </div>
        """
        
        return format_html(html)
    
    ticket_details_table.short_description = "Ticket Details"
    
    def current_tickets_summary(self, obj):
        """Show current tickets and allow adding new ones"""
        if obj.product_type != 'event':
            return "Not an event product"
        
        if not obj.ticket_tiers.exists():
            return "No tickets added yet. Use the fields above to add ticket types."
        
        # Show current tickets in a nice table
        rows = []
        total_quantity = 0
        
        for tier in obj.ticket_tiers.all():
            total_quantity += tier.quantity_available
            rows.append(f"""
                <tr>
                    <td style="border: 1px solid #ddd; padding: 8px; background-color: {tier.category.color or '#007bff'}; color: white; border-radius: 4px; text-align: center; font-weight: bold;">{tier.category.name}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; font-size: 16px; font-weight: bold; color: #28a745;">₦{tier.price:,}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center; font-weight: 600;">{tier.quantity_available}</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">
                        <a href="/admin/products/tickettier/{tier.id}/change/" style="color: #007bff; text-decoration: none;">✏️ Edit</a>
                    </td>
                </tr>
            """)
        
        html = f"""
        <div style="margin: 20px 0;">
            <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <h4 style="margin: 0; font-size: 16px;">🎫 Current Tickets ({obj.ticket_tiers.count()} types)</h4>
                <p style="margin: 5px 0 0 0; opacity: 0.9;">Total Available: <strong>{total_quantity} tickets</strong></p>
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin: 10px 0; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <thead>
                    <tr style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);">
                        <th style="border: 1px solid #ddd; padding: 12px; text-align: left; font-weight: bold; color: #495057;">Category</th>
                        <th style="border: 1px solid #ddd; padding: 12px; text-align: left; font-weight: bold; color: #495057;">Price</th>
                        <th style="border: 1px solid #ddd; padding: 12px; text-align: left; font-weight: bold; color: #495057;">Quantity</th>
                        <th style="border: 1px solid #ddd; padding: 12px; text-align: left; font-weight: bold; color: #495057;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {''.join(rows)}
                </tbody>
            </table>
            
            <div style="background: #fff3cd; padding: 10px; border-radius: 6px; margin-top: 10px; border-left: 4px solid #ffc107;">
                <small style="color: #856404; font-style: italic;">
                    💡 <strong>To add new tickets:</strong> Fill in the fields above (Category, Price, Quantity) and click "Save and continue editing" to add them to the list.
                </small>
            </div>
        </div>
        """
        
        return format_html(html)
    
    current_tickets_summary.short_description = "Current Tickets"
    
    def save_model(self, request, obj, form, change):
        """Handle ticket creation when saving the product"""
        
        # For events, set price to 0 since tickets have individual prices
        if obj.product_type == 'event':
            obj.price = 0
        
        # First save the product
        super().save_model(request, obj, form, change)
        
        # If this is an event product and ticket fields are filled, create a ticket tier
        if (obj.product_type == 'event' and 
            form.cleaned_data.get('ticket_category_id') and 
            form.cleaned_data.get('ticket_price') and 
            form.cleaned_data.get('ticket_quantity')):
            
            try:
                category = form.cleaned_data['ticket_category_id']
                price = form.cleaned_data['ticket_price']
                quantity = form.cleaned_data['ticket_quantity']
                
                # Create the ticket tier with a unique name
                import uuid
                unique_name = f"{category.name}_{uuid.uuid4().hex[:8]}"
                
                ticket_tier = TicketTier.objects.create(
                    category=category,
                    name=unique_name,  # Use unique name to avoid constraint violation
                    price=price,
                    quantity_available=quantity,
                    description=f"{category.name} tickets",
                    benefits="Standard benefits",
                    is_active=True
                )
                
                # Associate with the product
                obj.ticket_tiers.add(ticket_tier)
                
                # Update total ticket quantity
                total_quantity = sum(tier.quantity_available for tier in obj.ticket_tiers.all())
                obj.ticket_quantity = total_quantity
                obj.save()
                
                # Show success message
                from django.contrib import messages
                messages.success(request, f'✅ Added {category.name} tickets: ₦{price:,} x {quantity} quantity')
                
            except Exception as e:
                from django.contrib import messages
                messages.error(request, f'❌ Error creating ticket: {str(e)}')
    
    def get_form(self, request, obj=None, **kwargs):
        """Customize form to clear ticket fields after saving"""
        form = super().get_form(request, obj, **kwargs)
        
        # If this is a new form (not editing), clear the ticket fields
        if obj is None:
            form.base_fields['ticket_category_id'].initial = None
            form.base_fields['ticket_price'].initial = None
            form.base_fields['ticket_quantity'].initial = None
        
        return form
    
    def response_add(self, request, obj, post_url_continue=None):
        """Clear ticket fields after adding a product with tickets"""
        response = super().response_add(request, obj, post_url_continue)
        
        # If we're continuing to edit, clear the ticket fields
        if '_continue' in request.POST:
            # Clear the form fields for next ticket
            obj.ticket_category_id = None
            obj.ticket_price = None
            obj.ticket_quantity = None
        
        return response
    
    def response_change(self, request, obj):
        """Clear ticket fields after editing a product with tickets"""
        response = super().response_change(request, obj)
        
        # Clear the ticket fields after saving
        obj.ticket_category_id = None
        obj.ticket_price = None
        obj.ticket_quantity = None
        
        return response