from django.urls import path
from apps.departments.views import DepartmentListView

urlpatterns = [
    path('', DepartmentListView.as_view(), name='department_list'),
]
