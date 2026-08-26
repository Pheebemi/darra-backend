from django.conf import settings
from django.shortcuts import render
from rest_framework import generics, permissions, status
from .models import Product, Review, TicketCategory, TicketTier, Coupon
from .serializers import (
    CouponSerializer,
    ProductSerializer, ProductCreateSerializer, ProductUpdateSerializer,
    ReviewSerializer, TicketCategorySerializer, TicketTierSerializer
)
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Avg, Sum, Count, Q
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from datetime import timedelta
from apps.payments.models import Payment, Purchase
from django.db.models.functions import TruncDate
from apps.payments.serializers import PurchaseSerializer
from .file_validation import (
    validate_uploaded_file, validate_cover_image, ALLOWED_FILE_TYPES,
    get_allowed_extensions_for_type,
)
from .models import _r2_configured
from .r2_uploads import build_file_key, generate_presigned_put, attach_r2_file
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError as DRFValidationError
from core.pagination import StandardResultsPagination, paginate_list
from core.cache_utils import (
    cache_product_list, cache_product_data, cache_user_data, 
    performance_monitor, CacheManager
)
from django.core.cache import cache
from .ai import generate_product_description
# Removed Cloudinary dependency - using local storage

# Create your views here.

class TicketCategoryListView(generics.ListAPIView):
    """List all available ticket categories"""
    serializer_class = TicketCategorySerializer
    permission_classes = [permissions.AllowAny]
    queryset = TicketCategory.objects.all()

class TicketTierListView(generics.ListAPIView):
    """List all ticket tiers for a specific category"""
    serializer_class = TicketTierSerializer
    permission_classes = [permissions.AllowAny]
    
    def get_queryset(self):
        category_id = self.kwargs.get('category_id')
        if category_id:
            return TicketTier.objects.filter(category_id=category_id, is_active=True)
        return TicketTier.objects.filter(is_active=True)

class TicketTierCreateView(generics.CreateAPIView):
    """Create a new ticket tier"""
    serializer_class = TicketTierSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def perform_create(self, serializer):
        serializer.save()

class SellerProductListCreateView(generics.ListCreateAPIView):
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Product.objects.filter(owner=self.request.user)

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ProductCreateSerializer
        return ProductSerializer
    
    def perform_create(self, serializer):
        # Check if this is a duplicate request by looking for similar products
        title = serializer.validated_data.get('title')
        product_type = serializer.validated_data.get('product_type')

        # Look for recent duplicate products (within last 5 minutes)
        recent_duplicate = Product.objects.filter(
            owner=self.request.user,
            title=title,
            product_type=product_type,
            created_at__gte=timezone.now() - timedelta(minutes=5)
        ).first()
        
        if recent_duplicate:
            # Return the existing product instead of creating a new one
            return recent_duplicate
        
        product = serializer.save(owner=self.request.user)

        # Attach the uploaded files. A failure here must NOT be swallowed: a
        # product created without its file (the thing the buyer pays for) is
        # worse than a clear error. If validation fails, delete the just-created
        # product and return the message so the seller can fix and retry.
        try:
            if 'cover_image' in self.request.FILES:
                cover_image = self.request.FILES['cover_image']
                validate_cover_image(cover_image)
                product.cover_image = cover_image
                product.save()

            # The product file arrives one of two ways: a `file_key` pointing at
            # an object the browser already uploaded straight to R2 (the path for
            # anything large), or raw `file` bytes in the request (local disk /
            # small files). Both are validated before they stick.
            file_key = self.request.data.get('file_key')
            if file_key:
                attach_r2_file(product, file_key, self.request.user, product.product_type)
            elif 'file' in self.request.FILES:
                product_file = self.request.FILES['file']
                validate_uploaded_file(product_file, product.product_type)
                product.file = product_file
                product.save()
        except DjangoValidationError as e:
            product.delete()
            raise DRFValidationError({'detail': e.messages})

        return product


