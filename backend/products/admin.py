from django.contrib import admin
from .models import Product


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('title', 'owner', 'product_type', 'price', 'created_at')
    search_fields = ('title', 'owner__email', 'product_type')
    list_filter = ('product_type', 'created_at')
