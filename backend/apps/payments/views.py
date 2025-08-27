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
import requests
import json

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
from .services import PaystackService, PaymentService, PayoutService
from .services import PaymentProviderFactory  # Import the factory
from core.throttling import PaymentRateThrottle, WebhookRateThrottle  # Import rate limiting

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
                
                payment_response = payment_service.initialize_payment(payment)
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
        
        # Verify with the configured payment provider
        payment_service = PaymentProviderFactory.get_payment_service()
        payment_response = payment_service.verify_payment(reference)
        print(f"DEBUG: {payment.payment_provider} response status: {payment_response.get('data', {}).get('status')}")
        
        # Check if payment was successful based on provider
        is_successful = False
        if payment.payment_provider == 'flutterwave':
            is_successful = payment_response.get('status') == 'successful'
        else:  # Paystack
            is_successful = payment_response.get('data', {}).get('status') == 'success'
        
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
                return Response({
                    'message': 'Payment verification failed',
                    'error': str(process_error)
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        else:
            print(f"DEBUG: Payment not successful: {payment_response}")
            return Response({
                'message': 'Payment not successful',
                'status': payment_response.get('data', {}).get('status')
            }, status=status.HTTP_400_BAD_REQUEST)
            
    except Exception as e:
        print(f"DEBUG: Error in verify_payment: {str(e)}")
        return Response({
            'error': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_library(request):
    """Get user's purchased products"""
    try:
        library_items = UserLibrary.objects.filter(user=request.user).select_related('product', 'purchase')
        serializer = UserLibrarySerializer(library_items, many=True)
        return Response(serializer.data)
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)

class PaymentHistoryView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PaymentSerializer
    
    def get_queryset(self):
        return Payment.objects.filter(user=self.request.user).prefetch_related('purchases__product').order_by('-created_at')
    
    def list(self, request, *args, **kwargs):
        """Custom list method to add debugging"""
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        data = serializer.data
        
        # Debug: Log the first few payment amounts
        if data and len(data) > 0:
            print(f"DEBUG: PaymentHistoryView - First payment amount: {data[0].get('amount')}, Type: {type(data[0].get('amount'))}")
            print(f"DEBUG: PaymentHistoryView - First payment currency: {data[0].get('currency')}")
        
        return Response(data)

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

@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([WebhookRateThrottle])
def payment_webhook(request):
    """Handle payment webhook notifications from both Paystack and Flutterwave"""
    try:
        webhook_data = request.data
        print(f"DEBUG: Received webhook data: {webhook_data}")
        
        # Determine payment provider from webhook data
        if 'data' in webhook_data and 'reference' in webhook_data.get('data', {}):
            # Paystack webhook format
            reference = webhook_data.get('data', {}).get('reference')
            provider = 'paystack'
        elif 'tx_ref' in webhook_data:
            # Flutterwave webhook format
            reference = webhook_data.get('tx_ref')
            provider = 'flutterwave'
        else:
            print("DEBUG: Unknown webhook format")
            return HttpResponse(status=400)
        
        print(f"DEBUG: Processing {provider} webhook for reference: {reference}")
        
        # Get payment and verify status
        payment = get_object_or_404(Payment, reference=reference)
        
        # Check payment status based on provider
        if provider == 'paystack':
            is_successful = webhook_data.get('data', {}).get('status') == 'success'
        else:  # Flutterwave
            is_successful = webhook_data.get('status') == 'successful'
        
        if is_successful:
            print(f"DEBUG: {provider} webhook indicates successful payment")
            try:
                PaymentService.process_successful_payment(payment)
                print(f"DEBUG: Payment processed via webhook, new status: {payment.status}")
            except Exception as e:
                print(f"DEBUG: Error processing webhook: {str(e)}")
                return HttpResponse(status=500)
        else:
            print(f"DEBUG: {provider} webhook indicates payment status: {webhook_data.get('data', {}).get('status') if provider == 'paystack' else webhook_data.get('status')}")
        
        return HttpResponse(status=200)
    except Exception as e:
        print(f"DEBUG: Error processing webhook: {str(e)}")
        return HttpResponse(status=500)

# Debug endpoint to test checkout
@api_view(['POST'])
@permission_classes([AllowAny])
def debug_checkout(request):
    """Debug endpoint to see what data is being sent to checkout"""
    print(f"DEBUG: Debug checkout endpoint called")
    print(f"DEBUG: Request method: {request.method}")
    print(f"DEBUG: Request headers: {dict(request.headers)}")
    print(f"DEBUG: Request data: {request.data}")
    print(f"DEBUG: Request data type: {type(request.data)}")
    print(f"DEBUG: Request user: {request.user}")
    
    # Test the serializer
    serializer = CheckoutSerializer(data=request.data)
    if serializer.is_valid():
        print(f"DEBUG: Serializer is valid: {serializer.validated_data}")
        return Response({
            'status': 'success',
            'message': 'Checkout data is valid',
            'data': serializer.validated_data
        })
    else:
        print(f"DEBUG: Serializer errors: {serializer.errors}")
        return Response({
            'status': 'error',
            'message': 'Checkout data validation failed',
            'errors': serializer.errors
        }, status=400)

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
        
        # Create payout request
        payout_request = serializer.save(seller=request.user)
        
        # Process payout immediately
        payout_service = PayoutService()
        success = payout_service.process_payout(payout_request)
        
        if success:
            return Response({
                'message': 'Payout processed successfully',
                'payout': PayoutRequestSerializer(payout_request).data
            }, status=status.HTTP_201_CREATED)
        else:
            return Response({
                'message': 'Payout request created but processing failed',
                'payout': PayoutRequestSerializer(payout_request).data
            }, status=status.HTTP_202_ACCEPTED)
            
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