from django.contrib import admin
from .models import Payment, Purchase, UserLibrary, SellerCommission, PayoutRequest, SellerEarnings

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['reference', 'user', 'amount', 'currency', 'status', 'created_at']
    list_filter = ['status', 'currency', 'created_at']
    search_fields = ['reference', 'user__email', 'paystack_transaction_id']
    readonly_fields = ['reference', 'created_at', 'updated_at']
    ordering = ['-created_at']

@admin.register(Purchase)
class PurchaseAdmin(admin.ModelAdmin):
    list_display = ['id', 'payment', 'product', 'quantity', 'unit_price', 'total_price', 'created_at']
    list_filter = ['created_at', 'product__product_type']
    search_fields = ['product__title', 'payment__user__email']
    readonly_fields = ['created_at']
    ordering = ['-created_at']

@admin.register(UserLibrary)
class UserLibraryAdmin(admin.ModelAdmin):
    list_display = ['user', 'product', 'quantity', 'added_at']
    list_filter = ['added_at', 'product__product_type']
    search_fields = ['user__email', 'product__title']
    readonly_fields = ['added_at']
    ordering = ['-added_at']

@admin.register(SellerCommission)
class SellerCommissionAdmin(admin.ModelAdmin):
    list_display = [
        'seller', 'product_title', 'product_price', 'commission_amount', 
        'seller_payout', 'status', 'created_at'
    ]
    list_filter = ['status', 'created_at']
    search_fields = ['seller__email', 'purchase__product__title']
    readonly_fields = ['created_at', 'paid_at']
    ordering = ['-created_at']
    
    def product_title(self, obj):
        return obj.purchase.product.title
    product_title.short_description = 'Product'
    
    actions = ['mark_as_paid', 'mark_as_failed']
    
    def mark_as_paid(self, request, queryset):
        """Mark selected commissions as paid"""
        from django.utils import timezone
        count = queryset.update(status='paid', paid_at=timezone.now())
        self.message_user(request, f"Marked {count} commissions as paid.")
    mark_as_paid.short_description = "Mark commissions as paid"
    
    def mark_as_failed(self, request, queryset):
        """Mark selected commissions as failed"""
        count = queryset.update(status='failed')
        self.message_user(request, f"Marked {count} commissions as failed.")
    mark_as_failed.short_description = "Mark commissions as failed"

@admin.register(PayoutRequest)
class PayoutRequestAdmin(admin.ModelAdmin):
    list_display = [
        'seller', 'amount', 'bank_name', 'account_number', 
        'status', 'created_at', 'processed_at'
    ]
    list_filter = ['status', 'created_at']
    search_fields = ['seller__email', 'transfer_reference', 'paystack_transfer_id']
    readonly_fields = ['transfer_reference', 'created_at']
    ordering = ['-created_at']
    
    def bank_name(self, obj):
        return obj.bank_details.bank_name
    bank_name.short_description = 'Bank'
    
    def account_number(self, obj):
        return obj.bank_details.account_number
    account_number.short_description = 'Account Number'
    
    actions = ['mark_as_completed', 'mark_as_failed']
    
    def mark_as_completed(self, request, queryset):
        """Mark selected payouts as completed"""
        from django.utils import timezone
        count = queryset.update(status='completed', processed_at=timezone.now())
        self.message_user(request, f"Marked {count} payouts as completed.")
    mark_as_completed.short_description = "Mark payouts as completed"
    
    def mark_as_failed(self, request, queryset):
        """Mark selected payouts as failed"""
        count = queryset.update(status='failed')
        self.message_user(request, f"Marked {count} payouts as failed.")
    mark_as_failed.short_description = "Mark payouts as failed"

@admin.register(SellerEarnings)
class SellerEarningsAdmin(admin.ModelAdmin):
    list_display = [
        'seller', 'total_sales', 'total_commission', 
        'total_payouts', 'available_balance', 'last_updated'
    ]
    list_filter = ['last_updated']
    search_fields = ['seller__email', 'seller__brand_name']
    readonly_fields = ['last_updated']
    ordering = ['-last_updated']
    
    actions = ['recalculate_earnings']
    
    def recalculate_earnings(self, request, queryset):
        """Recalculate earnings for selected sellers"""
        from .services import PaystackService
        paystack_service = PaystackService()
        
        count = 0
        for earnings in queryset:
            try:
                paystack_service.update_seller_earnings(earnings.seller)
                count += 1
            except Exception as e:
                self.message_user(request, f"Error updating {earnings.seller.email}: {str(e)}", level='ERROR')
        
        self.message_user(request, f"Recalculated earnings for {count} sellers.")
    recalculate_earnings.short_description = "Recalculate earnings" 