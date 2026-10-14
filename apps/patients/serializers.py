from decimal import Decimal
from rest_framework import serializers
from apps.patients.models import Patient


class PatientSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='user.full_name', read_only=True)
    email = serializers.CharField(source='user.email', read_only=True)
    language = serializers.CharField(source='user.language', read_only=True)
    age = serializers.IntegerField(read_only=True)

    class Meta:
        model = Patient
        fields = [
            'id', 'user_id', 'full_name', 'email', 'phone', 'date_of_birth', 'age', 'gender',
            'blood_group', 'weight_kg', 'height_cm', 'language', 'created_at'
        ]


class PatientHealthSerializer(serializers.Serializer):
    """Optional health details a patient (or the receptionist, for walk-ins) can fill in."""
    gender = serializers.CharField(max_length=30, required=False, allow_blank=True, allow_null=True)
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    age = serializers.IntegerField(required=False, allow_null=True, min_value=0, max_value=120)
    blood_group = serializers.ChoiceField(choices=Patient.BloodGroup.choices, required=False, allow_blank=True, allow_null=True)
    weight_kg = serializers.DecimalField(max_digits=5, decimal_places=1, required=False, allow_null=True, min_value=Decimal('1'), max_value=Decimal('500'))
    height_cm = serializers.DecimalField(max_digits=5, decimal_places=1, required=False, allow_null=True, min_value=Decimal('30'), max_value=Decimal('272'))

    HEALTH_FIELDS = ('gender', 'date_of_birth', 'age', 'blood_group', 'weight_kg', 'height_cm')

    @classmethod
    def apply(cls, patient, data):
        """Copy whichever health fields were provided onto the patient. Blank values are ignored, not erased."""
        changed = False
        for field in ('gender', 'date_of_birth', 'blood_group', 'weight_kg', 'height_cm'):
            value = data.get(field)
            if value in (None, ''):
                continue
            if getattr(patient, field) != value:
                setattr(patient, field, value)
                changed = True
        if data.get('age') is not None and not data.get('date_of_birth'):
            before = patient.date_of_birth
            patient.set_age(data['age'])
            changed = changed or before != patient.date_of_birth
        if changed:
            patient.save()
        return patient
