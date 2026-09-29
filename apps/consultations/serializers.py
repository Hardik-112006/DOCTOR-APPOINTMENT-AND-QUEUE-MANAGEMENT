from rest_framework import serializers
from apps.consultations.models import Consultation

class ConsultationSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user.full_name', read_only=True)
    doctor_name = serializers.CharField(source='doctor.user.full_name', read_only=True)
    token_number = serializers.CharField(source='appointment.token_number', read_only=True)

    class Meta:
        model = Consultation
        fields = [
            'id', 'appointment_id', 'token_number', 'doctor_id', 'doctor_name',
            'patient_id', 'patient_name', 'notes', 'prescription_notes',
            'status', 'started_at', 'completed_at'
        ]

class SaveConsultationSerializer(serializers.Serializer):
    appointment_id = serializers.IntegerField()
    notes = serializers.CharField(required=False, allow_blank=True)
    prescription_notes = serializers.CharField(required=False, allow_blank=True)
    complete = serializers.BooleanField(default=False)
