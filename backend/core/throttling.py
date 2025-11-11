"""
Custom rate limiting classes for specific endpoints
"""

from rest_framework.throttling import ScopedRateThrottle, UserRateThrottle
from rest_framework.throttling import AnonRateThrottle


class PaymentRateThrottle(ScopedRateThrottle):
    """
    Rate limiting for payment endpoints
    - 30 requests per minute per user
    """
    scope = 'payment'


class AuthenticationRateThrottle(ScopedRateThrottle):
    """
    Rate limiting for authentication endpoints
    - 10 requests per minute per IP (prevents brute force)
    """
    scope = 'auth'
    
    def get_cache_key(self, request, view):
        # Use IP address for auth endpoints to prevent brute force attacks
        if request.user.is_authenticated:
            return f"auth_user_{request.user.id}"
        return f"auth_ip_{self.get_ident(request)}"


class WebhookRateThrottle(ScopedRateThrottle):
    """
    Rate limiting for webhook endpoints
    - 100 requests per minute per IP
    """
    scope = 'webhook'
    
    def get_cache_key(self, request, view):
        # Use IP address for webhooks
        return f"webhook_ip_{self.get_ident(request)}"


class BurstRateThrottle(UserRateThrottle):
    """
    Burst protection - limits rapid successive requests
    - 60 requests per minute per user
    """
    rate = '60/minute'


class SustainedRateThrottle(UserRateThrottle):
    """
    Sustained usage protection - limits long-term usage
    - 1000 requests per hour per user
    """
    rate = '1000/hour'














