from django.db import models
from apps.appointments.models import Appointment
from apps.doctors.models import Doctor
from apps.patients.models import Patient

class Consultation(models.Model):
    class Status(models.TextChoices):
        STARTED = 'STARTED', 'Started'
        COMPLETED = 'COMPLETED', 'Completed'

    appointment = models.OneToOneField(Appointment, on_delete=models.CASCADE, related_name='consultation')
    doctor = models.ForeignKey(Doctor, on_delete=models.RESTRICT, related_name='consultations')
    patient = models.ForeignKey(Patient, on_delete=models.RESTRICT, related_name='consultations')
    notes = models.TextField(null=True, blank=True)
    prescription_notes = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.STARTED)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'consultations'
        indexes = [
            models.Index(fields=['doctor']),
            models.Index(fields=['patient']),
        ]
        verbose_name = 'Consultation'
        verbose_name_plural = 'Consultations'

    def __str__(self):
        return f"Consultation for {self.appointment.token_number} - Dr. {self.doctor.user.full_name} ({self.status})"
