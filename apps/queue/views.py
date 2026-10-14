import datetime
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from apps.queue.models import QueueEntry
from apps.queue.serializers import (
    QueueEntrySerializer, WalkInRegistrationSerializer, UpdateQueueStatusSerializer, ReceptionRemarkSerializer
)
from apps.queue.services import QueueService
from apps.appointments.models import Appointment
from apps.doctors.models import Doctor
from apps.departments.models import Department
from apps.patients.models import Patient
from apps.patients.serializers import PatientHealthSerializer
from apps.accounts.models import User
from apps.accounts.permissions import IsReceptionist, IsDoctorOrReceptionist

QUEUE_RELATED = (
    'appointment__patient__user',
    'appointment__doctor__user',
    'appointment__doctor__clinic',
    'appointment__department',
    'appointment__slot',
    'appointment__consultation',
    'validated_by',
)

# Internal staff-only fields stripped from what a patient sees about their own entry.
PATIENT_HIDDEN_FIELDS = ('reception_remark', 'validated_by_name')


def own_doctor(user):
    if user.role == User.Role.DOCTOR:
        return Doctor.objects.select_related('user', 'department', 'clinic').filter(user=user).first()
    return None


def doctor_forbidden(user, entry):
    """Doctors may only act on their own patients."""
    return user.role == User.Role.DOCTOR and entry.appointment.doctor.user_id != user.id


class LiveQueueView(APIView):
    """Full queue with patient identities - staff only."""
    permission_classes = [IsDoctorOrReceptionist]

    def get(self, request):
        target_date_str = request.query_params.get('date')
        target_date = timezone.localdate()
        if target_date_str:
            try:
                target_date = datetime.date.fromisoformat(target_date_str)
            except ValueError:
                pass

        doctor_id = request.query_params.get('doctor_id')
        status_filter = request.query_params.get('status')

        # A doctor only ever sees their own queue
        current_doctor = own_doctor(request.user)
        if request.user.role == User.Role.DOCTOR:
            if not current_doctor:
                return Response({"error": {"code": "NOT_FOUND", "message": "No doctor profile linked to this account."}}, status=status.HTTP_404_NOT_FOUND)
            doctor_id = current_doctor.id

        # Sync any appointments for this doctor on this date that might be missing a QueueEntry
        if doctor_id:
            missing_appts = Appointment.objects.filter(
                doctor_id=doctor_id,
                appointment_date=target_date,
                queue_entry__isnull=True
            ).exclude(status=Appointment.Status.CANCELLED)
            for appt in missing_appts:
                QueueEntry.objects.create(
                    appointment=appt,
                    queue_date=target_date,
                    queue_position=QueueService.next_queue_position(target_date),
                    status=QueueEntry.Status.WAITING,
                )
            if missing_appts:
                QueueService.recalculate_queue(doctor_id, target_date)

        qs = QueueEntry.objects.filter(queue_date=target_date).select_related(*QUEUE_RELATED).order_by('queue_position')

        if doctor_id:
            qs = qs.filter(appointment__doctor_id=doctor_id)
        if status_filter:
            qs = qs.filter(status=status_filter)

        serializer = QueueEntrySerializer(qs, many=True)
        return Response({
            "data": {
                "date": target_date.isoformat(),
                "doctor_id": doctor_id,
                "doctor_name": current_doctor.user.full_name if current_doctor else None,
                "specialization": current_doctor.specialization if current_doctor else None,
                "total": qs.count(),
                "queue": serializer.data
            }
        })


