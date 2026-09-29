from django.urls import path
from apps.consultations.views import ConsultationDetailView, SaveConsultationView

urlpatterns = [
    path('appointment/<int:appointment_id>/', ConsultationDetailView.as_view(), name='consultation_detail'),
    path('save/', SaveConsultationView.as_view(), name='consultation_save'),
]