class GenerateProductDescriptionView(APIView):
    """Generate product copy when a seller explicitly requests it."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if getattr(request.user, 'user_type', None) != 'seller':
            return Response(
                {'message': 'Only sellers can generate product descriptions.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        title = str(request.data.get('title') or '').strip()
        if not title:
            return Response(
                {'message': 'A product title is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not settings.SUPPORT_AI_API_KEY:
            # Distinct from a provider failure: no amount of retrying fixes a
            # missing key, so don't tell the seller to try again.
            return Response(
                {'message': 'AI descriptions are not configured on this site yet.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        ticket_types = request.data.get('ticket_types', [])
        if isinstance(ticket_types, str):
            import json
            try:
                ticket_types = json.loads(ticket_types)
            except json.JSONDecodeError:
                ticket_types = []

        description = generate_product_description(
            {
                'title': title,
                'product_type': request.data.get('product_type', ''),
                'price': request.data.get('price', ''),
                # The seller's own draft copy, used as the brief to rewrite
                # rather than as something to replace unseen.
                'notes': request.data.get('notes', ''),
                # Taken from the account, not the request — a client must not
                # be able to put someone else's shop name in the copy.
                'brand_name': getattr(request.user, 'brand_name', '') or '',
                'event_date': request.data.get('event_date', ''),
                'event_end_date': request.data.get('event_end_date', ''),
                'venue_name': request.data.get('venue_name', ''),
                'location': request.data.get('location', ''),
                'speakers': request.data.get('speakers', ''),
            },
            ticket_types,
        )
        if not description:
            return Response(
                {'message': 'The AI service did not respond. Please try again in a moment.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response({'description': description})

class ProductDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Product.objects.filter(owner=self.request.user)

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return ProductUpdateSerializer
        return ProductSerializer
    
    def perform_update(self, serializer):
        product = serializer.save()

        # Same cover-accepts-JPG fix as create; surface validation errors as a
        # clean 400 rather than a 500.
        try:
            if 'cover_image' in self.request.FILES:
                cover_image = self.request.FILES['cover_image']
                validate_cover_image(cover_image)
                product.cover_image = cover_image
                product.save()

            file_key = self.request.data.get('file_key')
            if file_key:
                attach_r2_file(product, file_key, self.request.user, product.product_type)
            elif 'file' in self.request.FILES:
                product_file = self.request.FILES['file']
                validate_uploaded_file(product_file, product.product_type)
                product.file = product_file
                product.save()
        except DjangoValidationError as e:
            raise DRFValidationError({'detail': e.messages})


class PresignProductFileUploadView(APIView):
    """
    Hand a seller a short-lived presigned R2 URL so the browser can upload a
    product file directly to Cloudflare — bypassing the Vercel 4.5MB proxy
    limit. Returns 503 when R2 isn't configured so the frontend falls back to a
    normal multipart upload (local dev / small files).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not _r2_configured():
            return Response({'detail': 'Direct upload is not available.'}, status=503)

        if getattr(request.user, 'user_type', None) != 'seller':
            return Response({'detail': 'Only sellers can upload product files.'}, status=403)

        filename = (request.data.get('filename') or '').strip()
        product_type = (request.data.get('product_type') or '').strip()
        if not filename:
            return Response({'detail': 'filename is required.'}, status=400)

        allowed = get_allowed_extensions_for_type(product_type)
        if allowed:
            ext = '.' + filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
            if ext not in allowed:
                return Response(
                    {'detail': f"This product type accepts: {', '.join(allowed)}"},
                    status=400,
                )

        key = build_file_key(request.user.id, filename)
        url = generate_presigned_put(key)
        return Response({'url': url, 'key': key})


