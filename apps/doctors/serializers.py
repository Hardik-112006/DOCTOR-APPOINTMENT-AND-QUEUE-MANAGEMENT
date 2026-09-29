from rest_framework import serializers
from apps.doctors.models import Doctor, DoctorAvailability
from apps.departments.serializers import DepartmentSerializer

class DoctorAvailabilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = DoctorAvailability
        fields = ['id', 'day_of_week', 'start_time', 'end_time', 'is_active']

class DoctorSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source='user.full_name', read_only=True)
    full_name = serializers.CharField(source='user.full_name', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    phone = serializers.CharField(source='user.phone', read_only=True)
    department_name = serializers.CharField(source='department.name', read_only=True)
    availabilities = DoctorAvailabilitySerializer(many=True, read_only=True)

    class Meta:
        model = Doctor
        fields = [
            'id', 'user_id', 'name', 'full_name', 'email', 'phone', 'clinic_id',
            'department_id', 'department_name', 'specialization',
            'experience', 'consultation_fee', 'is_available', 'availabilities'
        ]

