from django.urls import path
from apps.doctors.views import DoctorListView, DoctorAvailabilityView, DoctorSlotsView

urlpatterns = [
    path('', DoctorListView.as_view(), name='doctor_list'),
    path('<int:pk>/availability/', DoctorAvailabilityView.as_view(), name='doctor_availability'),
    path('<int:pk>/slots/', DoctorSlotsView.as_view(), name='doctor_slots'),
]

