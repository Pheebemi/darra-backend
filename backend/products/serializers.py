from rest_framework import serializers
from .models import Product

class ProductSerializer(serializers.ModelSerializer):
    seller_name = serializers.CharField(source='owner.brand_name', read_only=True)
    seller_id = serializers.IntegerField(source='owner.id', read_only=True)

    class Meta:
        model = Product
        fields = [
            'id', 'title', 'description', 'price', 'product_type',
            'file', 'created_at', 'event_date', 'ticket_quantity',
            'seller_name', 'seller_id'
        ]
        read_only_fields = ['owner', 'created_at']
