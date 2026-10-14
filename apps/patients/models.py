import datetime
from django.db import models
from django.conf import settings
from django.utils import timezone


class Patient(models.Model):
    class BloodGroup(models.TextChoices):
        A_POS = 'A+', 'A+'
        A_NEG = 'A-', 'A-'
        B_POS = 'B+', 'B+'
        B_NEG = 'B-', 'B-'
        AB_POS = 'AB+', 'AB+'
        AB_NEG = 'AB-', 'AB-'
        O_POS = 'O+', 'O+'
        O_NEG = 'O-', 'O-'

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='patient_profile'
    )
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=30, null=True, blank=True)
    phone = models.CharField(max_length=20, null=True, blank=True)
    blood_group = models.CharField(max_length=5, choices=BloodGroup.choices, null=True, blank=True)
    weight_kg = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    height_cm = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'patients'
        verbose_name = 'Patient'
        verbose_name_plural = 'Patients'

    def __str__(self):
        return f"{self.user.full_name} ({self.phone or self.user.phone})"

    @property
    def age(self):
        if not self.date_of_birth:
            return None
        today = timezone.localdate()
        dob = self.date_of_birth
        return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))

    def set_age(self, age):
        """Store an age the patient typed in as an approximate date of birth (keeps an exact DOB if it already matches)."""
        if age is None or self.age == int(age):
            return
        today = timezone.localdate()
        try:
            self.date_of_birth = today.replace(year=today.year - int(age))
        except ValueError:
            # 29 Feb on a non-leap target year
            self.date_of_birth = datetime.date(today.year - int(age), 2, 28)
