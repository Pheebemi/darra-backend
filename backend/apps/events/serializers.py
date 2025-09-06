from rest_framework import serializers
from .models import EventTicket
from .fast_models import FastEventTicket
from users.serializers import UserProfileSerializer
from products.serializers import ProductSerializer, TicketTierSerializer

class EventTicketSerializer(serializers.ModelSerializer):
    buyer = UserProfileSerializer(read_only=True)
    event = ProductSerializer(read_only=True)
    verified_by = UserProfileSerializer(read_only=True)
    qr_code_url = serializers.SerializerMethodField()
    pdf_ticket_url = serializers.SerializerMethodField()
    
    class Meta:
        model = EventTicket
        fields = [
            'ticket_id', 'purchase', 'buyer', 'event', 'quantity',
            'qr_code', 'qr_code_url', 'pdf_ticket', 'pdf_ticket_url',
            'is_used', 'used_at', 'verified_by', 'verified_at', 'created_at'
        ]
        read_only_fields = [
            'ticket_id', 'buyer', 'event', 'verified_by', 'verified_at', 'created_at'
        ]
    
    def get_qr_code_url(self, obj):
        """Get optimized QR code URL from Cloudinary"""
        return obj.get_qr_code_url()
    
    def get_pdf_ticket_url(self, obj):
        """Get PDF ticket URL from Cloudinary"""
        return obj.get_pdf_ticket_url()

class EventTicketDetailSerializer(serializers.ModelSerializer):
    buyer = UserProfileSerializer(read_only=True)
    event = ProductSerializer(read_only=True)
    verified_by = UserProfileSerializer(read_only=True)
    purchase_reference = serializers.CharField(source='purchase.payment.reference', read_only=True)
    payment_amount = serializers.DecimalField(source='purchase.total_price', max_digits=10, decimal_places=2, read_only=True)
    ticket_tier = TicketTierSerializer(source='purchase.selected_ticket_tier', read_only=True)
    qr_code_url = serializers.SerializerMethodField()
    pdf_ticket_url = serializers.SerializerMethodField()
    
    class Meta:
        model = EventTicket
        fields = [
            'ticket_id', 'purchase', 'buyer', 'event', 'quantity',
            'qr_code', 'qr_code_url', 'pdf_ticket', 'pdf_ticket_url',
            'is_used', 'used_at', 'verified_by', 'verified_at', 'created_at',
            'purchase_reference', 'payment_amount', 'ticket_tier'
        ]
    
    def get_qr_code_url(self, obj):
        """Get optimized QR code URL from Cloudinary"""
        return obj.get_qr_code_url()
    
    def get_pdf_ticket_url(self, obj):
        """Get PDF ticket URL from Cloudinary"""
        return obj.get_pdf_ticket_url()
