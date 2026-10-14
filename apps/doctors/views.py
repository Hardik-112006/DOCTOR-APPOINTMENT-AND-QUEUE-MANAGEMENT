import datetime
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from apps.accounts.permissions import IsReceptionist, IsDoctorOrReceptionist
from apps.doctors.models import Doctor, DoctorAvailability
from apps.doctors.serializers import DoctorSerializer, DoctorAvailabilitySerializer, DoctorScheduleUpdateSerializer
from apps.doctors.services import ScheduleService, day_code
from apps.appointments.serializers import SlotSerializer
from apps.queue.models import QueueEntry


def active_doctors():
    return Doctor.objects.select_related('user', 'department', 'clinic').prefetch_related('availabilities').filter(
        user__is_active=True, user__is_verified=True
    )


def parse_date(value):
    if not value:
        return timezone.localdate()
    return datetime.date.fromisoformat(value)


class DoctorListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        clinic_id = request.query_params.get('clinic_id')
        department_id = request.query_params.get('department_id')

        doctors = active_doctors()
        if clinic_id:
            doctors = doctors.filter(clinic_id=clinic_id)
        if department_id:
            doctors = doctors.filter(department_id=department_id)

        serializer = DoctorSerializer(doctors, many=True)
        return Response({"data": serializer.data})


class DoctorAvailabilityView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        try:
            doctor = Doctor.objects.select_related('user', 'department', 'clinic').prefetch_related('availabilities').get(pk=pk)
        except Doctor.DoesNotExist:
            return Response({"error": {"code": "NOT_FOUND", "message": "Doctor not found"}}, status=status.HTTP_404_NOT_FOUND)

        today = timezone.localdate()
        today_code = day_code(today)

        availabilities = doctor.availabilities.filter(is_active=True)
        today_avail = availabilities.filter(day_of_week=today_code).first()

        return Response({
            "data": {
                "doctor_id": doctor.id,
                "doctor_name": doctor.user.full_name,
                "specialization": doctor.specialization,
                "is_available": doctor.is_available,
                "availabilities": DoctorAvailabilitySerializer(availabilities, many=True).data,
                "today_day_of_week": today_code,
                "today_available": bool(today_avail and doctor.is_available),
                "today_schedule": {
                    "start_time": today_avail.start_time.strftime('%H:%M:%S') if today_avail else None,
                    "end_time": today_avail.end_time.strftime('%H:%M:%S') if today_avail else None
                } if today_avail else None
            }
        })


class DoctorSlotsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        doctor = Doctor.objects.select_related('user', 'department', 'clinic').prefetch_related('availabilities').filter(pk=pk).first()
        if not doctor:
            return Response({"error": {"code": "NOT_FOUND", "message": "Doctor not found"}}, status=status.HTTP_404_NOT_FOUND)

        try:
            target_date = parse_date(request.query_params.get('date'))
        except ValueError:
            return Response({"error": {"code": "VALIDATION_ERROR", "message": "Invalid date format. Use YYYY-MM-DD"}}, status=status.HTTP_400_BAD_REQUEST)

        # When booking isn't possible (past date, day off, doctor unavailable...) say why instead of showing an empty grid.
        unavailable_reason = ScheduleService.booking_block_reason(doctor, target_date)
        slots = [] if unavailable_reason else ScheduleService.sync_slots(doctor, target_date)

        slot_data = []
        for slot in slots:
            item = SlotSerializer(slot).data
            item['is_past'] = ScheduleService.slot_is_past(slot)
            slot_data.append(item)

        return Response({
            "data": {
                "doctor": DoctorSerializer(doctor).data,
                "date": target_date.isoformat(),
                "unavailable_reason": unavailable_reason,
                "slots": slot_data
            }
        })


