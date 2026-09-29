from rest_framework import serializers
from apps.notifications.models import Notification

class NotificationSerializer(serializers.ModelSerializer):
    time_ago = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = ['id', 'user_id', 'appointment_id', 'type', 'message', 'is_read', 'sent_at', 'time_ago']

    def get_time_ago(self, obj):
        from django.utils.timesince import timesince
        return timesince(obj.sent_at) + " ago"
