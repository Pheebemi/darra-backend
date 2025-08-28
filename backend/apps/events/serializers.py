from rest_framework import serializers
from .models import EventTicket
from users.serializers import UserProfileSerializer
from products.serializers import ProductSerializer, TicketTierSerializer

class EventTicketSerializer(serializers.ModelSerializer):
    buyer = UserProfileSerializer(read_only=True)
    event = ProductSerializer(read_only=True)
    verified_by = UserProfileSerializer(read_only=True)
    
    class Meta:
        model = EventTicket
        fields = [
            'ticket_id', 'purchase', 'buyer', 'event', 'quantity',
            'is_used', 'used_at', 'verified_by', 'verified_at', 'created_at'
        ]
        read_only_fields = [
            'ticket_id', 'buyer', 'event', 'verified_by', 'verified_at', 'created_at'
        ]

class EventTicketDetailSerializer(serializers.ModelSerializer):
    buyer = UserProfileSerializer(read_only=True)
    event = ProductSerializer(read_only=True)
    verified_by = UserProfileSerializer(read_only=True)
    purchase_reference = serializers.CharField(source='purchase.payment.reference', read_only=True)
    payment_amount = serializers.DecimalField(source='purchase.total_price', max_digits=10, decimal_places=2, read_only=True)
    ticket_tier = TicketTierSerializer(source='purchase.selected_ticket_tier', read_only=True)
    
    class Meta:
        model = EventTicket
        fields = [
            'ticket_id', 'purchase', 'buyer', 'event', 'quantity',
            'is_used', 'used_at', 'verified_by', 'verified_at', 'created_at',
            'purchase_reference', 'payment_amount', 'ticket_tier'
        ]
