from rest_framework import serializers
from apps.consultations.models import Consultation

class ConsultationSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user.full_name', read_only=True)
    patient_phone = serializers.CharField(source='patient.phone', read_only=True)
    doctor_id = serializers.SerializerMethodField()
    doctor_name = serializers.SerializerMethodField()
    specialization = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()
    token_number = serializers.CharField(source='appointment.token_number', read_only=True)
    appointment_date = serializers.DateField(source='appointment.appointment_date', read_only=True)
    booking_type = serializers.CharField(source='appointment.booking_type', read_only=True)

    class Meta:
        model = Consultation
        fields = [
            'id', 'appointment_id', 'token_number', 'doctor_id', 'doctor_name', 'specialization',
            'department_name', 'appointment_date', 'booking_type',
            'patient_id', 'patient_name', 'patient_phone', 'notes', 'prescription_notes',
            'status', 'started_at', 'completed_at'
        ]

    def get_doctor_id(self, obj):
        if obj.appointment and obj.appointment.doctor_id:
            return obj.appointment.doctor_id
        return obj.doctor_id if obj.doctor else None

    def get_doctor_name(self, obj):
        if obj.appointment and obj.appointment.doctor and obj.appointment.doctor.user:
            return obj.appointment.doctor.user.full_name
        if obj.doctor and obj.doctor.user:
            return obj.doctor.user.full_name
        return "Doctor"

    def get_specialization(self, obj):
        if obj.appointment and obj.appointment.doctor and obj.appointment.doctor.specialization:
            return obj.appointment.doctor.specialization
        if obj.doctor and obj.doctor.specialization:
            return obj.doctor.specialization
        return ""

    def get_department_name(self, obj):
        if obj.appointment and obj.appointment.department:
            return obj.appointment.department.name
        if obj.appointment and obj.appointment.doctor and obj.appointment.doctor.department:
            return obj.appointment.doctor.department.name
        if obj.doctor and obj.doctor.department:
            return obj.doctor.department.name
        return ""

class SaveConsultationSerializer(serializers.Serializer):
    appointment_id = serializers.IntegerField()
    notes = serializers.CharField(required=False, allow_blank=True)
    prescription_notes = serializers.CharField(required=False, allow_blank=True)
    complete = serializers.BooleanField(default=False)

