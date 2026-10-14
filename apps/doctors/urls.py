from django.urls import path
from apps.doctors.views import DoctorListView, DoctorAvailabilityView, DoctorSlotsView, DoctorRosterView, DoctorScheduleView

urlpatterns = [
    path('', DoctorListView.as_view(), name='doctor_list'),
    path('roster/', DoctorRosterView.as_view(), name='doctor_roster'),
    path('<int:pk>/availability/', DoctorAvailabilityView.as_view(), name='doctor_availability'),
    path('<int:pk>/slots/', DoctorSlotsView.as_view(), name='doctor_slots'),
    path('<int:pk>/schedule/', DoctorScheduleView.as_view(), name='doctor_schedule'),
]
