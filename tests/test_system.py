import datetime
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

from apps.clinics.models import Clinic
from apps.departments.models import Department
from apps.doctors.models import Doctor, DoctorAvailability
from apps.patients.models import Patient
from apps.appointments.models import Slot, Appointment
from apps.queue.models import QueueEntry
from apps.queue.services import QueueService
from apps.appointments.services import AppointmentService
from apps.consultations.models import Consultation
from apps.dashboard.services import DashboardService

User = get_user_model()

class DoctorQueueSystemTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.clinic = Clinic.objects.create(
            name="SmartCare Clinic",
            address="Noida",
            phone="+91-9876500001",
            settings_json={"averageConsultationMinutes": 10}
        )

        # Users with proper hashed passwords
        self.patient_user = User.objects.create_user(
            email="patient@test.com",
            phone="9000000010",
            full_name="Test Patient",
            role=User.Role.PATIENT,
            password="Patient@123"
        )
        self.patient = Patient.objects.create(user=self.patient_user, phone="9000000010")

        self.receptionist_user = User.objects.create_user(
            email="receptionist@test.com",
            phone="9000000012",
            full_name="Test Receptionist",
            role=User.Role.RECEPTIONIST,
            password="Receptionist@123"
        )

        self.doctor_user = User.objects.create_user(
            email="doctor@test.com",
            phone="9000000011",
            full_name="Dr. Test Doctor",
            role=User.Role.DOCTOR,
            password="Doctor@123"
        )

        self.dept = Department.objects.create(clinic=self.clinic, name="General Medicine")
        self.doctor = Doctor.objects.create(
            user=self.doctor_user,
            clinic=self.clinic,
            department=self.dept,
            specialization="General Medicine",
            consultation_fee=500.00,
            is_available=True
        )

        # Weekly availability
        DoctorAvailability.objects.create(
            doctor=self.doctor,
            day_of_week=DoctorAvailability.DayOfWeek.MON,
            start_time=datetime.time(9, 0),
            end_time=datetime.time(13, 0),
            is_active=True
        )

        self.admin_user = User.objects.create_superuser(
            email="admin@test.com",
            phone="9000000013",
            full_name="Test Admin",
            password="Admin@123"
        )

    def test_password_hashing_and_verification(self):
        # Verify passwords are never plain text
        self.assertFalse(self.patient_user.password.startswith("Patient@123"))
        self.assertTrue(self.patient_user.password.startswith("pbkdf2_sha256$") or "$" in self.patient_user.password)
        self.assertTrue(self.patient_user.check_password("Patient@123"))
        self.assertTrue(self.doctor_user.check_password("Doctor@123"))
        self.assertTrue(self.receptionist_user.check_password("Receptionist@123"))
        self.assertTrue(self.admin_user.check_password("Admin@123"))

    def test_login_all_roles_and_identifiers(self):
        # 1. Patient login via email
        res = self.client.post('/api/v1/auth/login/', {
            'username_or_email': 'patient@test.com',
            'password': 'Patient@123'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('access', res.data['data'])
        self.assertEqual(res.data['data']['user']['role'], 'PATIENT')

        # 2. Patient login via phone
        res_phone = self.client.post('/api/v1/auth/login/', {
            'username_or_email': '9000000010',
            'password': 'Patient@123'
        })
        self.assertEqual(res_phone.status_code, status.HTTP_200_OK)

        # 3. Doctor login
        res_doc = self.client.post('/api/v1/auth/login/', {
            'identifier': 'doctor@test.com',
            'password': 'Doctor@123'
        })
        self.assertEqual(res_doc.status_code, status.HTTP_200_OK)
        self.assertEqual(res_doc.data['data']['user']['role'], 'DOCTOR')

        # 4. Receptionist login
        res_rec = self.client.post('/api/v1/auth/login/', {
            'email': 'receptionist@test.com',
            'password': 'Receptionist@123'
        })
        self.assertEqual(res_rec.status_code, status.HTTP_200_OK)
        self.assertEqual(res_rec.data['data']['user']['role'], 'RECEPTIONIST')

        # 5. Admin login
        res_adm = self.client.post('/api/v1/auth/login/', {
            'username_or_email': 'admin@test.com',
            'password': 'Admin@123'
        })
        self.assertEqual(res_adm.status_code, status.HTTP_200_OK)
        self.assertEqual(res_adm.data['data']['user']['role'], 'ADMIN')

        # 6. Invalid password
        res_invalid = self.client.post('/api/v1/auth/login/', {
            'username_or_email': 'patient@test.com',
            'password': 'WrongPassword@999'
        })
        self.assertEqual(res_invalid.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(res_invalid.data['error']['code'], 'INVALID_PASSWORD')

        # 7. Non-existent user
        res_nonexistent = self.client.post('/api/v1/auth/login/', {
            'username_or_email': 'nonexistent@test.com',
            'password': 'SomePassword@123'
        })
        self.assertEqual(res_nonexistent.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(res_nonexistent.data['error']['code'], 'USER_NOT_FOUND')

    def test_doctors_and_availability_and_slots_apis(self):
        # 1. Doctors list
        res = self.client.get('/api/v1/doctors/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        doctors_list = res.data['data']
        self.assertGreaterEqual(len(doctors_list), 1)
        self.assertEqual(doctors_list[0]['id'], self.doctor.id)

        # 2. Doctor availability endpoint
        res_avail = self.client.get(f'/api/v1/doctors/{self.doctor.id}/availability/')
        self.assertEqual(res_avail.status_code, status.HTTP_200_OK)
        self.assertIn('availabilities', res_avail.data['data'])
        self.assertEqual(res_avail.data['data']['doctor_id'], self.doctor.id)

        # 3. Doctor slots endpoint
        today = timezone.localdate()
        res_slots = self.client.get(f'/api/v1/doctors/{self.doctor.id}/slots/?date={today.isoformat()}')
        self.assertEqual(res_slots.status_code, status.HTTP_200_OK)
        self.assertIn('slots', res_slots.data['data'])

    def test_book_appointment_and_queue_entry(self):
        self.client.force_authenticate(user=self.patient_user)
        today = timezone.localdate()

        res = self.client.post('/api/v1/appointments/book/', {
            'doctor_id': self.doctor.id,
            'appointment_date': today.isoformat(),
            'booking_type': 'ONLINE'
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        appt_id = res.data['data']['id']
        token = res.data['data']['token_number']
        self.assertTrue(token.startswith('D-'))

        # Check queue entry created
        q_entry = QueueEntry.objects.get(appointment_id=appt_id)
        self.assertEqual(q_entry.status, QueueEntry.Status.WAITING)
        self.assertEqual(q_entry.queue_position, 1)
        self.assertEqual(q_entry.patients_ahead, 0)
        self.assertEqual(q_entry.eta_minutes, 0)

    def test_prevent_duplicate_booking(self):
        today = timezone.localdate()
        appt1, err1 = AppointmentService.book_appointment(
            patient=self.patient,
            doctor=self.doctor,
            department=self.dept,
            appointment_date=today
        )
        self.assertIsNotNone(appt1)

        # Second booking attempt on same date with same doctor
        appt2, err2 = AppointmentService.book_appointment(
            patient=self.patient,
            doctor=self.doctor,
            department=self.dept,
            appointment_date=today
        )
        self.assertIsNone(appt2)
        self.assertIn("already have an active appointment", err2)

    def test_queue_lifecycle_and_eta_calculation(self):
        today = timezone.localdate()

        # Create 3 patients and appointments
        p1 = self.patient
        p2_user = User.objects.create_user(email="p2@test.com", phone="9000000021", full_name="Patient Two", role=User.Role.PATIENT)
        p2 = Patient.objects.create(user=p2_user, phone="9000000021")

        p3_user = User.objects.create_user(email="p3@test.com", phone="9000000022", full_name="Patient Three", role=User.Role.PATIENT)
        p3 = Patient.objects.create(user=p3_user, phone="9000000022")

        appt1, _ = AppointmentService.book_appointment(p1, self.doctor, self.dept, today)
        appt2, _ = AppointmentService.book_appointment(p2, self.doctor, self.dept, today)
        appt3, _ = AppointmentService.book_appointment(p3, self.doctor, self.dept, today)

        q1 = QueueEntry.objects.get(appointment=appt1)
        q2 = QueueEntry.objects.get(appointment=appt2)
        q3 = QueueEntry.objects.get(appointment=appt3)

        self.assertEqual(q1.patients_ahead, 0)
        self.assertEqual(q1.eta_minutes, 0)

        self.assertEqual(q2.patients_ahead, 1)
        self.assertEqual(q2.eta_minutes, 10)

        self.assertEqual(q3.patients_ahead, 2)
        self.assertEqual(q3.eta_minutes, 20)

        # Doctor calls next patient
        called_entry, err = QueueService.call_next_patient(self.doctor, today)
        self.assertEqual(called_entry.appointment_id, appt1.id)
        self.assertEqual(called_entry.status, QueueEntry.Status.CALLED)

        # Doctor starts consultation
        QueueService.update_queue_status(appt1.id, QueueEntry.Status.CONSULTING)
        # Doctor completes consultation
        QueueService.update_queue_status(appt1.id, QueueEntry.Status.COMPLETED, notes="Good health", prescription_notes="Vitamins")

        # After p1 is completed, p2 should now be next with 0 ahead
        QueueService.recalculate_queue(self.doctor.id, today)
        q2.refresh_from_db()
        q3.refresh_from_db()

        self.assertEqual(q2.patients_ahead, 0)
        self.assertEqual(q2.eta_minutes, 0)

        self.assertEqual(q3.patients_ahead, 1)
        self.assertEqual(q3.eta_minutes, 10)

    def test_receptionist_walk_in_registration(self):
        self.client.force_authenticate(user=self.receptionist_user)
        res = self.client.post('/api/v1/queue/walk-in/', {
            'doctor_id': self.doctor.id,
            'department_id': self.dept.id,
            'patient_name': 'Walkin Patient',
            'patient_phone': '9876599999'
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['data']['patient_name'], 'Walkin Patient')
        self.assertEqual(res.data['data']['booking_type'], 'WALK_IN')

    def test_dashboard_metrics(self):
        self.client.force_authenticate(user=self.admin_user)
        res = self.client.get('/api/v1/dashboard/metrics/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('total_appointments', res.data['data'])
        self.assertIn('waiting_patients', res.data['data'])
        self.assertIn('average_waiting_minutes', res.data['data'])
