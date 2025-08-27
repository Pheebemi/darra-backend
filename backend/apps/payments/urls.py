from django.urls import path
from .views import (
    CheckoutView,
    verify_payment,
    get_user_library,
    PaymentHistoryView,
    payment_status,
    payment_webhook,
    debug_checkout,
    test_connection,
    test_flutterwave_connection,
    seller_earnings,
    seller_commissions,
    seller_payouts,
    request_payout,
    seller_analytics
)

urlpatterns = [
    path('checkout/', CheckoutView.as_view(), name='checkout'),
    path('debug-checkout/', debug_checkout, name='debug_checkout'),
    path('test-connection/', test_connection, name='test_connection'),
    path('test-flutterwave/', test_flutterwave_connection, name='test_flutterwave_connection'),
    path('verify/<str:reference>/', verify_payment, name='verify_payment'),
    path('library/', get_user_library, name='user_library'),
    path('history/', PaymentHistoryView.as_view(), name='payment_history'),
    path('status/<str:reference>/', payment_status, name='payment_status'),
    path('webhook/', payment_webhook, name='payment_webhook'),
    
    # Seller earnings and payouts
    path('seller/earnings/', seller_earnings, name='seller_earnings'),
    path('seller/commissions/', seller_commissions, name='seller_commissions'),
    path('seller/payouts/', seller_payouts, name='seller_payouts'),
    path('seller/request-payout/', request_payout, name='request_payout'),
    path('seller/analytics/', seller_analytics, name='seller_analytics'),
] 