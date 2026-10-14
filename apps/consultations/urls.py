from django.urls import path
from apps.consultations.views import ConsultationDetailView, SaveConsultationView, AttendedPatientsView, DoctorRemarkView

urlpatterns = [
    path('appointment/<int:appointment_id>/', ConsultationDetailView.as_view(), name='consultation_detail'),
    path('appointment/<int:appointment_id>/remark/', DoctorRemarkView.as_view(), name='consultation_doctor_remark'),
    path('save/', SaveConsultationView.as_view(), name='consultation_save'),
    path('attended/', AttendedPatientsView.as_view(), name='consultation_attended'),
]
