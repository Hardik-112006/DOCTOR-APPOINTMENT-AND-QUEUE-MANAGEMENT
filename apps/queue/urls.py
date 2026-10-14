from django.urls import path
from apps.queue.views import (
    LiveQueueView,
    PatientQueueStatusView,
    WalkInRegistrationView,
    CallNextPatientView,
    UpdateQueueStatusView,
    ValidatePatientView,
    ReceptionRemarkView,
)

urlpatterns = [
    path('live/', LiveQueueView.as_view(), name='queue_live'),
    path('patient-status/', PatientQueueStatusView.as_view(), name='queue_patient_status'),
    path('walk-in/', WalkInRegistrationView.as_view(), name='queue_walk_in'),
    path('call-next/', CallNextPatientView.as_view(), name='queue_call_next'),
    path('update-status/', UpdateQueueStatusView.as_view(), name='queue_update_status'),
    path('validate/', ValidatePatientView.as_view(), name='queue_validate'),
    # Older name for the same check-in action
    path('mark-arrived/', ValidatePatientView.as_view(), name='queue_mark_arrived'),
    path('remark/', ReceptionRemarkView.as_view(), name='queue_reception_remark'),
]
