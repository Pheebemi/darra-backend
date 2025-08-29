from rest_framework import serializers
from .models import Product, TicketCategory, TicketTier

class TicketCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketCategory
        fields = ['id', 'name', 'description', 'color']

class TicketTierSerializer(serializers.ModelSerializer):
    remaining_quantity = serializers.ReadOnlyField()
    is_sold_out = serializers.ReadOnlyField()
    category = TicketCategorySerializer(read_only=True)
    
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
            'id', 'title', 'description', 'description_html', 'price', 'product_type',
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
            'title', 'description', 'description_html', 'price', 'product_type',
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
            # Parse ticket_types if it's a string (from FormData)
            if isinstance(ticket_types, str):
                import json
                try:
                    ticket_types = json.loads(ticket_types)
                except json.JSONDecodeError:
                    print(f"Error parsing ticket_types JSON: {ticket_types}")
                    return product
            
            try:
                # Create simple ticket categories for each ticket type
                created_tiers = []
                
                for ticket_type_data in ticket_types:
                    try:
                        category = TicketCategory.objects.get(id=ticket_type_data['category_id'])
                        
                        # Create a simple ticket tier with just the essential info
                        import uuid
                        unique_name = f"{category.name}_{uuid.uuid4().hex[:8]}"
                        
                        ticket_tier = TicketTier.objects.create(
                            category_id=ticket_type_data['category_id'],
                            name=unique_name,  # Use unique name to avoid constraint violation
                            price=ticket_type_data['price'],
                            quantity_available=ticket_type_data['quantity'],
                            description=f"{category.name} tickets",  # Simple description
                            benefits="Standard benefits",
                            is_active=True
                        )
                        created_tiers.append(ticket_tier)
                        
                    except TicketCategory.DoesNotExist:
                        print(f"DEBUG: Category {ticket_type_data['category_id']} not found")
                        continue
                
                # Associate all created ticket tiers with the product
                if created_tiers:
                    product.ticket_tiers.set(created_tiers)
                    print(f"DEBUG: Created {len(created_tiers)} ticket categories")
                    for tier in created_tiers:
                        print(f"DEBUG: {tier.category.name} - Price: ₦{tier.price}, Quantity: {tier.quantity_available}")
                    
            except Exception as e:
                print(f"Error creating ticket categories: {e}")
                import traceback
                traceback.print_exc()
        
        return product

class ProductUpdateSerializer(serializers.ModelSerializer):
    ticket_types = serializers.JSONField(write_only=True, required=False)

    class Meta:
        model = Product
        fields = [
            'title', 'description', 'description_html', 'price', 'product_type',
            'file', 'cover_image', 'event_date', 'ticket_quantity',
            'ticket_types'
        ]

    def update(self, instance, validated_data):
        ticket_types = validated_data.pop('ticket_types', None)
        
        print(f"DEBUG: ProductUpdateSerializer.update called")
        print(f"DEBUG: ticket_types received: {ticket_types}")
        print(f"DEBUG: instance.product_type: {instance.product_type}")
        
        # Update the product
        product = super().update(instance, validated_data)
        
        # Handle ticket types update
        if ticket_types is not None:
            print(f"DEBUG: Processing ticket_types: {ticket_types}")
            
            # Remove existing ticket tiers
            existing_count = product.ticket_tiers.count()
            product.ticket_tiers.all().delete()
            print(f"DEBUG: Removed {existing_count} existing ticket tiers")
            
            # Parse ticket_types if it's a string (from FormData)
            if isinstance(ticket_types, str):
                import json
                try:
                    ticket_types = json.loads(ticket_types)
                    print(f"DEBUG: Parsed JSON ticket_types: {ticket_types}")
                except json.JSONDecodeError:
                    print(f"Error parsing ticket_types JSON: {ticket_types}")
                    return product
            
            # Calculate total ticket quantity from ticket types
            if ticket_types:
                total_quantity = sum(ticket_type['quantity'] for ticket_type in ticket_types)
                product.ticket_quantity = total_quantity
                product.save()
            
            # Create new ticket tiers
            if ticket_types:
                print(f"DEBUG: Creating {len(ticket_types)} new ticket tiers")
                try:
                    created_tiers = []
                    
                    for i, ticket_type_data in enumerate(ticket_types):
                        print(f"DEBUG: Processing ticket {i+1}: {ticket_type_data}")
                        try:
                            category = TicketCategory.objects.get(id=ticket_type_data['category_id'])
                            print(f"DEBUG: Found category: {category.name}")
                            
                            # Create a simple ticket tier with just the essential info
                            import uuid
                            unique_name = f"{category.name}_{uuid.uuid4().hex[:8]}"
                            print(f"DEBUG: Creating tier with name: {unique_name}")
                            
                            ticket_tier = TicketTier.objects.create(
                                category_id=ticket_type_data['category_id'],
                                name=unique_name,  # Use unique name to avoid constraint violation
                                price=ticket_type_data['price'],
                                quantity_available=ticket_type_data['quantity'],
                                description=f"{category.name} tickets",  # Simple description
                                benefits="Standard benefits",
                                is_active=True
                            )
                            print(f"DEBUG: Successfully created ticket tier: {ticket_tier.id}")
                            created_tiers.append(ticket_tier)
                            
                        except TicketCategory.DoesNotExist:
                            print(f"DEBUG: Category {ticket_type_data['category_id']} not found")
                            continue
                        except Exception as e:
                            print(f"DEBUG: Error creating ticket tier: {e}")
                            continue
                    
                    # Associate all created ticket tiers with the product
                    if created_tiers:
                        print(f"DEBUG: Associating {len(created_tiers)} ticket tiers with product")
                        product.ticket_tiers.set(created_tiers)
                        print(f"DEBUG: Successfully updated with {len(created_tiers)} ticket categories")
                        for tier in created_tiers:
                            print(f"DEBUG: {tier.category.name} - Price: ₦{tier.price}, Quantity: {tier.quantity_available}")
                    else:
                        print(f"DEBUG: No ticket tiers were created successfully")
                        
                except Exception as e:
                    print(f"Error updating ticket categories: {e}")
                    import traceback
                    traceback.print_exc()
        
        return product
