# pyrefly: ignore [missing-import]
from rest_framework.views import APIView
# pyrefly: ignore [missing-import]
from rest_framework.response import Response

# pyrefly: ignore [missing-import]
from rest_framework import permissions, status
# pyrefly: ignore [missing-import]
from django.utils import timezone
# pyrefly: ignore [missing-import]
from apps.appointments.models import Appointment
from apps.appointments.serializers import AppointmentSerializer, BookAppointmentSerializer
from apps.appointments.services import AppointmentService
from apps.doctors.models import Doctor
from apps.patients.models import Patient
from apps.patients.serializers import PatientHealthSerializer
from apps.accounts.permissions import IsPatient

class BookAppointmentView(APIView):
    permission_classes = [IsPatient]

    def post(self, request):
        serializer = BookAppointmentSerializer(data=request.data)
        if not serializer.is_valid():
            first_field, first_errors = next(iter(serializer.errors.items()))
            first_error = first_errors[0] if isinstance(first_errors, list) else first_errors
            return Response({
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": f"{first_field.replace('_', ' ').capitalize()}: {first_error}",
                    "fields": serializer.errors
                }
            }, status=status.HTTP_400_BAD_REQUEST)

        # Ensure patient profile exists
        if not hasattr(request.user, 'patient_profile'):
            patient, _ = Patient.objects.get_or_create(user=request.user, defaults={'phone': request.user.phone})
        else:
            patient = request.user.patient_profile

        data = serializer.validated_data
        try:
            doctor = Doctor.objects.select_related('department', 'clinic', 'user').prefetch_related('availabilities').get(pk=data['doctor_id'])
        except Doctor.DoesNotExist:
            return Response({"error": {"code": "NOT_FOUND", "message": "Doctor not found"}}, status=status.HTTP_404_NOT_FOUND)

        # Optional health details typed on the booking form go on the patient's profile
        PatientHealthSerializer.apply(patient, {f: data.get(f) for f in PatientHealthSerializer.HEALTH_FIELDS})

        # Patients always book online; walk-ins are registered by the receptionist at the desk.
        appointment, err = AppointmentService.book_appointment(
            patient=patient,
            doctor=doctor,
            department=doctor.department,
            appointment_date=data['appointment_date'],
            slot_id=data.get('slot_id'),
            booking_type=Appointment.BookingType.ONLINE,
            user=request.user,
            problem_description=data.get('problem_description'),
        )

        if err:
            return Response({"error": {"code": "BOOKING_ERROR", "message": err}}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            "data": AppointmentSerializer(appointment).data
        }, status=status.HTTP_201_CREATED)

class MyAppointmentsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        patient = None
        if hasattr(request.user, 'patient_profile'):
            patient = request.user.patient_profile
        else:
            patient = Patient.objects.filter(user=request.user).first()

        if patient:
            appts = Appointment.objects.filter(patient=patient).select_related(
                'doctor__user', 'doctor__department', 'department', 'slot', 'patient__user', 'consultation', 'queue_entry'
            ).order_by('-appointment_date', '-id')
        else:
            appts = Appointment.objects.filter(patient__user=request.user).select_related(
                'doctor__user', 'doctor__department', 'department', 'slot', 'patient__user', 'consultation', 'queue_entry'
            ).order_by('-appointment_date', '-id')

        # Dynamically recalculate doctor queues for active appointments today
        from apps.queue.services import QueueService
        today = timezone.localdate()
        doc_ids = appts.filter(appointment_date=today, status=Appointment.Status.WAITING).values_list('doctor_id', flat=True).distinct()
        for doc_id in doc_ids:
            QueueService.recalculate_queue(doc_id, today)

        serializer = AppointmentSerializer(appts, many=True)
        return Response({"data": serializer.data})

class CancelAppointmentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            appt = Appointment.objects.get(pk=pk)
        except Appointment.DoesNotExist:
            return Response({"error": {"code": "NOT_FOUND", "message": "Appointment not found"}}, status=status.HTTP_404_NOT_FOUND)

        # Ownership check
        if request.user.role not in ('ADMIN', 'RECEPTIONIST'):
            if appt.patient.user != request.user:
                return Response({"error": {"code": "FORBIDDEN", "message": "You cannot cancel this appointment."}}, status=status.HTTP_403_FORBIDDEN)
            if appt.status not in (Appointment.Status.BOOKED, Appointment.Status.WAITING):
                return Response({"error": {"code": "CANCELLATION_ERROR", "message": "This appointment can no longer be cancelled online. Please speak to the reception desk."}}, status=status.HTTP_400_BAD_REQUEST)

        success, err = AppointmentService.cancel_appointment(pk, user=request.user)
        if not success:
            return Response({"error": {"code": "CANCELLATION_ERROR", "message": err}}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"data": {"message": "Appointment cancelled successfully."}})
