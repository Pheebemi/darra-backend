from django.shortcuts import render
from rest_framework import generics, permissions
from .models import Product
from .serializers import ProductSerializer
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Sum, Count, Q
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.utils import timezone
from datetime import timedelta
from apps.payments.models import Payment, Purchase
from django.db.models.functions import TruncDate
from apps.payments.serializers import PurchaseSerializer

# Create your views here.

class SellerProductListCreateView(generics.ListCreateAPIView):
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Product.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

class ProductDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Product.objects.filter(owner=self.request.user)

class ProductListView(generics.ListAPIView):
    serializer_class = ProductSerializer
    permission_classes = [permissions.AllowAny]
    queryset = Product.objects.all()

class PublicProductDetailView(generics.RetrieveAPIView):
    serializer_class = ProductSerializer
    permission_classes = [permissions.AllowAny]
    queryset = Product.objects.all()

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