class ProductListView(generics.ListAPIView):
    serializer_class = ProductSerializer
    permission_classes = [permissions.AllowAny]
    queryset = Product.objects.all()
    pagination_class = StandardResultsPagination

    # Sorting happens here rather than in the browser. With pagination the
    # client only holds one page, so sorting client-side would only order that
    # page — "cheapest first" would show the cheapest of page 3, not overall.
    ORDERING = {
        'newest': '-created_at',
        'oldest': 'created_at',
        'price_asc': 'price',
        'price_desc': '-price',
        'title': 'title',
    }

    @performance_monitor('get_product_list')
    def get_queryset(self):
        queryset = (
            Product.objects
            # Drafts are the seller's private work in progress — they must
            # never appear in public browse.
            .filter(is_published=True)
            .select_related('owner', 'ticket_category')
            .prefetch_related('ticket_tiers')
            # Aggregate here rather than per-row in the serializer, so a page
            # of 24 products costs one query instead of 48.
            .annotate(avg_rating=Avg('reviews__rating'), num_reviews=Count('reviews', distinct=True))
        )
        product_type = self.request.query_params.get('product_type', None)
        ticket_category = self.request.query_params.get('ticket_category', None)
        search = self.request.query_params.get('search', None)
        ordering = self.request.query_params.get('ordering', 'newest')

        if product_type:
            queryset = queryset.filter(product_type=product_type)
        if ticket_category:
            queryset = queryset.filter(ticket_category_id=ticket_category)
        if search:
            from django.db.models import Q
            queryset = queryset.filter(
                Q(title__icontains=search) |
                Q(description__icontains=search) |
                Q(owner__brand_name__icontains=search)
            )

        # A deterministic order is required, not just nice to have: without it
        # the database can return rows in any order and the same product can
        # appear on two pages while another is never shown. `id` breaks ties.
        return queryset.order_by(self.ORDERING.get(ordering, '-created_at'), '-id')

class PublicProductDetailView(generics.RetrieveAPIView):
    serializer_class = ProductSerializer
    permission_classes = [permissions.AllowAny]
    queryset = Product.objects.all()

    @cache_product_data
    @performance_monitor('get_product_detail')
    def get_queryset(self):
        return Product.objects.select_related('owner', 'ticket_category').prefetch_related('ticket_tiers')

    def get_object(self):
        # The URL segment can be a slug (great-ebook) or a numeric id — resolve
        # either, so slug links and any old /products/<id> links both work.
        from django.shortcuts import get_object_or_404
        from django.http import Http404
        identifier = str(self.kwargs.get('identifier', ''))
        queryset = self.get_queryset()
        lookup = {'pk': identifier} if identifier.isdigit() else {'slug': identifier}
        obj = get_object_or_404(queryset, **lookup)

        # A draft is visible only to the seller who owns it, so they can
        # preview the real page before publishing. To everyone else an
        # unpublished product does not exist — 404 rather than 403, so the URL
        # doesn't confirm that a hidden listing is sitting there.
        if not obj.is_published:
            user = self.request.user
            if not (user.is_authenticated and obj.owner_id == user.id):
                raise Http404('No Product matches the given query.')

        self.check_object_permissions(self.request, obj)
        return obj

class SellerOrdersView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PurchaseSerializer

    def get_queryset(self):
        # Get purchases of products owned by the current user
        return Purchase.objects.filter(
            product__owner=self.request.user,
            payment__status='success'
        ).select_related(
            'product', 'payment__user'
        ).order_by('-created_at')

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        data = serializer.data
        
        # Add customer information to each purchase
        for item in data:
            purchase = queryset.filter(id=item['id']).first()
            if purchase:
                item['customer'] = {
                    'email': purchase.payment.user.email,
                    'name': purchase.payment.user.first_name or purchase.payment.user.email.split('@')[0],
                    'id': purchase.payment.user.id
                }
                item['payment_reference'] = purchase.payment.reference
                item['payment_status'] = purchase.payment.status
        
        return Response(data)

class SellerAnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        time_range = request.query_params.get('time_range', '7d')
        
        # Calculate date range
        end_date = timezone.now()
        if time_range == '7d':
            start_date = end_date - timedelta(days=7)
        elif time_range == '30d':
            start_date = end_date - timedelta(days=30)
        elif time_range == '90d':
            start_date = end_date - timedelta(days=90)
        elif time_range == '1y':
            start_date = end_date - timedelta(days=365)
        else:
            start_date = end_date - timedelta(days=7)

        # Get user's products
        user_products = Product.objects.filter(owner=user)
        total_products = user_products.count()

        # Get successful purchases of user's products
        successful_purchases = Purchase.objects.filter(
            product__owner=user,
            payment__status='success',
            created_at__range=[start_date, end_date]
        )

        # Calculate metrics
        total_orders = successful_purchases.count()
        total_revenue = successful_purchases.aggregate(
            total=Sum('total_price')
        )['total'] or 0

        # Get unique customers
        unique_customers = successful_purchases.values('payment__user').distinct().count()

        # Calculate previous period for growth comparison
        period_days = (end_date - start_date).days
        prev_start_date = start_date - timedelta(days=period_days)
        prev_end_date = start_date

        prev_purchases = Purchase.objects.filter(
            product__owner=user,
            payment__status='success',
            created_at__range=[prev_start_date, prev_end_date]
        )

        prev_orders = prev_purchases.count()
        prev_revenue = prev_purchases.aggregate(
            total=Sum('total_price')
        )['total'] or 0

        # Calculate growth percentages
        orders_growth = 0
        if prev_orders > 0:
            orders_growth = round(((total_orders - prev_orders) / prev_orders) * 100, 1)

        revenue_growth = 0
        if prev_revenue > 0:
            revenue_growth = round(((total_revenue - prev_revenue) / prev_revenue) * 100, 1)

        # Calculate average order value
        avg_order_value = 0
        if total_orders > 0:
            avg_order_value = total_revenue / total_orders

        # Store-wide rating across everything this seller has listed.
        #
        # Deliberately NOT scoped to the selected period like the sales
        # metrics above: a rating is a reputation figure, and someone who
        # earned 4.8 over a year should not see it collapse to "no rating"
        # because nobody happened to review in the last 7 days.
        rating_summary = Review.objects.filter(product__owner=user).aggregate(
            avg=Avg('rating'), total=Count('id')
        )
        avg_rating = round(rating_summary['avg'], 2) if rating_summary['avg'] is not None else None
        review_count = rating_summary['total']

        # Get top performing products
        top_products = successful_purchases.values(
            'product__title'
        ).annotate(
            sales=Count('id'),
            revenue=Sum('total_price')
        ).order_by('-revenue')[:5]

        # Format top products data
        top_products_data = []
        for product in top_products:
            top_products_data.append({
                'name': product['product__title'],
                'sales': product['sales'],
                'revenue': float(product['revenue']),
                'growth': 0  # Could be calculated with more complex logic
            })

        # Get daily revenue data for charts (last 7 days)
        daily_revenue = successful_purchases.filter(
            created_at__gte=end_date - timedelta(days=7)
        ).annotate(
            date=TruncDate('created_at')
        ).values('date').annotate(
            daily_revenue=Sum('total_price')
        ).order_by('date')

        # Get customer demographics (basic)
        customer_countries = successful_purchases.values(
            'payment__ip_address'
        ).distinct().count()

        return Response({
            "total_products": total_products,
            "total_revenue": float(total_revenue),
            "total_orders": total_orders,
            "total_customers": unique_customers,
            "avg_order_value": float(avg_order_value),
            "orders_growth": orders_growth,
            "revenue_growth": revenue_growth,
            "customers_growth": 0,  # Could be calculated with more complex logic
            "products_growth": 0,   # Could be calculated with more complex logic
            "conversion_rate": 0,   # Would need view/download data
            "avg_session_duration": 0,  # Would need analytics integration
            "return_rate": 0,       # Would need return/refund data
            # None, not 0, when nothing is rated yet — "no reviews" and
            # "rated zero" have to stay distinguishable to the dashboard.
            "avg_rating": avg_rating,
            "review_count": review_count,
            "top_country": "Nigeria",  # Default for now
            "top_products": top_products_data,
            "daily_revenue": [
                {
                    'date': item['date'].strftime('%Y-%m-%d'),
                    'revenue': float(item['daily_revenue'])
                } for item in daily_revenue
            ],
            "customer_countries": customer_countries,
            # Additional metrics
            "total_views": 0,       # Would need analytics integration
            "total_downloads": total_orders,  # Assuming each order = 1 download
            "views_growth": 0,
            "downloads_growth": orders_growth,
            "conversion_growth": 0,
            "aov_growth": 0,
        })


