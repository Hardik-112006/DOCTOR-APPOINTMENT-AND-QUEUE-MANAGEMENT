import os
import sys
import django
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.test import Client
from apps.accounts.models import User
from apps.patients.models import Patient
from apps.doctors.models import Doctor
from apps.appointments.models import Appointment
from apps.queue.models import QueueEntry

def run_tests():
    client = Client()
    print("==================================================")
    print("RUNNING FINAL VERIFICATION TESTS")
    print("==================================================")

    # ----------------------------------------------------
    # 1. PATIENT MULTIPLE APPOINTMENTS TEST
    # ----------------------------------------------------
    print("\n--- TEST 1: Patient Dashboard Multiple Appointments ---")
    login_resp = client.post('/api/v1/auth/login/', {
        'email_or_phone': 'aarav.patient@example.com',
        'password': 'Demo@123'
    }, content_type='application/json')
    assert login_resp.status_code == 200, f"Login failed: {login_resp.json()}"
    patient_token = login_resp.json()['data']['access']
    
    appts_resp = client.get('/api/v1/appointments/my-appointments/', HTTP_AUTHORIZATION=f'Bearer {patient_token}')
    assert appts_resp.status_code == 200, f"Failed to get appointments: {appts_resp.json()}"
    appts_data = appts_resp.json().get('data', [])
    print(f"Total appointments found for Aarav: {len(appts_data)}")
    assert len(appts_data) >= 2, f"Expected at least 2 appointments for Aarav, found {len(appts_data)}"
    
    for appt in appts_data:
        doc_name = appt.get('doctor_name')
        spec = appt.get('specialization')
        appt_date = appt.get('appointment_date')
        slot_time = appt.get('slot_time')
        status = appt.get('status')
        token = appt.get('token_number')
        fee = appt.get('consultation_fee')
        print(f"  * Appt ID {appt.get('id')}: Doctor={doc_name}, Spec={spec}, Date={appt_date}, Slot={slot_time}, Status={status}, Token={token}, Fee={fee}")
        assert doc_name, "Missing doctor_name"
        assert spec, "Missing specialization"
        assert appt_date, "Missing appointment_date"
        assert status, "Missing status"
        assert token, "Missing token_number"
        assert fee is not None, "Missing consultation_fee"
    print("[PASS] Test 1: Patient multiple appointments verified with all required fields.")

    # ----------------------------------------------------
    # 2. DOCTOR DASHBOARD PATIENT VISIBILITY & ISOLATION TEST
    # ----------------------------------------------------
    print("\n--- TEST 2: Doctor Dashboard Patient Visibility & Isolation ---")
    # Dr. Rajesh
    login_rajesh = client.post('/api/v1/auth/login/', {
        'email_or_phone': 'rajesh.doctor@example.com',
        'password': 'Demo@123'
    }, content_type='application/json')
    assert login_rajesh.status_code == 200, f"Dr. Rajesh login failed: {login_rajesh.json()}"
    rajesh_token = login_rajesh.json()['data']['access']
    
    queue_rajesh = client.get('/api/v1/queue/live/', HTTP_AUTHORIZATION=f'Bearer {rajesh_token}')
    assert queue_rajesh.status_code == 200, f"Dr. Rajesh live queue failed: {queue_rajesh.json()}"
    rajesh_entries = queue_rajesh.json().get('data', {}).get('queue', [])
    print(f"Dr. Rajesh queue entries: {len(rajesh_entries)}")
    assert len(rajesh_entries) > 0, "Dr. Rajesh has no patients in live queue"
    
    # Dr. Neha
    login_neha = client.post('/api/v1/auth/login/', {
        'email_or_phone': 'neha.doctor@example.com',
        'password': 'Demo@123'
    }, content_type='application/json')
    assert login_neha.status_code == 200, f"Dr. Neha login failed: {login_neha.json()}"
    neha_token = login_neha.json()['data']['access']
    
    queue_neha = client.get('/api/v1/queue/live/', HTTP_AUTHORIZATION=f'Bearer {neha_token}')
    assert queue_neha.status_code == 200, f"Dr. Neha live queue failed: {queue_neha.json()}"
    neha_entries = queue_neha.json().get('data', {}).get('queue', [])
    print(f"Dr. Neha queue entries: {len(neha_entries)}")
    assert len(neha_entries) > 0, "Dr. Neha has no patients in live queue"
    
    # Verify isolation
    rajesh_tokens = {q.get('token_number') for q in rajesh_entries}
    neha_tokens = {q.get('token_number') for q in neha_entries}
    print(f"Dr. Rajesh tokens: {rajesh_tokens}")
    print(f"Dr. Neha tokens: {neha_tokens}")
    assert not (rajesh_tokens & neha_tokens), f"Overlap in tokens between doctors! {rajesh_tokens & neha_tokens}"
    print("[PASS] Test 2: Doctor queue isolation and patient visibility verified.")

    # ----------------------------------------------------
    # 3. REGISTRATION VALIDATION & ERROR MESSAGES TEST
    # ----------------------------------------------------
    print("\n--- TEST 3: Registration Validation & Field Errors ---")
    # Duplicate email & phone
    dup_resp = client.post('/api/v1/auth/register/', {
        'full_name': 'Test User',
        'email': 'aarav.patient@example.com',
        'phone': '9000000001',
        'password': 'Password123'
    }, content_type='application/json')
    assert dup_resp.status_code == 400, f"Expected 400, got {dup_resp.status_code}: {dup_resp.json()}"
    dup_json = dup_resp.json()
    err_obj = dup_json.get('error', {})
    fields = err_obj.get('fields', {})
    print(f"Validation error response: {dup_json}")
    assert 'email' in fields or 'phone' in fields, f"Expected field-specific errors in {fields}"

    # Successful registration with optional fields
    import uuid
    rand_phone = f"99{uuid.uuid4().int % 100000000:08d}"
    rand_email = f"patient_{uuid.uuid4().hex[:6]}@example.com"
    success_resp = client.post('/api/v1/auth/register/', {
        'full_name': 'Ravi Shankar',
        'email': rand_email,
        'phone': rand_phone,
        'password': 'Password@123',
        'gender': 'Male',
        'age': 32,
        'blood_group': 'O+'
    }, content_type='application/json')
    assert success_resp.status_code == 201, f"Registration failed: {success_resp.json()}"
    new_user_data = success_resp.json().get('data', {})
    print(f"Successfully registered new user: {new_user_data.get('email')}")
    assert User.objects.filter(email=rand_email).exists(), "New user not found in DB"
    assert Patient.objects.filter(user__email=rand_email).exists(), "New patient record not found in DB"
    print("[PASS] Test 3: Registration field-level validation and optional field support verified.")

    # ----------------------------------------------------
    # 4. HINDI TRANSLATION VERIFICATION
    # ----------------------------------------------------
    print("\n--- TEST 4: Hindi Language Support & Translations ---")
    with open('static/js/i18n.js', 'r', encoding='utf-8') as f:
        i18n_content = f.read()
    assert 'TRANSLATIONS = {' in i18n_content or 'translations = {' in i18n_content, "Missing translations dictionary in i18n.js"
    assert 'अपॉइंटमेंट बुक करें' in i18n_content, "Missing Hindi bookAppointment translation"
    assert 'मेरी अपॉइंटमेंट' in i18n_content, "Missing Hindi myAppointments translation"
    assert 'उपलब्ध डॉक्टर' in i18n_content, "Missing Hindi availableDoctors translation"
    assert 'लॉग आउट' in i18n_content, "Missing Hindi logout translation"
    print("Core translations in i18n.js verified.")

    # Check key templates have data-i18n
    templates_to_check = [
        'templates/base.html',
        'templates/login.html',
        'templates/bookappointment.html',
        'templates/livequeuetracking.html',
        'templates/doctorqueueandconsultation.html',
        'templates/receptionistcontrol.html',
        'templates/clinic-adminoverview.html'
    ]
    for tpath in templates_to_check:
        with open(tpath, 'r', encoding='utf-8') as f:
            content = f.read()
        assert 'data-i18n' in content, f"Missing data-i18n tags in {tpath}"
        print(f"  * {tpath}: data-i18n tags verified.")

    print("[PASS] Test 4: Complete Hindi language support verified across dictionaries and templates.")

    print("\n==================================================")
    print("ALL 4 VERIFICATION SUITES PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == '__main__':
    run_tests()
