from django.db import transaction
from django.utils import timezone
from django.db.models import Max
from apps.queue.models import QueueEntry
from apps.appointments.models import Appointment
from apps.notifications.services import NotificationService
from apps.dashboard.services import DashboardService

class QueueService:
    @staticmethod
    def generate_next_token(doctor, appointment_date):
        """
        Generates next token for the doctor on the specified date atomically.
        Format: e.g. A-01, A-02, or prefix based on doctor initials/department.
        """
        prefix = doctor.user.full_name[:1].upper() or 'A'
        existing_tokens = Appointment.objects.filter(
            doctor=doctor,
            appointment_date=appointment_date
        ).values_list('token_number', flat=True)

        max_num = 0
        for tok in existing_tokens:
            try:
                parts = tok.split('-')
                if len(parts) == 2 and parts[1].isdigit():
                    num = int(parts[1])
                    if num > max_num:
                        max_num = num
            except Exception:
                continue

        next_num = max(max_num + 1, 1)
        return f"{prefix}-{next_num}"

    @staticmethod
    def recalculate_queue(doctor_id, queue_date=None):
        """
        Recalculates queue positions, patients ahead, and ETA for all active queue entries of a doctor.
        """
        if not queue_date:
            queue_date = timezone.localdate()

        with transaction.atomic():
            entries = list(
                QueueEntry.objects.select_for_update()
                .filter(
                    appointment__doctor_id=doctor_id,
                    queue_date=queue_date
                )
                .select_related('appointment__doctor__clinic', 'appointment__patient__user')
                .order_by('queue_position', 'id')
            )

            if not entries:
                return []

            clinic = entries[0].appointment.doctor.clinic
            avg_consult_minutes = clinic.average_consultation_minutes if clinic else 10

            waiting_patients_ahead = 0
            # Check if there is currently a patient consulting or called
            active_consulting = any(e.status in (QueueEntry.Status.CONSULTING, QueueEntry.Status.CALLED) for e in entries)

            for entry in entries:
                if entry.status == QueueEntry.Status.WAITING:
                    entry.patients_ahead = waiting_patients_ahead
                    # If someone is currently consulting, each waiting patient wait is (ahead + 1) * avg_minutes
                    # If nobody is consulting, the top waiting patient is next (ahead * avg_minutes)
                    multiplier = waiting_patients_ahead if not active_consulting else waiting_patients_ahead + 1
                    entry.eta_minutes = multiplier * avg_consult_minutes
                    entry.save(update_fields=['patients_ahead', 'eta_minutes'])

                    # Sync estimated wait on appointment
                    Appointment.objects.filter(id=entry.appointment_id).update(
                        estimated_wait_minutes=entry.eta_minutes,
                        status=Appointment.Status.WAITING
                    )
                    waiting_patients_ahead += 1

                elif entry.status in (QueueEntry.Status.CALLED, QueueEntry.Status.CONSULTING):
                    entry.patients_ahead = 0
                    entry.eta_minutes = 0
                    entry.save(update_fields=['patients_ahead', 'eta_minutes'])
                    Appointment.objects.filter(id=entry.appointment_id).update(
                        estimated_wait_minutes=0,
                        status=Appointment.Status.CALLED if entry.status == QueueEntry.Status.CALLED else Appointment.Status.CONSULTING
                    )

                elif entry.status == QueueEntry.Status.COMPLETED:
                    entry.patients_ahead = 0
                    entry.eta_minutes = 0
                    entry.save(update_fields=['patients_ahead', 'eta_minutes'])
                    Appointment.objects.filter(id=entry.appointment_id).update(
                        estimated_wait_minutes=0,
                        status=Appointment.Status.COMPLETED
                    )

            return entries

    @classmethod
    def call_next_patient(cls, doctor, queue_date=None, user=None):
        """
        Doctor calls the next waiting patient in their queue.
        """
        if not queue_date:
            queue_date = timezone.localdate()

        with transaction.atomic():
            # Find next waiting patient
            next_entry = (
                QueueEntry.objects.select_for_update()
                .filter(
                    appointment__doctor=doctor,
                    queue_date=queue_date,
                    status=QueueEntry.Status.WAITING
                )
                .select_related('appointment__patient__user', 'appointment__doctor__user')
                .order_by('queue_position')
                .first()
            )

            if not next_entry:
                return None, "No waiting patients in queue."

            now = timezone.now()
            next_entry.status = QueueEntry.Status.CALLED
            next_entry.called_at = now
            next_entry.patients_ahead = 0
            next_entry.eta_minutes = 0
            next_entry.save(update_fields=['status', 'called_at', 'patients_ahead', 'eta_minutes'])

            Appointment.objects.filter(id=next_entry.appointment_id).update(
                status=Appointment.Status.CALLED,
                estimated_wait_minutes=0
            )

            # Send notification
            patient_user = next_entry.appointment.patient.user
            doc_name = doctor.user.full_name
            token_no = next_entry.appointment.token_number
            NotificationService.create_notification(
                user=patient_user,
                message=f"Dr. {doc_name} has called your token #{token_no}. Please proceed to the consultation room.",
                notif_type='PATIENT_CALLED',
                appointment=next_entry.appointment
            )

            DashboardService.log_activity(
                user=user or doctor.user,
                clinic=doctor.clinic,
                action='CALL_NEXT_PATIENT',
                entity_type='APPOINTMENT',
                entity_id=next_entry.appointment.id
            )

            cls.recalculate_queue(doctor.id, queue_date)
            return next_entry, None

    @classmethod
    def update_queue_status(cls, appointment_id, new_status, user=None, notes="", prescription_notes=""):
        """
        Updates the queue status for an appointment with full state consistency.
        """
        from apps.consultations.models import Consultation

        with transaction.atomic():
            entry = (
                QueueEntry.objects.select_for_update()
                .select_related('appointment__doctor__clinic', 'appointment__patient__user', 'appointment__doctor__user')
                .filter(appointment_id=appointment_id)
                .first()
            )
            if not entry:
                return None, "Queue entry not found."

            now = timezone.now()
            doctor = entry.appointment.doctor
            patient_user = entry.appointment.patient.user

            if new_status == QueueEntry.Status.CALLED:
                entry.status = QueueEntry.Status.CALLED
                entry.called_at = now
                entry.save()
                Appointment.objects.filter(id=appointment_id).update(status=Appointment.Status.CALLED)
                NotificationService.create_notification(
                    user=patient_user,
                    message=f"Dr. {doctor.user.full_name} has called your token #{entry.appointment.token_number}.",
                    notif_type='PATIENT_CALLED',
                    appointment=entry.appointment
                )

            elif new_status == QueueEntry.Status.CONSULTING:
                entry.status = QueueEntry.Status.CONSULTING
                entry.consultation_started_at = now
                entry.save()
                Appointment.objects.filter(id=appointment_id).update(status=Appointment.Status.CONSULTING)

                Consultation.objects.update_or_create(
                    appointment=entry.appointment,
                    defaults={
                        'doctor': doctor,
                        'patient': entry.appointment.patient,
                        'status': Consultation.Status.STARTED,
                        'started_at': now
                    }
                )
                NotificationService.create_notification(
                    user=patient_user,
                    message=f"Consultation for token #{entry.appointment.token_number} has started.",
                    notif_type='CONSULTATION_STARTED',
                    appointment=entry.appointment
                )

            elif new_status == QueueEntry.Status.COMPLETED:
                entry.status = QueueEntry.Status.COMPLETED
                entry.completed_at = now
                entry.patients_ahead = 0
                entry.eta_minutes = 0
                entry.save()
                Appointment.objects.filter(id=appointment_id).update(status=Appointment.Status.COMPLETED, estimated_wait_minutes=0)

                Consultation.objects.update_or_create(
                    appointment=entry.appointment,
                    defaults={
                        'doctor': doctor,
                        'patient': entry.appointment.patient,
                        'notes': notes,
                        'prescription_notes': prescription_notes,
                        'status': Consultation.Status.COMPLETED,
                        'completed_at': now
                    }
                )
                NotificationService.create_notification(
                    user=patient_user,
                    message=f"Your consultation for token #{entry.appointment.token_number} is completed.",
                    notif_type='CONSULTATION_COMPLETED',
                    appointment=entry.appointment
                )

            DashboardService.log_activity(
                user=user or doctor.user,
                clinic=doctor.clinic,
                action=f'QUEUE_STATUS_{new_status}',
                entity_type='APPOINTMENT',
                entity_id=entry.appointment.id
            )

            cls.recalculate_queue(doctor.id, entry.queue_date)
            return entry, None

    @classmethod
    def register_walk_in(cls, clinic, doctor, department, patient_name, patient_phone, user=None):
        """
        Receptionist registers a walk-in patient directly into today's queue.
        """
        from apps.accounts.models import User
        from apps.patients.models import Patient
        from apps.appointments.models import Appointment

        today = timezone.localdate()

        with transaction.atomic():
            # Get or create user for the walk-in patient
            patient_user, _ = User.objects.get_or_create(
                phone=patient_phone,
                defaults={
                    'full_name': patient_name,
                    'role': User.Role.PATIENT,
                    'language': User.Language.EN
                }
            )

            # Get or create patient profile
            patient_profile, _ = Patient.objects.get_or_create(
                user=patient_user,
                defaults={'phone': patient_phone}
            )

            token_number = cls.generate_next_token(doctor, today)

            # Get next queue position for today
            max_pos = QueueEntry.objects.filter(queue_date=today).aggregate(max_p=Max('queue_position'))['max_p'] or 0
            new_pos = max_pos + 1

            appointment = Appointment.objects.create(
                patient=patient_profile,
                doctor=doctor,
                department=department,
                slot=None,
                appointment_date=today,
                booking_type=Appointment.BookingType.WALK_IN,
                token_number=token_number,
                status=Appointment.Status.WAITING,
                estimated_wait_minutes=0
            )

            queue_entry = QueueEntry.objects.create(
                appointment=appointment,
                queue_date=today,
                queue_position=new_pos,
                patients_ahead=0,
                eta_minutes=0,
                status=QueueEntry.Status.WAITING,
                arrival_time=timezone.now()
            )

            NotificationService.create_notification(
                user=patient_user,
                message=f"Walk-in token #{token_number} registered for Dr. {doctor.user.full_name}.",
                notif_type='TOKEN_ISSUED',
                appointment=appointment
            )

            DashboardService.log_activity(
                user=user,
                clinic=clinic,
                action='WALK_IN_REGISTERED',
                entity_type='APPOINTMENT',
                entity_id=appointment.id
            )

            cls.recalculate_queue(doctor.id, today)
            return queue_entry, None
