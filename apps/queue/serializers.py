from rest_framework import serializers
from apps.queue.models import QueueEntry
from apps.patients.serializers import PatientHealthSerializer


class QueueEntrySerializer(serializers.ModelSerializer):
    """Staff-facing queue row (doctor / receptionist / admin). Never return this for other patients to a patient."""
    token_number = serializers.CharField(source='appointment.token_number', read_only=True)
    patient_id = serializers.IntegerField(source='appointment.patient.id', read_only=True)
    patient_name = serializers.CharField(source='appointment.patient.user.full_name', read_only=True)
    patient_phone = serializers.CharField(source='appointment.patient.phone', read_only=True)
    patient_gender = serializers.CharField(source='appointment.patient.gender', read_only=True)
    patient_dob = serializers.DateField(source='appointment.patient.date_of_birth', read_only=True)
    patient_age = serializers.IntegerField(source='appointment.patient.age', read_only=True)
    patient_blood_group = serializers.CharField(source='appointment.patient.blood_group', read_only=True)
    patient_weight_kg = serializers.DecimalField(source='appointment.patient.weight_kg', max_digits=5, decimal_places=1, read_only=True)
    patient_height_cm = serializers.DecimalField(source='appointment.patient.height_cm', max_digits=5, decimal_places=1, read_only=True)
    problem_description = serializers.CharField(source='appointment.problem_description', read_only=True)
    reception_remark = serializers.CharField(source='appointment.reception_remark', read_only=True)
    doctor_id = serializers.IntegerField(source='appointment.doctor.id', read_only=True)
    doctor_name = serializers.CharField(source='appointment.doctor.user.full_name', read_only=True)
    specialization = serializers.CharField(source='appointment.doctor.specialization', read_only=True)
    consultation_fee = serializers.DecimalField(source='appointment.doctor.consultation_fee', max_digits=10, decimal_places=2, read_only=True)
    department_name = serializers.CharField(source='appointment.department.name', read_only=True)
    booking_type = serializers.CharField(source='appointment.booking_type', read_only=True)
    is_validated = serializers.BooleanField(read_only=True)
    validated_by_name = serializers.SerializerMethodField()
    queue_position = serializers.SerializerMethodField()
    slot_time = serializers.SerializerMethodField()
    prescription_notes = serializers.SerializerMethodField()
    consultation_notes = serializers.SerializerMethodField()

    class Meta:
        model = QueueEntry
        fields = [
            'id', 'appointment_id', 'token_number', 'queue_date',
            'queue_position', 'patients_ahead', 'eta_minutes', 'status',
            'patient_id', 'patient_name', 'patient_phone', 'patient_gender', 'patient_dob',
            'patient_age', 'patient_blood_group', 'patient_weight_kg', 'patient_height_cm',
            'problem_description', 'reception_remark',
            'doctor_id', 'doctor_name', 'specialization', 'consultation_fee', 'department_name', 'booking_type',
            'slot_time', 'arrival_time', 'is_validated', 'validated_at', 'validated_by_name',
            'called_at', 'consultation_started_at', 'completed_at',
            'prescription_notes', 'consultation_notes'
        ]

    def get_validated_by_name(self, obj):
        return obj.validated_by.full_name if obj.validated_by_id and obj.validated_by else None

    def get_queue_position(self, obj):
        if obj.status == QueueEntry.Status.WAITING:
            return obj.patients_ahead + 1
        return 1

    def get_slot_time(self, obj):
        if obj.appointment.slot:
            return f"{obj.appointment.slot.start_time.strftime('%H:%M')} - {obj.appointment.slot.end_time.strftime('%H:%M')}"
        return None

    def get_prescription_notes(self, obj):
        if hasattr(obj.appointment, 'consultation') and obj.appointment.consultation:
            return obj.appointment.consultation.prescription_notes
        return None

    def get_consultation_notes(self, obj):
        if hasattr(obj.appointment, 'consultation') and obj.appointment.consultation:
            return obj.appointment.consultation.notes
        return None


class WalkInRegistrationSerializer(PatientHealthSerializer):
    doctor_id = serializers.IntegerField()
    department_id = serializers.IntegerField(required=False, allow_null=True)
    patient_name = serializers.CharField(max_length=150)
    patient_phone = serializers.CharField(max_length=20)
    problem_description = serializers.CharField(max_length=1000, required=False, allow_blank=True, allow_null=True)


class UpdateQueueStatusSerializer(serializers.Serializer):
    appointment_id = serializers.IntegerField()
    status = serializers.ChoiceField(choices=QueueEntry.Status.choices)
    notes = serializers.CharField(required=False, allow_blank=True)
    prescription_notes = serializers.CharField(required=False, allow_blank=True)


class ReceptionRemarkSerializer(serializers.Serializer):
    appointment_id = serializers.IntegerField()
    remark = serializers.CharField(max_length=500, allow_blank=True)
