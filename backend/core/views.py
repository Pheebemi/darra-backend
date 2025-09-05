"""
Test views for rate limiting verification
"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle
from core.throttling import BurstRateThrottle, SustainedRateThrottle


@api_view(['GET'])
@permission_classes([AllowAny])
def test_rate_limiting(request):
    """
    Test endpoint to verify rate limiting is working
    """
    return Response({
        'message': 'Rate limiting test successful',
        'timestamp': '2025-08-25T10:00:00Z',
        'rate_limit_info': {
            'anonymous': '100/hour',
            'authenticated': '1000/hour',
            'burst': '60/minute',
            'sustained': '1000/hour'
        }
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def test_burst_limit(request):
    """
    Test endpoint for burst rate limiting
    """
    return Response({
        'message': 'Burst rate limiting test',
        'limit': '60/minute'
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def test_sustained_limit(request):
    """
    Test endpoint for sustained rate limiting
    """
    return Response({
        'message': 'Sustained rate limiting test',
        'limit': '1000/hour'
    })





