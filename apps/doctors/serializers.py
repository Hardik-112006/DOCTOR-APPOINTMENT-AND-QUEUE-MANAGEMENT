from rest_framework import serializers
from apps.doctors.models import Doctor, DoctorAvailability
from apps.doctors.services import ScheduleService, DAY_CODES


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
    today = serializers.SerializerMethodField()

    class Meta:
        model = Doctor
        fields = [
            'id', 'user_id', 'name', 'full_name', 'email', 'phone', 'clinic_id',
            'department_id', 'department_name', 'specialization',
            'experience', 'consultation_fee', 'is_available', 'availabilities', 'today'
        ]

    def get_today(self, obj):
        return ScheduleService.duty_status(obj)


class ScheduleWindowSerializer(serializers.Serializer):
    day_of_week = serializers.ChoiceField(choices=DoctorAvailability.DayOfWeek.choices)
    start_time = serializers.TimeField()
    end_time = serializers.TimeField()

    def validate(self, attrs):
        if attrs['start_time'] >= attrs['end_time']:
            raise serializers.ValidationError(f"{attrs['day_of_week']}: start time must be before end time.")
        return attrs


class DoctorScheduleUpdateSerializer(serializers.Serializer):
    is_available = serializers.BooleanField(required=False)
    availabilities = ScheduleWindowSerializer(many=True, required=False)

    def validate_availabilities(self, windows):
        by_day = {}
        for w in windows:
            by_day.setdefault(w['day_of_week'], []).append(w)
        for day, day_windows in by_day.items():
            day_windows.sort(key=lambda w: w['start_time'])
            for prev, curr in zip(day_windows, day_windows[1:]):
                if curr['start_time'] < prev['end_time']:
                    raise serializers.ValidationError(f"{day}: timings {prev['start_time']:%H:%M}-{prev['end_time']:%H:%M} and {curr['start_time']:%H:%M}-{curr['end_time']:%H:%M} overlap.")
        return sorted(windows, key=lambda w: (DAY_CODES.index(w['day_of_week']), w['start_time']))
