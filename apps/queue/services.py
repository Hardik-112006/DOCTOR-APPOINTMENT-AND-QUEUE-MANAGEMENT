import datetime
# pyrefly: ignore [missing-import]
from django.db import transaction
# pyrefly: ignore [missing-import]
from django.utils import timezone
# pyrefly: ignore [missing-import]
from django.db.models import Max
from apps.queue.models import QueueEntry
from apps.appointments.models import Appointment
from apps.notifications.services import NotificationService
from apps.dashboard.services import DashboardService

IN_ROOM_STATUSES = (QueueEntry.Status.CALLED, QueueEntry.Status.CONSULTING)


class QueueService:
    @staticmethod
    def lock_clinic(clinic):
        """
        Serialize token / queue-position allocation for a clinic so two simultaneous
        bookings cannot grab the same number.
        """
        from apps.clinics.models import Clinic
        if clinic:
            Clinic.objects.select_for_update().filter(pk=clinic.pk).first()

    @staticmethod
    def next_queue_position(queue_date):
        # queue_position is unique per date across the whole clinic, so take the global max.
        max_pos = QueueEntry.objects.filter(queue_date=queue_date).aggregate(max_p=Max('queue_position'))['max_p'] or 0
        return max_pos + 1

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
        Recalculates patients ahead and ETA for all queue entries of a doctor.
        Queue order is token order (queue_position) - the same order call_next_patient uses.
        People ahead = everyone already in the room + every waiting patient with an earlier token.
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
                .select_related('appointment__doctor__clinic')
                .order_by('queue_position', 'id')
            )

            if not entries:
                return []

            clinic = entries[0].appointment.doctor.clinic
            avg_consult_minutes = clinic.average_consultation_minutes if clinic else 10

            in_room_count = sum(1 for e in entries if e.status in IN_ROOM_STATUSES)
            waiting_seen = 0

            for entry in entries:
                if entry.status == QueueEntry.Status.WAITING:
                    ahead = in_room_count + waiting_seen
                    waiting_seen += 1
                else:
                    ahead = 0
                eta = ahead * avg_consult_minutes

                if entry.patients_ahead != ahead or entry.eta_minutes != eta:
                    entry.patients_ahead = ahead
                    entry.eta_minutes = eta
                    entry.save(update_fields=['patients_ahead', 'eta_minutes'])

                updates = {'estimated_wait_minutes': eta}
                if entry.status == QueueEntry.Status.WAITING:
                    updates['status'] = Appointment.Status.WAITING
                Appointment.objects.filter(id=entry.appointment_id).update(**updates)

            return entries

    @staticmethod
    def patient_snapshot(entry):
        """
        Everything a patient needs to understand where they stand, without exposing other patients' identities:
        how many are ahead (split by walk-in / online and checked-in / not yet arrived), who is being served now,
        and an anonymised token board.
        """
        entries = list(
            QueueEntry.objects.filter(
                appointment__doctor_id=entry.appointment.doctor_id,
                queue_date=entry.queue_date
            ).select_related('appointment').order_by('queue_position', 'id')
        )
        clinic = entry.appointment.doctor.clinic
        avg_minutes = clinic.average_consultation_minutes if clinic else 10

        in_room = [e for e in entries if e.status in IN_ROOM_STATUSES]
        waiting_ahead = [
            e for e in entries
            if e.status == QueueEntry.Status.WAITING and e.queue_position < entry.queue_position
        ] if entry.status == QueueEntry.Status.WAITING else []
        ahead = (in_room if entry.status == QueueEntry.Status.WAITING else []) + waiting_ahead

        def board_item(e):
            return {
                'token_number': e.appointment.token_number,
                'booking_type': e.appointment.booking_type,
                'status': e.status,
                'is_validated': e.is_validated,
                'is_you': e.id == entry.id,
            }

        active = [e for e in entries if e.status != QueueEntry.Status.COMPLETED]
        serving = next((e for e in entries if e.status == QueueEntry.Status.CONSULTING), None) or (in_room[0] if in_room else None)

        expected_call_at = None
        if entry.status == QueueEntry.Status.WAITING and entry.queue_date == timezone.localdate():
            expected_call_at = (timezone.localtime() + datetime.timedelta(minutes=len(ahead) * avg_minutes)).isoformat()

        return {
            'is_today': entry.queue_date == timezone.localdate(),
            'avg_consultation_minutes': avg_minutes,
            'ahead': {
                'total': len(ahead),
                'in_room': sum(1 for e in ahead if e.status in IN_ROOM_STATUSES),
                'walk_in': sum(1 for e in ahead if e.appointment.booking_type == Appointment.BookingType.WALK_IN),
                'online': sum(1 for e in ahead if e.appointment.booking_type == Appointment.BookingType.ONLINE),
                'checked_in': sum(1 for e in ahead if e.is_validated),
                'not_checked_in': sum(1 for e in ahead if not e.is_validated),
            },
            'now_serving': {
                'token_number': serving.appointment.token_number,
                'status': serving.status,
            } if serving else None,
            'total_waiting': sum(1 for e in entries if e.status == QueueEntry.Status.WAITING),
            'completed_count': sum(1 for e in entries if e.status == QueueEntry.Status.COMPLETED),
            'walk_in_total': sum(1 for e in active if e.appointment.booking_type == Appointment.BookingType.WALK_IN),
            'expected_call_at': expected_call_at,
            'board': [board_item(e) for e in active],
        }

    @classmethod
    def validate_entry(cls, appointment_id, user=None):
        """Receptionist checks the patient in; from now on the doctor can call them."""
        with transaction.atomic():
            entry = (
                QueueEntry.objects.select_for_update()
                .select_related('appointment__patient__user', 'appointment__doctor__user', 'appointment__doctor__clinic')
                .filter(appointment_id=appointment_id)
                .first()
            )
            if not entry:
                return None, "Queue entry not found."
            if entry.queue_date != timezone.localdate():
                return None, "Only today's appointments can be validated."
            if entry.is_validated:
                return entry, None

            now = timezone.now()
            entry.validated_at = now
            entry.validated_by = user if user and user.is_authenticated else None
            entry.arrival_time = entry.arrival_time or now
            entry.save(update_fields=['validated_at', 'validated_by', 'arrival_time'])

            NotificationService.create_notification(
                user=entry.appointment.patient.user,
                message=f"You are checked in for token #{entry.appointment.token_number}. Please wait - Dr. {entry.appointment.doctor.user.full_name} will call you soon.",
                notif_type='PATIENT_VALIDATED',
                appointment=entry.appointment
            )
            DashboardService.log_activity(
                user=user,
                clinic=entry.appointment.doctor.clinic,
                action='PATIENT_ARRIVED',
                entity_type='APPOINTMENT',
                entity_id=entry.appointment_id
            )
            return entry, None

    @classmethod
    def call_next_patient(cls, doctor, queue_date=None, user=None):
        """
        Doctor calls the next waiting patient in their queue.
        Only patients the receptionist has validated can be called.
        """
        if not queue_date:
            queue_date = timezone.localdate()

        with transaction.atomic():
            waiting = (
                QueueEntry.objects.select_for_update()
                .filter(
                    appointment__doctor=doctor,
                    queue_date=queue_date,
                    status=QueueEntry.Status.WAITING
                )
                .select_related('appointment__patient__user', 'appointment__doctor__user')
                .order_by('queue_position')
            )
            next_entry = waiting.filter(validated_at__isnull=False).first()

            if not next_entry:
                pending = waiting.count()
                if pending:
                    return None, f"{pending} patient(s) are waiting but none have been validated by reception yet."
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
    def update_queue_status(cls, appointment_id, new_status, user=None, notes="", prescription_notes="", doctor_remark=None):
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
            if entry.status == QueueEntry.Status.COMPLETED:
                return None, "This consultation is already completed."
            if new_status != QueueEntry.Status.WAITING and not entry.is_validated:
                return None, "This patient has not been validated by reception yet. Ask the receptionist to check them in first."

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
                entry.called_at = entry.called_at or now
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

                defaults = {
                    'doctor': doctor,
                    'patient': entry.appointment.patient,
                    'notes': notes,
                    'prescription_notes': prescription_notes,
                    'status': Consultation.Status.COMPLETED,
                    'completed_at': now
                }
                if doctor_remark is not None:
                    defaults['doctor_remark'] = doctor_remark.strip() or None
                Consultation.objects.update_or_create(appointment=entry.appointment, defaults=defaults)
                NotificationService.create_notification(
                    user=patient_user,
                    message=f"Your consultation for token #{entry.appointment.token_number} is completed. Your prescription is ready to download.",
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
    def register_walk_in(cls, clinic, doctor, department, patient_name, patient_phone, user=None,
                         problem_description=None, health=None):
        """
        Receptionist registers a walk-in patient directly into today's queue.
        The patient is standing at the desk, so the entry is validated straight away.
        """
        from apps.accounts.models import User
        from apps.patients.models import Patient
        from apps.patients.serializers import PatientHealthSerializer
        from apps.doctors.services import ScheduleService

        today = timezone.localdate()
        block_reason = ScheduleService.booking_block_reason(doctor, today)
        if block_reason:
            return None, block_reason

        with transaction.atomic():
            cls.lock_clinic(clinic)

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
            if health:
                PatientHealthSerializer.apply(patient_profile, health)

            existing = Appointment.objects.filter(
                patient=patient_profile, doctor=doctor, appointment_date=today
            ).exclude(status=Appointment.Status.CANCELLED).first()
            if existing:
                return None, f"{patient_user.full_name} already has token #{existing.token_number} with Dr. {doctor.user.full_name} today."

            token_number = cls.generate_next_token(doctor, today)
            now = timezone.now()

            appointment = Appointment.objects.create(
                patient=patient_profile,
                doctor=doctor,
                department=department,
                slot=None,
                appointment_date=today,
                booking_type=Appointment.BookingType.WALK_IN,
                token_number=token_number,
                status=Appointment.Status.WAITING,
                estimated_wait_minutes=0,
                problem_description=problem_description or None,
            )

            queue_entry = QueueEntry.objects.create(
                appointment=appointment,
                queue_date=today,
                queue_position=cls.next_queue_position(today),
                patients_ahead=0,
                eta_minutes=0,
                status=QueueEntry.Status.WAITING,
                arrival_time=now,
                validated_at=now,
                validated_by=user if user and user.is_authenticated else None,
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
            queue_entry.refresh_from_db()
            return queue_entry, None
