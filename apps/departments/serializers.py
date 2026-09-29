from rest_framework import serializers
from apps.departments.models import Department

class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'clinic', 'name', 'specialty', 'is_active']
