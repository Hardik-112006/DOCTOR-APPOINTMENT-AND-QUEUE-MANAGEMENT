from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from apps.consultations.models import Consultation
from apps.consultations.serializers import ConsultationSerializer, SaveConsultationSerializer
from apps.consultations.services import ConsultationService
from apps.accounts.permissions import IsDoctor

class ConsultationDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, appointment_id):
        consultation = Consultation.objects.filter(appointment_id=appointment_id).select_related('doctor__user', 'patient__user', 'appointment').first()
        if not consultation:
            return Response({"data": None}, status=status.HTTP_200_OK)
        return Response({"data": ConsultationSerializer(consultation).data})

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
        complete = serializer.validated_data.get('complete', False)

        if complete:
            entry, err = ConsultationService.complete_consultation(
                appointment_id=appointment_id,
                notes=notes,
                prescription_notes=prescription_notes,
                user=request.user
            )
        else:
            consultation = Consultation.objects.filter(appointment_id=appointment_id).first()
            if consultation:
                consultation.notes = notes
                consultation.prescription_notes = prescription_notes
                consultation.save(update_fields=['notes', 'prescription_notes'])
            err = None

        if err:
            return Response({"error": {"code": "CONSULTATION_ERROR", "message": err}}, status=status.HTTP_400_BAD_REQUEST)

        consultation = Consultation.objects.filter(appointment_id=appointment_id).first()
        return Response({"data": ConsultationSerializer(consultation).data if consultation else {"message": "Saved"}})
