from rest_framework import serializers
from .models import Payment, Purchase, UserLibrary
from products.serializers import ProductSerializer

class PurchaseSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    
    class Meta:
        model = Purchase
        fields = ['id', 'product', 'quantity', 'unit_price', 'total_price', 'created_at']
        read_only_fields = ['id', 'unit_price', 'total_price', 'created_at']

class PaymentSerializer(serializers.ModelSerializer):
    purchases = PurchaseSerializer(many=True, read_only=True)
    
    class Meta:
        model = Payment
        fields = ['id', 'reference', 'amount', 'currency', 'status', 'created_at', 'purchases']
        read_only_fields = ['id', 'reference', 'status', 'created_at', 'purchases']

class UserLibrarySerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    
    class Meta:
        model = UserLibrary
        fields = ['id', 'product', 'added_at']
        read_only_fields = ['id', 'added_at']

class CartItemSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1, default=1)

class CheckoutSerializer(serializers.Serializer):
    items = CartItemSerializer(many=True)
    email = serializers.EmailField()
    callback_url = serializers.URLField(required=False) 