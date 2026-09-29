import datetime
# pyrefly: ignore [missing-import]
from django.utils import timezone
# pyrefly: ignore [missing-import]
from rest_framework import serializers
# pyrefly: ignore [missing-import]
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.patients.models import Patient


class CustomTokenObtainPairSerializer(serializers.Serializer):
    email_or_phone = serializers.CharField(required=False, allow_blank=True)
    username_or_email = serializers.CharField(required=False, allow_blank=True)
    username = serializers.CharField(required=False, allow_blank=True)
    email = serializers.CharField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True)
    identifier = serializers.CharField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        raw_identifier = (
            attrs.get('email_or_phone') or
            attrs.get('username_or_email') or
            attrs.get('identifier') or
            attrs.get('email') or
            attrs.get('phone') or
            attrs.get('username')
        )
        password = attrs.get('password')

        if not raw_identifier or not password:
            raise serializers.ValidationError('Please enter your email or phone number and password.')

        identifier = str(raw_identifier).strip()

        user = None
        if '@' in identifier:
            user = User.objects.filter(email__iexact=identifier).first()
        else:
            user = User.objects.filter(phone=identifier).first() or User.objects.filter(email__iexact=identifier).first()

        if not user:
            raise serializers.ValidationError({
                'code': 'USER_NOT_FOUND',
                'message': f"No account found with identifier '{identifier}'."
            })

        if not user.check_password(password):
            raise serializers.ValidationError({
                'code': 'INVALID_PASSWORD',
                'message': 'Incorrect password. Please verify and try again.'
            })

        if not user.is_active:
            raise serializers.ValidationError({
                'code': 'ACCOUNT_INACTIVE',
                'message': 'Your account is currently disabled. Please contact clinic administrator.'
            })

        refresh = RefreshToken.for_user(user)
        return {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': {
                'id': user.id,
                'full_name': user.full_name,
                'email': user.email,
                'phone': user.phone,
                'role': user.role,
                'language': user.language
            }
        }


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'full_name', 'email', 'phone', 'role', 'language', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']


class RegisterPatientSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)
    phone = serializers.CharField(max_length=20)
    password = serializers.CharField(write_only=True, min_length=6)
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    gender = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    age = serializers.IntegerField(required=False, allow_null=True)
    blood_group = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    language = serializers.ChoiceField(choices=User.Language.choices, default=User.Language.EN, required=False)

    def validate_phone(self, value):
        cleaned = str(value).strip()
        if not cleaned:
            raise serializers.ValidationError("Phone number is required.")
        if User.objects.filter(phone=cleaned).exists():
            raise serializers.ValidationError("This mobile phone number is already registered.")
        return cleaned

    def validate_email(self, value):
        if value:
            cleaned = str(value).strip().lower()
            if User.objects.filter(email__iexact=cleaned).exists():
                raise serializers.ValidationError("This email address is already registered.")
            return cleaned
        return None

    def validate_password(self, value):
        if len(value) < 6:
            raise serializers.ValidationError("Password must be at least 6 characters long.")
        return value

    def create(self, validated_data):
        dob = validated_data.pop('date_of_birth', None)
        gender = validated_data.pop('gender', None)
        age = validated_data.pop('age', None)
        blood_group = validated_data.pop('blood_group', None)
        password = validated_data.pop('password')

        if not dob and age:
            curr_year = timezone.now().year
            dob = datetime.date(curr_year - int(age), 1, 1)

        user = User.objects.create_user(
            email=validated_data.get('email') or None,
            phone=validated_data.get('phone'),
            full_name=validated_data.get('full_name'),
            role=User.Role.PATIENT,
            language=validated_data.get('language', User.Language.EN),
            password=password
        )

        Patient.objects.create(
            user=user,
            date_of_birth=dob,
            gender=gender,
            phone=user.phone
        )
        return user
