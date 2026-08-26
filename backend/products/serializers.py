import json

from django.db.models import Avg
from rest_framework import serializers

from .models import Product, Review, TicketCategory, TicketTier, Coupon, media_url_for

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
    average_rating = serializers.SerializerMethodField()
    review_count = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'slug', 'title', 'description', 'description_html', 'price', 'product_type',
            'cover_image', 'has_file', 'file_url', 'cover_image_url', 'thumbnail_url',
            'created_at', 'event_date', 'event_end_date', 'venue_name', 'location', 'speakers', 'ticket_quantity',
            'seller_name', 'seller_id', 'ticket_category', 'ticket_tiers', 'is_ticket_event',
            'is_published', 'average_rating', 'review_count',
        ]
        read_only_fields = ['owner', 'created_at', 'slug']

    def get_average_rating(self, obj):
        """
        Mean rating, or None when nobody has reviewed yet.

        None rather than 0 on purpose: a brand-new product with no reviews is
        not the same as one rated zero, and the UI needs to tell them apart to
        decide between "No reviews yet" and a star row.

        Reads the `avg_rating` annotation when the queryset supplied one, so
        list endpoints aggregate in a single query instead of one per row.
        """
        annotated = getattr(obj, 'avg_rating', 'missing')
        if annotated != 'missing':
            return round(annotated, 2) if annotated is not None else None
        result = obj.reviews.aggregate(avg=Avg('rating'))['avg']
        return round(result, 2) if result is not None else None

    def get_review_count(self, obj):
        annotated = getattr(obj, 'num_reviews', None)
        if annotated is not None:
            return annotated
        return obj.reviews.count()

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


class ReviewSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    is_own = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = ['id', 'rating', 'comment', 'created_at', 'updated_at',
                  'user_name', 'is_own']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_user_name(self, obj):
        # Reviews are public, so the reviewer's email must never be exposed
        # here — fall back to a generic label rather than leaking it.
        return obj.user.full_name or 'Darra buyer'

    def get_is_own(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        return bool(user and user.is_authenticated and obj.user_id == user.id)

    def validate_rating(self, value):
        if not 1 <= value <= 5:
            raise serializers.ValidationError('Rating must be between 1 and 5.')
        return value


class CouponProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ['id', 'title']


class CouponSerializer(serializers.ModelSerializer):
    # A seller may only scope a coupon to their own products — the queryset
    # is narrowed to the requesting user in __init__ below.
    products = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Product.objects.none(), required=False
    )
    product_details = CouponProductSerializer(source='products', many=True, read_only=True)
    # Populated by the view's annotated queryset (Count/Sum over successful
    # purchases). Defaulted so a freshly-created coupon serializes cleanly
    # before it has ever been read back through that queryset.
    redemptions = serializers.IntegerField(read_only=True, default=0)
    revenue = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True, default=0)

    class Meta:
        model = Coupon
        fields = [
            'id', 'code', 'discount_type', 'value', 'products', 'product_details',
            'max_redemptions', 'max_redemptions_per_buyer', 'expires_at', 'is_active',
            'redemptions', 'revenue', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        if request is not None:
            self.fields['products'].queryset = Product.objects.filter(owner=request.user)

    def validate_code(self, value):
        value = (value or '').strip().upper()
        if not value:
            raise serializers.ValidationError('Enter a code.')
        existing = Coupon.objects.filter(code=value)
        if self.instance:
            existing = existing.exclude(pk=self.instance.pk)
        if existing.exists():
            raise serializers.ValidationError('That code is already taken.')
        return value

    def validate(self, attrs):
        discount_type = attrs.get(
            'discount_type', getattr(self.instance, 'discount_type', Coupon.DiscountType.PERCENT)
        )
        value = attrs.get('value', getattr(self.instance, 'value', None))

        if value is not None and value <= 0:
            raise serializers.ValidationError({'value': 'Discount must be greater than zero.'})

        # Commission is always 4% of list price regardless of the coupon, so
        # a percentage deep enough can leave a seller owing more than they
        # collected on that sale. Capping at 50% keeps a seller's payout
        # positive no matter how the coupon is used.
        if discount_type == Coupon.DiscountType.PERCENT and value is not None and value > 50:
            raise serializers.ValidationError({
                'value': 'Percentage discounts are capped at 50% — commission is still charged '
                         'on the full price, so a deeper cut can leave you owing more than you collect.'
            })
        return attrs

    def create(self, validated_data):
        validated_data['seller'] = self.context['request'].user
        return super().create(validated_data)
