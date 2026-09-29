import datetime
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions, status
from apps.doctors.models import Doctor, DoctorAvailability
from apps.doctors.serializers import DoctorSerializer, DoctorAvailabilitySerializer
from apps.appointments.models import Slot
from apps.appointments.serializers import SlotSerializer

class DoctorListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        clinic_id = request.query_params.get('clinic_id')
        department_id = request.query_params.get('department_id')

        doctors = Doctor.objects.select_related('user', 'department', 'clinic').prefetch_related('availabilities').filter(user__is_active=True)
        if clinic_id:
            doctors = doctors.filter(clinic_id=clinic_id)
        if department_id:
            doctors = doctors.filter(department_id=department_id)

        serializer = DoctorSerializer(doctors, many=True)
        return Response({"data": serializer.data})

class DoctorAvailabilityView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        try:
            doctor = Doctor.objects.select_related('user', 'department', 'clinic').prefetch_related('availabilities').get(pk=pk)
        except Doctor.DoesNotExist:
            return Response({"error": {"code": "NOT_FOUND", "message": "Doctor not found"}}, status=status.HTTP_404_NOT_FOUND)

        today = timezone.localdate()
        day_map = {0: 'MON', 1: 'TUE', 2: 'WED', 3: 'THU', 4: 'FRI', 5: 'SAT', 6: 'SUN'}
        today_code = day_map[today.weekday()]

        availabilities = doctor.availabilities.filter(is_active=True)
        today_avail = availabilities.filter(day_of_week=today_code).first()

        return Response({
            "data": {
                "doctor_id": doctor.id,
                "doctor_name": doctor.user.full_name,
                "specialization": doctor.specialization,
                "is_available": doctor.is_available,
                "availabilities": DoctorAvailabilitySerializer(availabilities, many=True).data,
                "today_day_of_week": today_code,
                "today_available": bool(today_avail and doctor.is_available),
                "today_schedule": {
                    "start_time": today_avail.start_time.strftime('%H:%M:%S') if today_avail else None,
                    "end_time": today_avail.end_time.strftime('%H:%M:%S') if today_avail else None
                } if today_avail else None
            }
        })

class DoctorSlotsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, pk):
        try:
            doctor = Doctor.objects.get(pk=pk)
        except Doctor.DoesNotExist:
            return Response({"error": {"code": "NOT_FOUND", "message": "Doctor not found"}}, status=status.HTTP_404_NOT_FOUND)

        date_str = request.query_params.get('date')
        if not date_str:
            target_date = timezone.localdate()
        else:
            try:
                target_date = datetime.date.fromisoformat(date_str)
            except ValueError:
                return Response({"error": {"code": "VALIDATION_ERROR", "message": "Invalid date format. Use YYYY-MM-DD"}}, status=status.HTTP_400_BAD_REQUEST)

        # Look for existing slots
        slots = Slot.objects.filter(doctor=doctor, slot_date=target_date).order_by('start_time')

        # Auto-generate slots if none exist and doctor has availability on that day of week
        if not slots.exists():
            day_map = {0: 'MON', 1: 'TUE', 2: 'WED', 3: 'THU', 4: 'FRI', 5: 'SAT', 6: 'SUN'}
            target_day_code = day_map[target_date.weekday()]

            availabilities = DoctorAvailability.objects.filter(doctor=doctor, day_of_week=target_day_code, is_active=True)
            clinic = doctor.clinic
            slot_duration = clinic.average_consultation_minutes if clinic else 10

            new_slots = []
            for avail in availabilities:
                curr_time = avail.start_time
                while curr_time < avail.end_time:
                    curr_dt = datetime.datetime.combine(target_date, curr_time)
                    end_dt = curr_dt + datetime.timedelta(minutes=slot_duration)
                    if end_dt.time() > avail.end_time:
                        break
                    new_slots.append(
                        Slot(
                            doctor=doctor,
                            slot_date=target_date,
                            start_time=curr_time,
                            end_time=end_dt.time(),
                            capacity=1,
                            status=Slot.Status.AVAILABLE
                        )
                    )
                    curr_time = end_dt.time()

            if new_slots:
                Slot.objects.bulk_create(new_slots)
                slots = Slot.objects.filter(doctor=doctor, slot_date=target_date).order_by('start_time')

        serializer = SlotSerializer(slots, many=True)
        return Response({
            "data": {
                "doctor": DoctorSerializer(doctor).data,
                "date": target_date.isoformat(),
                "slots": serializer.data
            }
        })

