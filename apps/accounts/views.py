# pyrefly: ignore [missing-import]
from rest_framework.views import APIView
# pyrefly: ignore [missing-import]
from rest_framework.response import Response
# pyrefly: ignore [missing-import]
from rest_framework import status, permissions
# pyrefly: ignore [missing-import]
from django.db import transaction
from apps.accounts.serializers import (
    CustomTokenObtainPairSerializer, UserSerializer, RegisterPatientSerializer,
    RegisterStaffSerializer, StaffSerializer,
)
from apps.accounts.models import User
from apps.accounts.permissions import IsClinicAdmin
from apps.patients.models import Patient
from apps.patients.serializers import PatientSerializer, PatientHealthSerializer
from apps.doctors.serializers import DoctorSerializer


def validation_error_response(serializer, fallback="Validation failed."):
    field_messages = []
    for field, err_list in serializer.errors.items():
        err_text = err_list[0] if isinstance(err_list, list) else str(err_list)
        if field == 'non_field_errors':
            field_messages.append(str(err_text))
        else:
            field_messages.append(f"{field.replace('_', ' ').capitalize()}: {err_text}")
    return Response({
        "error": {
            "code": "VALIDATION_ERROR",
            "message": " | ".join(field_messages) if field_messages else fallback,
            "fields": serializer.errors
        }
    }, status=status.HTTP_400_BAD_REQUEST)

class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = CustomTokenObtainPairSerializer(data=request.data)
        if serializer.is_valid():
            user = getattr(serializer, 'user', None)
            if user:
                try:
                    from apps.dashboard.services import DashboardService
                    DashboardService.log_activity(
                        user=user,
                        clinic=None,
                        action=f"USER_LOGIN_{user.role}",
                        entity_type="User",
                        entity_id=user.id
                    )
                except Exception:
                    pass
            return Response({"data": serializer.validated_data}, status=status.HTTP_200_OK)

        errors = serializer.errors
        code = "INVALID_CREDENTIALS"
        message = "Authentication failed"

        if isinstance(errors, dict):
            if 'code' in errors:
                raw_code = errors['code']
                code = raw_code[0] if isinstance(raw_code, list) else str(raw_code)
            if 'message' in errors:
                raw_msg = errors['message']
                message = raw_msg[0] if isinstance(raw_msg, list) else str(raw_msg)
            elif 'non_field_errors' in errors:
                raw_nfe = errors['non_field_errors'][0]
                if isinstance(raw_nfe, dict):
                    code = raw_nfe.get('code', code)
                    message = raw_nfe.get('message', str(raw_nfe))
                else:
                    message = str(raw_nfe)

        if code in ['USER_NOT_FOUND', 'INVALID_PASSWORD', 'ACCOUNT_INACTIVE', 'INVALID_CREDENTIALS']:
            status_code = status.HTTP_401_UNAUTHORIZED
        elif code == 'ACCOUNT_PENDING_APPROVAL':
            status_code = status.HTTP_403_FORBIDDEN
        else:
            status_code = status.HTTP_400_BAD_REQUEST

        return Response({
            "error": {
                "code": code,
                "message": message,
                "fields": errors
            }
        }, status=status_code)

class RegisterPatientView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterPatientSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            try:
                from apps.dashboard.services import DashboardService
                DashboardService.log_activity(
                    user=user,
                    clinic=None,
                    action="PATIENT_REGISTERED",
                    entity_type="Patient",
                    entity_id=user.id
                )
            except Exception:
                pass
            # pyrefly: ignore [missing-import]
            from rest_framework_simplejwt.tokens import RefreshToken
            refresh = RefreshToken.for_user(user)
            return Response({
                "data": {
                    "message": "Registration successful",
                    "refresh": str(refresh),
                    "access": str(refresh.access_token),
                    "user": UserSerializer(user).data
                }
            }, status=status.HTTP_201_CREATED)

        return validation_error_response(serializer, "Registration validation failed.")


