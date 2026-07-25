from django.shortcuts import render
from rest_framework import generics, permissions, status
from .models import Product, TicketCategory, TicketTier
from .serializers import (
    ProductSerializer, ProductCreateSerializer, ProductUpdateSerializer,
    TicketCategorySerializer, TicketTierSerializer
)
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Sum, Count, Q
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from datetime import timedelta
from apps.payments.models import Payment, Purchase
from django.db.models.functions import TruncDate
from apps.payments.serializers import PurchaseSerializer
from .file_validation import validate_uploaded_file, validate_cover_image, ALLOWED_FILE_TYPES
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError as DRFValidationError
from core.pagination import StandardResultsPagination
from core.cache_utils import (
    cache_product_list, cache_product_data, cache_user_data, 
    performance_monitor, CacheManager
)
from django.core.cache import cache
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
    
    def post(self, request, *args, **kwargs):
        print(f"🔍 DEBUG: POST request received to /products/my-products/")
        print(f"🔍 DEBUG: Request method: {request.method}")
        print(f"🔍 DEBUG: Request user: {request.user}")
        print(f"🔍 DEBUG: Request files: {list(request.FILES.keys())}")
        print(f"🔍 DEBUG: Request data keys: {list(request.data.keys())}")
        return super().post(request, *args, **kwargs)

    def perform_create(self, serializer):
        # Check if this is a duplicate request by looking for similar products
        title = serializer.validated_data.get('title')
        product_type = serializer.validated_data.get('product_type')
        
        print(f"🔍 DEBUG: Starting product creation for {title} (type: {product_type})")
        print(f"🔍 DEBUG: Request files: {list(self.request.FILES.keys())}")
        
        # Look for recent duplicate products (within last 5 minutes)
        recent_duplicate = Product.objects.filter(
            owner=self.request.user,
            title=title,
            product_type=product_type,
            created_at__gte=timezone.now() - timedelta(minutes=5)
        ).first()
        
        if recent_duplicate:
            print(f"⚠️ Duplicate product creation detected: {title}")
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

            if 'file' in self.request.FILES:
                product_file = self.request.FILES['file']
                validate_uploaded_file(product_file, product.product_type)
                product.file = product_file
                product.save()
        except DjangoValidationError as e:
            product.delete()
            raise DRFValidationError({'detail': e.messages})

        return product

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

            if 'file' in self.request.FILES:
                product_file = self.request.FILES['file']
                validate_uploaded_file(product_file, product.product_type)
                product.file = product_file
                product.save()
        except DjangoValidationError as e:
            raise DRFValidationError({'detail': e.messages})

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
        queryset = Product.objects.select_related('owner', 'ticket_category').prefetch_related('ticket_tiers')
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
            "avg_rating": 0,        # Would need rating system
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
