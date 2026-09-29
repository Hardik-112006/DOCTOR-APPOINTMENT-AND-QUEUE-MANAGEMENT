from django.db import models
from apps.doctors.models import Doctor
from apps.patients.models import Patient
from apps.departments.models import Department

class Slot(models.Model):
    class Status(models.TextChoices):
        AVAILABLE = 'AVAILABLE', 'Available'
        BOOKED = 'BOOKED', 'Booked'
        BLOCKED = 'BLOCKED', 'Blocked'

    doctor = models.ForeignKey(Doctor, on_delete=models.CASCADE, related_name='slots')
    slot_date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    capacity = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.AVAILABLE)

    class Meta:
        db_table = 'slots'
        unique_together = ('doctor', 'slot_date', 'start_time')
        verbose_name = 'Slot'
        verbose_name_plural = 'Slots'

    def __str__(self):
        return f"{self.doctor.user.full_name} | {self.slot_date} {self.start_time}-{self.end_time} ({self.status})"

class Appointment(models.Model):
    class BookingType(models.TextChoices):
        ONLINE = 'ONLINE', 'Online'
        WALK_IN = 'WALK_IN', 'Walk-In'

    class Status(models.TextChoices):
        BOOKED = 'BOOKED', 'Booked'
        WAITING = 'WAITING', 'Waiting'
        CALLED = 'CALLED', 'Called'
        CONSULTING = 'CONSULTING', 'Consulting'
        COMPLETED = 'COMPLETED', 'Completed'
        CANCELLED = 'CANCELLED', 'Cancelled'

    patient = models.ForeignKey(Patient, on_delete=models.RESTRICT, related_name='appointments')
    doctor = models.ForeignKey(Doctor, on_delete=models.RESTRICT, related_name='appointments')
    department = models.ForeignKey(Department, on_delete=models.RESTRICT, related_name='appointments')
    slot = models.ForeignKey(Slot, on_delete=models.SET_NULL, null=True, blank=True, related_name='appointments')
    appointment_date = models.DateField()
    booking_type = models.CharField(max_length=20, choices=BookingType.choices)
    token_number = models.CharField(max_length=30)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.BOOKED)
    estimated_wait_minutes = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'appointments'
        unique_together = ('appointment_date', 'doctor', 'token_number')
        constraints = [
            models.UniqueConstraint(
                fields=['patient', 'doctor', 'appointment_date'],
                condition=~models.Q(status='CANCELLED'),
                name='uq_active_patient_doctor_date'
            )
        ]
        indexes = [
            models.Index(fields=['appointment_date', 'status']),
            models.Index(fields=['patient']),
            models.Index(fields=['doctor', 'appointment_date']),
        ]
        verbose_name = 'Appointment'
        verbose_name_plural = 'Appointments'

    def __str__(self):
        return f"Token {self.token_number} | {self.patient.user.full_name} -> {self.doctor.user.full_name} ({self.status})"
