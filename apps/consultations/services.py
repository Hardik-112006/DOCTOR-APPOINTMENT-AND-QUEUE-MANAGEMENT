from django.utils import timezone
from django.db import transaction
from apps.consultations.models import Consultation
from apps.queue.models import QueueEntry
from apps.queue.services import QueueService

class ConsultationService:
    @staticmethod
    def get_consultation(appointment_id):
        return Consultation.objects.filter(appointment_id=appointment_id).first()

    @classmethod
    def start_consultation(cls, appointment_id, user=None):
        return QueueService.update_queue_status(appointment_id, QueueEntry.Status.CONSULTING, user=user)

    @classmethod
    def complete_consultation(cls, appointment_id, notes="", prescription_notes="", user=None):
        return QueueService.update_queue_status(
            appointment_id,
            QueueEntry.Status.COMPLETED,
            user=user,
            notes=notes,
            prescription_notes=prescription_notes
        )
