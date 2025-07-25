from django.urls import path
from .views import (
    SellerProductListCreateView, ProductDetailView, 
    SellerAnalyticsView, ProductListView, PublicProductDetailView
)

urlpatterns = [
    path('', ProductListView.as_view(), name='all-products'),
    path('<int:pk>/', PublicProductDetailView.as_view(), name='public-product-detail'),
    path('my-products/', SellerProductListCreateView.as_view(), name='seller-products'),
    path('my-products/<int:pk>/', ProductDetailView.as_view(), name='product-detail'),
    path('analytics/', SellerAnalyticsView.as_view(), name='seller-analytics'),
]
