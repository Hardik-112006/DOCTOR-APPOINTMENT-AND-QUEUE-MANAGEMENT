import datetime
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from apps.queue.models import QueueEntry
from apps.queue.serializers import QueueEntrySerializer, WalkInRegistrationSerializer, UpdateQueueStatusSerializer
from apps.queue.services import QueueService
from apps.appointments.models import Appointment
from apps.doctors.models import Doctor
from apps.departments.models import Department
from apps.accounts.permissions import IsDoctor, IsReceptionist, IsDoctorOrReceptionist

class LiveQueueView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from django.db.models import Max
        target_date_str = request.query_params.get('date')
        if target_date_str:
            try:
                target_date = datetime.date.fromisoformat(target_date_str)
            except ValueError:
                target_date = timezone.localdate()
        else:
            target_date = timezone.localdate()

        doctor_id = request.query_params.get('doctor_id')
        status_filter = request.query_params.get('status')

        # If logged in user is a Doctor, resolve their doctor_id automatically
        current_doctor = None
        if request.user.role == 'DOCTOR' or hasattr(request.user, 'doctor_profile'):
            current_doctor = Doctor.objects.select_related('user', 'department').filter(user=request.user).first()
            if current_doctor and not doctor_id:
                doctor_id = current_doctor.id

        # Sync any appointments for this doctor on this date that might be missing a QueueEntry
        if doctor_id:
            missing_appts = Appointment.objects.filter(
                doctor_id=doctor_id,
                appointment_date=target_date,
                queue_entry__isnull=True
            ).exclude(status=Appointment.Status.CANCELLED)
            for appt in missing_appts:
                max_pos = QueueEntry.objects.filter(queue_date=target_date, appointment__doctor_id=doctor_id).aggregate(max_p=Max('queue_position'))['max_p'] or 0
                QueueEntry.objects.create(
                    appointment=appt,
                    queue_date=target_date,
                    queue_position=max_pos + 1,
                    status=QueueEntry.Status.WAITING,
                    arrival_time=timezone.now() if target_date == timezone.localdate() else None
                )

        qs = QueueEntry.objects.filter(queue_date=target_date).select_related(
            'appointment__patient__user',
            'appointment__doctor__user',
            'appointment__department',
            'appointment__slot'
        ).order_by('queue_position')

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
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        appointment_id = request.query_params.get('appointment_id')
        token_number = request.query_params.get('token_number')
        target_date = timezone.localdate()

        patient = None
        if hasattr(request.user, 'patient_profile'):
            patient = request.user.patient_profile
        else:
            patient = Patient.objects.filter(user=request.user).first()

        entry = None
        if appointment_id:
            entry = QueueEntry.objects.filter(appointment_id=appointment_id).select_related(
                'appointment__patient__user', 'appointment__doctor__user',
                'appointment__department', 'appointment__slot', 'appointment__consultation'
            ).first()
        elif token_number:
            entry = QueueEntry.objects.filter(appointment__token_number=token_number).select_related(
                'appointment__patient__user', 'appointment__doctor__user',
                'appointment__department', 'appointment__slot', 'appointment__consultation'
            ).first()
        elif patient:
            # Find today's active appointment for this patient
            entry = QueueEntry.objects.filter(
                appointment__patient=patient,
                queue_date=target_date
            ).exclude(status=QueueEntry.Status.COMPLETED).select_related(
                'appointment__patient__user', 'appointment__doctor__user',
                'appointment__department', 'appointment__slot', 'appointment__consultation'
            ).order_by('queue_position', '-id').first()

            if not entry:
                # Any active queue entry
                entry = QueueEntry.objects.filter(
                    appointment__patient=patient
                ).exclude(status=QueueEntry.Status.COMPLETED).select_related(
                    'appointment__patient__user', 'appointment__doctor__user',
                    'appointment__department', 'appointment__slot', 'appointment__consultation'
                ).order_by('-queue_date', 'queue_position').first()

            if not entry:
                # Latest entry overall
                entry = QueueEntry.objects.filter(
                    appointment__patient=patient
                ).select_related(
                    'appointment__patient__user', 'appointment__doctor__user',
                    'appointment__department', 'appointment__slot', 'appointment__consultation'
                ).order_by('-queue_date', '-id').first()

        if not entry:
            return Response({
                "data": None,
                "message": "No active queue entry found."
            }, status=status.HTTP_200_OK)

        QueueService.recalculate_queue(entry.appointment.doctor_id, entry.queue_date)
        entry.refresh_from_db()

        serializer = QueueEntrySerializer(entry)
        return Response({"data": serializer.data})

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

        doctor_id = serializer.validated_data['doctor_id']
        department_id = serializer.validated_data['department_id']
        patient_name = serializer.validated_data['patient_name']
        patient_phone = serializer.validated_data['patient_phone']

        try:
            doctor = Doctor.objects.select_related('clinic', 'user').get(pk=doctor_id)
            department = Department.objects.get(pk=department_id)
        except (Doctor.DoesNotExist, Department.DoesNotExist):
            return Response({"error": {"code": "NOT_FOUND", "message": "Doctor or Department not found."}}, status=status.HTTP_404_NOT_FOUND)

        entry, err = QueueService.register_walk_in(
            clinic=doctor.clinic,
            doctor=doctor,
            department=department,
            patient_name=patient_name,
            patient_phone=patient_phone,
            user=request.user
        )

        if err:
            return Response({"error": {"code": "WALK_IN_ERROR", "message": err}}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"data": QueueEntrySerializer(entry).data}, status=status.HTTP_201_CREATED)

