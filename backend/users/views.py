from django.shortcuts import render
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
import secrets  # Cryptographically secure random
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
from rest_framework.throttling import AnonRateThrottle
from django.contrib.auth import authenticate
from django.conf import settings
from django.db.models import Count, Q
from core.pagination import paginate_list
from core.throttling import AuthenticationRateThrottle  # Import custom rate limiting
from .otp_security import (
    generate_secure_otp,
    validate_otp_timing,
    check_otp_cooldown,
    sanitize_otp_input,
    log_otp_attempt
)

User = get_user_model()

def generate_otp():
    """
    Generate cryptographically secure 6-digit OTP
    Uses secrets.token_hex() for true randomness
    """
    return generate_secure_otp()

class RegisterView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AuthenticationRateThrottle]  # Rate limit registration

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
        
        # Return more detailed error messages
        error_messages = []
        for field, errors in serializer.errors.items():
            if isinstance(errors, list):
                for error in errors:
                    error_messages.append(f"{field}: {error}")
            else:
                error_messages.append(f"{field}: {errors}")
        
        return Response({
            "message": "Invalid signup details",
            "errors": error_messages,
            "details": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

class VerifyOTPView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AuthenticationRateThrottle]  # Rate limit OTP verification

    def post(self, request):
        serializer = OTPVerificationSerializer(data=request.data)
        if serializer.is_valid():
            try:
                user = User.objects.get(email=serializer.validated_data['email'])
                
                # Enhanced security: Validate OTP timing using utility function
                timing_ok, timing_message = validate_otp_timing(user.otp_created_at, max_age_minutes=10)
                if not timing_ok:
                    return Response({
                        "message": timing_message
                    }, status=status.HTTP_400_BAD_REQUEST)

                # Check if OTP exists
                if not user.otp:
                    log_otp_attempt(user.email, False, request.META.get('REMOTE_ADDR'))
                    return Response({
                        "message": "No OTP found. Please request a new one."
                    }, status=status.HTTP_400_BAD_REQUEST)

                # Sanitize OTP input
                sanitized_otp = sanitize_otp_input(serializer.validated_data['otp'])
                if not sanitized_otp:
                    log_otp_attempt(user.email, False, request.META.get('REMOTE_ADDR'))
                    return Response({
                        "message": "Invalid OTP format. Please enter 6 digits."
                    }, status=status.HTTP_400_BAD_REQUEST)

                if user.otp == sanitized_otp:
                    # Successful verification
                    user.is_verified = True
                    user.otp = ''  # Clear OTP after successful verification
                    user.otp_created_at = None  # Clear OTP timestamp
                    user.save()

                    # Log successful verification
                    log_otp_attempt(user.email, True, request.META.get('REMOTE_ADDR'))

                    # Generate tokens
                    refresh = RefreshToken.for_user(user)
                    
                    return Response({
                        "message": "Email verified successfully.",
                        "tokens": {
                            "refresh": str(refresh),
                            "access": str(refresh.access_token)
                        }
                    })
                else:
                    # Wrong code: do NOT clear the OTP. Clearing on a single
                    # typo forced a full resend + 2-min cooldown, which is a big
                    # part of how users got stuck. The 10-minute expiry plus the
                    # auth rate limit already make a 6-digit code impractical to
                    # brute force, so let them simply try again.
                    log_otp_attempt(user.email, False, request.META.get('REMOTE_ADDR'))

                    return Response({
                        "message": "Incorrect code. Please check and try again."
                    }, status=status.HTTP_400_BAD_REQUEST)
            except User.DoesNotExist:
                return Response({
                    "message": "User not found."
                }, status=status.HTTP_404_NOT_FOUND)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AuthenticationRateThrottle]  # Rate limit login attempts

    def post(self, request):
        serializer = UserLoginSerializer(data=request.data)
        if serializer.is_valid():
            try:
                user = User.objects.get(email=serializer.validated_data['email'])
                if not user.is_verified:
                    # Recovery path: an unverified user who closed the OTP page
                    # would otherwise be stuck forever (can't re-register — email
                    # taken; can't log in — not verified). Resend a fresh OTP
                    # (respecting the cooldown so we don't spam) and tell the
                    # frontend to route them to the verification page.
                    cooldown_ok, _ = check_otp_cooldown(user.otp_created_at, cooldown_minutes=2)
                    if cooldown_ok:
                        otp = generate_otp()
                        user.otp = otp
                        user.otp_created_at = timezone.now()
                        user.save()
                        try:
                            send_otp_email(user.email, otp, is_verification=True)
                        except Exception as e:
                            print(f"Failed to send verification email: {str(e)}")
                    return Response({
                        "message": "Your email isn't verified yet. We've sent you a verification code.",
                        "needs_verification": True,
                        "email": user.email,
                    }, status=status.HTTP_403_FORBIDDEN)

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
    throttle_classes = [AuthenticationRateThrottle]  # Rate limit OTP requests

    def post(self, request):
        serializer = OTPLoginSerializer(data=request.data)
        if serializer.is_valid():
            try:
                user = User.objects.get(email=serializer.validated_data['email'])
                
                # Enhanced security: Check OTP cooldown using utility function
                cooldown_ok, remaining_seconds = check_otp_cooldown(user.otp_created_at, cooldown_minutes=2)
                if not cooldown_ok:
                    return Response({
                        "message": f"Please wait {remaining_seconds} seconds before requesting another OTP."
                    }, status=status.HTTP_429_TOO_MANY_REQUESTS)
                
                # Generate and save new OTP
                otp = generate_otp()
                user.otp = otp
                user.otp_created_at = timezone.now()
                user.save()

                # Send OTP via email
                try:
                    send_otp_email(user.email, otp, is_verification=False)
                    # Log successful OTP generation
                    log_otp_attempt(user.email, True, request.META.get('REMOTE_ADDR'))
                except Exception as e:
                    # Log the error but don't expose it to the user
                    print(f"Failed to send email: {str(e)}")
                    log_otp_attempt(user.email, False, request.META.get('REMOTE_ADDR'))

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
    throttle_classes = [AuthenticationRateThrottle]

    # Same response whether or not the address exists, so this endpoint can't
    # be used to discover which emails have accounts.
    GENERIC_RESPONSE = (
        "If an account exists with this email, you will receive password "
        "reset instructions shortly."
    )

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        if serializer.is_valid():
            email = serializer.validated_data['email']
            try:
                user = User.objects.get(email=email)
                token = default_token_generator.make_token(user)
                uid = urlsafe_base64_encode(force_bytes(user.pk))

                # Point at the FRONTEND reset page, not the API. This used to
                # be hardcoded to 127.0.0.1 and to a path that wasn't even
                # routed, so every reset link in production was dead.
                reset_url = f"{settings.FRONTEND_URL}/reset-password/{uid}/{token}"

                send_password_reset_email(email, reset_url)
            except User.DoesNotExist:
                pass

            return Response({"message": self.GENERIC_RESPONSE})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AuthenticationRateThrottle]

    def post(self, request, uidb64, token):
        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({
                "message": "Invalid reset link."
            }, status=status.HTTP_400_BAD_REQUEST)

        if not default_token_generator.check_token(user, token):
            return Response({
                "message": "This reset link is invalid or has expired. Please request a new one."
            }, status=status.HTTP_400_BAD_REQUEST)

        serializer = PasswordResetConfirmSerializer(
            data=request.data, context={'user': user}
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(serializer.validated_data['password'])
        # Someone resetting their password may be doing so because the account
        # was compromised, so drop every existing session.
        try:
            for outstanding in OutstandingToken.objects.filter(user_id=user.id):
                BlacklistedToken.objects.get_or_create(token=outstanding)
        except Exception as e:
            print(f"Warning: could not blacklist tokens after reset: {e}")

        # A user who can prove control of their email is verified by definition;
        # otherwise an unverified account could reset and still not log in.
        if not user.is_verified:
            user.is_verified = True
        user.save()

        return Response({
            "message": "Password reset successful. You can now sign in."
        })

    def get(self, request, uidb64, token):
        """Lets the reset page check the link before showing the form."""
        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({'valid': False}, status=status.HTTP_400_BAD_REQUEST)

        if not default_token_generator.check_token(user, token):
            return Response({'valid': False}, status=status.HTTP_400_BAD_REQUEST)

        return Response({'valid': True, 'email': user.email})

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

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_banks(request):
    """
    Nigerian bank list for the payout bank-details form.

    This lives on the backend so the Flutterwave secret key never has to be
    deployed to the frontend. Previously the Next.js server held a live key
    purely to make this one read-only call — a money-moving credential
    stationed on a host that only needed a dropdown.

    Cached for a day; the list changes a few times a year at most.
    """
    from django.core.cache import cache

    cached = cache.get('flutterwave_bank_list')
    if cached:
        return Response(cached)

    try:
        resp = requests.get(
            'https://api.flutterwave.com/v3/banks/NG',
            headers={'Authorization': f'Bearer {settings.FLUTTERWAVE_SECRET_KEY}'},
            timeout=15,
        )
        payload = resp.json()
    except Exception as e:
        print(f"Error fetching banks: {e}")
        return Response(
            {'message': 'Could not load the bank list. Please try again.'},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    if not resp.ok or payload.get('status') != 'success':
        return Response(
            {'message': payload.get('message') or 'Could not load the bank list.'},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    banks = [
        {'name': b.get('name'), 'code': b.get('code')}
        for b in (payload.get('data') or [])
    ]
    cache.set('flutterwave_bank_list', banks, 60 * 60 * 24)
    return Response(banks)


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

        # Validate with Flutterwave
        headers = {
            'Authorization': f'Bearer {settings.FLUTTERWAVE_SECRET_KEY}',
            'Content-Type': 'application/json',
        }
        try:
            resp = requests.post(
                'https://api.flutterwave.com/v3/accounts/resolve',
                json={'account_number': account_number, 'account_bank': bank_code},
                headers=headers,
                timeout=15,
            )
            data = resp.json()
        except Exception as e:
            return Response({'status': False, 'message': 'Could not connect to bank validation service.'}, status=400)

        if data.get('status') != 'success':
            msg = data.get('message') or 'Could not resolve account. Check account number and bank.'
            return Response({'status': False, 'message': msg}, status=400)

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


class SellerStoreView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, brand_slug):
        try:
            seller = User.objects.get(brand_slug=brand_slug, user_type='seller')
        except User.DoesNotExist:
            return Response({'error': 'Store not found.'}, status=status.HTTP_404_NOT_FOUND)

        from .serializers import SellerStoreSerializer
        serializer = SellerStoreSerializer(seller, context={'request': request})
        return Response(serializer.data)


class AllStoresView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        sellers = (
            User.objects
            .filter(user_type='seller', store_active=True)
            .exclude(brand_slug__isnull=True)
            .exclude(brand_slug='')
            # annotate() instead of s.products.count() inside the loop, which
            # ran one extra query per seller.
            .annotate(product_count=Count('products'))
            # Explicit order so paging is stable; id breaks ties.
            .order_by('brand_name', 'id')
        )

        search = (request.GET.get('search') or '').strip()
        if search:
            sellers = sellers.filter(
                Q(brand_name__icontains=search) | Q(about__icontains=search)
            )

        return Response(paginate_list(
            request,
            sellers,
            serialize=lambda s: {
                'brand_name': s.brand_name,
                'brand_slug': s.brand_slug,
                'about': s.about,
                'product_count': s.product_count,
            },
        ))
