from django.shortcuts import render
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
import random
import string
from .serializers import (
    UserRegistrationSerializer,
    UserLoginSerializer,
    OTPVerificationSerializer,
    OTPLoginSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
    UserProfileSerializer,
    UpdatePasswordSerializer
)
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.contrib.auth.tokens import default_token_generator
from .utils import send_otp_email, send_password_reset_email
from rest_framework.decorators import api_view, permission_classes
from django.utils.text import slugify
import requests
from .models import BankDetail
from .serializers import BankDetailSerializer

User = get_user_model()

def generate_otp():
    return ''.join(random.choices(string.digits, k=6))

class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            
            # Generate and save OTP
            otp = generate_otp()
            user.otp = otp
            user.otp_created_at = timezone.now()
            user.save()

            # Send OTP via email
            try:
                send_otp_email(user.email, otp, is_verification=True)
            except Exception as e:
                # Log the error but don't expose it to the user
                print(f"Failed to send email: {str(e)}")

            return Response({
                "message": "Registration successful. Please verify your email.",
                "email": user.email
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class VerifyOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = OTPVerificationSerializer(data=request.data)
        if serializer.is_valid():
            try:
                user = User.objects.get(email=serializer.validated_data['email'])
                
                # Check if OTP is expired (10 minutes validity)
                if user.otp_created_at and timezone.now() > user.otp_created_at + timedelta(minutes=10):
                    return Response({
                        "message": "OTP has expired. Please request a new one."
                    }, status=status.HTTP_400_BAD_REQUEST)

                if user.otp == serializer.validated_data['otp']:
                    user.is_verified = True
                    user.otp = ''  # Clear OTP after successful verification
                    user.save()

                    # Generate tokens
                    refresh = RefreshToken.for_user(user)
                    
                    return Response({
                        "message": "Email verified successfully.",
                        "tokens": {
                            "refresh": str(refresh),
                            "access": str(refresh.access_token)
                        }
                    })
                return Response({
                    "message": "Invalid OTP."
                }, status=status.HTTP_400_BAD_REQUEST)
            except User.DoesNotExist:
                return Response({
                    "message": "User not found."
                }, status=status.HTTP_404_NOT_FOUND)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = UserLoginSerializer(data=request.data)
        if serializer.is_valid():
            try:
                user = User.objects.get(email=serializer.validated_data['email'])
                if not user.is_verified:
                    return Response({
                        "message": "Please verify your email first."
                    }, status=status.HTTP_400_BAD_REQUEST)

                if user.check_password(serializer.validated_data['password']):
                    refresh = RefreshToken.for_user(user)
                    return Response({
                        "tokens": {
                            "refresh": str(refresh),
                            "access": str(refresh.access_token)
                        },
                        "user": {
                            "email": user.email,
                            "full_name": user.full_name,
                            "user_type": user.user_type,
                            "brand_name": user.brand_name if user.user_type == 'seller' else None
                        }
                    })
                return Response({
                    "message": "Invalid credentials."
                }, status=status.HTTP_400_BAD_REQUEST)
            except User.DoesNotExist:
                return Response({
                    "message": "User not found."
                }, status=status.HTTP_404_NOT_FOUND)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class RequestOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = OTPLoginSerializer(data=request.data)
        if serializer.is_valid():
            try:
                user = User.objects.get(email=serializer.validated_data['email'])
                
                # Generate and save new OTP
                otp = generate_otp()
                user.otp = otp
                user.otp_created_at = timezone.now()
                user.save()

                # Send OTP via email
                try:
                    send_otp_email(user.email, otp, is_verification=False)
                except Exception as e:
                    # Log the error but don't expose it to the user
                    print(f"Failed to send email: {str(e)}")

                return Response({
                    "message": "OTP sent successfully.",
                    "email": user.email
                })
            except User.DoesNotExist:
                return Response({
                    "message": "User not found."
                }, status=status.HTTP_404_NOT_FOUND)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            try:
                user = User.objects.get(email=email)
                # Generate password reset token
                token = default_token_generator.make_token(user)
                
                uid = urlsafe_base64_encode(force_bytes(user.pk))
                
                # Update the reset URL to match your URL pattern
                reset_url = f"http://127.0.0.1:8000/api/auth/reset-password-confirm/{uid}/{token}/"
                
                # Send password reset email
                send_password_reset_email(email, reset_url)
                
                return Response({
                    "message": "Password reset instructions sent to your email."
                })
            except User.DoesNotExist:
                # Return success even if user doesn't exist (security)
                return Response({
                    "message": "If an account exists with this email, you will receive password reset instructions."
                })
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request, uidb64, token):
        try:
            # Decode the user ID
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
            
            # Verify the token
            if default_token_generator.check_token(user, token):
                serializer = PasswordResetConfirmSerializer(data=request.data)
                if serializer.is_valid():
                    # Set new password
                    user.set_password(serializer.validated_data['password'])
                    user.save()
                    return Response({
                        "message": "Password reset successful."
                    })
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            else:
                return Response({
                    "message": "Invalid or expired reset link."
                }, status=status.HTTP_400_BAD_REQUEST)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({
                "message": "Invalid reset link."
            }, status=status.HTTP_400_BAD_REQUEST)

class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserProfileSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        serializer = UserProfileSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class UpdatePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = UpdatePasswordSerializer(data=request.data)
        if serializer.is_valid():
            user = request.user
            if user.check_password(serializer.validated_data['old_password']):
                # Update password
                user.set_password(serializer.validated_data['new_password'])
                user.save()

                # Blacklist all outstanding tokens for the user
                try:
                    tokens = OutstandingToken.objects.filter(user_id=user.id)
                    for token in tokens:
                        BlacklistedToken.objects.get_or_create(token=token)
                except Exception as e:
                    # If token blacklisting fails, continue anyway
                    print(f"Warning: Could not blacklist tokens: {e}")

                return Response({
                    "message": "Password updated successfully. Please login again."
                })
            return Response({
                "old_password": ["Current password is incorrect."]
            }, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class BankDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Return all bank accounts for the user
        try:
            account = BankDetail.objects.get(user=request.user)
            serializer = BankDetailSerializer(account)
            # Return as array since frontend expects multiple accounts
            return Response([serializer.data])
        except BankDetail.DoesNotExist:
            # Return empty array if no bank account exists
            return Response([])

    def post(self, request):
        bank_code = request.data.get('bank_code')
        account_number = request.data.get('account_number')
        bank_name = request.data.get('bank_name')

        # Validate with Paystack
        from django.conf import settings
        headers = {
            'Authorization': f'Bearer {settings.PAYSTACK_SECRET_KEY}',
        }
        url = f'https://api.paystack.co/bank/resolve?account_number={account_number}&bank_code={bank_code}'
        resp = requests.get(url, headers=headers)
        data = resp.json()

        if not data.get('status'):
            return Response({'status': False, 'message': data.get('message', 'Validation failed')}, status=400)

        account_name = data['data']['account_name']

        # Save or update bank details
        bank_detail, created = BankDetail.objects.update_or_create(
            user=request.user,
            defaults={
                'bank_code': bank_code,
                'bank_name': bank_name,
                'account_number': account_number,
                'account_name': account_name,
            }
        )
        serializer = BankDetailSerializer(bank_detail)
        return Response({'status': True, 'account_name': account_name, 'data': serializer.data})

    def delete(self, request, pk=None):
        try:
            account = BankDetail.objects.get(pk=pk, user=request.user)
            account.delete()
            return Response({'success': True})
        except BankDetail.DoesNotExist:
            return Response({'error': 'Bank account not found'}, status=404)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def check_brand_name(request):
    brand_name = request.GET.get('brand_name', '').strip()
    slug = slugify(brand_name)
    user = request.user
    exists = User.objects.filter(brand_slug=slug).exclude(id=user.id).exists()
    return Response({'available': not exists})
