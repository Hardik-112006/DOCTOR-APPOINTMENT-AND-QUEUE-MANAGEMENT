from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from apps.departments.models import Department
from apps.departments.serializers import DepartmentSerializer

class DepartmentListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        clinic_id = request.query_params.get('clinic_id', 1)
        depts = Department.objects.filter(clinic_id=clinic_id, is_active=True)
        serializer = DepartmentSerializer(depts, many=True)
        return Response({"data": serializer.data})
