from django.urls import path
from apps.accounts.views import StaffListCreateView, StaffActionView

urlpatterns = [
    path('', StaffListCreateView.as_view(), name='staff_list_create'),
    path('<int:pk>/<str:action>/', StaffActionView.as_view(), name='staff_action'),
]
