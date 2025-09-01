from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils.translation import gettext_lazy as _
from django.utils import timezone

class CustomUserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError(_('The Email field must be set'))
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('user_type', 'admin')

        if extra_fields.get('is_staff') is not True:
            raise ValueError(_('Superuser must have is_staff=True.'))
        if extra_fields.get('is_superuser') is not True:
            raise ValueError(_('Superuser must have is_superuser=True.'))

        return self.create_user(email, password, **extra_fields)

class User(AbstractUser):
    class UserType(models.TextChoices):
        BUYER = 'buyer', _('Buyer')
        SELLER = 'seller', _('Seller')
        ADMIN = 'admin', _('Admin')

    username = None
    email = models.EmailField(_('email address'), unique=True)
    full_name = models.CharField(max_length=255)
    user_type = models.CharField(
        max_length=10,
        choices=UserType.choices,
        default=UserType.BUYER
    )
    brand_name = models.CharField(max_length=255, blank=True, null=True)
    brand_slug = models.SlugField(max_length=255, blank=True, null=True, unique=True)
    is_verified = models.BooleanField(default=False)
    otp = models.CharField(max_length=6, blank=True)
    otp_created_at = models.DateTimeField(null=True, blank=True)
    about = models.TextField(blank=True, null=True)
    open_time = models.CharField(max_length=10, blank=True, null=True, default='09:00')
    close_time = models.CharField(max_length=10, blank=True, null=True, default='18:00')
    store_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)

    objects = CustomUserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['full_name']

    def __str__(self):
        return self.email

    def save(self, *args, **kwargs):
        if self.user_type != self.UserType.SELLER:
            self.brand_name = ''
            self.brand_slug = None
        super().save(*args, **kwargs)

class BankDetail(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='bank_detail')
    bank_code = models.CharField(max_length=20)
    bank_name = models.CharField(max_length=100)
    account_number = models.CharField(max_length=20)
    account_name = models.CharField(max_length=100)

    def __str__(self):
        return f"{self.user.email} - {self.bank_name} ({self.account_number})"
