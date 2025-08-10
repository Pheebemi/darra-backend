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
    
    def to_representation(self, instance):
        """Custom representation to ensure proper amount formatting"""
        data = super().to_representation(instance)
        # Ensure amount is a proper number (Django DecimalField can sometimes cause precision issues)
        if 'amount' in data and data['amount'] is not None:
            data['amount'] = float(instance.amount)
        return data

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