from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from django.db.models import Sum, Count
from django.utils import timezone
from datetime import timedelta
from .models import Payment, UserLibrary, SellerCommission, PayoutRequest, SellerEarnings
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

class CheckoutView(generics.CreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CheckoutSerializer
    
    def create(self, request, *args, **kwargs):
        print(f"DEBUG: Checkout request data: {request.data}")
        print(f"DEBUG: Checkout request user: {request.user.email}")
        
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            print(f"DEBUG: Checkout validation errors: {serializer.errors}")
            return Response({
                'error': 'Invalid checkout data',
                'details': serializer.errors
            }, status=status.HTTP_400_BAD_REQUEST)
        
        print(f"DEBUG: Checkout validated data: {serializer.validated_data}")
        
        try:
            # Use user's email if not provided in request
            email = serializer.validated_data.get('email') or request.user.email
            
            # Create payment from cart items
            payment = PaymentService.create_payment_from_cart(
                user=request.user,
                cart_items=serializer.validated_data['items']
            )
            
            # Initialize payment with Paystack
            paystack_service = PaystackService()
            paystack_response = paystack_service.initialize_payment(payment)
            
            return Response({
                'payment': PaymentSerializer(payment).data,
                'paystack_data': paystack_response,
                'authorization_url': paystack_response.get('data', {}).get('authorization_url')
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            print(f"DEBUG: Checkout error: {str(e)}")
            return Response({
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

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
        
        # Verify with Paystack
        paystack_service = PaystackService()
        paystack_response = paystack_service.verify_payment(reference)
        print(f"DEBUG: Paystack response status: {paystack_response.get('data', {}).get('status')}")
        
        # Check if payment was successful
        if paystack_response.get('data', {}).get('status') == 'success':
            print("DEBUG: Payment successful, processing...")
            try:
                # Process successful payment
                payment = paystack_service.process_successful_payment(payment, paystack_response)
                print(f"DEBUG: Payment processed, new status: {payment.status}")
                
                return Response({
                    'message': 'Payment verified successfully',
                    'payment': PaymentSerializer(payment).data
                })
            except Exception as process_error:
                print(f"DEBUG: Error processing payment: {str(process_error)}")
                # If there's an error processing (like duplicate library items), 
                # still return success since the payment was actually successful
                if "UNIQUE constraint failed" in str(process_error):
                    print("DEBUG: Duplicate library items detected, but payment was successful")
                    return Response({
                        'message': 'Payment verified successfully (items already in library)',
                        'payment': PaymentSerializer(payment).data
                    })
                else:
                    # Re-raise other errors
                    raise process_error
        else:
            print(f"DEBUG: Payment not successful: {paystack_response}")
            return Response({
                'error': 'Payment verification failed',
                'paystack_response': paystack_response
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
def paystack_webhook(request):
    """Handle Paystack webhook for payment updates"""
    try:
        # Get the webhook data
        webhook_data = request.data
        print(f"DEBUG: Received webhook data: {webhook_data}")
        
        # Extract the reference from the webhook
        reference = webhook_data.get('data', {}).get('reference')
        if not reference:
            return Response({'error': 'No reference found'}, status=status.HTTP_400_BAD_REQUEST)
        
        print(f"DEBUG: Processing webhook for reference: {reference}")
        
        # Get the payment
        try:
            payment = Payment.objects.get(reference=reference)
        except Payment.DoesNotExist:
            return Response({'error': 'Payment not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Check if payment was successful
        if webhook_data.get('data', {}).get('status') == 'success':
            print("DEBUG: Webhook indicates successful payment")
            
            # Process the payment if it hasn't been processed yet
            if payment.status != Payment.PaymentStatus.SUCCESS:
                paystack_service = PaystackService()
                payment = paystack_service.process_successful_payment(payment, webhook_data)
                print(f"DEBUG: Payment processed via webhook, new status: {payment.status}")
            else:
                print("DEBUG: Payment already processed")
        else:
            print(f"DEBUG: Webhook indicates payment status: {webhook_data.get('data', {}).get('status')}")
        
        return Response({'status': 'success'})
        
    except Exception as e:
        print(f"DEBUG: Error processing webhook: {str(e)}")
        return Response({
            'error': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)

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