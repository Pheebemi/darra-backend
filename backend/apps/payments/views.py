from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from .models import Payment, UserLibrary
from .serializers import (
    PaymentSerializer, 
    UserLibrarySerializer, 
    CheckoutSerializer
)
from .services import PaystackService, PaymentService

class CheckoutView(generics.CreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = CheckoutSerializer
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
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
            print("DEBUG: Payment verification failed")
            # Update payment status to failed
            payment.status = Payment.PaymentStatus.FAILED
            payment.gateway_response = str(paystack_response)
            payment.save()
            
            return Response({
                'message': 'Payment verification failed',
                'payment': PaymentSerializer(payment).data
            }, status=status.HTTP_400_BAD_REQUEST)
            
    except Exception as e:
        print(f"DEBUG: Exception during verification: {str(e)}")
        return Response({
            'error': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)

class UserLibraryView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserLibrarySerializer
    
    def get_queryset(self):
        return UserLibrary.objects.filter(user=self.request.user).select_related('product')

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
            print(f"DEBUG: Webhook indicates successful payment for {reference}")
            
            # Process the successful payment
            paystack_service = PaystackService()
            payment = paystack_service.process_successful_payment(payment, webhook_data)
            
            return Response({'message': 'Webhook processed successfully'})
        else:
            print(f"DEBUG: Webhook indicates failed payment for {reference}")
            payment.status = Payment.PaymentStatus.FAILED
            payment.gateway_response = str(webhook_data)
            payment.save()
            
            return Response({'message': 'Payment marked as failed'})
            
    except Exception as e:
        print(f"DEBUG: Webhook error: {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST) 