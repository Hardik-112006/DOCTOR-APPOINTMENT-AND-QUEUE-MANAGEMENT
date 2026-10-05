from rest_framework import serializers
from apps.appointments.models import Slot, Appointment
from apps.doctors.serializers import DoctorSerializer
from apps.patients.serializers import PatientSerializer

class SlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = Slot
        fields = ['id', 'doctor_id', 'slot_date', 'start_time', 'end_time', 'capacity', 'status']

class AppointmentSerializer(serializers.ModelSerializer):
    doctor_name = serializers.CharField(source='doctor.user.full_name', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    specialization = serializers.CharField(source='doctor.specialization', read_only=True)
    consultation_fee = serializers.DecimalField(source='doctor.consultation_fee', max_digits=10, decimal_places=2, read_only=True)
    patient_name = serializers.CharField(source='patient.user.full_name', read_only=True)
    patient_phone = serializers.CharField(source='patient.phone', read_only=True)
    slot_time = serializers.SerializerMethodField()
    queue_status = serializers.SerializerMethodField()
    queue_position = serializers.SerializerMethodField()
    patients_ahead = serializers.SerializerMethodField()
    eta_minutes = serializers.SerializerMethodField()
    prescription_notes = serializers.SerializerMethodField()
    consultation_notes = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = [
            'id', 'patient_id', 'patient_name', 'patient_phone',
            'doctor_id', 'doctor_name', 'specialization', 'consultation_fee',
            'department_id', 'department_name',
            'slot_id', 'slot_time', 'appointment_date', 'booking_type',
            'token_number', 'status', 'estimated_wait_minutes', 'queue_status',
            'queue_position', 'patients_ahead', 'eta_minutes', 'created_at',
            'prescription_notes', 'consultation_notes'
        ]

    def get_slot_time(self, obj):
        if obj.slot:
            return f"{obj.slot.start_time.strftime('%H:%M')} - {obj.slot.end_time.strftime('%H:%M')}"
        return None

    def get_queue_status(self, obj):
        if hasattr(obj, 'queue_entry'):
            return obj.queue_entry.status
        return obj.status

    def get_queue_position(self, obj):
        if hasattr(obj, 'queue_entry') and obj.queue_entry:
            if obj.queue_entry.status == 'WAITING':
                return obj.queue_entry.patients_ahead + 1
            return 1
        return None

    def get_patients_ahead(self, obj):
        if hasattr(obj, 'queue_entry'):
            return obj.queue_entry.patients_ahead
        return 0

    def get_eta_minutes(self, obj):
        if hasattr(obj, 'queue_entry'):
            return obj.queue_entry.eta_minutes
        return obj.estimated_wait_minutes

    def get_prescription_notes(self, obj):
        if hasattr(obj, 'consultation') and obj.consultation:
            return obj.consultation.prescription_notes
        return None

    def get_consultation_notes(self, obj):
        if hasattr(obj, 'consultation') and obj.consultation:
            return obj.consultation.notes
        return None

class BookAppointmentSerializer(serializers.Serializer):
    doctor_id = serializers.IntegerField()
    appointment_date = serializers.DateField()
    slot_id = serializers.IntegerField(required=False, allow_null=True)
    booking_type = serializers.ChoiceField(
        choices=Appointment.BookingType.choices,
        default=Appointment.BookingType.ONLINE
    )