class CallNextPatientView(APIView):
    permission_classes = [IsDoctorOrReceptionist]

    def post(self, request):
        doctor_id = request.data.get('doctor_id')
        if not doctor_id and hasattr(request.user, 'doctor_profile'):
            doctor_id = request.user.doctor_profile.id

        if not doctor_id:
            return Response({"error": {"code": "VALIDATION_ERROR", "message": "Doctor ID required."}}, status=status.HTTP_400_BAD_REQUEST)

        try:
            doctor = Doctor.objects.select_related('clinic', 'user').get(pk=doctor_id)
        except Doctor.DoesNotExist:
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
        new_status = serializer.validated_data['status']
        notes = serializer.validated_data.get('notes', '')
        prescription_notes = serializer.validated_data.get('prescription_notes', '')

        entry, err = QueueService.update_queue_status(
            appointment_id=appointment_id,
            new_status=new_status,
            user=request.user,
            notes=notes,
            prescription_notes=prescription_notes
        )

        if err:
            return Response({"error": {"code": "UPDATE_ERROR", "message": err}}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"data": QueueEntrySerializer(entry).data})

class MarkArrivedView(APIView):
    permission_classes = [IsReceptionist]

    def post(self, request):
        appointment_id = request.data.get('appointment_id')
        if not appointment_id:
            return Response({"error": {"code": "VALIDATION_ERROR", "message": "appointment_id is required."}}, status=status.HTTP_400_BAD_REQUEST)

        entry = QueueEntry.objects.filter(appointment_id=appointment_id).first()
        if not entry:
            return Response({"error": {"code": "NOT_FOUND", "message": "Queue entry not found."}}, status=status.HTTP_404_NOT_FOUND)

        entry.arrival_time = timezone.now()
        entry.save(update_fields=['arrival_time'])

        try:
            from apps.dashboard.services import DashboardService
            doctor_clinic = entry.appointment.doctor.clinic if (entry.appointment and entry.appointment.doctor) else None
            DashboardService.log_activity(
                user=request.user,
                clinic=doctor_clinic,
                action='PATIENT_ARRIVED',
                entity_type='QueueEntry',
                entity_id=entry.id
            )
        except Exception:
            pass

        return Response({"data": QueueEntrySerializer(entry).data})
