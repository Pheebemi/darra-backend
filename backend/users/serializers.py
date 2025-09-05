from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.utils.text import slugify
import re
from .models import BankDetail

User = get_user_model()

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    
    class Meta:
        model = User
        fields = ['email', 'password', 'full_name', 'user_type', 'brand_name']
        extra_kwargs = {
            'brand_name': {'required': False}
        }

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def validate_password(self, value):
        if len(value) < 8:
            raise serializers.ValidationError("Password must be at least 8 characters long.")
        return value

    def validate_brand_name(self, value):
        if self.initial_data.get('user_type') == 'seller':
            if not value:
                raise serializers.ValidationError("Brand name is required for sellers.")
            
            # Check if brand name contains only valid characters
            if not re.match(r'^[a-zA-Z0-9\s-]+$', value):
                raise serializers.ValidationError(
                    "Brand name can only contain letters, numbers, spaces, and hyphens."
                )
            
            # Check if brand slug is unique
            slug = slugify(value)
            if User.objects.filter(brand_slug=slug).exists():
                raise serializers.ValidationError("This brand name is already taken.")
            
        return value

    def create(self, validated_data):
        user_type = validated_data.get('user_type')
        brand_name = validated_data.get('brand_name', '')
        
        if user_type == 'seller' and brand_name:
            validated_data['brand_slug'] = slugify(brand_name)
        
        user = User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            full_name=validated_data['full_name'],
            user_type=validated_data['user_type'],
            brand_name=brand_name
        )
        return user

class UserLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

class OTPVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(max_length=6)

class OTPLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()

class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate_password(self, value):
        if len(value) < 8:
            raise serializers.ValidationError("Password must be at least 8 characters long.")
        return value

class UserProfileSerializer(serializers.ModelSerializer):
    about = serializers.CharField(required=False, allow_blank=True)
    open_time = serializers.CharField(required=False, allow_blank=True)
    close_time = serializers.CharField(required=False, allow_blank=True)
    store_active = serializers.BooleanField(required=False)

    class Meta:
        model = User
        fields = [
            'id',
            'email', 'full_name', 'user_type', 'brand_name', 'brand_slug',
            'about', 'open_time', 'close_time', 'store_active'
        ]
        read_only_fields = ['id', 'email', 'user_type', 'brand_slug']

    def validate_brand_name(self, value):
        user = self.instance
        if user.user_type == 'seller':
            if not value:
                raise serializers.ValidationError("Brand name is required for sellers.")
            
            # Check if brand name contains only valid characters
            if not re.match(r'^[a-zA-Z0-9\s-]+$', value):
                raise serializers.ValidationError(
                    "Brand name can only contain letters, numbers, spaces, and hyphens."
                )
            
            # Check if brand slug is unique (excluding current user)
            slug = slugify(value)
            if User.objects.filter(brand_slug=slug).exclude(id=user.id).exists():
                raise serializers.ValidationError("This brand name is already taken.")
            
        return value

    def update(self, instance, validated_data):
        if instance.user_type == 'seller' and 'brand_name' in validated_data:
            validated_data['brand_slug'] = slugify(validated_data['brand_name'])
        return super().update(instance, validated_data) 

class UpdatePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=8)

    def validate_new_password(self, value):
        if len(value) < 8:
            raise serializers.ValidationError("Password must be at least 8 characters long.")
        return value

class BankDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankDetail
        fields = ['id', 'bank_code', 'bank_name', 'account_number', 'account_name']