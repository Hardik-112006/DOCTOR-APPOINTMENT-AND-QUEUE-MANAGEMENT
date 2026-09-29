import datetime
import sys
# pyrefly: ignore [missing-import]
from django.core.management.base import BaseCommand
# pyrefly: ignore [missing-import]
from django.utils import timezone
# pyrefly: ignore [missing-import]
from django.contrib.auth import get_user_model
# pyrefly: ignore [missing-import]
from django.db import transaction

from apps.clinics.models import Clinic
from apps.departments.models import Department
from apps.doctors.models import Doctor, DoctorAvailability
from apps.patients.models import Patient
from apps.appointments.models import Slot, Appointment
from apps.queue.models import QueueEntry
from apps.consultations.models import Consultation
from apps.notifications.models import Notification
from apps.dashboard.models import ActivityLog

User = get_user_model()

class Command(BaseCommand):
    help = 'Seeds database with realistic clinic, users, 8+ doctors, schedules, slots, appointments, and live queue state (idempotent).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Wipe existing demo data before seeding'
        )

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Starting comprehensive development & demo data seeding..."))
        sys.stdout.flush()

        if options.get('reset'):
            self.stdout.write(self.style.WARNING("Reset flag enabled. Cleaning previous data..."))
            ActivityLog.objects.all().delete()
            Notification.objects.all().delete()
            Consultation.objects.all().delete()
            QueueEntry.objects.all().delete()
            Appointment.objects.all().delete()
            Slot.objects.all().delete()
            DoctorAvailability.objects.all().delete()
            Patient.objects.all().delete()
            Doctor.objects.all().delete()
            Department.objects.all().delete()
            User.objects.all().delete()
            Clinic.objects.all().delete()

        # 1. CLINIC
        clinic, _ = Clinic.objects.update_or_create(
            id=1,
            defaults={
                'name': 'SmartCare Clinic',
                'address': 'Sector 62, Noida, Uttar Pradesh',
                'phone': '+91-9876500001',
                'settings_json': {
                    'defaultLanguage': 'en',
                    'supportedLanguages': ['en', 'hi'],
                    'averageConsultationMinutes': 10,
                    'queueRefreshSeconds': 5
                }
            }
        )
        self.stdout.write(f"[OK] Clinic verified: {clinic.name}")

        # 2. DEPARTMENTS
        departments_data = [
            ('General Medicine', 'General Physician & Primary Care'),
            ('Cardiology', 'Heart & Cardiovascular Care'),
            ('Dermatology', 'Skin, Hair & Cosmetic Dermatology'),
            ('Orthopedics', 'Bones, Joints & Musculoskeletal Care'),
            ('Gynecology', 'Women’s Health & Obstetrics'),
            ('Pediatrics', 'Child Health & Neonatal Care'),
            ('Neurology', 'Brain, Spine & Nervous System'),
            ('ENT', 'Ear, Nose & Throat Disorders'),
        ]
        dept_dict = {}
        for dept_name, specialty in departments_data:
            dept, _ = Department.objects.update_or_create(
                clinic=clinic,
                name=dept_name,
                defaults={'specialty': specialty, 'is_active': True}
            )
            dept_dict[dept_name] = dept
        self.stdout.write(f"[OK] {len(dept_dict)} Departments verified.")

        # 3. USERS SPECIFICATION
        # (full_name, phone, email, role, language, password)
        users_specs = [
            # Standard requested test accounts
            ('Test Patient', '9000000010', 'patient@test.com', User.Role.PATIENT, 'en', 'Patient@123'),
            ('Dr. Vikram Seth', '9000000011', 'doctor@test.com', User.Role.DOCTOR, 'en', 'Doctor@123'),
            ('Test Receptionist', '9000000012', 'receptionist@test.com', User.Role.RECEPTIONIST, 'en', 'Receptionist@123'),
            ('Test Admin', '9000000013', 'admin@test.com', User.Role.ADMIN, 'en', 'Admin@123'),
            
            # Primary demo accounts
            ('Aarav Sharma', '9000000001', 'aarav.patient@example.com', User.Role.PATIENT, 'en', 'Demo@123'),
            ('Priya Receptionist', '9000000002', 'reception@smartcare.example.com', User.Role.RECEPTIONIST, 'en', 'Demo@123'),
            ('Dr. Rajesh Kumar', '9000000003', 'rajesh.doctor@example.com', User.Role.DOCTOR, 'en', 'Demo@123'),
            ('Dr. Neha Verma', '9000000004', 'neha.doctor@example.com', User.Role.DOCTOR, 'hi', 'Demo@123'),
            ('Clinic Admin', '9000000005', 'admin@smartcare.example.com', User.Role.ADMIN, 'en', 'Demo@123'),
            ('Meera Singh', '9000000006', 'meera.patient@example.com', User.Role.PATIENT, 'hi', 'Demo@123'),
            ('Kabir Gupta', '9000000007', 'kabir.patient@example.com', User.Role.PATIENT, 'en', 'Demo@123'),
            ('Ananya Patel', '9000000008', 'ananya.patient@example.com', User.Role.PATIENT, 'en', 'Demo@123'),
            ('Rohan Mehta', '9000000009', 'rohan.patient@example.com', User.Role.PATIENT, 'en', 'Demo@123'),

            # Doctor user accounts for specialists
            ('Dr. Amit Sharma', '9000000014', 'amit.sharma@example.com', User.Role.DOCTOR, 'en', 'Doctor@123'),
            ('Dr. Priya Singh', '9000000015', 'priya.singh@example.com', User.Role.DOCTOR, 'en', 'Doctor@123'),
            ('Dr. Arjun Mehta', '9000000016', 'arjun.mehta@example.com', User.Role.DOCTOR, 'en', 'Doctor@123'),
            ('Dr. Sneha Kapoor', '9000000017', 'sneha.kapoor@example.com', User.Role.DOCTOR, 'en', 'Doctor@123'),
            ('Dr. Rahul Malhotra', '9000000018', 'rahul.malhotra@example.com', User.Role.DOCTOR, 'en', 'Doctor@123'),
            ('Dr. Ananya Gupta', '9000000019', 'ananya.gupta@example.com', User.Role.DOCTOR, 'en', 'Doctor@123'),
        ]

        users_dict = {}
        for name, phone, email, role, lang, pwd in users_specs:
            user = User.objects.filter(email=email).first()
            if not user and phone:
                user = User.objects.filter(phone=phone).first()

            if not user:
                user = User(
                    email=email,
                    phone=phone,
                    full_name=name,
                    role=role,
                    language=lang,
                    is_active=True,
                    is_staff=(role == User.Role.ADMIN),
                    is_superuser=(role == User.Role.ADMIN)
                )
            else:
                user.email = email
                user.phone = phone
                user.full_name = name
                user.role = role
                user.language = lang
                user.is_active = True
                if role == User.Role.ADMIN:
                    user.is_staff = True
                    user.is_superuser = True

            user.set_password(pwd)
            user.save()
            users_dict[email] = user

        self.stdout.write(f"[OK] {len(users_dict)} Users verified with proper hashed passwords.")

        # 4. PATIENTS
        patients_specs = [
            ('patient@test.com', datetime.date(1996, 4, 12), 'Male', '9000000010'),
            ('aarav.patient@example.com', datetime.date(2002, 5, 15), 'Male', '9000000001'),
            ('meera.patient@example.com', datetime.date(1998, 8, 22), 'Female', '9000000006'),
            ('kabir.patient@example.com', datetime.date(1995, 11, 10), 'Male', '9000000007'),
            ('ananya.patient@example.com', datetime.date(2001, 2, 18), 'Female', '9000000008'),
            ('rohan.patient@example.com', datetime.date(1992, 7, 3), 'Male', '9000000009'),
        ]

        patients_dict = {}
        for email, dob, gender, phone in patients_specs:
            patient, _ = Patient.objects.update_or_create(
                user=users_dict[email],
                defaults={'date_of_birth': dob, 'gender': gender, 'phone': phone}
            )
            patients_dict[email] = patient
        self.stdout.write(f"[OK] {len(patients_dict)} Patients verified.")

        # 5. DOCTORS (Realistic Dummy Doctors across Specialties)
        doctors_specs = [
            (
                'rajesh.doctor@example.com',
                'General Medicine',
                'General Medicine',
                10,
                500.00,
                [('MON', 'FRI', datetime.time(9, 0), datetime.time(13, 0)),
                 ('MON', 'FRI', datetime.time(14, 0), datetime.time(18, 0)),
                 ('SAT', 'SAT', datetime.time(9, 0), datetime.time(12, 0))]
            ),
            (
                'neha.doctor@example.com',
                'Cardiology',
                'Cardiology',
                8,
                800.00,
                [('MON', 'FRI', datetime.time(9, 0), datetime.time(13, 0)),
                 ('MON', 'FRI', datetime.time(14, 0), datetime.time(18, 0))]
            ),
            (
                'amit.sharma@example.com',
                'Orthopedics',
                'Orthopedics',
                12,
                750.00,
                [('MON', 'FRI', datetime.time(9, 0), datetime.time(13, 0)),
                 ('MON', 'FRI', datetime.time(14, 0), datetime.time(17, 30))]
            ),
            (
                'priya.singh@example.com',
                'Gynecology',
                'Gynecology',
                9,
                700.00,
                [('MON', 'FRI', datetime.time(9, 30), datetime.time(13, 30)),
                 ('MON', 'FRI', datetime.time(14, 30), datetime.time(18, 30))]
            ),
            (
                'arjun.mehta@example.com',
                'General Medicine',
                'General Medicine',
                7,
                450.00,
                [('MON', 'FRI', datetime.time(8, 30), datetime.time(12, 30)),
                 ('MON', 'FRI', datetime.time(13, 30), datetime.time(17, 30))]
            ),
            (
                'sneha.kapoor@example.com',
                'Pediatrics',
                'Pediatrics',
                11,
                600.00,
                [('MON', 'FRI', datetime.time(9, 0), datetime.time(13, 0)),
                 ('MON', 'FRI', datetime.time(15, 0), datetime.time(19, 0))]
            ),
            (
                'rahul.malhotra@example.com',
                'Neurology',
                'Neurology',
                15,
                1000.00,
                [('MON', 'FRI', datetime.time(10, 0), datetime.time(14, 0)),
                 ('MON', 'FRI', datetime.time(15, 0), datetime.time(18, 0))]
            ),
            (
                'ananya.gupta@example.com',
                'ENT',
                'ENT',
                6,
                550.00,
                [('MON', 'FRI', datetime.time(9, 0), datetime.time(13, 0)),
                 ('MON', 'FRI', datetime.time(14, 0), datetime.time(17, 0))]
            ),
            (
                'doctor@test.com',
                'General Medicine',
                'General Medicine',
                5,
                500.00,
                [('MON', 'FRI', datetime.time(9, 0), datetime.time(13, 0)),
                 ('MON', 'FRI', datetime.time(14, 0), datetime.time(18, 0))]
            ),
        ]

        days_order = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
        today = timezone.localdate()
        doc_instances = {}
        slots_to_create = []

        for email, dept_name, spec, exp, fee, sched_rules in doctors_specs:
            doctor, _ = Doctor.objects.update_or_create(
                user=users_dict[email],
                defaults={
                    'clinic': clinic,
                    'department': dept_dict[dept_name],
                    'specialization': spec,
                    'experience': exp,
                    'consultation_fee': fee,
                    'is_available': True
                }
            )
            doc_instances[email] = doctor

            # Clear and recreate availability
            DoctorAvailability.objects.filter(doctor=doctor).delete()
            avails_to_create = []
            for start_day, end_day, st_time, end_time in sched_rules:
                s_idx = days_order.index(start_day)
                e_idx = days_order.index(end_day)
                for d_i in range(s_idx, e_idx + 1):
                    day_code = days_order[d_i]
                    avails_to_create.append(
                        DoctorAvailability(
                            doctor=doctor,
                            day_of_week=day_code,
                            start_time=st_time,
                            end_time=end_time,
                            is_active=True
                        )
                    )
            DoctorAvailability.objects.bulk_create(avails_to_create)

            # Generate slots for today & next 2 days
            for day_offset in range(3):
                slot_date = today + datetime.timedelta(days=day_offset)
                day_code = days_order[slot_date.weekday()]
                matching_avails = [a for a in avails_to_create if a.day_of_week == day_code]
                for avail in matching_avails:
                    curr_time = avail.start_time
                    while curr_time < avail.end_time:
                        curr_dt = datetime.datetime.combine(slot_date, curr_time)
                        end_dt = curr_dt + datetime.timedelta(minutes=15)
                        if end_dt.time() > avail.end_time:
                            break
                        slots_to_create.append(
                            Slot(
                                doctor=doctor,
                                slot_date=slot_date,
                                start_time=curr_time,
                                end_time=end_dt.time(),
                                capacity=1,
                                status=Slot.Status.AVAILABLE
                            )
                        )
                        curr_time = end_dt.time()

        # Efficient bulk create slots ignoring duplicates
        Slot.objects.bulk_create(slots_to_create, ignore_conflicts=True)
        self.stdout.write(f"[OK] Created/Updated {len(doc_instances)} realistic doctors with weekly availability and {len(slots_to_create)} slots.")

        # 6. DEMO APPOINTMENTS & LIVE QUEUE STATE
        doc_rajesh = doc_instances['rajesh.doctor@example.com']
        slots_rajesh = list(Slot.objects.filter(doctor=doc_rajesh, slot_date=today).order_by('start_time')[:6])

        # Mark first few slots as BOOKED for queue demo
        for s in slots_rajesh[:3]:
            s.status = Slot.Status.BOOKED
            s.save()

        now = timezone.now()
        appt_specs = [
            (
                'A-24', 'meera.patient@example.com', slots_rajesh[0] if len(slots_rajesh) > 0 else None,
                Appointment.BookingType.ONLINE, Appointment.Status.CONSULTING, 0, 1, 0, 0,
                QueueEntry.Status.CONSULTING, now - datetime.timedelta(minutes=18),
                now - datetime.timedelta(minutes=8), now - datetime.timedelta(minutes=7), None
            ),
            (
                'A-25', 'kabir.patient@example.com', slots_rajesh[1] if len(slots_rajesh) > 1 else None,
                Appointment.BookingType.ONLINE, Appointment.Status.WAITING, 10, 2, 1, 10,
                QueueEntry.Status.WAITING, now - datetime.timedelta(minutes=15), None, None, None
            ),
            (
                'A-26', 'ananya.patient@example.com', slots_rajesh[2] if len(slots_rajesh) > 2 else None,
                Appointment.BookingType.WALK_IN, Appointment.Status.WAITING, 20, 3, 2, 20,
                QueueEntry.Status.WAITING, now - datetime.timedelta(minutes=12), None, None, None
            ),
            (
                'A-27', 'aarav.patient@example.com', None,
                Appointment.BookingType.ONLINE, Appointment.Status.WAITING, 30, 4, 3, 30,
                QueueEntry.Status.WAITING, now - datetime.timedelta(minutes=8), None, None, None
            ),
            (
                'A-28', 'rohan.patient@example.com', None,
                Appointment.BookingType.WALK_IN, Appointment.Status.COMPLETED, 0, 5, 0, 0,
                QueueEntry.Status.COMPLETED, now - datetime.timedelta(minutes=90),
                now - datetime.timedelta(minutes=85), now - datetime.timedelta(minutes=84),
                now - datetime.timedelta(minutes=74)
            ),
        ]

        appts_dict = {}
        for token, p_email, slot, b_type, a_stat, est_w, pos, ahead, eta, q_stat, arr, called, started, comp in appt_specs:
            appt, _ = Appointment.objects.update_or_create(
                appointment_date=today,
                doctor=doc_rajesh,
                patient=patients_dict[p_email],
                defaults={
                    'token_number': token,
                    'department': dept_dict['General Medicine'],
                    'slot': slot,
                    'booking_type': b_type,
                    'status': a_stat,
                    'estimated_wait_minutes': est_w
                }
            )
            appts_dict[token] = appt

            QueueEntry.objects.update_or_create(
                appointment=appt,
                defaults={
                    'queue_date': today,
                    'queue_position': pos,
                    'patients_ahead': ahead,
                    'eta_minutes': eta,
                    'status': q_stat,
                    'arrival_time': arr,
                    'called_at': called,
                    'consultation_started_at': started,
                    'completed_at': comp
                }
            )

        # Appointments for Dr. Neha Verma (Dermatology)
        doc_neha = doc_instances.get('neha.doctor@example.com')
        if doc_neha:
            slots_neha = list(Slot.objects.filter(doctor=doc_neha, slot_date=today).order_by('start_time')[:4])
            if slots_neha:
                slots_neha[0].status = Slot.Status.BOOKED
                slots_neha[0].save()
            neha_specs = [
                (
                    'N-10', 'aarav.patient@example.com', slots_neha[0] if slots_neha else None,
                    Appointment.BookingType.ONLINE, Appointment.Status.WAITING, 15, 6, 0, 15,
                    QueueEntry.Status.WAITING, now - datetime.timedelta(minutes=10), None, None, None
                ),
                (
                    'N-11', 'kabir.patient@example.com', slots_neha[1] if len(slots_neha) > 1 else None,
                    Appointment.BookingType.ONLINE, Appointment.Status.WAITING, 30, 7, 1, 30,
                    QueueEntry.Status.WAITING, now - datetime.timedelta(minutes=5), None, None, None
                )
            ]
            for token, p_email, slot, b_type, a_stat, est_w, pos, ahead, eta, q_stat, arr, called, started, comp in neha_specs:
                appt, _ = Appointment.objects.update_or_create(
                    appointment_date=today,
                    doctor=doc_neha,
                    patient=patients_dict[p_email],
                    defaults={
                        'token_number': token,
                        'department': dept_dict['Dermatology'],
                        'slot': slot,
                        'booking_type': b_type,
                        'status': a_stat,
                        'estimated_wait_minutes': est_w
                    }
                )
                appts_dict[token] = appt

                QueueEntry.objects.update_or_create(
                    appointment=appt,
                    defaults={
                        'queue_date': today,
                        'queue_position': pos,
                        'patients_ahead': ahead,
                        'eta_minutes': eta,
                        'status': q_stat,
                        'arrival_time': arr,
                        'called_at': called,
                        'consultation_started_at': started,
                        'completed_at': comp
                    }
                )

        # 7. CONSULTATIONS
        Consultation.objects.update_or_create(
            appointment=appts_dict['A-24'],
            defaults={
                'doctor': doc_rajesh,
                'patient': patients_dict['meera.patient@example.com'],
                'notes': 'Patient reports mild fever and headache for two days.',
                'prescription_notes': 'Paracetamol 500mg after meals if required. Adequate fluids and rest.',
                'status': Consultation.Status.STARTED,
                'started_at': now - datetime.timedelta(minutes=7),
                'completed_at': None
            }
        )

        Consultation.objects.update_or_create(
            appointment=appts_dict['A-28'],
            defaults={
                'doctor': doc_rajesh,
                'patient': patients_dict['rohan.patient@example.com'],
                'notes': 'Routine consultation completed.',
                'prescription_notes': 'Continue prescribed medication and follow-up after 7 days.',
                'status': Consultation.Status.COMPLETED,
                'started_at': now - datetime.timedelta(minutes=84),
                'completed_at': now - datetime.timedelta(minutes=74)
            }
        )

        # 8. NOTIFICATIONS
        Notification.objects.update_or_create(
            user=users_dict['aarav.patient@example.com'],
            appointment=appts_dict['A-27'],
            type='QUEUE_UPDATE',
            defaults={
                'message': 'Your token A-27 is confirmed. There are 3 patients ahead of you.',
                'is_read': False,
            }
        )
        Notification.objects.update_or_create(
            user=users_dict['aarav.patient@example.com'],
            appointment=appts_dict['A-27'],
            type='ETA_UPDATE',
            defaults={
                'message': 'Estimated waiting time is approximately 30 minutes.',
                'is_read': False,
            }
        )
        Notification.objects.update_or_create(
            user=users_dict['meera.patient@example.com'],
            appointment=appts_dict['A-24'],
            type='CONSULTATION_STARTED',
            defaults={
                'message': 'Consultation has started. Please wait for further instructions.',
                'is_read': True,
            }
        )

        # 9. ACTIVITY LOGS
        logs = [
            (users_dict['admin@smartcare.example.com'], clinic, 'DASHBOARD_VIEWED', 'CLINIC', 1),
            (users_dict['reception@smartcare.example.com'], clinic, 'QUEUE_VIEWED', 'QUEUE', 1),
            (users_dict['reception@smartcare.example.com'], clinic, 'WALK_IN_REGISTERED', 'APPOINTMENT', appts_dict['A-26'].id),
            (users_dict['rajesh.doctor@example.com'], clinic, 'CALL_NEXT_PATIENT', 'APPOINTMENT', appts_dict['A-24'].id),
            (users_dict['rajesh.doctor@example.com'], clinic, 'CONSULTATION_STARTED', 'CONSULTATION', 1),
            (users_dict['aarav.patient@example.com'], clinic, 'APPOINTMENT_BOOKED', 'APPOINTMENT', appts_dict['A-27'].id),
        ]
        for u, c, act, etype, eid in logs:
            ActivityLog.objects.create(
                user=u,
                clinic=c,
                action=act,
                entity_type=etype,
                entity_id=eid
            )

        self.stdout.write(self.style.SUCCESS("[SUCCESS] PostgreSQL database successfully seeded with all users, doctors, schedules & slots!"))
