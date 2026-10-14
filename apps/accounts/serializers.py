from decimal import Decimal
# pyrefly: ignore [missing-import]
from rest_framework import serializers
# pyrefly: ignore [missing-import]
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.models import User
from apps.patients.models import Patient
from apps.patients.serializers import PatientHealthSerializer


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

        if not user.is_verified:
            raise serializers.ValidationError({
                'code': 'ACCOUNT_PENDING_APPROVAL',
                'message': 'Your staff account is awaiting approval from the clinic administrator.'
            })

        self.user = user
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
        fields = ['id', 'full_name', 'email', 'phone', 'role', 'language', 'is_active', 'is_verified', 'created_at']
        read_only_fields = ['id', 'created_at']


class RegisterPatientSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)
    phone = serializers.CharField(max_length=20)
    password = serializers.CharField(write_only=True, min_length=6)
    date_of_birth = serializers.DateField(required=False, allow_null=True)
    gender = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    age = serializers.IntegerField(required=False, allow_null=True, min_value=0, max_value=120)
    blood_group = serializers.ChoiceField(choices=Patient.BloodGroup.choices, required=False, allow_blank=True, allow_null=True)
    weight_kg = serializers.DecimalField(max_digits=5, decimal_places=1, required=False, allow_null=True, min_value=Decimal('1'), max_value=Decimal('500'))
    height_cm = serializers.DecimalField(max_digits=5, decimal_places=1, required=False, allow_null=True, min_value=Decimal('30'), max_value=Decimal('272'))
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
        health = {f: validated_data.pop(f, None) for f in PatientHealthSerializer.HEALTH_FIELDS}
        password = validated_data.pop('password')

        user = User.objects.create_user(
            email=validated_data.get('email') or None,
            phone=validated_data.get('phone'),
            full_name=validated_data.get('full_name'),
            role=User.Role.PATIENT,
            language=validated_data.get('language', User.Language.EN),
            password=password
        )

        patient = Patient.objects.create(user=user, phone=user.phone)
        PatientHealthSerializer.apply(patient, health)
        return user


class StaffSerializer(serializers.ModelSerializer):
    doctor = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'full_name', 'email', 'phone', 'role', 'is_active', 'is_verified', 'created_at', 'doctor']

    def get_doctor(self, obj):
        doctor = getattr(obj, 'doctor_profile', None)
        if not doctor:
            return None
        return {
            'id': doctor.id,
            'department_id': doctor.department_id,
            'department_name': doctor.department.name if doctor.department_id else None,
            'specialization': doctor.specialization,
            'experience': doctor.experience,
            'consultation_fee': str(doctor.consultation_fee),
            'is_available': doctor.is_available,
        }


class RegisterStaffSerializer(serializers.Serializer):
    """Creates a doctor or receptionist account. Self sign-ups stay unverified until an admin approves them."""
    role = serializers.ChoiceField(choices=[
        (User.Role.DOCTOR.value, User.Role.DOCTOR.label),
        (User.Role.RECEPTIONIST.value, User.Role.RECEPTIONIST.label),
    ])
    full_name = serializers.CharField(max_length=150)
    phone = serializers.CharField(max_length=20)
    email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)
    password = serializers.CharField(write_only=True, min_length=6)
    department_id = serializers.IntegerField(required=False, allow_null=True)
    specialization = serializers.CharField(max_length=150, required=False, allow_blank=True)
    experience = serializers.IntegerField(required=False, min_value=0, max_value=80, default=0)
    consultation_fee = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, min_value=Decimal('0'), default=0)

    validate_phone = RegisterPatientSerializer.validate_phone
    validate_email = RegisterPatientSerializer.validate_email

    def validate(self, attrs):
        if attrs['role'] == User.Role.DOCTOR:
            from apps.departments.models import Department
            dept = Department.objects.filter(pk=attrs.get('department_id'), is_active=True).first()
            if not dept:
                raise serializers.ValidationError({'department_id': 'Please choose the department this doctor belongs to.'})
            attrs['department'] = dept
            if not attrs.get('specialization'):
                attrs['specialization'] = dept.name
        return attrs

    def create(self, validated_data):
        from apps.doctors.models import Doctor
        verified = self.context.get('verified', False)
        role = validated_data['role']
        user = User.objects.create_user(
            email=validated_data.get('email') or None,
            phone=validated_data['phone'],
            full_name=validated_data['full_name'],
            role=role,
            password=validated_data['password'],
            is_verified=verified,
        )
        if role == User.Role.DOCTOR:
            dept = validated_data['department']
            Doctor.objects.create(
                user=user,
                clinic=dept.clinic,
                department=dept,
                specialization=validated_data['specialization'],
                experience=validated_data.get('experience') or 0,
                consultation_fee=validated_data.get('consultation_fee') or 0,
                # Pending doctors stay hidden from booking until an admin approves them.
                is_available=verified,
            )
        return user
