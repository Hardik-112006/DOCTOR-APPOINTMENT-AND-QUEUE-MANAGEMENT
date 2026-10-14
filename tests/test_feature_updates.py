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
from apps.appointments.models import Appointment
from apps.appointments.services import AppointmentService
from apps.queue.models import QueueEntry
from apps.queue.services import QueueService

User = get_user_model()


class FeatureUpdateTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.clinic = Clinic.objects.create(name="SmartCare", settings_json={"averageConsultationMinutes": 10})
        self.dept = Department.objects.create(clinic=self.clinic, name="General Medicine")

        self.patient_user = User.objects.create_user(email="p1@test.com", phone="9100000001", full_name="Patient One", role=User.Role.PATIENT, password="Pass@1234")
        self.patient = Patient.objects.create(user=self.patient_user, phone="9100000001")
        self.other_user = User.objects.create_user(email="p2@test.com", phone="9100000002", full_name="Patient Two", role=User.Role.PATIENT, password="Pass@1234")
        self.other_patient = Patient.objects.create(user=self.other_user, phone="9100000002")

        self.receptionist = User.objects.create_user(email="r@test.com", phone="9100000003", full_name="Reception", role=User.Role.RECEPTIONIST, password="Pass@1234")
        self.admin = User.objects.create_superuser(email="a@test.com", phone="9100000004", full_name="Admin", password="Pass@1234")

        self.doctor_user = User.objects.create_user(email="d@test.com", phone="9100000005", full_name="Dr. One", role=User.Role.DOCTOR, password="Pass@1234")
        self.doctor = Doctor.objects.create(user=self.doctor_user, clinic=self.clinic, department=self.dept, specialization="GP", consultation_fee=300, is_available=True)
        self.other_doctor_user = User.objects.create_user(email="d2@test.com", phone="9100000006", full_name="Dr. Two", role=User.Role.DOCTOR, password="Pass@1234")
        self.other_doctor = Doctor.objects.create(user=self.other_doctor_user, clinic=self.clinic, department=self.dept, specialization="GP", is_available=True)

        for doc in (self.doctor, self.other_doctor):
            for day in DoctorAvailability.DayOfWeek.values:
                DoctorAvailability.objects.create(doctor=doc, day_of_week=day, start_time=datetime.time(0, 0), end_time=datetime.time(23, 59))

        self.today = timezone.localdate()

    def book(self, patient, doctor=None, date=None, **kwargs):
        return AppointmentService.book_appointment(patient, doctor or self.doctor, self.dept, date or self.today, **kwargs)

    def walk_in(self, name, phone):
        return QueueService.register_walk_in(self.clinic, self.doctor, self.dept, name, phone, user=self.receptionist)

    # ---------- Patient ----------

    def test_booking_saves_problem_and_health_details(self):
        self.client.force_authenticate(self.patient_user)
        res = self.client.post('/api/v1/appointments/book/', {
            'doctor_id': self.doctor.id,
            'appointment_date': self.today.isoformat(),
            'problem_description': 'Fever and cough for 3 days',
            'blood_group': 'B+', 'age': 30, 'weight_kg': '68.5', 'height_cm': '172',
        }, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data['data']['problem_description'], 'Fever and cough for 3 days')
        self.patient.refresh_from_db()
        self.assertEqual(self.patient.blood_group, 'B+')
        self.assertEqual(self.patient.age, 30)
        self.assertEqual(str(self.patient.weight_kg), '68.5')

    def test_booking_failures_return_clear_reasons(self):
        self.client.force_authenticate(self.patient_user)
        res = self.client.post('/api/v1/appointments/book/', {'doctor_id': self.doctor.id, 'appointment_date': (self.today - datetime.timedelta(days=1)).isoformat()}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('past date', res.data['error']['message'])

        DoctorAvailability.objects.filter(doctor=self.doctor, day_of_week='SUN').delete()
        next_sunday = self.today + datetime.timedelta(days=(6 - self.today.weekday()) or 7)
        res = self.client.post('/api/v1/appointments/book/', {'doctor_id': self.doctor.id, 'appointment_date': next_sunday.isoformat()}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('does not consult on Sundays', res.data['error']['message'])

        self.doctor.is_available = False
        self.doctor.save()
        res = self.client.post('/api/v1/appointments/book/', {'doctor_id': self.doctor.id, 'appointment_date': self.today.isoformat()}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('currently unavailable', res.data['error']['message'])

    def test_only_patients_can_book(self):
        self.client.force_authenticate(self.doctor_user)
        res = self.client.post('/api/v1/appointments/book/', {'doctor_id': self.doctor.id, 'appointment_date': self.today.isoformat()}, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_patient_sees_people_ahead_including_walk_ins(self):
        self.book(self.other_patient)                 # online, not checked in
        self.walk_in("Walk In A", "9100000010")       # walk-in, auto validated
        self.walk_in("Walk In B", "9100000011")
        appt, err = self.book(self.patient)
        self.assertIsNone(err)

        self.client.force_authenticate(self.patient_user)
        res = self.client.get('/api/v1/queue/patient-status/', {'appointment_id': appt.id})
        self.assertEqual(res.status_code, 200)
        data = res.data['data']
        self.assertEqual(data['patients_ahead'], 3)
        ahead = data['queue']['ahead']
        self.assertEqual(ahead['total'], 3)
        self.assertEqual(ahead['walk_in'], 2)
        self.assertEqual(ahead['online'], 1)
        self.assertEqual(ahead['checked_in'], 2)
        self.assertEqual(ahead['not_checked_in'], 1)
        board = data['queue']['board']
        self.assertEqual(len(board), 4)
        self.assertTrue(board[-1]['is_you'])
        # Board never leaks other patients' identities
        self.assertNotIn('patient_name', board[0])
        self.assertNotIn('reception_remark', data)

    def test_patient_cannot_view_others_queue_or_staff_apis(self):
        other_appt, _ = self.book(self.other_patient)
        self.client.force_authenticate(self.patient_user)
        res = self.client.get('/api/v1/queue/patient-status/', {'appointment_id': other_appt.id})
        self.assertIsNone(res.data['data'])
        self.assertEqual(self.client.get('/api/v1/queue/live/').status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get('/api/v1/dashboard/metrics/').status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get('/api/v1/dashboard/activity-logs/').status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.get('/api/v1/staff/').status_code, status.HTTP_403_FORBIDDEN)

    def test_patient_updates_health_profile(self):
        self.client.force_authenticate(self.patient_user)
        res = self.client.patch('/api/v1/auth/me/', {'blood_group': 'O-', 'age': 45, 'height_cm': '160.5'}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['data']['blood_group'], 'O-')
        self.assertEqual(res.data['data']['age'], 45)
        res = self.client.patch('/api/v1/auth/me/', {'blood_group': 'Z+'}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_registration_stores_health_details(self):
        res = self.client.post('/api/v1/auth/register/', {
            'full_name': 'New Patient', 'phone': '9100000099', 'password': 'Secret@123',
            'blood_group': 'AB+', 'weight_kg': '70', 'height_cm': '175', 'age': 28,
        }, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        patient = Patient.objects.get(user__phone='9100000099')
        self.assertEqual(patient.blood_group, 'AB+')
        self.assertEqual(patient.age, 28)

    # ---------- Receptionist ----------

    def test_validation_gates_doctor_call_and_notifies(self):
        appt, _ = self.book(self.patient)
        self.client.force_authenticate(self.doctor_user)
        res = self.client.post('/api/v1/queue/update-status/', {'appointment_id': appt.id, 'status': 'CALLED'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('not been validated', res.data['error']['message'])

        self.client.force_authenticate(self.receptionist)
        res = self.client.post('/api/v1/queue/validate/', {'appointment_id': appt.id}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertTrue(res.data['data']['is_validated'])
        self.assertTrue(self.patient_user.notifications.filter(type='PATIENT_VALIDATED').exists())

        self.client.force_authenticate(self.doctor_user)
        res = self.client.post('/api/v1/queue/call-next/', {}, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['data']['appointment_id'], appt.id)

    def test_walk_in_is_auto_validated_and_duplicate_is_rejected(self):
        self.client.force_authenticate(self.receptionist)
        payload = {'doctor_id': self.doctor.id, 'patient_name': 'Ramesh', 'patient_phone': '9100000020', 'problem_description': 'Back pain', 'age': 50}
        res = self.client.post('/api/v1/queue/walk-in/', payload, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertTrue(res.data['data']['is_validated'])
        self.assertEqual(res.data['data']['problem_description'], 'Back pain')
        self.assertEqual(res.data['data']['patient_age'], 50)
        res = self.client.post('/api/v1/queue/walk-in/', payload, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('already has token', res.data['error']['message'])

    def test_reception_remark_is_staff_only(self):
        appt, _ = self.book(self.patient)
        self.client.force_authenticate(self.receptionist)
        res = self.client.post('/api/v1/queue/remark/', {'appointment_id': appt.id, 'remark': 'Fee paid'}, format='json')
        self.assertEqual(res.status_code, 200)
        appt.refresh_from_db()
        self.assertEqual(appt.reception_remark, 'Fee paid')
        live = self.client.get('/api/v1/queue/live/').data['data']['queue']
        self.assertEqual(live[0]['reception_remark'], 'Fee paid')
        self.client.force_authenticate(self.patient_user)
        self.assertEqual(self.client.post('/api/v1/queue/remark/', {'appointment_id': appt.id, 'remark': 'x'}, format='json').status_code, 403)

    def test_receptionist_downloads_walk_in_prescription(self):
        entry, _ = self.walk_in("Walk Rx", "9100000030")
        QueueService.update_queue_status(entry.appointment_id, QueueEntry.Status.CONSULTING)
        QueueService.update_queue_status(entry.appointment_id, QueueEntry.Status.COMPLETED, notes="n", prescription_notes="Paracetamol", doctor_remark="private")
        self.client.force_authenticate(self.receptionist)
        res = self.client.get(f'/api/v1/consultations/appointment/{entry.appointment_id}/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['data']['prescription_notes'], 'Paracetamol')
        self.assertNotIn('doctor_remark', res.data['data'])
        past = self.client.get('/api/v1/queue/live/', {'date': self.today.isoformat()}).data['data']['queue']
        self.assertEqual(past[0]['status'], 'COMPLETED')

    def test_receptionist_sets_schedule_and_sees_roster(self):
        self.client.force_authenticate(self.receptionist)
        res = self.client.put(f'/api/v1/doctors/{self.doctor.id}/schedule/', {
            'is_available': True,
            'availabilities': [
                {'day_of_week': 'MON', 'start_time': '09:00', 'end_time': '13:00'},
                {'day_of_week': 'MON', 'start_time': '14:00', 'end_time': '17:00'},
            ]
        }, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(self.doctor.availabilities.count(), 2)

        res = self.client.put(f'/api/v1/doctors/{self.doctor.id}/schedule/', {
            'availabilities': [
                {'day_of_week': 'TUE', 'start_time': '09:00', 'end_time': '13:00'},
                {'day_of_week': 'TUE', 'start_time': '12:00', 'end_time': '15:00'},
            ]
        }, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('overlap', res.data['error']['message'])

        res = self.client.put(f'/api/v1/doctors/{self.other_doctor.id}/schedule/', {'is_available': False}, format='json')
        self.assertEqual(res.status_code, 200)

        roster = self.client.get('/api/v1/doctors/roster/').data['data']
        self.assertEqual(roster['summary']['total'], 2)
        by_id = {d['id']: d for d in roster['doctors']}
        self.assertEqual(by_id[self.other_doctor.id]['duty_status'], 'UNAVAILABLE')

        self.client.force_authenticate(self.patient_user)
        self.assertEqual(self.client.put(f'/api/v1/doctors/{self.doctor.id}/schedule/', {'is_available': False}, format='json').status_code, 403)

    def test_slots_follow_schedule_changes(self):
        tomorrow = self.today + datetime.timedelta(days=1)
        code = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'][tomorrow.weekday()]
        DoctorAvailability.objects.filter(doctor=self.doctor, day_of_week=code).delete()
        DoctorAvailability.objects.create(doctor=self.doctor, day_of_week=code, start_time=datetime.time(9, 0), end_time=datetime.time(10, 0))
        slots = self.client.get(f'/api/v1/doctors/{self.doctor.id}/slots/', {'date': tomorrow.isoformat()}).data['data']['slots']
        self.assertEqual(len(slots), 6)
        DoctorAvailability.objects.filter(doctor=self.doctor, day_of_week=code).update(end_time=datetime.time(9, 30))
        slots = self.client.get(f'/api/v1/doctors/{self.doctor.id}/slots/', {'date': tomorrow.isoformat()}).data['data']['slots']
        self.assertEqual(len(slots), 3)

    # ---------- Doctor ----------

    def test_doctor_remark_is_private_and_listed_in_history(self):
        appt, _ = self.book(self.patient, problem_description="Headache")
        QueueService.validate_entry(appt.id, user=self.receptionist)
        QueueService.update_queue_status(appt.id, QueueEntry.Status.CALLED)
        QueueService.update_queue_status(appt.id, QueueEntry.Status.CONSULTING)

        self.client.force_authenticate(self.doctor_user)
        res = self.client.post('/api/v1/consultations/save/', {
            'appointment_id': appt.id, 'notes': 'Migraine', 'prescription_notes': 'Rest',
            'doctor_remark': 'Anxious patient, prefers Hindi', 'complete': True
        }, format='json')
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data['data']['doctor_remark'], 'Anxious patient, prefers Hindi')

        attended = self.client.get('/api/v1/consultations/attended/', {'patient_id': self.patient.id}).data['data']
        self.assertEqual(len(attended), 1)
        self.assertEqual(attended[0]['problem_description'], 'Headache')

        res = self.client.post(f'/api/v1/consultations/appointment/{appt.id}/remark/', {'doctor_remark': 'Follow up in 2 weeks'}, format='json')
        self.assertEqual(res.status_code, 200)

        self.client.force_authenticate(self.patient_user)
        res = self.client.get(f'/api/v1/consultations/appointment/{appt.id}/')
        self.assertNotIn('doctor_remark', res.data['data'])

        self.client.force_authenticate(self.other_doctor_user)
        res = self.client.post(f'/api/v1/consultations/appointment/{appt.id}/remark/', {'doctor_remark': 'x'}, format='json')
        self.assertEqual(res.status_code, 404)

    def test_doctor_sees_only_own_queue_with_patient_details(self):
        appt, _ = self.book(self.patient, problem_description="Chest pain")
        self.book(self.other_patient, doctor=self.other_doctor)
        self.client.force_authenticate(self.doctor_user)
        queue = self.client.get('/api/v1/queue/live/', {'doctor_id': self.other_doctor.id}).data['data']['queue']
        self.assertEqual(len(queue), 1)
        self.assertEqual(queue[0]['appointment_id'], appt.id)
        self.assertEqual(queue[0]['problem_description'], 'Chest pain')
        self.assertIn('patient_blood_group', queue[0])

    def test_save_draft_requires_started_consultation(self):
        appt, _ = self.book(self.patient)
        self.client.force_authenticate(self.doctor_user)
        res = self.client.post('/api/v1/consultations/save/', {'appointment_id': appt.id, 'notes': 'x'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['error']['code'], 'CONSULTATION_NOT_STARTED')

    # ---------- Admin ----------

    def test_staff_signup_needs_admin_approval(self):
        res = self.client.post('/api/v1/auth/register-staff/', {
            'role': 'DOCTOR', 'full_name': 'Dr. New', 'phone': '9100000040', 'password': 'Doc@12345',
            'department_id': self.dept.id, 'consultation_fee': '400'
        }, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        user_id = res.data['data']['user']['id']

        res = self.client.post('/api/v1/auth/login/', {'username_or_email': '9100000040', 'password': 'Doc@12345'}, format='json')
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.data['error']['code'], 'ACCOUNT_PENDING_APPROVAL')
        self.assertNotIn(user_id, [d['user_id'] for d in self.client.get('/api/v1/doctors/').data['data']])

        self.client.force_authenticate(self.admin)
        pending = self.client.get('/api/v1/staff/', {'status': 'pending'}).data['data']
        self.assertEqual([u['id'] for u in pending], [user_id])
        self.assertEqual(self.client.post(f'/api/v1/staff/{user_id}/approve/').status_code, 200)
        self.client.force_authenticate(None)

        res = self.client.post('/api/v1/auth/login/', {'username_or_email': '9100000040', 'password': 'Doc@12345'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertIn(user_id, [d['user_id'] for d in self.client.get('/api/v1/doctors/').data['data']])

    def test_admin_adds_removes_restores_and_rejects_staff(self):
        self.client.force_authenticate(self.admin)
        res = self.client.post('/api/v1/staff/', {'role': 'RECEPTIONIST', 'full_name': 'Desk Two', 'phone': '9100000050', 'password': 'Desk@12345'}, format='json')
        self.assertEqual(res.status_code, 201, res.data)
        self.assertTrue(res.data['data']['is_verified'])
        rec_id = res.data['data']['id']

        self.assertEqual(self.client.post(f'/api/v1/staff/{rec_id}/remove/').status_code, 200)
        self.assertFalse(User.objects.get(pk=rec_id).is_active)
        self.assertEqual(self.client.post(f'/api/v1/staff/{rec_id}/reject/').status_code, 400)
        self.assertEqual(self.client.post(f'/api/v1/staff/{rec_id}/restore/').status_code, 200)

        self.assertEqual(self.client.post(f'/api/v1/staff/{self.doctor_user.id}/remove/').status_code, 200)
        self.doctor.refresh_from_db()
        self.assertFalse(self.doctor.is_available)

        self.client.force_authenticate(None)
        self.client.post('/api/v1/auth/register-staff/', {'role': 'RECEPTIONIST', 'full_name': 'Pending', 'phone': '9100000060', 'password': 'Pend@12345'}, format='json')
        pending_id = User.objects.get(phone='9100000060').id
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.post(f'/api/v1/staff/{pending_id}/reject/').status_code, 200)
        self.assertFalse(User.objects.filter(pk=pending_id).exists())
