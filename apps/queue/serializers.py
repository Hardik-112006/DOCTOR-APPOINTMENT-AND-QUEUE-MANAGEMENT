from rest_framework import serializers
from apps.queue.models import QueueEntry
from apps.appointments.serializers import AppointmentSerializer

class QueueEntrySerializer(serializers.ModelSerializer):
    token_number = serializers.CharField(source='appointment.token_number', read_only=True)
    patient_id = serializers.IntegerField(source='appointment.patient.id', read_only=True)
    patient_name = serializers.CharField(source='appointment.patient.user.full_name', read_only=True)
    patient_phone = serializers.CharField(source='appointment.patient.phone', read_only=True)
    patient_gender = serializers.CharField(source='appointment.patient.gender', read_only=True)
    patient_dob = serializers.DateField(source='appointment.patient.date_of_birth', read_only=True)
    doctor_id = serializers.IntegerField(source='appointment.doctor.id', read_only=True)
    doctor_name = serializers.CharField(source='appointment.doctor.user.full_name', read_only=True)
    specialization = serializers.CharField(source='appointment.doctor.specialization', read_only=True)
    consultation_fee = serializers.DecimalField(source='appointment.doctor.consultation_fee', max_digits=10, decimal_places=2, read_only=True)
    department_name = serializers.CharField(source='appointment.department.name', read_only=True)
    booking_type = serializers.CharField(source='appointment.booking_type', read_only=True)
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
            'doctor_id', 'doctor_name', 'specialization', 'consultation_fee', 'department_name', 'booking_type',
            'slot_time', 'arrival_time', 'called_at', 'consultation_started_at', 'completed_at',
            'prescription_notes', 'consultation_notes'
        ]

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

class WalkInRegistrationSerializer(serializers.Serializer):
    doctor_id = serializers.IntegerField()
    department_id = serializers.IntegerField()
    patient_name = serializers.CharField(max_length=150)
    patient_phone = serializers.CharField(max_length=20)

class UpdateQueueStatusSerializer(serializers.Serializer):
    appointment_id = serializers.IntegerField()
    status = serializers.ChoiceField(choices=QueueEntry.Status.choices)
    notes = serializers.CharField(required=False, allow_blank=True)
    prescription_notes = serializers.CharField(required=False, allow_blank=True)
