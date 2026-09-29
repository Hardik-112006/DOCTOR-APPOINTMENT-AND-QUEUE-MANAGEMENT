import datetime
# pyrefly: ignore [missing-import]
from django.utils import timezone

# pyrefly: ignore [missing-import]
from django.db.models import Count, Avg, Q
from apps.dashboard.models import ActivityLog
from apps.appointments.models import Appointment
from apps.queue.models import QueueEntry
from apps.doctors.models import Doctor

class DashboardService:
    @staticmethod
    def log_activity(user, clinic, action, entity_type=None, entity_id=None):
        return ActivityLog.objects.create(
            user=user if user and user.is_authenticated else None,
            clinic=clinic,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id
        )

    @staticmethod
    def format_action_display(action, entity_type=None, entity_id=None):
        if not action:
            return "System Event"
        if action == 'APPOINTMENT_BOOKED':
            return f"New appointment token booked (#{entity_id})" if entity_id else "New appointment booked"
        elif action == 'APPOINTMENT_CANCELLED':
            return f"Appointment cancelled (#{entity_id})" if entity_id else "Appointment cancelled"
        elif action == 'WALK_IN_REGISTERED':
            return f"Walk-in token registered (#{entity_id})" if entity_id else "Walk-in patient registered"
        elif action == 'PATIENT_ARRIVED':
            return f"Patient checked in / marked arrived (#{entity_id})" if entity_id else "Patient marked arrived"
        elif action in ('CALL_NEXT_PATIENT', 'QUEUE_STATUS_CALLED'):
            return f"Doctor called next waiting patient (#{entity_id})" if entity_id else "Doctor called next patient"
        elif action in ('CONSULTATION_STARTED', 'QUEUE_STATUS_CONSULTING'):
            return f"Doctor started consultation in room (#{entity_id})" if entity_id else "Consultation started"
        elif action in ('QUEUE_STATUS_COMPLETED', 'CONSULTATION_COMPLETED'):
            return f"Consultation completed & prescription saved (#{entity_id})" if entity_id else "Consultation completed"
        elif action == 'PATIENT_REGISTERED':
            return f"New patient account registered (#{entity_id})" if entity_id else "New patient registered"
        elif action.startswith('USER_LOGIN'):
            role_suffix = action.replace('USER_LOGIN_', '').replace('USER_LOGIN', '')
            return f"User logged in ({role_suffix})" if role_suffix else "User logged in"
        return action.replace('_', ' ').title()

    @staticmethod
    def get_clinic_metrics(clinic, target_date=None):
        if not target_date:
            target_date = timezone.localdate()

        queue_qs = QueueEntry.objects.filter(queue_date=target_date)
        if clinic:
            queue_qs = queue_qs.filter(appointment__doctor__clinic=clinic)

        total_appointments = queue_qs.count()
        waiting_count = queue_qs.filter(status=QueueEntry.Status.WAITING).count()
        called_count = queue_qs.filter(status=QueueEntry.Status.CALLED).count()
        consulting_count = queue_qs.filter(status=QueueEntry.Status.CONSULTING).count()
        completed_count = queue_qs.filter(status=QueueEntry.Status.COMPLETED).count()

        avg_wait = queue_qs.filter(status=QueueEntry.Status.WAITING).aggregate(avg_eta=Avg('eta_minutes'))['avg_eta'] or 0

        doctors_qs = Doctor.objects.filter(clinic=clinic) if clinic else Doctor.objects.all()
        total_doctors = doctors_qs.count()
        available_doctors = doctors_qs.filter(is_available=True).count()

        # Real activity logs (recent 50 logs for audit trail)
        recent_activity_qs = ActivityLog.objects.select_related('user').order_by('-created_at')
        if clinic:
            recent_activity_qs = recent_activity_qs.filter(Q(clinic=clinic) | Q(clinic__isnull=True))
        recent_activity_qs = recent_activity_qs[:50]
        recent_activity = []
        now = timezone.now()
        for log in recent_activity_qs:
            local_dt = timezone.localtime(log.created_at) if log.created_at else None
            diff = now - log.created_at if log.created_at else datetime.timedelta(seconds=0)
            seconds = int(diff.total_seconds())
            if seconds < 30:
                time_ago = 'Just now'
            elif seconds < 60:
                time_ago = f'{seconds}s ago'
            elif seconds < 3600:
                time_ago = f'{seconds // 60}m ago'
            elif seconds < 86400:
                time_ago = f'{seconds // 3600}h ago'
            else:
                time_ago = f'{seconds // 86400}d ago'

            recent_activity.append({
                'id': log.id,
                'user': log.user.full_name if log.user else 'System',
                'user_role': log.user.role if log.user else 'SYSTEM',
                'action': log.action,
                'action_display': DashboardService.format_action_display(log.action, log.entity_type, log.entity_id),
                'entity_type': log.entity_type or 'General',
                'entity_id': log.entity_id,
                'created_at': local_dt.strftime('%H:%M:%S') if local_dt else '',
                'created_at_formatted': local_dt.strftime('%d %b %Y, %I:%M %p') if local_dt else '',
                'created_at_full': local_dt.strftime('%d %b %Y, %I:%M %p') if local_dt else '',
                'time_ago': time_ago
            })

        # Calculate Real Daily Progress for past 7 days
        daily_progress = DashboardService.get_daily_progress(clinic=clinic, target_date=target_date)

        return {
            'date': target_date.isoformat(),
            'total_appointments': total_appointments,
            'waiting_patients': waiting_count,
            'called_patients': called_count,
            'consulting_patients': consulting_count,
            'completed_patients': completed_count,
            'average_waiting_minutes': round(float(avg_wait), 1),
            'total_doctors': total_doctors,
            'available_doctors': available_doctors,
            'recent_activity': recent_activity,
            'daily_progress': daily_progress
        }

    @staticmethod
    def get_daily_progress(clinic=None, target_date=None):
        if not target_date:
            target_date = timezone.localdate()

        daily_progress = []
        for i in range(6, -1, -1):
            day = target_date - datetime.timedelta(days=i)
            day_appts = Appointment.objects.filter(appointment_date=day)
            if clinic:
                day_appts = day_appts.filter(doctor__clinic=clinic)

            active_appts = day_appts.exclude(status=Appointment.Status.CANCELLED)
            day_total = active_appts.count()
            day_completed = active_appts.filter(status=Appointment.Status.COMPLETED).count()
            day_in_progress = active_appts.filter(status__in=[
                Appointment.Status.WAITING,
                Appointment.Status.CALLED,
                Appointment.Status.CONSULTING,
                Appointment.Status.BOOKED
            ]).count()

            percentage = round((day_completed / day_total * 100), 1) if day_total > 0 else 0.0

            daily_progress.append({
                'date': day.isoformat(),
                'day_name': day.strftime('%A'),
                'date_formatted': day.strftime('%d %b %Y'),
                'is_today': (day == target_date),
                'total': day_total,
                'completed': day_completed,
                'in_progress': day_in_progress,
                'percentage': percentage
            })

        return daily_progress
