from rest_framework import serializers
from django.conf import settings
from .models import Payment, Purchase, UserLibrary, SellerCommission, PayoutRequest, SellerEarnings
from products.serializers import ProductSerializer
from users.serializers import UserProfileSerializer

class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = ['id', 'reference', 'amount', 'currency', 'status', 'created_at']

class PurchaseSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    
    class Meta:
        model = Purchase
        fields = ['id', 'product', 'quantity', 'unit_price', 'total_price', 'created_at']

class UserLibrarySerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)
    event_tickets = serializers.SerializerMethodField()
    
    class Meta:
        model = UserLibrary
        fields = ['id', 'product', 'quantity', 'added_at', 'event_tickets']
        read_only_fields = ['id', 'quantity', 'added_at', 'event_tickets']
    
    def get_event_tickets(self, obj):
        """Get event ticket details including QR codes for event products"""
        print(f"DEBUG: Processing product {obj.product.id} with type: {obj.product.product_type}")
        
        if obj.product.product_type == 'event':
            try:
                from apps.events.models import EventTicket
                print(f"DEBUG: Importing EventTicket model")
                
                tickets = EventTicket.objects.filter(purchase=obj.purchase)
                print(f"DEBUG: Found {tickets.count()} tickets for purchase {obj.purchase.id}")
                
                result = [{
                    'id': ticket.id,
                    'ticket_id': str(ticket.ticket_id),
                    'qr_code_url': ticket.qr_code.url if ticket.qr_code else None,
                    'is_used': ticket.is_used,
                    'created_at': ticket.created_at
                } for ticket in tickets]
                
                print(f"DEBUG: Serialized tickets: {result}")
                return result
            except Exception as e:
                print(f"ERROR: Error getting event tickets: {e}")
                import traceback
                traceback.print_exc()
                return []
        else:
            print(f"DEBUG: Product {obj.product.id} is not an event (type: {obj.product.product_type})")
        return []

class CheckoutItemSerializer(serializers.Serializer):
    """Serializer for individual checkout items"""
    product_id = serializers.IntegerField(required=True)
    quantity = serializers.IntegerField(required=True, min_value=1)
    ticket_tier_id = serializers.IntegerField(required=False, allow_null=True)  # For event products

class CheckoutSerializer(serializers.Serializer):
    items = serializers.ListField(
        child=CheckoutItemSerializer(),
        min_length=1
    )
    email = serializers.EmailField(required=False)  # Make email optional
    payment_provider = serializers.ChoiceField(
        choices=[('paystack', 'Paystack'), ('flutterwave', 'Flutterwave')],
        required=False,
        default='paystack'
    )

class SellerCommissionSerializer(serializers.ModelSerializer):
    product_title = serializers.CharField(source='purchase.product.title', read_only=True)
    customer_email = serializers.CharField(source='purchase.payment.user.email', read_only=True)
    customer_name = serializers.CharField(source='purchase.payment.user.full_name', read_only=True)
    
    class Meta:
        model = SellerCommission
        fields = [
            'id', 'product_title', 'customer_email', 'customer_name',
            'product_price', 'commission_amount', 'seller_payout',
            'status', 'created_at', 'paid_at'
        ]
        read_only_fields = fields

class PayoutRequestSerializer(serializers.ModelSerializer):
    bank_name = serializers.CharField(source='bank_details.bank_name', read_only=True)
    account_number = serializers.CharField(source='bank_details.account_number', read_only=True)
    account_name = serializers.CharField(source='bank_details.account_name', read_only=True)
    
    class Meta:
        model = PayoutRequest
        fields = [
            'id', 'amount', 'bank_name', 'account_number', 'account_name',
            'status', 'transfer_reference', 'created_at', 'processed_at'
        ]
        read_only_fields = ['id', 'status', 'transfer_reference', 'created_at', 'processed_at']

class CreatePayoutRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = PayoutRequest
        fields = ['amount', 'bank_details']
    
    def validate_amount(self, value):
        """Validate payout amount"""
        if value <= 0:
            raise serializers.ValidationError("Payout amount must be greater than 0")
        
        # Check if seller has enough available balance
        seller = self.context['request'].user
        try:
            earnings = seller.earnings
            if value > earnings.available_balance:
                raise serializers.ValidationError(
                    f"Insufficient balance. Available: ₦{earnings.available_balance}"
                )
        except SellerEarnings.DoesNotExist:
            raise serializers.ValidationError("No earnings found")
        
        # Check minimum payout amount (₦1,000)
        if value < 1000:
            raise serializers.ValidationError("Minimum payout amount is ₦1,000")
        
        return value
    
    def validate_bank_details(self, value):
        """Validate bank details belong to seller"""
        seller = self.context['request'].user
        if value.user != seller:
            raise serializers.ValidationError("Bank details must belong to you")
        return value

class SellerEarningsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SellerEarnings
        fields = [
            'total_sales', 'total_commission', 'total_payouts', 
            'available_balance', 'last_updated'
        ]
        read_only_fields = fields

class AnalyticsSerializer(serializers.Serializer):
    """Serializer for analytics data"""
    total_revenue = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_orders = serializers.IntegerField()
    revenue_growth = serializers.DecimalField(max_digits=5, decimal_places=2)
    conversion_rate = serializers.DecimalField(max_digits=5, decimal_places=2)
    avg_order_value = serializers.DecimalField(max_digits=10, decimal_places=2)
    aov_growth = serializers.DecimalField(max_digits=5, decimal_places=2)
    customer_countries = serializers.IntegerField()
    top_products = serializers.ListField()
    daily_revenue = serializers.ListField()
    total_customers = serializers.IntegerField()
    
    # Commission and earnings data
    total_earnings = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_commission = serializers.DecimalField(max_digits=12, decimal_places=2)
    net_payout = serializers.DecimalField(max_digits=12, decimal_places=2)
    pending_payouts = serializers.DecimalField(max_digits=12, decimal_places=2)
    recent_commissions = serializers.ListField()
    recent_payouts = serializers.ListField() 