class DoctorRosterView(APIView):
    """How many doctors there are, who is on duty, their timings and current queue load."""
    permission_classes = [IsDoctorOrReceptionist]

    def get(self, request):
        try:
            target_date = parse_date(request.query_params.get('date'))
        except ValueError:
            return Response({"error": {"code": "VALIDATION_ERROR", "message": "Invalid date format. Use YYYY-MM-DD"}}, status=status.HTTP_400_BAD_REQUEST)

        doctors = list(active_doctors().order_by('department__name', 'user__full_name'))
        loads = {
            row['appointment__doctor_id']: row
            for row in QueueEntry.objects.filter(queue_date=target_date).values('appointment__doctor_id').annotate(
                waiting=Count('id', filter=Q(status=QueueEntry.Status.WAITING)),
                waiting_validated=Count('id', filter=Q(status=QueueEntry.Status.WAITING, validated_at__isnull=False)),
                in_room=Count('id', filter=Q(status__in=[QueueEntry.Status.CALLED, QueueEntry.Status.CONSULTING])),
                completed=Count('id', filter=Q(status=QueueEntry.Status.COMPLETED)),
            )
        }
        # Later rows win, so ordering by status lets CONSULTING override CALLED for the same doctor.
        serving = {
            e.appointment.doctor_id: e.appointment.token_number
            for e in QueueEntry.objects.filter(
                queue_date=target_date, status__in=[QueueEntry.Status.CALLED, QueueEntry.Status.CONSULTING]
            ).select_related('appointment').order_by('status', 'queue_position')
        }

        roster = []
        for doc in doctors:
            load = loads.get(doc.id, {})
            duty = ScheduleService.duty_status(doc, target_date)
            roster.append({
                'id': doc.id,
                'name': doc.user.full_name,
                'phone': doc.user.phone,
                'department_id': doc.department_id,
                'department_name': doc.department.name,
                'specialization': doc.specialization,
                'consultation_fee': str(doc.consultation_fee),
                'is_available': doc.is_available,
                'duty_status': duty['status'],
                'next_start': duty['next_start'],
                'windows': duty['windows'],
                'availabilities': DoctorAvailabilitySerializer(
                    [a for a in doc.availabilities.all() if a.is_active], many=True
                ).data,
                'waiting': load.get('waiting', 0),
                'waiting_validated': load.get('waiting_validated', 0),
                'in_room': load.get('in_room', 0),
                'completed': load.get('completed', 0),
                'now_serving': serving.get(doc.id),
            })

        summary = {
            'total': len(roster),
            'on_duty': sum(1 for d in roster if d['duty_status'] == 'ON_DUTY'),
            'later_today': sum(1 for d in roster if d['duty_status'] == 'LATER_TODAY'),
            'scheduled': sum(1 for d in roster if d['duty_status'] in ('ON_DUTY', 'LATER_TODAY', 'DONE_FOR_TODAY', 'SCHEDULED')),
            'off': sum(1 for d in roster if d['duty_status'] in ('OFF_TODAY', 'UNAVAILABLE')),
        }
        return Response({"data": {"date": target_date.isoformat(), "summary": summary, "doctors": roster}})


class DoctorScheduleView(APIView):
    """Receptionist / admin sets a doctor's weekly check-in timings and whether they are taking patients."""
    permission_classes = [IsReceptionist]

    def put(self, request, pk):
        doctor = Doctor.objects.select_related('user', 'department', 'clinic').filter(pk=pk).first()
        if not doctor:
            return Response({"error": {"code": "NOT_FOUND", "message": "Doctor not found"}}, status=status.HTTP_404_NOT_FOUND)

        serializer = DoctorScheduleUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            errors = serializer.errors
            message = "Invalid schedule."
            if 'availabilities' in errors:
                raw = errors['availabilities']
                if isinstance(raw, list):
                    flat = [m for item in raw for m in (item.get('non_field_errors', []) if isinstance(item, dict) else [item])]
                    message = str(flat[0]) if flat else message
            return Response({"error": {"code": "VALIDATION_ERROR", "message": message, "fields": errors}}, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        with transaction.atomic():
            if 'is_available' in data:
                doctor.is_available = data['is_available']
                doctor.save(update_fields=['is_available'])
            if 'availabilities' in data:
                DoctorAvailability.objects.filter(doctor=doctor).delete()
                DoctorAvailability.objects.bulk_create([
                    DoctorAvailability(doctor=doctor, day_of_week=w['day_of_week'], start_time=w['start_time'], end_time=w['end_time'], is_active=True)
                    for w in data['availabilities']
                ])

        from apps.dashboard.services import DashboardService
        DashboardService.log_activity(user=request.user, clinic=doctor.clinic, action='DOCTOR_SCHEDULE_UPDATED', entity_type='Doctor', entity_id=doctor.id)

        doctor = active_doctors().filter(pk=pk).first() or doctor
        return Response({"data": DoctorSerializer(doctor).data})
