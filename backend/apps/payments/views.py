from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from django.db.models import Sum, Count
from django.utils import timezone
from datetime import timedelta
from django.db import transaction
from django.conf import settings
from decimal import Decimal, InvalidOperation
import hashlib
import hmac
import logging
import requests
import json

logger = logging.getLogger(__name__)

from .models import Payment, Purchase, UserLibrary, SellerCommission, PayoutRequest, SellerEarnings
from .serializers import (
    PaymentSerializer, 
    UserLibrarySerializer, 
    CheckoutSerializer,
    SellerCommissionSerializer,
    PayoutRequestSerializer,
    CreatePayoutRequestSerializer,
    SellerEarningsSerializer
)
from .services import PaystackService, FlutterwaveService, PaymentService, PayoutService
from .services import PaymentProviderFactory  # Import the factory
from core.throttling import PaymentRateThrottle, WebhookRateThrottle  # Import rate limiting
from users.utils import send_digital_product_email

class CheckoutView(generics.CreateAPIView):
    serializer_class = CheckoutSerializer
    permission_classes = [IsAuthenticated]
    throttle_classes = [PaymentRateThrottle]  # Rate limit payment requests
    
    def create(self, request, *args, **kwargs):
        print(f"DEBUG: Checkout request data: {request.data}")
        print(f"DEBUG: Request data type: {type(request.data)}")
        print(f"DEBUG: Serializer class: {self.serializer_class}")
        
        serializer = self.get_serializer(data=request.data)
        print(f"DEBUG: Serializer created: {serializer}")
        print(f"DEBUG: Serializer class name: {serializer.__class__.__name__}")
        
        if serializer.is_valid():
            print(f"DEBUG: Serializer is valid")
            print(f"DEBUG: Validated data: {serializer.validated_data}")
            print(f"DEBUG: Validated data type: {type(serializer.validated_data)}")
            print(f"DEBUG: Items in validated data: {serializer.validated_data.get('items', [])}")
            
            try:
                # Get the requested payment provider first
                requested_provider = serializer.validated_data.get('payment_provider', 'paystack')
                print(f"DEBUG: Requested provider: {requested_provider}")
                
                # Process checkout - pass the payment provider directly
                print(f"DEBUG: About to create payment from cart with items: {serializer.validated_data['items']}")
                payment = PaymentService.create_payment_from_cart(request.user, serializer.validated_data['items'], requested_provider)
                print(f"DEBUG: Payment created successfully: {payment.id}, {payment.reference}, {payment.amount}")
                print(f"DEBUG: Payment provider set to: {payment.payment_provider}")
                
                # Get the payment service for the requested provider
                payment_service = PaymentProviderFactory.get_payment_service_by_provider(requested_provider)
                print(f"DEBUG: Using requested provider: {requested_provider}")
                
                print(f"DEBUG: Payment service type: {type(payment_service).__name__}")
                print(f"DEBUG: Initializing {payment.payment_provider} payment for payment ID: {payment.id}")
                print(f"DEBUG: Payment reference: {payment.reference}")
                print(f"DEBUG: Payment amount: {payment.amount}")
                print(f"DEBUG: User email: {payment.user.email}")
                
                # Get callback_url from serializer if provided
                callback_url = serializer.validated_data.get('callback_url')
                print(f"DEBUG: Callback URL: {callback_url}")
                
                payment_response = payment_service.initialize_payment(payment, callback_url=callback_url)
                print(f"DEBUG: {payment.payment_provider} response: {payment_response}")
                
                # Return payment data with provider-specific authorization URL
                if payment.payment_provider == 'flutterwave':
                    authorization_url = payment_response.get('data', {}).get('link')
                    provider_data = payment_response
                else:  # Paystack
                    authorization_url = payment_response.get('data', {}).get('authorization_url')
                    provider_data = payment_response
                
                response_data = {
                    'payment': PaymentSerializer(payment).data,
                    'provider_data': provider_data,
                    'authorization_url': authorization_url,
                    'payment_provider': payment.payment_provider
                }
                
                print(f"DEBUG: Final response data: {response_data}")
                return Response(response_data, status=status.HTTP_201_CREATED)
            except Exception as e:
                print(f"DEBUG: Checkout error: {str(e)}")
                return Response({
                    'error': 'Checkout failed',
                    'details': str(e)
                }, status=status.HTTP_400_BAD_REQUEST)
        else:
            print(f"DEBUG: Checkout validation errors: {serializer.errors}")
            print(f"DEBUG: Serializer errors type: {type(serializer.errors)}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
def verify_payment(request, reference):
    """Verify payment with Paystack and process if successful"""
    try:
        print(f"DEBUG: Verifying payment with reference: {reference}")
        payment = get_object_or_404(Payment, reference=reference)
        print(f"DEBUG: Found payment with status: {payment.status}")
        
        if payment.status == Payment.PaymentStatus.SUCCESS:
            print("DEBUG: Payment already verified")
            return Response({
                'message': 'Payment already verified',
                'payment': PaymentSerializer(payment).data
            })
        
        # Verify with the specific payment provider for this payment
        print(f"DEBUG: Getting payment service for provider: {payment.payment_provider}")
        payment_service = PaymentProviderFactory.get_payment_service_by_provider(payment.payment_provider)
        print(f"DEBUG: Payment service type: {type(payment_service).__name__}")
        payment_response = payment_service.verify_payment(reference)
        print(f"DEBUG: {payment.payment_provider} response: {payment_response}")
        print(f"DEBUG: {payment.payment_provider} response type: {type(payment_response)}")
        print(f"DEBUG: {payment.payment_provider} response keys: {list(payment_response.keys()) if isinstance(payment_response, dict) else 'Not a dict'}")
        
        if payment.payment_provider == 'flutterwave':
            print(f"DEBUG: Flutterwave status: {payment_response.get('status')}")
            print(f"DEBUG: Flutterwave status type: {type(payment_response.get('status'))}")
        else:
            print(f"DEBUG: Paystack status: {payment_response.get('data', {}).get('status')}")
            print(f"DEBUG: Paystack status type: {type(payment_response.get('data', {}).get('status'))}")
        
        # Check if payment was successful based on provider
        is_successful = False
        if payment.payment_provider == 'flutterwave':
            flutterwave_status = payment_response.get('status')
            # Flutterwave returns 'success', not 'successful'
            is_successful = flutterwave_status == 'success'
            print(f"DEBUG: Flutterwave status check - Raw status: '{flutterwave_status}', is_successful: {is_successful}")
        else:  # Paystack
            paystack_status = payment_response.get('data', {}).get('status')
            is_successful = paystack_status == 'success'
            print(f"DEBUG: Paystack status check - Raw status: '{paystack_status}', is_successful: {is_successful}")
        
        print(f"DEBUG: Final is_successful result: {is_successful}")
        
        if is_successful:
            print("DEBUG: Payment successful, processing...")
            try:
                # Process the payment
                PaymentService.process_successful_payment(payment)
                print(f"DEBUG: Payment processed, new status: {payment.status}")
                
                return Response({
                    'message': 'Payment verified successfully',
                    'payment': PaymentSerializer(payment).data
                })
            except Exception as process_error:
                print(f"DEBUG: Error processing payment: {str(process_error)}")
                # Even if ticket creation fails, payment was successful
                # Don't fail the entire payment verification
                print(f"DEBUG: Payment was successful, but processing had issues. Payment status: {payment.status}")
                
                # Check if payment status was updated to success
                if payment.status == Payment.PaymentStatus.SUCCESS:
                    return Response({
                        'message': 'Payment verified successfully',
                        'payment': PaymentSerializer(payment).data,
                        'warning': 'Some post-processing may still be in progress'
                    })
                else:
                    return Response({
                        'message': 'Payment verification failed',
                        'error': str(process_error)
                    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        else:
            print(f"DEBUG: Payment not successful: {payment_response}")
            # Return the correct status based on provider
            if payment.payment_provider == 'flutterwave':
                error_status = payment_response.get('status')
            else:  # Paystack
                error_status = payment_response.get('data', {}).get('status')
            
            return Response({
                'message': 'Payment not successful',
                'status': error_status
            }, status=status.HTTP_400_BAD_REQUEST)
            
    except Exception as e:
        print(f"DEBUG: Error in verify_payment: {str(e)}")
        return Response({
            'error': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_library(request):
    """Get user's purchased products with pagination"""
    try:
        print(f"DEBUG: Getting library for user: {request.user.email}")
        
        # Get pagination parameters
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 20))
        offset = (page - 1) * page_size
        
        # Get total count
        total_items = UserLibrary.objects.filter(user=request.user).count()
        print(f"DEBUG: Total library items: {total_items}")
        
        # Get paginated items
        library_items = UserLibrary.objects.filter(user=request.user).select_related('product', 'purchase').order_by('-added_at')[offset:offset + page_size]
        print(f"DEBUG: Returning {library_items.count()} items for page {page}")
        
        # Debug: Print first few items
        for i, item in enumerate(library_items[:3]):
            print(f"DEBUG: Item {i}: Product ID {item.product.id}, Type: {item.product.product_type}")
        
        serializer = UserLibrarySerializer(library_items, many=True)
        print(f"DEBUG: Serialization completed successfully")
        
        # Calculate pagination info
        total_pages = (total_items + page_size - 1) // page_size
        has_next = page < total_pages
        has_previous = page > 1
        
        return Response({
            'results': serializer.data,
            'pagination': {
                'page': page,
                'page_size': page_size,
                'total_items': total_items,
                'total_pages': total_pages,
                'has_next': has_next,
                'has_previous': has_previous,
                'next_page': page + 1 if has_next else None,
                'previous_page': page - 1 if has_previous else None
            }
        })
    except Exception as e:
        print(f"ERROR: Library fetch error: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response({
            'error': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)

class PaymentHistoryView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PaymentSerializer
    
    def get_queryset(self):
        return Payment.objects.filter(user=self.request.user).prefetch_related('purchases__product').order_by('-created_at')
    
    def list(self, request, *args, **kwargs):
        """Custom list method with pagination and debugging"""
        # Get pagination parameters
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 20))
        offset = (page - 1) * page_size
        
        # Get total count
        queryset = self.filter_queryset(self.get_queryset())
        total_items = queryset.count()
        print(f"DEBUG: PaymentHistoryView - Total transactions: {total_items}")
        
        # Get paginated items
        paginated_queryset = queryset[offset:offset + page_size]
        serializer = self.get_serializer(paginated_queryset, many=True)
        data = serializer.data
        
        # Debug: Log the first few payment amounts
        if data and len(data) > 0:
            print(f"DEBUG: PaymentHistoryView - First payment amount: {data[0].get('amount')}, Type: {type(data[0].get('amount'))}")
            print(f"DEBUG: PaymentHistoryView - First payment currency: {data[0].get('currency')}")
        
        # Calculate pagination info
        total_pages = (total_items + page_size - 1) // page_size
        has_next = page < total_pages
        has_previous = page > 1
        
        return Response({
            'results': data,
            'pagination': {
                'page': page,
                'page_size': page_size,
                'total_items': total_items,
                'total_pages': total_pages,
                'has_next': has_next,
                'has_previous': has_previous,
                'next_page': page + 1 if has_next else None,
                'previous_page': page - 1 if has_previous else None
            }
        })

@api_view(['GET'])
def payment_status(request, reference):
    """Get payment status"""
    try:
        payment = get_object_or_404(Payment, reference=reference)
        return Response(PaymentSerializer(payment).data)
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)