class RegisterStaffView(APIView):
    """Doctor / receptionist self sign-up. The account cannot log in until an admin approves it."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterStaffSerializer(data=request.data, context={'verified': False})
        if not serializer.is_valid():
            return validation_error_response(serializer, "Staff registration validation failed.")
        user = serializer.save()
        try:
            from apps.dashboard.services import DashboardService
            DashboardService.log_activity(user=None, clinic=None, action="STAFF_SIGNUP_REQUESTED", entity_type="User", entity_id=user.id)
        except Exception:
            pass
        return Response({
            "data": {
                "message": "Request submitted. You can sign in once the clinic administrator approves your account.",
                "user": UserSerializer(user).data
            }
        }, status=status.HTTP_201_CREATED)


class CurrentUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        data = UserSerializer(user).data
        if hasattr(user, 'patient_profile'):
            data['patient'] = PatientSerializer(user.patient_profile).data
        if hasattr(user, 'doctor_profile'):
            data['doctor'] = DoctorSerializer(user.doctor_profile).data
        return Response({"data": data}, status=status.HTTP_200_OK)

    def patch(self, request):
        """Patients update their own health profile (blood group, age, weight, height...)."""
        if request.user.role != User.Role.PATIENT:
            return Response({"error": {"code": "FORBIDDEN", "message": "Only patients have a health profile."}}, status=status.HTTP_403_FORBIDDEN)
        serializer = PatientHealthSerializer(data=request.data)
        if not serializer.is_valid():
            return validation_error_response(serializer)
        patient, _ = Patient.objects.get_or_create(user=request.user, defaults={'phone': request.user.phone})
        PatientHealthSerializer.apply(patient, serializer.validated_data)
        return Response({"data": PatientSerializer(patient).data}, status=status.HTTP_200_OK)

class UpdateLanguageView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request):
        lang = str(request.data.get('language', '')).strip().lower()
        if lang not in ['en', 'hi']:
            return Response({
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Language must be either 'en' or 'hi'"
                }
            }, status=status.HTTP_400_BAD_REQUEST)

        request.user.language = lang
        request.user.save(update_fields=['language'])
        return Response({
            "data": {
                "language": lang
            }
        }, status=status.HTTP_200_OK)


class StaffListCreateView(APIView):
    """Admin: list doctors & receptionists, or add a new (already verified) staff account."""
    permission_classes = [IsClinicAdmin]

    def get(self, request):
        qs = User.objects.filter(role__in=[User.Role.DOCTOR, User.Role.RECEPTIONIST]).select_related(
            'doctor_profile__department'
        ).order_by('role', 'full_name')
        role = (request.query_params.get('role') or '').upper()
        if role in (User.Role.DOCTOR, User.Role.RECEPTIONIST):
            qs = qs.filter(role=role)
        state = request.query_params.get('status')
        if state == 'pending':
            qs = qs.filter(is_verified=False)
        elif state == 'active':
            qs = qs.filter(is_verified=True, is_active=True)
        elif state == 'removed':
            qs = qs.filter(is_verified=True, is_active=False)
        counts = {
            'pending': User.objects.filter(role__in=[User.Role.DOCTOR, User.Role.RECEPTIONIST], is_verified=False).count(),
        }
        return Response({"data": StaffSerializer(qs, many=True).data, "counts": counts})

    def post(self, request):
        serializer = RegisterStaffSerializer(data=request.data, context={'verified': True})
        if not serializer.is_valid():
            return validation_error_response(serializer, "Staff validation failed.")
        user = serializer.save()
        from apps.dashboard.services import DashboardService
        DashboardService.log_activity(user=request.user, clinic=None, action=f"STAFF_ADDED_{user.role}", entity_type="User", entity_id=user.id)
        return Response({"data": StaffSerializer(user).data}, status=status.HTTP_201_CREATED)


class StaffActionView(APIView):
    """Admin: approve (validate) / reject a pending request, or remove / restore an existing staff member."""
    permission_classes = [IsClinicAdmin]
    ACTIONS = ('approve', 'reject', 'remove', 'restore')

    def post(self, request, pk, action):
        if action not in self.ACTIONS:
            return Response({"error": {"code": "NOT_FOUND", "message": "Unknown action."}}, status=status.HTTP_404_NOT_FOUND)
        user = User.objects.filter(pk=pk, role__in=[User.Role.DOCTOR, User.Role.RECEPTIONIST]).select_related('doctor_profile').first()
        if not user:
            return Response({"error": {"code": "NOT_FOUND", "message": "Staff member not found."}}, status=status.HTTP_404_NOT_FOUND)

        doctor = getattr(user, 'doctor_profile', None)
        with transaction.atomic():
            if action == 'approve':
                user.is_verified = True
                user.is_active = True
                user.save(update_fields=['is_verified', 'is_active'])
                if doctor:
                    doctor.is_available = True
                    doctor.save(update_fields=['is_available'])
                message = f"{user.full_name} approved. They can now sign in."
            elif action == 'reject':
                if user.is_verified:
                    return Response({"error": {"code": "INVALID_ACTION", "message": "Only pending requests can be rejected. Use remove instead."}}, status=status.HTTP_400_BAD_REQUEST)
                user.delete()
                message = "Request rejected and deleted."
            elif action == 'remove':
                # Soft remove: appointments and prescriptions keep pointing at this doctor.
                user.is_active = False
                user.save(update_fields=['is_active'])
                if doctor:
                    doctor.is_available = False
                    doctor.save(update_fields=['is_available'])
                message = f"{user.full_name} removed. They can no longer sign in."
            else:
                user.is_active = True
                user.save(update_fields=['is_active'])
                message = f"{user.full_name} restored."

        from apps.dashboard.services import DashboardService
        DashboardService.log_activity(user=request.user, clinic=None, action=f"STAFF_{action.upper()}", entity_type="User", entity_id=pk)
        data = None if action == 'reject' else StaffSerializer(user).data
        return Response({"data": {"message": message, "staff": data}})
