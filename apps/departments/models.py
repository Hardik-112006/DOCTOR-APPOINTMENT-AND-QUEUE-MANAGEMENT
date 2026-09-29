from django.db import models
from apps.clinics.models import Clinic

class Department(models.Model):
    clinic = models.ForeignKey(Clinic, on_delete=models.CASCADE, related_name='departments')
    name = models.CharField(max_length=100)
    specialty = models.CharField(max_length=150, null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'departments'
        unique_together = ('clinic', 'name')
        verbose_name = 'Department'
        verbose_name_plural = 'Departments'

    def __str__(self):
        return f"{self.name} ({self.clinic.name})"
