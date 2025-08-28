from django.urls import path
from .views import (
    SellerProductListCreateView, ProductDetailView, 
    SellerAnalyticsView, ProductListView, PublicProductDetailView,
    SellerOrdersView, TicketCategoryListView, TicketTierListView,
    TicketTierCreateView
)

urlpatterns = [
    path('', ProductListView.as_view(), name='all-products'),
    path('<int:pk>/', PublicProductDetailView.as_view(), name='public-product-detail'),
    path('my-products/', SellerProductListCreateView.as_view(), name='seller-products'),
    path('my-products/<int:pk>/', ProductDetailView.as_view(), name='product-detail'),
    path('analytics/', SellerAnalyticsView.as_view(), name='seller-analytics'),
    path('orders/', SellerOrdersView.as_view(), name='seller-orders'),
    
    # Ticket system endpoints
    path('ticket-categories/', TicketCategoryListView.as_view(), name='ticket-categories'),
    path('ticket-tiers/', TicketTierListView.as_view(), name='ticket-tiers'),
    path('ticket-tiers/<int:category_id>/', TicketTierListView.as_view(), name='ticket-tiers-by-category'),
    path('ticket-tiers/create/', TicketTierCreateView.as_view(), name='create-ticket-tier'),
]
