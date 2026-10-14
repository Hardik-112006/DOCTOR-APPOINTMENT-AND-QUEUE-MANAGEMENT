from rest_framework import serializers
from apps.consultations.models import Consultation


class ConsultationSerializer(serializers.ModelSerializer):
    """
    Prescription / consultation record. `doctor_remark` is the doctor's private memory aid:
    it is only included when the viewer is the consulting doctor (pass `request` in context).
    """
    patient_name = serializers.CharField(source='patient.user.full_name', read_only=True)
    patient_phone = serializers.CharField(source='patient.phone', read_only=True)
    patient_gender = serializers.CharField(source='patient.gender', read_only=True)
    patient_age = serializers.IntegerField(source='patient.age', read_only=True)
    patient_blood_group = serializers.CharField(source='patient.blood_group', read_only=True)
    patient_weight_kg = serializers.DecimalField(source='patient.weight_kg', max_digits=5, decimal_places=1, read_only=True)
    patient_height_cm = serializers.DecimalField(source='patient.height_cm', max_digits=5, decimal_places=1, read_only=True)
    problem_description = serializers.CharField(source='appointment.problem_description', read_only=True)
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
            'patient_id', 'patient_name', 'patient_phone', 'patient_gender', 'patient_age',
            'patient_blood_group', 'patient_weight_kg', 'patient_height_cm', 'problem_description',
            'notes', 'prescription_notes', 'doctor_remark',
            'status', 'started_at', 'completed_at'
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        doctor_user_id = instance.doctor.user_id if instance.doctor_id else None
        if not request or request.user.id != doctor_user_id:
            data.pop('doctor_remark', None)
        return data

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
    doctor_remark = serializers.CharField(required=False, allow_blank=True, max_length=1000)
    complete = serializers.BooleanField(default=False)


class DoctorRemarkSerializer(serializers.Serializer):
    doctor_remark = serializers.CharField(allow_blank=True, max_length=1000)
