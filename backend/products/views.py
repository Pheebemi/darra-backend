from django.shortcuts import render
from rest_framework import generics, permissions
from .models import Product
from .serializers import ProductSerializer
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Sum, Count
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

# Create your views here.

class SellerProductListCreateView(generics.ListCreateAPIView):
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Product.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

class PublicProductDetailView(generics.RetrieveAPIView):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [permissions.AllowAny]

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        data = serializer.data
        # Add seller info
        data['seller_name'] = instance.owner.brand_name if instance.owner.user_type == 'seller' else None
        data['seller_id'] = instance.owner.id
        return Response(data)

class ProductDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Product.objects.filter(owner=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        data = serializer.data
        data['seller_name'] = instance.owner.brand_name
        data['seller_id'] = instance.owner.id
        return Response(data)

class SellerAnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        products = Product.objects.filter(owner=user)
        total_products = products.count()
        total_revenue = products.aggregate(total=Sum('price'))['total'] or 0
        total_downloads = 156  # Replace with real download logic if available
        total_views = 2400     # Replace with real view logic if available

        # Example: sales growth (static for now)
        sales_growth = 23

        return Response({
            "total_products": total_products,
            "total_revenue": float(total_revenue),
            "total_downloads": total_downloads,
            "total_views": total_views,
            "sales_growth": sales_growth,
        })

class ProductListView(generics.ListAPIView):
    queryset = Product.objects.all().order_by('-created_at')
    serializer_class = ProductSerializer
    permission_classes = [permissions.AllowAny]
