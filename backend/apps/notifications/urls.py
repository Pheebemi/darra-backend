from rest_framework import routers
from .views import NotificationViewSet

router = routers.DefaultRouter()
router.register(r'notifications', NotificationViewSet, basename='notification')

urlpatterns = router.urls