def _flutterwave_signature_ok(request):
    """
    Flutterwave echoes the "Secret hash" configured on their webhook dashboard
    in the verif-hash header. If we have no hash configured we cannot
    authenticate anything, so we fail closed.
    """
    expected = getattr(settings, 'FLUTTERWAVE_SECRET_HASH', '') or ''
    if not expected:
        logger.error(
            "FLUTTERWAVE_SECRET_HASH is not configured; rejecting webhook. "
            "Set it in .env and on the Flutterwave dashboard."
        )
        return False

    received = request.headers.get('verif-hash', '') or ''
    return bool(received) and hmac.compare_digest(str(received), str(expected))


def _paystack_signature_ok(request, raw_body):
    """
    Paystack signs the raw request body with HMAC-SHA512 keyed on the secret
    key and sends it in x-paystack-signature.
    """
    secret = (getattr(settings, 'PAYSTACK_SECRET_KEY', '') or '').encode()
    received = request.headers.get('x-paystack-signature', '') or ''
    if not secret or not received:
        return False

    computed = hmac.new(secret, raw_body, hashlib.sha512).hexdigest()
    return hmac.compare_digest(received, computed)


def _amounts_match(expected, actual):
    """Compare money values tolerantly (providers vary in type and precision)."""
    try:
        return abs(Decimal(str(expected)) - Decimal(str(actual))) < Decimal('0.01')
    except (InvalidOperation, TypeError, ValueError):
        return False


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([WebhookRateThrottle])
def payment_webhook(request):
    """
    Handle payment webhook notifications from Paystack and Flutterwave.

    This endpoint is unauthenticated by necessity, so it is defended twice:

      1. The provider's signature over the request is verified, proving the
         call really came from them.
      2. The payment is then re-verified by calling the provider's own API.
         The status and amount in the request body are NEVER trusted — only
         what the provider tells us directly.

    Either check alone would stop a forged "payment successful" callback; both
    together mean a leaked secret hash still is not enough to grant a product.
    """
    try:
        # Must be read before request.data — once DRF parses the stream the
        # raw body is no longer available, and the HMAC is over raw bytes.
        raw_body = request.body
        webhook_data = request.data

        # Determine payment provider from webhook data
        reference = None
        provider = None

        # Paystack webhook format (reference lives under data.reference)
        if isinstance(webhook_data, dict) and webhook_data.get('data', {}).get('reference'):
            reference = webhook_data['data']['reference']
            provider = 'paystack'

        # Flutterwave webhook formats:
        # - Some deliveries put tx_ref at the root
        # - Others nest tx_ref under data.tx_ref (common)
        if not provider and isinstance(webhook_data, dict):
            if webhook_data.get('tx_ref'):
                reference = webhook_data.get('tx_ref')
                provider = 'flutterwave'
            elif webhook_data.get('data', {}).get('tx_ref'):
                reference = webhook_data['data']['tx_ref']
                provider = 'flutterwave'

        if not provider or not reference:
            logger.warning("Webhook with unknown format or missing reference")
            return HttpResponse(status=400)

        # --- 1. Authenticate the caller ---------------------------------
        if provider == 'paystack':
            signature_ok = _paystack_signature_ok(request, raw_body)
        else:
            signature_ok = _flutterwave_signature_ok(request)

        if not signature_ok:
            logger.error(
                "Rejected %s webhook for reference %s: signature verification failed.",
                provider, reference,
            )
            return HttpResponse(status=401)

        payment = get_object_or_404(Payment, reference=reference)

        # Nothing to do if we already processed this one (providers retry).
        if payment.status == Payment.PaymentStatus.SUCCESS:
            logger.info("Webhook for already-processed payment %s; ignoring.", reference)
            return HttpResponse(status=200)

        # --- 2. Ask the provider directly, never trust the body ----------
        try:
            if provider == 'paystack':
                service = PaystackService()
                result = service.verify_payment(reference)
                data = (result or {}).get('data', {}) or {}
                is_successful = data.get('status') == 'success'
                # Paystack reports amounts in kobo.
                provider_amount = Decimal(str(data.get('amount', 0))) / Decimal('100')
            else:
                service = FlutterwaveService()
                result = service.verify_payment(reference)
                data = (result or {}).get('data', {}) or {}
                is_successful = data.get('status') in ('success', 'successful')
                provider_amount = data.get('amount', 0)
        except Exception as e:
            # Could not confirm with the provider — do not grant anything.
            # Returning 5xx makes the provider retry later.
            logger.error("Could not verify %s payment %s: %s", provider, reference, e)
            return HttpResponse(status=502)

        if not is_successful:
            logger.info("Provider reports payment %s is not successful; ignoring.", reference)
            return HttpResponse(status=200)

        if not _amounts_match(payment.amount, provider_amount):
            logger.error(
                "Amount mismatch for payment %s: expected %s, provider reported %s. "
                "Refusing to process.",
                reference, payment.amount, provider_amount,
            )
            return HttpResponse(status=409)

        try:
            PaymentService.process_successful_payment(payment)
        except Exception as e:
            logger.exception("Error processing verified payment %s: %s", reference, e)
            return HttpResponse(status=500)

        return HttpResponse(status=200)
    except Exception as e:
        logger.exception("Unhandled error in payment webhook: %s", e)
        return HttpResponse(status=500)

