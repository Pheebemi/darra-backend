from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Notification
from .serializers import NotificationSerializer
from .services import NotificationService

class NotificationViewSet(viewsets.ModelViewSet):
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user).order_by('-created_at')
    
    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAdminUser])
    def send_promotional(self, request):
        """Send promotional notification to all users (admin only)"""
        try:
            title = request.data.get('title', 'New Update Available!')
            body = request.data.get('body', 'Check out our latest products and deals!')
            data = request.data.get('data', {})
            
            count = NotificationService.send_bulk_promotional_notifications(
                title=title,
                body=body,
                data=data
            )
            
            return Response({
                'message': f'Successfully sent {count} promotional notifications',
                'notifications_sent': count
            })
        except Exception as e:
            return Response({
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['post'])
    def test_notification(self, request):
        """Test notification creation (for debugging)"""
        try:
            title = request.data.get('title', 'Test Notification')
            body = request.data.get('body', 'This is a test notification')
            notification_type = request.data.get('type', 'general')
            
            notification = NotificationService.create_notification(
                user=request.user,
                title=title,
                body=body,
                notification_type=notification_type,
                data={'test': True}
            )
            
            if notification:
                return Response({
                    'message': 'Test notification created successfully',
                    'notification_id': notification.id
                })
            else:
                return Response({
                    'error': 'Failed to create notification'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            return Response({
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['patch'])
    def mark_as_read(self, request, pk=None):
        """Mark a notification as read"""
        try:
            notification = self.get_object()
            notification.read = True
            notification.save()
            
            return Response({
                'message': 'Notification marked as read',
                'notification_id': pk
            })
        except Exception as e:
            return Response({
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