def _resolve_product(identifier, *, published_only=True):
    """Look a product up by slug or numeric id, the same way the detail page does."""
    from django.shortcuts import get_object_or_404
    identifier = str(identifier)
    lookup = {'pk': identifier} if identifier.isdigit() else {'slug': identifier}
    if published_only:
        lookup['is_published'] = True
    return get_object_or_404(Product, **lookup)


class ProductReviewListCreateView(APIView):
    """
    GET  — public list of a product's reviews, newest first.
    POST — create or update the caller's own review.

    POST is an upsert rather than a plain create: the model allows one review
    per person per product, so a second POST from the same buyer edits what
    they already wrote instead of failing on the unique constraint.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, identifier):
        product = _resolve_product(identifier)
        reviews = product.reviews.select_related('user')
        summary = reviews.aggregate(avg=Avg('rating'), total=Count('id'))
        page = paginate_list(
            request,
            reviews,
            serialize=lambda r: ReviewSerializer(r, context={'request': request}).data,
            default_page_size=10,
        )
        page['average_rating'] = round(summary['avg'], 2) if summary['avg'] is not None else None
        page['review_count'] = summary['total']
        page['can_review'] = Review.can_be_reviewed_by(request.user, product)
        page['has_reviewed'] = bool(
            request.user.is_authenticated
            and reviews.filter(user=request.user).exists()
        )
        return Response(page)

    def post(self, request, identifier):
        if not request.user.is_authenticated:
            return Response(
                {'message': 'Sign in to leave a review.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        product = _resolve_product(identifier)

        # A seller reviewing their own listing would be self-dealing.
        if product.owner_id == request.user.id:
            return Response(
                {'message': 'You cannot review your own product.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Only people who actually bought it. Checked server-side against
        # successful payments — the client cannot assert this.
        if not Review.can_be_reviewed_by(request.user, product):
            return Response(
                {'message': 'You can only review a product you have purchased.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        existing = Review.objects.filter(product=product, user=request.user).first()
        serializer = ReviewSerializer(
            existing, data=request.data, partial=bool(existing),
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(product=product, user=request.user)
        CacheManager.invalidate_product_cache(product.id)
        return Response(
            serializer.data,
            status=status.HTTP_200_OK if existing else status.HTTP_201_CREATED,
        )


class ProductReviewDeleteView(APIView):
    """Delete the caller's own review."""
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, identifier):
        product = _resolve_product(identifier)
        deleted, _ = Review.objects.filter(product=product, user=request.user).delete()
        if not deleted:
            return Response(
                {'message': 'You have not reviewed this product.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        CacheManager.invalidate_product_cache(product.id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProductPublishToggleView(APIView):
    """Publish or unpublish one of the caller's own products."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        from django.shortcuts import get_object_or_404
        # Scoped to the caller's own products, so this can never flip
        # someone else's listing.
        product = get_object_or_404(Product, pk=pk, owner=request.user)

        requested = request.data.get('is_published')
        if requested is None:
            product.is_published = not product.is_published
        else:
            product.is_published = str(requested).lower() in ('1', 'true', 'yes')

        product.save(update_fields=['is_published'])
        CacheManager.invalidate_product_cache(product.id)
        return Response({
            'id': product.id,
            'is_published': product.is_published,
        })


def _seller_coupon_queryset(user):
    """
    The seller's own coupons, annotated with how many times each has
    actually been redeemed (a successful purchase carrying it) and how much
    revenue those redemptions brought in — so the Discounts screen doesn't
    issue a query per row.
    """
    return Coupon.objects.filter(seller=user).annotate(
        redemptions=Count(
            'purchases', filter=Q(purchases__payment__status=Payment.PaymentStatus.SUCCESS), distinct=True
        ),
        revenue=Sum(
            'purchases__total_price', filter=Q(purchases__payment__status=Payment.PaymentStatus.SUCCESS)
        ),
    ).prefetch_related('products')


class SellerCouponListCreateView(generics.ListCreateAPIView):
    """A seller's own discount codes — list and create."""
    serializer_class = CouponSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return _seller_coupon_queryset(self.request.user)


class SellerCouponDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Edit, toggle, or remove one of the caller's own coupons."""
    serializer_class = CouponSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return _seller_coupon_queryset(self.request.user)