class PatientQueueStatusView(APIView):
    """A patient's own live position. Staff may look up any appointment."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        appointment_id = request.query_params.get('appointment_id')
        token_number = request.query_params.get('token_number')
        target_date = timezone.localdate()
        is_patient = request.user.role == User.Role.PATIENT

        patient = Patient.objects.filter(user=request.user).first() if is_patient else None
        if is_patient and not patient:
            return Response({"data": None, "message": "No active queue entry found."}, status=status.HTTP_200_OK)

        base = QueueEntry.objects.select_related(*QUEUE_RELATED)
        if is_patient:
            base = base.filter(appointment__patient=patient)

        entry = None
        if appointment_id:
            entry = base.filter(appointment_id=appointment_id).first()
        elif token_number:
            entry = base.filter(appointment__token_number=token_number, queue_date=target_date).first()
        elif patient:
            # Today's active appointment first, then the next upcoming one, then the latest overall
            entry = (
                base.filter(queue_date=target_date).exclude(status=QueueEntry.Status.COMPLETED)
                .order_by('queue_position', '-id').first()
                or base.filter(queue_date__gt=target_date).order_by('queue_date', 'queue_position').first()
                or base.order_by('-queue_date', '-id').first()
            )

        if not entry:
            return Response({
                "data": None,
                "message": "No active queue entry found."
            }, status=status.HTTP_200_OK)

        QueueService.recalculate_queue(entry.appointment.doctor_id, entry.queue_date)
        entry.refresh_from_db()

        data = dict(QueueEntrySerializer(entry).data)
        if is_patient:
            for field in PATIENT_HIDDEN_FIELDS:
                data.pop(field, None)
        data['queue'] = QueueService.patient_snapshot(entry)
        return Response({"data": data})


class WalkInRegistrationView(APIView):
    permission_classes = [IsReceptionist]

    def post(self, request):
        serializer = WalkInRegistrationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Validation failed",
                    "fields": serializer.errors
                }
            }, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        doctor = Doctor.objects.select_related('clinic', 'user', 'department').prefetch_related('availabilities').filter(
            pk=data['doctor_id'], user__is_active=True
        ).first()
        if not doctor:
            return Response({"error": {"code": "NOT_FOUND", "message": "Doctor not found."}}, status=status.HTTP_404_NOT_FOUND)

        department = doctor.department
        if data.get('department_id'):
            department = Department.objects.filter(pk=data['department_id']).first()
            if not department:
                return Response({"error": {"code": "NOT_FOUND", "message": "Department not found."}}, status=status.HTTP_404_NOT_FOUND)

        entry, err = QueueService.register_walk_in(
            clinic=doctor.clinic,
            doctor=doctor,
            department=department,
            patient_name=data['patient_name'],
            patient_phone=data['patient_phone'].strip(),
            user=request.user,
            problem_description=data.get('problem_description'),
            health={f: data.get(f) for f in PatientHealthSerializer.HEALTH_FIELDS},
        )

        if err:
            return Response({"error": {"code": "WALK_IN_ERROR", "message": err}}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"data": QueueEntrySerializer(entry).data}, status=status.HTTP_201_CREATED)


class CallNextPatientView(APIView):
    permission_classes = [IsDoctorOrReceptionist]

    def post(self, request):
        doctor = own_doctor(request.user)
        if not doctor:
            doctor_id = request.data.get('doctor_id')
            if not doctor_id:
                return Response({"error": {"code": "VALIDATION_ERROR", "message": "Doctor ID required."}}, status=status.HTTP_400_BAD_REQUEST)
            doctor = Doctor.objects.select_related('clinic', 'user').filter(pk=doctor_id).first()
            if not doctor:
                return Response({"error": {"code": "NOT_FOUND", "message": "Doctor not found."}}, status=status.HTTP_404_NOT_FOUND)

        entry, err = QueueService.call_next_patient(doctor=doctor, user=request.user)
        if err:
            return Response({"error": {"code": "QUEUE_EMPTY", "message": err}}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"data": QueueEntrySerializer(entry).data})


class UpdateQueueStatusView(APIView):
    permission_classes = [IsDoctorOrReceptionist]

    def post(self, request):
        serializer = UpdateQueueStatusSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Validation failed",
                    "fields": serializer.errors
                }
            }, status=status.HTTP_400_BAD_REQUEST)

        appointment_id = serializer.validated_data['appointment_id']
        entry = QueueEntry.objects.select_related('appointment__doctor').filter(appointment_id=appointment_id).first()
        if entry and doctor_forbidden(request.user, entry):
            return Response({"error": {"code": "FORBIDDEN", "message": "This patient is in another doctor's queue."}}, status=status.HTTP_403_FORBIDDEN)

        entry, err = QueueService.update_queue_status(
            appointment_id=appointment_id,
            new_status=serializer.validated_data['status'],
            user=request.user,
            notes=serializer.validated_data.get('notes', ''),
            prescription_notes=serializer.validated_data.get('prescription_notes', '')
        )

        if err:
            return Response({"error": {"code": "UPDATE_ERROR", "message": err}}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"data": QueueEntrySerializer(entry).data})


class ValidatePatientView(APIView):
    """Receptionist validates (checks in) a patient so the doctor can call them."""
    permission_classes = [IsReceptionist]

    def post(self, request):
        appointment_id = request.data.get('appointment_id')
        if not appointment_id:
            return Response({"error": {"code": "VALIDATION_ERROR", "message": "appointment_id is required."}}, status=status.HTTP_400_BAD_REQUEST)

        entry, err = QueueService.validate_entry(appointment_id, user=request.user)
        if err:
            if not QueueEntry.objects.filter(appointment_id=appointment_id).exists():
                return Response({"error": {"code": "NOT_FOUND", "message": err}}, status=status.HTTP_404_NOT_FOUND)
            return Response({"error": {"code": "VALIDATION_ERROR", "message": err}}, status=status.HTTP_400_BAD_REQUEST)

        entry = QueueEntry.objects.select_related(*QUEUE_RELATED).get(pk=entry.pk)
        return Response({"data": QueueEntrySerializer(entry).data})


class ReceptionRemarkView(APIView):
    """Receptionist adds / edits an internal remark on an appointment (e.g. 'fee paid', 'reports pending')."""
    permission_classes = [IsReceptionist]

    def post(self, request):
        serializer = ReceptionRemarkSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"error": {"code": "VALIDATION_ERROR", "message": "Remark must be 500 characters or fewer.", "fields": serializer.errors}}, status=status.HTTP_400_BAD_REQUEST)

        appt = Appointment.objects.select_related('doctor__clinic').filter(pk=serializer.validated_data['appointment_id']).first()
        if not appt:
            return Response({"error": {"code": "NOT_FOUND", "message": "Appointment not found."}}, status=status.HTTP_404_NOT_FOUND)

        appt.reception_remark = serializer.validated_data['remark'].strip() or None
        appt.save(update_fields=['reception_remark'])

        from apps.dashboard.services import DashboardService
        DashboardService.log_activity(user=request.user, clinic=appt.doctor.clinic, action='RECEPTION_REMARK_UPDATED', entity_type='APPOINTMENT', entity_id=appt.id)
        return Response({"data": {"appointment_id": appt.id, "reception_remark": appt.reception_remark}})
