from django.urls import path
from .views import (
    SellerProductListCreateView, ProductDetailView,
    SellerAnalyticsView, ProductListView, PublicProductDetailView,
    SellerOrdersView, TicketCategoryListView, TicketTierListView,
    TicketTierCreateView, PresignProductFileUploadView,
    GenerateProductDescriptionView, ProductReviewListCreateView,
    ProductReviewDeleteView, ProductPublishToggleView,
    SellerCouponListCreateView, SellerCouponDetailView,
)

urlpatterns = [
    path('', ProductListView.as_view(), name='all-products'),
    path('my-products/', SellerProductListCreateView.as_view(), name='seller-products'),
    path(
        'my-products/generate-description/',
        GenerateProductDescriptionView.as_view(),
        name='generate-product-description',
    ),
    path('my-products/<int:pk>/', ProductDetailView.as_view(), name='product-detail'),
    path(
        'my-products/<int:pk>/publish/',
        ProductPublishToggleView.as_view(),
        name='product-publish-toggle',
    ),
    path('upload/presign/', PresignProductFileUploadView.as_view(), name='presign-upload'),
    path('analytics/', SellerAnalyticsView.as_view(), name='seller-analytics'),
    path('orders/', SellerOrdersView.as_view(), name='seller-orders'),

    # Seller discount codes
    path('coupons/', SellerCouponListCreateView.as_view(), name='seller-coupons'),
    path('coupons/<int:pk>/', SellerCouponDetailView.as_view(), name='seller-coupon-detail'),

    # Ticket system endpoints
    path('ticket-categories/', TicketCategoryListView.as_view(), name='ticket-categories'),
    path('ticket-tiers/', TicketTierListView.as_view(), name='ticket-tiers'),
    path('ticket-tiers/<int:category_id>/', TicketTierListView.as_view(), name='ticket-tiers-by-category'),
    path('ticket-tiers/create/', TicketTierCreateView.as_view(), name='create-ticket-tier'),

    # Reviews. These sit above the catch-all below but are still more specific
    # than it, because the trailing segment pins them to /reviews/.
    path(
        '<slug:identifier>/reviews/',
        ProductReviewListCreateView.as_view(),
        name='product-reviews',
    ),
    path(
        '<slug:identifier>/reviews/mine/',
        ProductReviewDeleteView.as_view(),
        name='product-review-delete',
    ),

    # Public product detail by slug or numeric id. MUST stay last — it is a
    # catch-all, so every specific route above is matched first.
    path('<slug:identifier>/', PublicProductDetailView.as_view(), name='public-product-detail'),
]
