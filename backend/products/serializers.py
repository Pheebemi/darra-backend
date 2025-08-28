from rest_framework import serializers
from .models import Product, TicketCategory, TicketTier

class TicketCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketCategory
        fields = ['id', 'name', 'description', 'color']

class TicketTierSerializer(serializers.ModelSerializer):
    remaining_quantity = serializers.ReadOnlyField()
    is_sold_out = serializers.ReadOnlyField()
    
    class Meta:
        model = TicketTier
        fields = ['id', 'name', 'price', 'quantity_available', 'remaining_quantity', 'description', 'benefits', 'is_sold_out', 'category']

class ProductSerializer(serializers.ModelSerializer):
    seller_name = serializers.CharField(source='owner.brand_name', read_only=True)
    seller_id = serializers.IntegerField(source='owner.id', read_only=True)
    ticket_category = TicketCategorySerializer(read_only=True)
    ticket_tiers = TicketTierSerializer(many=True, read_only=True)
    is_ticket_event = serializers.ReadOnlyField()

    class Meta:
        model = Product
        fields = [
            'id', 'title', 'description', 'price', 'product_type',
            'file', 'cover_image', 'created_at', 'event_date', 'ticket_quantity',
            'seller_name', 'seller_id', 'ticket_category', 'ticket_tiers', 'is_ticket_event'
        ]
        read_only_fields = ['owner', 'created_at']

class ProductCreateSerializer(serializers.ModelSerializer):
    ticket_category_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    ticket_types = serializers.JSONField(write_only=True, required=False)

    class Meta:
        model = Product
        fields = [
            'title', 'description', 'price', 'product_type',
            'file', 'cover_image', 'event_date', 'ticket_quantity',
            'ticket_category_id', 'ticket_types'
        ]

    def create(self, validated_data):
        ticket_category_id = validated_data.pop('ticket_category_id', None)
        ticket_types = validated_data.pop('ticket_types', [])
        
        # Calculate total ticket quantity from ticket types
        if ticket_types:
            total_quantity = sum(ticket_type['quantity'] for ticket_type in ticket_types)
            validated_data['ticket_quantity'] = total_quantity
        
        product = super().create(validated_data)
        
        if ticket_category_id:
            try:
                ticket_category = TicketCategory.objects.get(id=ticket_category_id)
                product.ticket_category = ticket_category
                product.save()
            except TicketCategory.DoesNotExist:
                pass
        
        if ticket_types:
            try:
                # Create ticket tiers for each ticket type
                created_tiers = []
                for ticket_type_data in ticket_types:
                    # Get the category name for better naming
                    try:
                        category = TicketCategory.objects.get(id=ticket_type_data['category_id'])
                        tier_name = f"{category.name} Ticket"
                    except TicketCategory.DoesNotExist:
                        tier_name = f"Category {ticket_type_data['category_id']} Ticket"
                    
                    ticket_tier = TicketTier.objects.create(
                        category_id=ticket_type_data['category_id'],
                        name=tier_name,
                        price=ticket_type_data['price'],
                        quantity_available=ticket_type_data['quantity'],
                        description=f"Ticket for {tier_name}",
                        benefits="Standard benefits",
                        is_active=True
                    )
                    created_tiers.append(ticket_tier)
                
                # Associate all created ticket tiers with the product
                product.ticket_tiers.set(created_tiers)
            except Exception as e:
                print(f"Error creating ticket tiers: {e}")
        
        return product
