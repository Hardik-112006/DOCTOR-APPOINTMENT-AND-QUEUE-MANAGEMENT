# pyrefly: ignore [missing-import]
from rest_framework.views import APIView
# pyrefly: ignore [missing-import]
from rest_framework.response import Response
# pyrefly: ignore [missing-import]
from rest_framework import status, permissions
from apps.accounts.serializers import CustomTokenObtainPairSerializer, UserSerializer, RegisterPatientSerializer
from apps.accounts.models import User
from apps.patients.serializers import PatientSerializer
from apps.doctors.serializers import DoctorSerializer

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

        status_code = status.HTTP_401_UNAUTHORIZED if code in ['USER_NOT_FOUND', 'INVALID_PASSWORD', 'ACCOUNT_INACTIVE', 'INVALID_CREDENTIALS'] else status.HTTP_400_BAD_REQUEST

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

        field_messages = []
        for field, err_list in serializer.errors.items():
            err_text = err_list[0] if isinstance(err_list, list) else str(err_list)
            field_name = field.replace('_', ' ').capitalize()
            field_messages.append(f"{field_name}: {err_text}")

        full_message = " | ".join(field_messages) if field_messages else "Registration validation failed."

        return Response({
            "error": {
                "code": "VALIDATION_ERROR",
                "message": full_message,
                "fields": serializer.errors
            }
        }, status=status.HTTP_400_BAD_REQUEST)

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
