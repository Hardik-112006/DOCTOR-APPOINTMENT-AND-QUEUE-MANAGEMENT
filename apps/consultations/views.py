from django.db.models import Q
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from apps.accounts.models import User
from apps.consultations.models import Consultation
from apps.consultations.serializers import ConsultationSerializer, SaveConsultationSerializer, DoctorRemarkSerializer
from apps.consultations.services import ConsultationService
from apps.accounts.permissions import IsDoctor
from apps.doctors.models import Doctor

CONSULTATION_RELATED = (
    'doctor__user', 'doctor__department', 'patient__user',
    'appointment__department', 'appointment__slot', 'appointment__doctor__user', 'appointment__doctor__department',
)


def doctor_profile_or_error(user):
    doctor = Doctor.objects.filter(user=user).first()
    if not doctor:
        return None, Response({"error": {"code": "NOT_FOUND", "message": "No doctor profile linked to this account."}}, status=status.HTTP_404_NOT_FOUND)
    return doctor, None


class ConsultationDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, appointment_id):
        consultation = Consultation.objects.filter(appointment_id=appointment_id).select_related(*CONSULTATION_RELATED).first()
        if not consultation:
            return Response({"data": None}, status=status.HTTP_200_OK)

        # Security check: Patients can only access their own consultations
        if request.user.role == 'PATIENT' or (not request.user.is_staff and request.user.role not in ('ADMIN', 'RECEPTIONIST', 'DOCTOR')):
            if consultation.patient.user != request.user:
                return Response({
                    "error": {
                        "code": "FORBIDDEN",
                        "message": "You do not have permission to view this prescription."
                    }
                }, status=status.HTTP_403_FORBIDDEN)

        return Response({"data": ConsultationSerializer(consultation, context={'request': request}).data})


class SaveConsultationView(APIView):
    permission_classes = [IsDoctor]

    def post(self, request):
        serializer = SaveConsultationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Validation failed",
                    "fields": serializer.errors
                }
            }, status=status.HTTP_400_BAD_REQUEST)

        appointment_id = serializer.validated_data['appointment_id']
        notes = serializer.validated_data.get('notes', '')
        prescription_notes = serializer.validated_data.get('prescription_notes', '')
        doctor_remark = serializer.validated_data.get('doctor_remark')
        complete = serializer.validated_data.get('complete', False)

        from apps.queue.models import QueueEntry
        entry = QueueEntry.objects.select_related('appointment__doctor').filter(appointment_id=appointment_id).first()
        if entry and request.user.role == User.Role.DOCTOR and entry.appointment.doctor.user_id != request.user.id:
            return Response({"error": {"code": "FORBIDDEN", "message": "This patient is in another doctor's queue."}}, status=status.HTTP_403_FORBIDDEN)

        err = None
        if complete:
            entry, err = ConsultationService.complete_consultation(
                appointment_id=appointment_id,
                notes=notes,
                prescription_notes=prescription_notes,
                doctor_remark=doctor_remark,
                user=request.user
            )
        else:
            consultation = Consultation.objects.filter(appointment_id=appointment_id).first()
            if not consultation:
                return Response({"error": {"code": "CONSULTATION_NOT_STARTED", "message": "Start the consultation before saving notes."}}, status=status.HTTP_400_BAD_REQUEST)
            consultation.notes = notes
            consultation.prescription_notes = prescription_notes
            fields = ['notes', 'prescription_notes']
            if doctor_remark is not None:
                consultation.doctor_remark = doctor_remark.strip() or None
                fields.append('doctor_remark')
            consultation.save(update_fields=fields)

        if err:
            return Response({"error": {"code": "CONSULTATION_ERROR", "message": err}}, status=status.HTTP_400_BAD_REQUEST)

        consultation = Consultation.objects.filter(appointment_id=appointment_id).select_related(*CONSULTATION_RELATED).first()
        return Response({"data": ConsultationSerializer(consultation, context={'request': request}).data if consultation else {"message": "Saved"}})


class AttendedPatientsView(APIView):
    """The logged-in doctor's past consultations, with their private remarks. Filter by ?patient_id= or search ?q=."""
    permission_classes = [IsDoctor]

    def get(self, request):
        doctor, error = doctor_profile_or_error(request.user)
        if error:
            return error

        qs = Consultation.objects.filter(doctor=doctor).select_related(*CONSULTATION_RELATED).order_by('-appointment__appointment_date', '-started_at')
        patient_id = request.query_params.get('patient_id')
        if patient_id:
            qs = qs.filter(patient_id=patient_id)
        exclude_appt = request.query_params.get('exclude_appointment_id')
        if exclude_appt:
            qs = qs.exclude(appointment_id=exclude_appt)
        search = (request.query_params.get('q') or '').strip()
        if search:
            qs = qs.filter(
                Q(patient__user__full_name__icontains=search) |
                Q(patient__phone__icontains=search) |
                Q(appointment__token_number__icontains=search) |
                Q(doctor_remark__icontains=search)
            )

        try:
            limit = max(1, min(int(request.query_params.get('limit', 50)), 200))
        except (TypeError, ValueError):
            limit = 50

        return Response({"data": ConsultationSerializer(qs[:limit], many=True, context={'request': request}).data, "total": qs.count()})


class DoctorRemarkView(APIView):
    """Doctor adds / edits their private remark on a patient they attended."""
    permission_classes = [IsDoctor]

    def post(self, request, appointment_id):
        doctor, error = doctor_profile_or_error(request.user)
        if error:
            return error

        serializer = DoctorRemarkSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"error": {"code": "VALIDATION_ERROR", "message": "Remark must be 1000 characters or fewer.", "fields": serializer.errors}}, status=status.HTTP_400_BAD_REQUEST)

        consultation = Consultation.objects.filter(appointment_id=appointment_id, doctor=doctor).select_related(*CONSULTATION_RELATED).first()
        if not consultation:
            return Response({"error": {"code": "NOT_FOUND", "message": "You can only add remarks for patients you have attended."}}, status=status.HTTP_404_NOT_FOUND)

        consultation.doctor_remark = serializer.validated_data['doctor_remark'].strip() or None
        consultation.save(update_fields=['doctor_remark'])
        return Response({"data": ConsultationSerializer(consultation, context={'request': request}).data})
