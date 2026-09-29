from django.db import transaction
from django.utils import timezone
from django.db.models import Max
from apps.appointments.models import Appointment, Slot
from apps.queue.models import QueueEntry
from apps.queue.services import QueueService
from apps.notifications.services import NotificationService
from apps.dashboard.services import DashboardService

class AppointmentService:
    @classmethod
    def book_appointment(cls, patient, doctor, department, appointment_date, slot_id=None, booking_type=Appointment.BookingType.ONLINE, user=None):
        with transaction.atomic():
            # Check for existing active appointment on this date with this doctor
            existing = Appointment.objects.filter(
                patient=patient,
                doctor=doctor,
                appointment_date=appointment_date
            ).exclude(status=Appointment.Status.CANCELLED).first()

            if existing:
                return None, f"You already have an active appointment (Token #{existing.token_number}) with Dr. {doctor.user.full_name} on {appointment_date}."

            slot = None
            if slot_id:
                slot = Slot.objects.select_for_update().filter(id=slot_id, doctor=doctor, slot_date=appointment_date).first()
                if not slot:
                    return None, "Selected slot does not exist."
                if slot.status != Slot.Status.AVAILABLE:
                    return None, "Selected slot is no longer available. Please select another slot."
                slot.status = Slot.Status.BOOKED
                slot.save(update_fields=['status'])

            token_number = QueueService.generate_next_token(doctor, appointment_date)

            max_pos = QueueEntry.objects.filter(queue_date=appointment_date).aggregate(max_p=Max('queue_position'))['max_p'] or 0
            new_pos = max_pos + 1

            appointment = Appointment.objects.create(
                patient=patient,
                doctor=doctor,
                department=department,
                slot=slot,
                appointment_date=appointment_date,
                booking_type=booking_type,
                token_number=token_number,
                status=Appointment.Status.WAITING,
                estimated_wait_minutes=0
            )

            queue_entry = QueueEntry.objects.create(
                appointment=appointment,
                queue_date=appointment_date,
                queue_position=new_pos,
                patients_ahead=0,
                eta_minutes=0,
                status=QueueEntry.Status.WAITING,
                arrival_time=timezone.now() if appointment_date == timezone.localdate() else None
            )

            NotificationService.create_notification(
                user=patient.user,
                message=f"Appointment booked! Your Token is #{token_number} with Dr. {doctor.user.full_name} on {appointment_date}.",
                notif_type='APPOINTMENT_BOOKED',
                appointment=appointment
            )

            DashboardService.log_activity(
                user=user or patient.user,
                clinic=doctor.clinic,
                action='APPOINTMENT_BOOKED',
                entity_type='APPOINTMENT',
                entity_id=appointment.id
            )

            QueueService.recalculate_queue(doctor.id, appointment_date)
            return appointment, None

    @classmethod
    def cancel_appointment(cls, appointment_id, user=None):
        with transaction.atomic():
            appointment = Appointment.objects.select_for_update().filter(id=appointment_id).first()
            if not appointment:
                return False, "Appointment not found."

            if appointment.status in (Appointment.Status.COMPLETED, Appointment.Status.CANCELLED):
                return False, f"Cannot cancel appointment with status {appointment.status}."

            appointment.status = Appointment.Status.CANCELLED
            appointment.save(update_fields=['status'])

            if appointment.slot:
                appointment.slot.status = Slot.Status.AVAILABLE
                appointment.slot.save(update_fields=['status'])

            QueueEntry.objects.filter(appointment=appointment).delete()

            NotificationService.create_notification(
                user=appointment.patient.user,
                message=f"Appointment #{appointment.token_number} on {appointment.appointment_date} has been cancelled.",
                notif_type='APPOINTMENT_CANCELLED',
                appointment=appointment
            )

            DashboardService.log_activity(
                user=user,
                clinic=appointment.doctor.clinic,
                action='APPOINTMENT_CANCELLED',
                entity_type='APPOINTMENT',
                entity_id=appointment.id
            )

            QueueService.recalculate_queue(appointment.doctor_id, appointment.appointment_date)
            return True, None
