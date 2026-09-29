from django.urls import path
from apps.appointments.views import BookAppointmentView, MyAppointmentsView, CancelAppointmentView

urlpatterns = [
    path('book/', BookAppointmentView.as_view(), name='appointment_book'),
    path('my-appointments/', MyAppointmentsView.as_view(), name='appointment_my_list'),
    path('my/', MyAppointmentsView.as_view(), name='appointment_my_short'),
    path('<int:pk>/cancel/', CancelAppointmentView.as_view(), name='appointment_cancel'),
]
