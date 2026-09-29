from django.urls import path
from apps.queue.views import (
    LiveQueueView,
    PatientQueueStatusView,
    WalkInRegistrationView,
    CallNextPatientView,
    UpdateQueueStatusView,
    MarkArrivedView,
)

urlpatterns = [
    path('live/', LiveQueueView.as_view(), name='queue_live'),
    path('patient-status/', PatientQueueStatusView.as_view(), name='queue_patient_status'),
    path('walk-in/', WalkInRegistrationView.as_view(), name='queue_walk_in'),
    path('call-next/', CallNextPatientView.as_view(), name='queue_call_next'),
    path('update-status/', UpdateQueueStatusView.as_view(), name='queue_update_status'),
    path('mark-arrived/', MarkArrivedView.as_view(), name='queue_mark_arrived'),
]
