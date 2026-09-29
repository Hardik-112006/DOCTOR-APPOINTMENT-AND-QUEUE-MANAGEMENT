from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from apps.appointments.models import Appointment
from apps.appointments.serializers import AppointmentSerializer, BookAppointmentSerializer
from apps.appointments.services import AppointmentService
from apps.doctors.models import Doctor
from apps.patients.models import Patient

class BookAppointmentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = BookAppointmentSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Validation failed",
                    "fields": serializer.errors
                }
            }, status=status.HTTP_400_BAD_REQUEST)

        # Ensure patient profile exists
        if not hasattr(request.user, 'patient_profile'):
            patient, _ = Patient.objects.get_or_create(user=request.user, defaults={'phone': request.user.phone})
        else:
            patient = request.user.patient_profile

        doctor_id = serializer.validated_data['doctor_id']
        try:
            doctor = Doctor.objects.select_related('department', 'clinic', 'user').get(pk=doctor_id)
        except Doctor.DoesNotExist:
            return Response({"error": {"code": "NOT_FOUND", "message": "Doctor not found"}}, status=status.HTTP_404_NOT_FOUND)

        appointment_date = serializer.validated_data['appointment_date']
        slot_id = serializer.validated_data.get('slot_id')
        booking_type = serializer.validated_data.get('booking_type', Appointment.BookingType.ONLINE)

        appointment, err = AppointmentService.book_appointment(
            patient=patient,
            doctor=doctor,
            department=doctor.department,
            appointment_date=appointment_date,
            slot_id=slot_id,
            booking_type=booking_type,
            user=request.user
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
                'doctor__user', 'doctor__department', 'department', 'slot', 'patient__user'
            ).order_by('-appointment_date', '-id')
        else:
            appts = Appointment.objects.filter(patient__user=request.user).select_related(
                'doctor__user', 'doctor__department', 'department', 'slot', 'patient__user'
            ).order_by('-appointment_date', '-id')

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
        if request.user.role not in ('ADMIN', 'RECEPTIONIST') and appt.patient.user != request.user:
            return Response({"error": {"code": "FORBIDDEN", "message": "You cannot cancel this appointment."}}, status=status.HTTP_403_FORBIDDEN)

        success, err = AppointmentService.cancel_appointment(pk, user=request.user)
        if not success:
            return Response({"error": {"code": "CANCELLATION_ERROR", "message": err}}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"data": {"message": "Appointment cancelled successfully."}})
