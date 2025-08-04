from django.contrib import admin
from .models import Payment, Purchase, UserLibrary

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['user', 'reference', 'amount', 'status', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['user__email', 'reference', 'paystack_transaction_id']
    readonly_fields = ['created_at', 'updated_at']

@admin.register(Purchase)
class PurchaseAdmin(admin.ModelAdmin):
    list_display = ['payment', 'product', 'quantity', 'total_price', 'created_at']
    list_filter = ['created_at']
    search_fields = ['payment__user__email', 'product__title']

@admin.register(UserLibrary)
class UserLibraryAdmin(admin.ModelAdmin):
    list_display = ['user', 'product', 'added_at']
    list_filter = ['added_at']
    search_fields = ['user__email', 'product__title'] 