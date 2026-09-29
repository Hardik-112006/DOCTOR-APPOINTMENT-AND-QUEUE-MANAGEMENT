from django.db import models
from apps.appointments.models import Appointment

class QueueEntry(models.Model):
    class Status(models.TextChoices):
        WAITING = 'WAITING', 'Waiting'
        CALLED = 'CALLED', 'Called'
        CONSULTING = 'CONSULTING', 'Consulting'
        COMPLETED = 'COMPLETED', 'Completed'

    appointment = models.OneToOneField(Appointment, on_delete=models.CASCADE, related_name='queue_entry')
    queue_date = models.DateField()
    queue_position = models.PositiveIntegerField()
    patients_ahead = models.PositiveIntegerField(default=0)
    eta_minutes = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.WAITING)
    arrival_time = models.DateTimeField(null=True, blank=True)
    called_at = models.DateTimeField(null=True, blank=True)
    consultation_started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'queue_entries'
        unique_together = (
            ('queue_date', 'appointment'),
            ('queue_date', 'queue_position')
        )
        indexes = [
            models.Index(fields=['queue_date', 'status']),
        ]
        verbose_name = 'Queue Entry'
        verbose_name_plural = 'Queue Entries'

    def __str__(self):
        return f"Queue #{self.queue_position} | {self.appointment.token_number} ({self.status})"
