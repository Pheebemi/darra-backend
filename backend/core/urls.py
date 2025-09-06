"""
URL configuration for core project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import (
    TokenRefreshView,
    TokenVerifyView,
)
from django.conf import settings
from django.conf.urls.static import static
from .views import test_rate_limiting, test_burst_limit, test_sustained_limit

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('users.urls')),
    path('api/users/', include('users.urls')),  # Add this line for bank-detail access
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    path('api/products/', include('products.urls')),
    path('api/payments/', include('apps.payments.urls')),
    path('api/', include('apps.notifications.urls')),
    path('api/events/', include('apps.events.urls')),
    
    # Rate limiting test endpoints
    path('api/test/rate-limit/', test_rate_limiting, name='test_rate_limit'),
    path('api/test/burst-limit/', test_burst_limit, name='test_burst_limit'),
    path('api/test/sustained-limit/', test_sustained_limit, name='test_sustained_limit'),
]

# Serve media files (both development and production)
if settings.DEBUG:
    # Development: Django serves media files directly
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
else:
    # Production: Serve media files through Django (for deployment platforms like Render)
    from django.views.static import serve
    from django.urls import re_path
    
    # Serve media files in production
    urlpatterns += [
        re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
    ]
    
    # Static files are handled by WhiteNoise in production
