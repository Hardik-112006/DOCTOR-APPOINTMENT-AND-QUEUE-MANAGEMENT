from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from apps.notifications.models import Notification
from apps.notifications.serializers import NotificationSerializer
from apps.notifications.services import NotificationService

class NotificationListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        notifs = Notification.objects.filter(user=request.user).order_by('-sent_at')[:30]
        serializer = NotificationSerializer(notifs, many=True)
        unread_count = Notification.objects.filter(user=request.user, is_read=False).count()
        return Response({
            "data": {
                "unread_count": unread_count,
                "notifications": serializer.data
            }
        })

class MarkNotificationReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        NotificationService.mark_as_read(pk, request.user)
        return Response({"data": {"message": "Notification marked as read."}})

class MarkAllNotificationsReadView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        NotificationService.mark_all_as_read(request.user)
        return Response({"data": {"message": "All notifications marked as read."}})
