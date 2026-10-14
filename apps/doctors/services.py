import datetime
from django.db import transaction
from django.utils import timezone
from apps.doctors.models import DoctorAvailability

DAY_CODES = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
DAY_NAMES = dict(DoctorAvailability.DayOfWeek.choices)


def day_code(date):
    return DAY_CODES[date.weekday()]


class ScheduleService:
    @staticmethod
    def windows_for_date(doctor, date):
        """Active (start_time, end_time) consultation windows for the doctor on that calendar date."""
        return [
            (a.start_time, a.end_time)
            for a in sorted(
                (a for a in doctor.availabilities.all() if a.is_active and a.day_of_week == day_code(date)),
                key=lambda a: a.start_time
            )
        ]

    @classmethod
    def booking_block_reason(cls, doctor, date):
        """Why a new booking for this doctor/date must be refused, or None if it is allowed."""
        name = doctor.user.full_name
        today = timezone.localdate()
        if date < today:
            return "You cannot book an appointment for a past date."
        if not doctor.user.is_active or not doctor.user.is_verified:
            return f"{name} is not accepting appointments."
        if not doctor.is_available:
            return f"{name} is currently unavailable. Please choose another doctor or try again later."
        windows = cls.windows_for_date(doctor, date)
        if not windows:
            return f"{name} does not consult on {DAY_NAMES[day_code(date)]}s. Please pick another date."
        if date == today and timezone.localtime().time() >= windows[-1][1]:
            return f"{name}'s consultation hours for today are over (last session ended at {windows[-1][1].strftime('%H:%M')}). Please book for another day."
        return None

    @staticmethod
    def slot_is_past(slot):
        now = timezone.localtime()
        return slot.slot_date < now.date() or (slot.slot_date == now.date() and slot.start_time <= now.time())

    @classmethod
    def sync_slots(cls, doctor, date):
        """
        Make the slot grid for a date match the doctor's current schedule:
        add missing slots, and drop free slots that no longer fall inside any window.
        Booked slots are never touched.
        """
        from apps.appointments.models import Slot

        clinic = doctor.clinic
        duration = datetime.timedelta(minutes=clinic.average_consultation_minutes if clinic else 10)
        windows = cls.windows_for_date(doctor, date)

        wanted = []
        for start, end in windows:
            curr = datetime.datetime.combine(date, start)
            limit = datetime.datetime.combine(date, end)
            while curr + duration <= limit:
                wanted.append((curr.time(), (curr + duration).time()))
                curr += duration

        with transaction.atomic():
            existing = {s.start_time: s for s in Slot.objects.filter(doctor=doctor, slot_date=date)}
            wanted_starts = {start for start, _ in wanted}

            stale_ids = [
                s.id for start, s in existing.items()
                if start not in wanted_starts and s.status == Slot.Status.AVAILABLE
            ]
            if stale_ids:
                Slot.objects.filter(id__in=stale_ids).delete()

            new_slots = [
                Slot(doctor=doctor, slot_date=date, start_time=start, end_time=end, capacity=1, status=Slot.Status.AVAILABLE)
                for start, end in wanted if start not in existing
            ]
            if new_slots:
                Slot.objects.bulk_create(new_slots, ignore_conflicts=True)

        return Slot.objects.filter(doctor=doctor, slot_date=date).order_by('start_time')

    @classmethod
    def duty_status(cls, doctor, date=None):
        """Where the doctor stands on a given day: ON_DUTY, LATER_TODAY, DONE_FOR_TODAY, OFF_TODAY, UNAVAILABLE."""
        date = date or timezone.localdate()
        windows = cls.windows_for_date(doctor, date)
        result = {
            'windows': [{'start_time': s.strftime('%H:%M'), 'end_time': e.strftime('%H:%M')} for s, e in windows],
            'status': None,
            'next_start': None,
        }
        if not doctor.is_available:
            result['status'] = 'UNAVAILABLE'
        elif not windows:
            result['status'] = 'OFF_TODAY'
        elif date != timezone.localdate():
            result['status'] = 'SCHEDULED'
        else:
            now = timezone.localtime().time()
            if any(s <= now < e for s, e in windows):
                result['status'] = 'ON_DUTY'
            else:
                upcoming = [s for s, _ in windows if s > now]
                if upcoming:
                    result['status'] = 'LATER_TODAY'
                    result['next_start'] = upcoming[0].strftime('%H:%M')
                else:
                    result['status'] = 'DONE_FOR_TODAY'
        return result
