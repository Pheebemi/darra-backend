"""
Custom security middleware for additional security headers
"""

class CustomSecurityMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Log incoming requests for debugging
        if request.path.startswith('/api/products/my-products/'):
            print(f"🔍 DEBUG: Incoming request to {request.path}")
            print(f"🔍 DEBUG: Method: {request.method}")
            print(f"🔍 DEBUG: User: {getattr(request, 'user', 'Anonymous')}")
            print(f"🔍 DEBUG: Files: {list(request.FILES.keys())}")
        
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



