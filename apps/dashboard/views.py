import datetime
# pyrefly: ignore [missing-import]
from django.utils import timezone
# pyrefly: ignore [missing-import]
from rest_framework.views import APIView
# pyrefly: ignore [missing-import]
from rest_framework.response import Response
# pyrefly: ignore [missing-import]
from rest_framework import permissions, status
# pyrefly: ignore [missing-import]
from django.db.models import Q
from apps.clinics.models import Clinic
from apps.dashboard.models import ActivityLog
from apps.dashboard.services import DashboardService
from apps.dashboard.serializers import ActivityLogSerializer

def resolve_clinic(request, clinic_id=None):
    if clinic_id:
        return Clinic.objects.filter(pk=clinic_id).first()
    if hasattr(request.user, 'doctor_profile') and request.user.doctor_profile:
        return request.user.doctor_profile.clinic
    if Clinic.objects.exists():
        return Clinic.objects.first()
    return None

class ClinicMetricsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        clinic_id = request.query_params.get('clinic_id')
        date_str = request.query_params.get('date')

        target_date = timezone.localdate()
        if date_str:
            try:
                target_date = datetime.date.fromisoformat(date_str)
            except ValueError:
                pass

        clinic = resolve_clinic(request, clinic_id)
        metrics = DashboardService.get_clinic_metrics(clinic=clinic, target_date=target_date)
        return Response({"data": metrics})

class ActivityLogsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        clinic_id = request.query_params.get('clinic_id')
        try:
            limit = max(1, min(int(request.query_params.get('limit', 50)), 100))
        except (ValueError, TypeError):
            limit = 50
        try:
            offset = max(0, int(request.query_params.get('offset', 0)))
        except (ValueError, TypeError):
            offset = 0

        clinic = resolve_clinic(request, clinic_id)

        qs = ActivityLog.objects.select_related('user').order_by('-created_at')
        if clinic:
            qs = qs.filter(Q(clinic=clinic) | Q(clinic__isnull=True))

        total_count = qs.count()
        logs = qs[offset:offset + limit]
        serializer = ActivityLogSerializer(logs, many=True)
        return Response({
            "data": serializer.data,
            "total": total_count,
            "limit": limit,
            "offset": offset
        })

class DailyProgressView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        clinic_id = request.query_params.get('clinic_id')
        date_str = request.query_params.get('date')

        target_date = timezone.localdate()
        if date_str:
            try:
                target_date = datetime.date.fromisoformat(date_str)
            except ValueError:
                pass

        clinic = resolve_clinic(request, clinic_id)
        daily_progress = DashboardService.get_daily_progress(clinic=clinic, target_date=target_date)
        return Response({"data": daily_progress})

