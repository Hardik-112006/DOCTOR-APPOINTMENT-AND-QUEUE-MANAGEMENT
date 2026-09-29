from django.urls import path
from apps.dashboard.views import ClinicMetricsView, ActivityLogsView, DailyProgressView

urlpatterns = [
    path('metrics/', ClinicMetricsView.as_view(), name='dashboard_metrics'),
    path('activity-logs/', ActivityLogsView.as_view(), name='dashboard_activity_logs'),
    path('daily-progress/', DailyProgressView.as_view(), name='dashboard_daily_progress'),
]
