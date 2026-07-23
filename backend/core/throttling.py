"""
Custom rate limiting classes for specific endpoints.

NOTE ON THE BASE CLASS
----------------------
These used to subclass DRF's ScopedRateThrottle with a class-level `scope`.
That does not work. ScopedRateThrottle deliberately ignores a class attribute
and reads the scope off the view instead:

    def allow_request(self, request, view):
        self.scope = getattr(view, self.scope_attr, None)   # view.throttle_scope
        if not self.scope:
            return True                                     # <- no limit at all

None of the views here set `throttle_scope`, so every one of these throttles
silently allowed unlimited requests — including the login endpoint that was
supposed to stop brute forcing.

They now subclass SimpleRateThrottle, which uses `self.scope` directly to look
up the rate in REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'], and each defines the
cache key it wants.
"""

from rest_framework.throttling import SimpleRateThrottle, UserRateThrottle


class IPScopedRateThrottle(SimpleRateThrottle):
    """
    Base for limits that must apply per IP even for anonymous callers.

    Authenticated requests are keyed on the user so people behind a shared
    NAT/office IP don't throttle each other; everyone else is keyed on IP.
    """
    scope = None  # subclasses set this

    def get_cache_key(self, request, view):
        user = getattr(request, 'user', None)
        if user is not None and user.is_authenticated:
            ident = f"user:{user.pk}"
        else:
            ident = f"ip:{self.get_ident(request)}"
        return f"throttle:{self.scope}:{ident}"


class AnonymousIPRateThrottle(IPScopedRateThrottle):
    """
    Always keys on IP, even when authenticated.

    Used where the caller isn't a trusted user at all — webhooks from payment
    providers, and endpoints that cost money per call.
    """

    def get_cache_key(self, request, view):
        return f"throttle:{self.scope}:ip:{self.get_ident(request)}"


class PaymentRateThrottle(IPScopedRateThrottle):
    """Payment endpoints — 30/minute (see DEFAULT_THROTTLE_RATES['payment'])."""
    scope = 'payment'


class AuthenticationRateThrottle(AnonymousIPRateThrottle):
    """
    Authentication endpoints — 10/minute per IP.

    Keyed on IP rather than user: the whole point is to stop someone guessing
    credentials for an account they are not logged into.
    """
    scope = 'auth'


class WebhookRateThrottle(AnonymousIPRateThrottle):
    """Webhook endpoints — 100/minute per IP."""
    scope = 'webhook'


class SupportChatRateThrottle(AnonymousIPRateThrottle):
    """
    AI support chat — 15/minute per IP.

    The endpoint is open to logged-out visitors, so this always keys on IP.
    Every call spends money at the provider: an unthrottled AI proxy is
    somebody else's free API key.
    """
    scope = 'support_chat'


class ContactRateThrottle(AnonymousIPRateThrottle):
    """Contact / human-handoff submissions — 5/hour per IP, so one visitor
    cannot flood the admin inbox."""
    scope = 'contact'


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
