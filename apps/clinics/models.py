from django.db import models

class Clinic(models.Model):
    name = models.CharField(max_length=150)
    address = models.TextField(null=True, blank=True)
    phone = models.CharField(max_length=20, null=True, blank=True)
    settings_json = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'clinics'
        verbose_name = 'Clinic'
        verbose_name_plural = 'Clinics'

    def __str__(self):
        return self.name

    @property
    def average_consultation_minutes(self):
        return self.settings_json.get('averageConsultationMinutes', 10)

    @property
    def queue_refresh_seconds(self):
        return self.settings_json.get('queueRefreshSeconds', 5)
