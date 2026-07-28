"""
Custom security middleware for additional security headers
"""

import ipaddress
from hmac import compare_digest

from django.conf import settings
from django.core.cache import cache
from django.http import HttpResponse


class AdminLoginRateLimitMiddleware:
    """
    Brute-force protection for the Django admin login form.

    The admin login form is a plain Django view — it does NOT go through the
    DRF throttles that protect the API, so without this it's an unlimited
    password-guessing target (the highest-value one on the site). This caps
    FAILED admin logins per IP using the cache. A successful login (302 redirect)
    is never counted, so a real admin can't lock themselves out by signing in.

    Runs after RealClientIPMiddleware, so it keys on the real visitor IP rather
    than the shared proxy IP.
    """
    LIMIT = 8            # failed attempts allowed
    WINDOW = 15 * 60     # per this many seconds

    def __init__(self, get_response):
        self.get_response = get_response
        prefix = getattr(settings, 'ADMIN_URL', 'admin/').strip('/')
        self.login_path = f"/{prefix}/login/"

    def _key(self, request):
        return f"adminlogin:{request.META.get('REMOTE_ADDR', 'unknown')}"

    def __call__(self, request):
        is_login_post = request.method == 'POST' and request.path == self.login_path

        if is_login_post and cache.get(self._key(request), 0) >= self.LIMIT:
            return HttpResponse(
                "Too many login attempts. Please try again in a few minutes.",
                status=429,
            )

        response = self.get_response(request)

        # Django re-renders the login form with 200 on failure; success is a 302.
        if is_login_post and response.status_code != 302:
            key = self._key(request)
            cache.set(key, cache.get(key, 0) + 1, self.WINDOW)

        return response


class RealClientIPMiddleware:
    """
    Recover the real visitor IP when a request arrives through our own frontend
    proxy.

    The browser talks to the Next.js server (on Vercel), which relays the call
    to Django. Django would otherwise see the proxy's IP for EVERY visitor, so
    all of them share a single rate-limit bucket: a handful of people browsing
    trips the anonymous limit for the whole site, and logins/signups collide on
    the auth limit. See core.throttling — every IP-keyed throttle depends on
    this being the real client.

    The proxy sends the visitor's IP in `X-Client-IP`, authenticated by a shared
    secret in `X-Proxy-Secret`. We trust that IP ONLY when the secret matches,
    so an attacker hitting Django directly cannot spoof another visitor's IP or
    forge unlimited fresh ones. When trusted we rewrite REMOTE_ADDR and
    X-Forwarded-For, so every downstream throttle (and the access logs) sees the
    real visitor. Unset secret => this is a no-op and behaviour is unchanged.
    """

    def __init__(self, get_response):
        self.get_response = get_response
        self.secret = (getattr(settings, 'PROXY_SHARED_SECRET', '') or '')

    def __call__(self, request):
        if self.secret:
            provided = request.META.get('HTTP_X_PROXY_SECRET', '')
            if provided and compare_digest(provided, self.secret):
                client_ip = request.META.get('HTTP_X_CLIENT_IP', '').split(',')[0].strip()
                if client_ip and self._is_ip(client_ip):
                    request.META['REMOTE_ADDR'] = client_ip
                    request.META['HTTP_X_FORWARDED_FOR'] = client_ip
        return self.get_response(request)

    @staticmethod
    def _is_ip(value):
        try:
            ipaddress.ip_address(value)
            return True
        except ValueError:
            return False


class CustomSecurityMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        
        # Additional security headers
        response['X-Content-Type-Options'] = 'nosniff'
        response['X-XSS-Protection'] = '1; mode=block'
        response['X-Frame-Options'] = 'DENY'
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'
        
        # Remove server information
        if 'Server' in response:
            del response['Server']
        
        return response



