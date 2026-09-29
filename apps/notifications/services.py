from apps.notifications.models import Notification

class NotificationService:
    @staticmethod
    def create_notification(user, message, notif_type='GENERAL', appointment=None):
        if not user:
            return None
        return Notification.objects.create(
            user=user,
            appointment=appointment,
            type=notif_type,
            message=message,
            is_read=False
        )

    @staticmethod
    def mark_as_read(notification_id, user):
        return Notification.objects.filter(id=notification_id, user=user).update(is_read=True)

    @staticmethod
    def mark_all_as_read(user):
        return Notification.objects.filter(user=user, is_read=False).update(is_read=True)
