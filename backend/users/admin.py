from django.contrib import admin
from django.contrib.auth import get_user_model
from .models import BankDetail

User = get_user_model()

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = (
        'email', 'full_name', 'user_type', 'brand_name', 'brand_slug',
        'is_verified', 'is_staff', 'is_superuser',
        'about', 'open_time', 'close_time', 'store_active',
    )
    search_fields = ('email', 'full_name', 'brand_name', 'brand_slug')
    list_filter = ('user_type', 'is_verified', 'is_staff', 'is_superuser', 'store_active')
    ordering = ('email',)
    readonly_fields = ('last_login', 'date_joined')
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal info', {'fields': (
            'full_name', 'user_type', 'brand_name', 'brand_slug',
            'about', 'open_time', 'close_time', 'store_active',
        )}),
        ('Permissions', {'fields': ('is_active', 'is_verified', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
        ('OTP', {'fields': ('otp', 'otp_created_at')}),
    )


@admin.register(BankDetail)
class BankDetailAdmin(admin.ModelAdmin):
    list_display = ('user', 'bank_name', 'account_number', 'account_name')
    search_fields = ('user__email', 'bank_name', 'account_number', 'account_name')

