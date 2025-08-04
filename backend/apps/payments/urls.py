from django.urls import path
from . import views

app_name = 'payments'

urlpatterns = [
    path('checkout/', views.CheckoutView.as_view(), name='checkout'),
    path('verify/<str:reference>/', views.verify_payment, name='verify_payment'),
    path('status/<str:reference>/', views.payment_status, name='payment_status'),
    path('webhook/', views.paystack_webhook, name='paystack_webhook'),
    path('library/', views.UserLibraryView.as_view(), name='user_library'),
    path('history/', views.PaymentHistoryView.as_view(), name='payment_history'),
] 