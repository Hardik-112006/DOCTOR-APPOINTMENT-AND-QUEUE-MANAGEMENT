from rest_framework import serializers
from apps.patients.models import Patient

class PatientSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='user.full_name', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    language = serializers.CharField(source='user.language', read_only=True)

    class Meta:
        model = Patient
        fields = ['id', 'user_id', 'full_name', 'email', 'phone', 'date_of_birth', 'gender', 'language', 'created_at']
