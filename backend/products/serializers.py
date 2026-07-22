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
    
    # NOTE: the paid product file itself is deliberately NOT exposed here.
    # `file` and a public `file_url` would let anyone who can view a product
    # download it without paying, since media is served directly by the web
    # server. Buyers receive the file only through the authenticated
    # /payments/library/<id>/download/ endpoint. `has_file` is a safe boolean
    # the UI can use to decide whether to show a Download button.
    has_file = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()
    cover_image_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'title', 'description', 'description_html', 'price', 'product_type',
            'cover_image', 'has_file', 'file_url', 'cover_image_url', 'thumbnail_url',
            'created_at', 'event_date', 'event_end_date', 'venue_name', 'location', 'speakers', 'ticket_quantity',
            'seller_name', 'seller_id', 'ticket_category', 'ticket_tiers', 'is_ticket_event'
        ]
        read_only_fields = ['owner', 'created_at']

    def get_has_file(self, obj):
        """Whether a downloadable file exists — safe to expose publicly."""
        return bool(obj.file)

    def get_file_url(self, obj):
        """
        Only the product's own seller ever sees a direct file URL. For everyone
        else this stays None so the paid asset can't be fetched without buying.
        """
        if not obj.file:
            return None

        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not (user and user.is_authenticated and obj.owner_id == user.id):
            return None

        try:
            from django.conf import settings
            return f"{settings.MEDIA_URL}{obj.file.name}"
        except Exception:
            return None


    def get_cover_image_url(self, obj):
        """Get cover image URL from local storage"""
        if obj.cover_image:
            try:
                from django.conf import settings
                return f"{settings.MEDIA_URL}{obj.cover_image.name}"
            except:
                return None
        return None
    
    def get_thumbnail_url(self, obj):
        """Get thumbnail URL for cover image"""
        if obj.cover_image:
            try:
                from django.conf import settings
                # For now, return the same URL as cover image
                # In production, you might want to generate thumbnails
                return f"{settings.MEDIA_URL}{obj.cover_image.name}"
            except:
                return None
        return None

class ProductCreateSerializer(serializers.ModelSerializer):
    ticket_category_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    ticket_types = serializers.JSONField(write_only=True, required=False)

    class Meta:
        model = Product
        fields = [
            'title', 'description', 'description_html', 'price', 'product_type',
            'event_date', 'event_end_date', 'venue_name', 'location', 'speakers', 'ticket_quantity',
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
                
                # Add created tiers to the product
                if created_tiers:
                    product.ticket_tiers.add(*created_tiers)
                    print(f"DEBUG: Added {len(created_tiers)} ticket tiers to product {product.id}")
                    
            except Exception as e:
                print(f"DEBUG: Error creating ticket tiers: {str(e)}")
        
        return product

class ProductUpdateSerializer(serializers.ModelSerializer):
    ticket_category_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    ticket_types = serializers.JSONField(write_only=True, required=False)

    class Meta:
        model = Product
        fields = [
            'title', 'description', 'description_html', 'price', 'product_type',
            'event_date', 'event_end_date', 'venue_name', 'location', 'speakers', 'ticket_quantity',
            'ticket_category_id', 'ticket_types'
        ]

    def update(self, instance, validated_data):
        ticket_category_id = validated_data.pop('ticket_category_id', None)
        ticket_types = validated_data.pop('ticket_types', [])
        
        # Update the product
        product = super().update(instance, validated_data)
        
        # Handle ticket category
        if ticket_category_id is not None:
            try:
                ticket_category = TicketCategory.objects.get(id=ticket_category_id)
                product.ticket_category = ticket_category
            except TicketCategory.DoesNotExist:
                product.ticket_category = None
            product.save()
        
        # Handle ticket types
        if ticket_types:
            # Clear existing ticket tiers
            product.ticket_tiers.clear()
            
            # Parse ticket_types if it's a string (from FormData)
            if isinstance(ticket_types, str):
                import json
                try:
                    ticket_types = json.loads(ticket_types)
                except json.JSONDecodeError:
                    print(f"Error parsing ticket_types JSON: {ticket_types}")
                    return product
            
            try:
                # Create new ticket tiers
                created_tiers = []
                
                for ticket_type_data in ticket_types:
                    try:
                        category = TicketCategory.objects.get(id=ticket_type_data['category_id'])
                        
                        # Create a simple ticket tier
                        import uuid
                        unique_name = f"{category.name}_{uuid.uuid4().hex[:8]}"
                        
                        ticket_tier = TicketTier.objects.create(
                            category_id=ticket_type_data['category_id'],
                            name=unique_name,
                            price=ticket_type_data['price'],
                            quantity_available=ticket_type_data['quantity'],
                            description=f"{category.name} tickets",
                            benefits="Standard benefits",
                            is_active=True
                        )
                        created_tiers.append(ticket_tier)
                        
                    except TicketCategory.DoesNotExist:
                        print(f"DEBUG: Category {ticket_type_data['category_id']} not found")
                        continue
                
                # Add created tiers to the product
                if created_tiers:
                    product.ticket_tiers.add(*created_tiers)
                    print(f"DEBUG: Updated product {product.id} with {len(created_tiers)} ticket tiers")
                    
            except Exception as e:
                print(f"DEBUG: Error updating ticket tiers: {str(e)}")
        
        return product
