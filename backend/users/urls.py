from django.urls import path
from .views import (
    RegisterView,
    VerifyOTPView,
    LoginView,
    RequestOTPView,
    PasswordResetRequestView,
    PasswordResetConfirmView,
    UserProfileView,
    UpdatePasswordView,
    check_brand_name,
    BankDetailView
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('verify-otp/', VerifyOTPView.as_view(), name='verify-otp'),
    path('login/', LoginView.as_view(), name='login'),
    path('request-otp/', RequestOTPView.as_view(), name='request-otp'),
    path('password-reset/', PasswordResetRequestView.as_view(), name='password-reset-request'),
    path('password-reset/<str:uidb64>/<str:token>/', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
    path('profile/', UserProfileView.as_view(), name='user-profile'),
    path('update-password/', UpdatePasswordView.as_view(), name='update-password'),
    path('check-brand-name/', check_brand_name, name='check-brand-name'),
]

urlpatterns += [
    path('bank-detail/', BankDetailView.as_view(), name='bank-detail'),
]