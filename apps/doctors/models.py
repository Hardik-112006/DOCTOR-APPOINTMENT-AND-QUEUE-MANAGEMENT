from django.db import models
from django.conf import settings
from apps.clinics.models import Clinic
from apps.departments.models import Department

class Doctor(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='doctor_profile'
    )
    clinic = models.ForeignKey(Clinic, on_delete=models.CASCADE, related_name='doctors')
    department = models.ForeignKey(Department, on_delete=models.RESTRICT, related_name='doctors')
    specialization = models.CharField(max_length=150)
    experience = models.PositiveIntegerField(default=0)
    consultation_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    is_available = models.BooleanField(default=True)

    class Meta:
        db_table = 'doctors'
        verbose_name = 'Doctor'
        verbose_name_plural = 'Doctors'

    def __str__(self):
        return f"Dr. {self.user.full_name} ({self.specialization})"

class DoctorAvailability(models.Model):
    class DayOfWeek(models.TextChoices):
        MON = 'MON', 'Monday'
        TUE = 'TUE', 'Tuesday'
        WED = 'WED', 'Wednesday'
        THU = 'THU', 'Thursday'
        FRI = 'FRI', 'Friday'
        SAT = 'SAT', 'Saturday'
        SUN = 'SUN', 'Sunday'

    doctor = models.ForeignKey(Doctor, on_delete=models.CASCADE, related_name='availabilities')
    day_of_week = models.CharField(max_length=10, choices=DayOfWeek.choices)
    start_time = models.TimeField()
    end_time = models.TimeField()
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'doctor_availability'
        verbose_name = 'Doctor Availability'
        verbose_name_plural = 'Doctor Availabilities'

    def __str__(self):
        return f"{self.doctor.user.full_name} - {self.day_of_week} ({self.start_time}-{self.end_time})"
