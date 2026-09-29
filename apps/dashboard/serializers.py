# pyrefly: ignore [missing-import]
from rest_framework import serializers
from apps.dashboard.models import ActivityLog
from apps.dashboard.services import DashboardService
# pyrefly: ignore [missing-import]
from django.utils import timezone

class ActivityLogSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()
    user_role = serializers.SerializerMethodField()
    action_display = serializers.SerializerMethodField()
    created_at_time = serializers.SerializerMethodField()
    created_at_formatted = serializers.SerializerMethodField()
    created_at_full = serializers.SerializerMethodField()
    time_ago = serializers.SerializerMethodField()

    class Meta:
        model = ActivityLog
        fields = [
            'id', 'user_id', 'user', 'user_role', 'action',
            'action_display', 'entity_type', 'entity_id',
            'created_at', 'created_at_time', 'created_at_formatted', 'created_at_full', 'time_ago'
        ]

    def get_user(self, obj):
        return obj.user.full_name if obj.user else 'System'

    def get_user_role(self, obj):
        return obj.user.role if obj.user else 'SYSTEM'

    def get_action_display(self, obj):
        return DashboardService.format_action_display(obj.action, obj.entity_type, obj.entity_id)

    def get_created_at_time(self, obj):
        local_dt = timezone.localtime(obj.created_at) if obj.created_at else None
        return local_dt.strftime('%H:%M:%S') if local_dt else ''

    def get_created_at_formatted(self, obj):
        local_dt = timezone.localtime(obj.created_at) if obj.created_at else None
        return local_dt.strftime('%d %b %Y, %I:%M %p') if local_dt else ''

    def get_created_at_full(self, obj):
        local_dt = timezone.localtime(obj.created_at) if obj.created_at else None
        return local_dt.strftime('%d %b %Y, %I:%M %p') if local_dt else ''

    def get_time_ago(self, obj):
        if not obj.created_at:
            return ''
        now = timezone.now()
        diff = now - obj.created_at
        seconds = int(diff.total_seconds())
        if seconds < 30:
            return 'Just now'
        elif seconds < 60:
            return f'{seconds}s ago'
        elif seconds < 3600:
            return f'{seconds // 60}m ago'
        elif seconds < 86400:
            return f'{seconds // 3600}h ago'
        else:
            return f'{seconds // 86400}d ago'
