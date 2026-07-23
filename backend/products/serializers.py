import json

from rest_framework import serializers
from .models import Product, TicketCategory, TicketTier, media_url_for

DEFAULT_TICKET_COLOR = '#5465FF'


def parse_ticket_types(raw):
    """
    Normalise the ticket types posted by the seller.

    Accepts a list, or a JSON string (the create form posts multipart, so it
    arrives as text). Each entry is {name, price, quantity}; `name` is whatever
    the seller typed for this event — "Regular", "Table for 2", "Gold".

    Older clients sent {category_id, price, quantity} instead, so a name is
    derived from the category when one isn't supplied. That keeps the mobile
    app working until it is updated.
    """
    if not raw:
        return []

    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError:
            raise serializers.ValidationError(
                {'ticket_types': 'Could not read the ticket types.'}
            )

    if not isinstance(raw, list):
        raise serializers.ValidationError(
            {'ticket_types': 'Ticket types must be a list.'}
        )

    cleaned, seen = [], set()
    for entry in raw:
        if not isinstance(entry, dict):
            continue

        name = str(entry.get('name') or '').strip()
        color = str(entry.get('color') or '').strip() or DEFAULT_TICKET_COLOR
        category_id = entry.get('category_id')

        # Legacy payload: no name, just a pointer at the global category.
        if not name and category_id:
            category = TicketCategory.objects.filter(id=category_id).first()
            if category:
                name = category.name
                color = category.color or color

        if not name:
            raise serializers.ValidationError(
                {'ticket_types': 'Every ticket category needs a name.'}
            )
        if len(name) > 100:
            raise serializers.ValidationError(
                {'ticket_types': f'"{name[:30]}..." is too long (max 100 characters).'}
            )

        key = name.casefold()
        if key in seen:
            raise serializers.ValidationError(
                {'ticket_types': f'You have two ticket categories called "{name}".'}
            )
        seen.add(key)

        try:
            price = float(entry.get('price'))
            quantity = int(entry.get('quantity'))
        except (TypeError, ValueError):
            raise serializers.ValidationError(
                {'ticket_types': f'"{name}" needs a valid price and quantity.'}
            )

        if price < 0:
            raise serializers.ValidationError(
                {'ticket_types': f'"{name}" cannot have a negative price.'}
            )
        if quantity < 1:
            raise serializers.ValidationError(
                {'ticket_types': f'"{name}" needs a quantity of at least 1.'}
            )

        cleaned.append({
            'name': name,
            'price': price,
            'quantity': quantity,
            'color': color,
            'category_id': category_id,
            'description': str(entry.get('description') or '').strip(),
        })

    return cleaned


def create_ticket_tiers(product, ticket_types):
    """Replace a product's ticket categories with the supplied list."""
    if not ticket_types:
        return []

    tiers = [
        TicketTier.objects.create(
            name=t['name'],
            color=t['color'],
            category_id=t['category_id'],  # legacy, usually None
            price=t['price'],
            quantity_available=t['quantity'],
            description=t['description'],
            is_active=True,
        )
        for t in ticket_types
    ]
    product.ticket_tiers.set(tiers)
    return tiers

class TicketCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketCategory
        fields = ['id', 'name', 'description', 'color']

class TicketTierSerializer(serializers.ModelSerializer):
    remaining_quantity = serializers.ReadOnlyField()
    is_sold_out = serializers.ReadOnlyField()
    category = TicketCategorySerializer(read_only=True)
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = TicketTier
        fields = ['id', 'name', 'display_name', 'color', 'price', 'quantity_available',
                  'remaining_quantity', 'description', 'benefits', 'is_sold_out', 'category']

    def get_display_name(self, obj):
        """The label to show a buyer — see TicketTier.display_name."""
        return obj.display_name

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
        Always None. Product files live outside MEDIA_ROOT and are not servable
        by URL at all, so there is no honest value to return here — a /media/
        path would both 404 and imply the paid file is publicly fetchable.

        The key is kept in the response purely so existing clients that read it
        don't break on a missing field. Use `has_file` to decide whether to show
        a download control; the file itself comes from the authenticated
        /payments/library/<id>/download/ endpoint.
        """
        return None


    def get_cover_image_url(self, obj):
        """Public URL of the cover image (covers are meant to be public)."""
        return media_url_for(obj.cover_image)

    def get_thumbnail_url(self, obj):
        """
        Same URL as the cover for now — there is no separate thumbnail
        rendition. Kept as its own field so one can be introduced without
        changing the API shape.
        """
        return media_url_for(obj.cover_image)

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
        ticket_types = parse_ticket_types(validated_data.pop('ticket_types', []))

        # Calculate total ticket quantity from ticket types
        if ticket_types:
            validated_data['ticket_quantity'] = sum(t['quantity'] for t in ticket_types)

        product = super().create(validated_data)

        if ticket_category_id:
            try:
                product.ticket_category = TicketCategory.objects.get(id=ticket_category_id)
                product.save()
            except TicketCategory.DoesNotExist:
                pass

        create_ticket_tiers(product, ticket_types)
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
        
        # Handle ticket types. Tiers already sold against are kept rather than
        # replaced — deleting one would orphan the purchases pointing at it.
        ticket_types = parse_ticket_types(ticket_types)
        if ticket_types:
            sold_tiers = list(product.ticket_tiers.filter(quantity_sold__gt=0))
            sold_names = {t.name.casefold() for t in sold_tiers}

            fresh = [t for t in ticket_types if t['name'].casefold() not in sold_names]
            new_tiers = [
                TicketTier.objects.create(
                    name=t['name'],
                    color=t['color'],
                    category_id=t['category_id'],
                    price=t['price'],
                    quantity_available=t['quantity'],
                    description=t['description'],
                    is_active=True,
                )
                for t in fresh
            ]

            # Update quantity/price on the ones that already have sales.
            for t in ticket_types:
                match = next(
                    (s for s in sold_tiers if s.name.casefold() == t['name'].casefold()),
                    None,
                )
                if match:
                    match.price = t['price']
                    match.color = t['color']
                    # Never drop capacity below what has already been sold.
                    match.quantity_available = max(t['quantity'], match.quantity_sold)
                    match.save()

            product.ticket_tiers.set(sold_tiers + new_tiers)
            product.ticket_quantity = sum(
                x.quantity_available for x in sold_tiers + new_tiers
            )
            product.save()

        return product