# NOTE: the AllowAny `debug_checkout` endpoint that used to live here was
# removed. It logged full request headers — including Authorization bearer
# tokens — to the server log, and was reachable by anyone in production.

# New endpoints for seller earnings and payouts

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def seller_earnings(request):
    """Get seller's earnings overview"""
    if request.user.user_type != 'seller':
        return Response({'error': 'Only sellers can access this'}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        # Get or create earnings record
        earnings, created = SellerEarnings.objects.get_or_create(seller=request.user)
        
        # Update earnings if not created
        if not created:
            paystack_service = PaystackService()
            paystack_service.update_seller_earnings(request.user)
            earnings.refresh_from_db()
        
        serializer = SellerEarningsSerializer(earnings)
        return Response(serializer.data)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def seller_commissions(request):
    """Get seller's commission history"""
    if request.user.user_type != 'seller':
        return Response({'error': 'Only sellers can access this'}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        commissions = SellerCommission.objects.filter(
            seller=request.user
        ).select_related('purchase__product', 'purchase__payment__user').order_by('-created_at')
        
        serializer = SellerCommissionSerializer(commissions, many=True)
        return Response(serializer.data)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def seller_payouts(request):
    """Get seller's payout history"""
    if request.user.user_type != 'seller':
        return Response({'error': 'Only sellers can access this'}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        payouts = PayoutRequest.objects.filter(
            seller=request.user
        ).select_related('bank_details').order_by('-created_at')
        
        serializer = PayoutRequestSerializer(payouts, many=True)
        return Response(serializer.data)
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def request_payout(request):
    """Request a payout"""
    if request.user.user_type != 'seller':
        return Response({'error': 'Only sellers can access this'}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        serializer = CreatePayoutRequestSerializer(
            data=request.data, 
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        
        # Create payout request — manual processing by admin
        payout_request = serializer.save(seller=request.user, status='pending')

        # Notify seller
        try:
            from users.utils import send_payout_requested_email
            send_payout_requested_email(payout_request)
        except Exception as e:
            print(f"Payout request email error: {e}")

        # Alert admins separately, so a failure to reach the seller does not
        # also swallow the alert telling us money is waiting to be sent.
        try:
            from users.utils import send_payout_admin_alert_email
            send_payout_admin_alert_email(payout_request)
        except Exception as e:
            print(f"Payout admin alert error: {e}")

        return Response({
            'message': 'Payout request submitted. You will be paid within 12-14 hours.',
            'payout': PayoutRequestSerializer(payout_request).data
        }, status=status.HTTP_201_CREATED)
            
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def seller_analytics(request):
    """Get comprehensive seller analytics including earnings"""
    if request.user.user_type != 'seller':
        return Response({'error': 'Only sellers can access this'}, status=status.HTTP_403_FORBIDDEN)
    
    try:
        # Get time range from query params
        time_range = request.query_params.get('timeRange', '7d')
        
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
        
        # Get commissions in date range
        commissions = SellerCommission.objects.filter(
            seller=request.user,
            created_at__range=(start_date, end_date)
        )
        
        # Calculate analytics
        total_revenue = commissions.aggregate(total=Sum('product_price'))['total'] or 0
        total_orders = commissions.count()
        total_commission = commissions.aggregate(total=Sum('commission_amount'))['total'] or 0
        net_payout = commissions.aggregate(total=Sum('seller_payout'))['total'] or 0
        
        # Get pending payouts
        pending_payouts = PayoutRequest.objects.filter(
            seller=request.user,
            status='pending'
        ).aggregate(total=Sum('amount'))['total'] or 0
        
        # Get recent commissions
        recent_commissions = commissions.order_by('-created_at')[:5]
        commission_data = SellerCommissionSerializer(recent_commissions, many=True).data
        
        # Get recent payouts
        recent_payouts = PayoutRequest.objects.filter(
            seller=request.user
        ).order_by('-created_at')[:5]
        payout_data = PayoutRequestSerializer(recent_payouts, many=True).data
        
        analytics_data = {
            'total_revenue': total_revenue,
            'total_orders': total_orders,
            'revenue_growth': 0,  # You can implement growth calculation
            'conversion_rate': 0,  # You can implement conversion calculation
            'avg_order_value': total_revenue / total_orders if total_orders > 0 else 0,
            'aov_growth': 0,  # You can implement AOV growth calculation
            'customer_countries': 1,  # Default value
            'top_products': [],  # You can implement top products
            'daily_revenue': [],  # You can implement daily revenue
            'total_customers': total_orders,  # For now, assume 1 customer per order
            
            # Commission and earnings data
            'total_earnings': net_payout,
            'total_commission': total_commission,
            'net_payout': net_payout,
            'pending_payouts': pending_payouts,
            'recent_commissions': commission_data,
            'recent_payouts': payout_data
        }
        
        return Response(analytics_data)
            
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([AllowAny])
def test_connection(request):
    """Simple endpoint to test mobile app connectivity"""
    print(f"DEBUG: Test connection endpoint called from IP: {request.META.get('REMOTE_ADDR')}")
    print(f"DEBUG: Request headers: {dict(request.headers)}")
    
    return Response({
        'status': 'success',
        'message': 'Connection successful',
        'timestamp': timezone.now().isoformat(),
        'client_ip': request.META.get('REMOTE_ADDR'),
        'user_agent': request.META.get('HTTP_USER_AGENT', 'Unknown')
    })

@api_view(['GET'])
@permission_classes([AllowAny])
def test_flutterwave_connection(request):
    """Test Flutterwave API connection"""
    import requests
    from .services import FlutterwaveService
    
    try:
        flutterwave = FlutterwaveService()
        
        # Test basic API connection
        test_url = f"{flutterwave.base_url}/banks/NG"
        response = requests.get(test_url, headers=flutterwave._get_headers())
        
        result = {
            'status': 'success' if response.status_code == 200 else 'failed',
            'response_code': response.status_code,
            'response_text': response.text[:200] if response.text else 'No response',
            'api_key_length': len(flutterwave.secret_key) if flutterwave.secret_key else 0,
            'api_key_prefix': flutterwave.secret_key[:10] + '...' if flutterwave.secret_key else 'None'
        }
        
        return Response({
            'status': 'success',
            'flutterwave_status': result,
            'timestamp': timezone.now().isoformat()
        })
    except Exception as e:
        return Response({
            'status': 'error',
            'message': str(e),
            'timestamp': timezone.now().isoformat()
        }, status=500)

@api_view(['GET'])
def check_payment_status(request, reference):
    """Check payment status and ticket creation progress"""
    try:
        payment = Payment.objects.get(reference=reference)
        
        # Get payment status
        payment_status = {
            'reference': payment.reference,
            'status': payment.status,
            'amount': payment.amount,
            'created_at': payment.created_at,
        }
        
        # Check if payment has event tickets
        purchases = payment.purchases.all()
        has_event_tickets = any(purchase.product.product_type == 'event' for purchase in purchases)
        
        ticket_status = {
            'has_event_tickets': has_event_tickets,
            'tickets_created': 0,
            'tickets_with_qr_codes': 0,
            'total_tickets_expected': 0,
        }
        
        if has_event_tickets:
            # Count tickets for this payment
            from apps.events.models import EventTicket
            tickets = EventTicket.objects.filter(purchase__payment=payment)
            
            ticket_status['tickets_created'] = tickets.count()
            ticket_status['tickets_with_qr_codes'] = tickets.filter(qr_code__isnull=False).count()
            
            # Calculate expected tickets
            for purchase in purchases:
                if purchase.product.product_type == 'event':
                    ticket_status['total_tickets_expected'] += purchase.quantity
        
        # Determine overall status
        is_complete = True
        if has_event_tickets:
            is_complete = (
                ticket_status['tickets_created'] == ticket_status['total_tickets_expected'] and
                ticket_status['tickets_with_qr_codes'] == ticket_status['total_tickets_expected']
            )
        
        return Response({
            'payment': payment_status,
            'tickets': ticket_status,
            'is_complete': is_complete,
            'message': 'Complete' if is_complete else 'Processing tickets...'
        })
        
    except Payment.DoesNotExist:
        return Response({
            'message': 'Payment not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        print(f"DEBUG: Error checking payment status: {str(e)}")
        return Response({
            'message': 'Error checking payment status',
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_digital_product_to_email(request, library_item_id):
    """Send digital product file via email to user"""
    try:
        # Get the library item
        library_item = get_object_or_404(UserLibrary, id=library_item_id, user=request.user)
        
        # Check if it's a digital product (not event)
        if library_item.product.product_type == 'event':
            return Response({
                'message': 'Event tickets are handled separately'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Check if product has a file
        if not library_item.product.file:
            return Response({
                'message': 'No file available for this product'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Send email with product file
        success = send_digital_product_email(
            user=request.user,
            product=library_item.product,
        )
        
        if success:
            return Response({
                'message': 'Product sent to your email successfully!'
            }, status=status.HTTP_200_OK)
        else:
            return Response({
                'message': 'This product was created with the old system and needs to be re-uploaded by the seller to work with email delivery.'
            }, status=status.HTTP_400_BAD_REQUEST)
            
    except UserLibrary.DoesNotExist:
        return Response({
            'message': 'Product not found in your library'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        print(f"DEBUG: Error sending digital product to email: {str(e)}")
        return Response({
            'message': 'Error sending product to email',
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def download_product_file(request, library_item_id):
    """Securely serve a purchased digital product file"""
    import os
    from django.http import FileResponse

    library_item = get_object_or_404(UserLibrary, id=library_item_id, user=request.user)
    product = library_item.product

    if product.product_type == 'event':
        return Response({'message': 'Event tickets are not downloadable here.'}, status=400)

    if not product.file:
        return Response({'message': 'No file attached to this product.'}, status=404)

    # Opens from the configured (private) storage, falling back to the
    # pre-migration public location so downloads keep working while files are
    # still being moved. Works for remote backends too.
    file_handle = product.open_file()
    if file_handle is None:
        return Response({'message': 'File not found on server.'}, status=404)

    # Derive the name from the stored field, not the resolved path, so it is
    # identical regardless of which location the file came from.
    filename = os.path.basename(product.file.name)
    ext = os.path.splitext(filename)[1].lower()
    content_types = {
        '.pdf': 'application/pdf',
        '.mp3': 'audio/mpeg',
        '.mp4': 'video/mp4',
        '.zip': 'application/zip',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.png': 'image/png',
    }
    content_type = content_types.get(ext, 'application/octet-stream')

    response = FileResponse(file_handle, content_type=content_type)
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def download_ticket_qr(request, ticket_id):
    """Securely serve a purchased event ticket QR code"""
    import os
    from django.http import FileResponse
    from apps.events.models import EventTicket

    try:
        ticket = EventTicket.objects.get(
            id=ticket_id,
            buyer=request.user
        )
    except EventTicket.DoesNotExist:
        return Response({'message': 'Ticket not found.'}, status=404)

    if not ticket.qr_code:
        return Response({'message': 'QR code not yet generated for this ticket.'}, status=404)

    try:
        file_path = ticket.qr_code.path
    except Exception:
        return Response({'message': 'QR code file not found on server.'}, status=404)

    if not os.path.exists(file_path):
        return Response({'message': 'QR code file not found on server.'}, status=404)

    response = FileResponse(open(file_path, 'rb'), content_type='image/png')
    response['Content-Disposition'] = f'attachment; filename="ticket_{ticket.ticket_id}_qr.png"'
    return response