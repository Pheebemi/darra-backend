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
    event_tickets = serializers.SerializerMethodField()
    
    class Meta:
        model = UserLibrary
        fields = ['id', 'product', 'quantity', 'added_at', 'event_tickets']
        read_only_fields = ['id', 'quantity', 'added_at', 'event_tickets']
    
    def get_event_tickets(self, obj):
        """Get event ticket details including QR codes for event products"""
        if obj.product.product_type == 'event':
            from apps.events.models import EventTicket
            from django.conf import settings
            
            tickets = EventTicket.objects.filter(purchase=obj.purchase)
            result = []
            for ticket in tickets:
                qr_url = None
                if ticket.qr_code:
                    qr_url = f"{settings.BASE_URL}{ticket.qr_code.url}"
                
                result.append({
                    'id': ticket.id,
                    'ticket_id': str(ticket.ticket_id),
                    'qr_code_url': qr_url,
                    'is_used': ticket.is_used,
                    'created_at': ticket.created_at
                })
            return result
        return []

class CartItemSerializer(serializers.Serializer):
    product_id = serializers.IntegerField()
    quantity = serializers.IntegerField(min_value=1, default=1)

class CheckoutSerializer(serializers.Serializer):
    items = CartItemSerializer(many=True)
    email = serializers.EmailField()
    callback_url = serializers.URLField(required=False) 