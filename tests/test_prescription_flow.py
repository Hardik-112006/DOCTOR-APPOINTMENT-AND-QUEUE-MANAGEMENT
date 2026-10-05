import requests
import sys

BASE = 'http://127.0.0.1:8000/api/v1'

def run():
    print("=" * 60)
    print("TESTING PRESCRIPTION WORKFLOW & PATIENT SECURITY")
    print("=" * 60)

    # 1. Patient Login
    print("\n--- 1. Authenticating Patient & Doctor ---")
    import time
    ts = int(time.time())
    patient_phone = f"9{ts % 1000000000:09d}"
    r_patient = requests.post(f'{BASE}/auth/register/', json={
        'full_name': 'Test Rx Patient',
        'phone': patient_phone,
        'email': f'rx_patient_{ts}@example.com',
        'password': 'Demo@123',
        'role': 'PATIENT'
    })
    assert r_patient.status_code == 201, f"Patient registration failed: {r_patient.text}"
    patient_token = r_patient.json()['data']['access']
    patient_user = r_patient.json()['data']['user']
    print(f"  [PASS] Isolated Patient created: {patient_user['full_name']} (ID: {patient_user['id']})")

    # Patient 2 Login for security check
    r_patient2 = requests.post(f'{BASE}/auth/login/', json={'identifier': '9111111111', 'password': 'Demo@123'})
    if r_patient2.status_code != 200:
        import time
        uniq_phone = f"9{int(time.time())%1000000000:09d}"
        r_patient2 = requests.post(f'{BASE}/auth/register/', json={
            'full_name': 'Other Patient',
            'phone': uniq_phone,
            'email': f'other_{int(time.time())}@example.com',
            'password': 'Demo@123',
            'role': 'PATIENT'
        })
    assert r_patient2.status_code in (200, 201), f"Patient 2 auth failed: {r_patient2.text}"
    patient2_token = r_patient2.json()['data']['access']
    print("  [PASS] Patient 2 authenticated for security tests")

    # Doctor Login (Dr. Rajesh Kumar)
    r_doc = requests.post(f'{BASE}/auth/login/', json={'identifier': '9000000003', 'password': 'Demo@123'})
    assert r_doc.status_code == 200, f"Doctor login failed: {r_doc.text}"
    doc_token = r_doc.json()['data']['access']
    print(f"  [PASS] Doctor logged in: Dr. Rajesh Kumar")

    # 2. Patient books appointment
    print("\n--- 2. Booking Appointment ---")
    r_docs = requests.get(f'{BASE}/doctors/')
    assert r_docs.status_code == 200, f"Get doctors failed: {r_docs.text}"
    doctor_list = r_docs.json()['data']
    doc = next((d for d in doctor_list if 'Rajesh' in d['name']), doctor_list[0])
    doc_id = doc['id']
    print(f"  [INFO] Selected doctor ID: {doc_id} ({doc['name']})")

    import datetime
    today = datetime.date.today().isoformat()
    r_book = requests.post(
        f'{BASE}/appointments/book/',
        headers={'Authorization': f'Bearer {patient_token}'},
        json={'doctor_id': doc_id, 'appointment_date': today, 'booking_type': 'ONLINE'}
    )
    assert r_book.status_code == 201, f"Booking failed: {r_book.text}"
    appt = r_book.json()['data']
    appt_id = appt['id']
    token_num = appt['token_number']
    print(f"  [PASS] Booked appointment #{appt_id} with token: {token_num}")

    # 3. Doctor starts consultation
    print("\n--- 3. Doctor Consultation & Prescription Recording ---")
    r_start = requests.post(
        f'{BASE}/queue/update-status/',
        headers={'Authorization': f'Bearer {doc_token}'},
        json={'appointment_id': appt_id, 'status': 'CONSULTING'}
    )
    assert r_start.status_code == 200, f"Start consultation failed: {r_start.text}"
    print(f"  [PASS] Status updated to CONSULTING for #{appt_id}")

    # 4. Doctor saves prescription and completes consultation
    test_notes = "Patient presented with mild seasonal fever and throat irritation."
    test_rx = "1. Tab Paracetamol 650mg TDS x 3 days\n2. Tab Cetirizine 10mg OD at night x 5 days\n3. Warm saline gargles twice daily"

    r_complete = requests.post(
        f'{BASE}/consultations/save/',
        headers={'Authorization': f'Bearer {doc_token}'},
        json={
            'appointment_id': appt_id,
            'notes': test_notes,
            'prescription_notes': test_rx,
            'complete': True
        }
    )
    assert r_complete.status_code == 200, f"Complete consultation failed: {r_complete.text}"
    print(f"  [PASS] Doctor completed consultation with real prescription notes.")

    # 5. Patient fetches /appointments/my-appointments/
    print("\n--- 4. Verifying Patient Appointment Data & Prescription Presence ---")
    r_my_appts = requests.get(
        f'{BASE}/appointments/my-appointments/',
        headers={'Authorization': f'Bearer {patient_token}'}
    )
    assert r_my_appts.status_code == 200, f"My appointments failed: {r_my_appts.text}"
    my_appts = r_my_appts.json()['data']
    target_appt = next((a for a in my_appts if a['id'] == appt_id), None)
    assert target_appt is not None, f"Appointment #{appt_id} not found in my appointments"
    assert target_appt['status'] == 'COMPLETED', f"Status not COMPLETED: {target_appt['status']}"
    assert target_appt['prescription_notes'] == test_rx, f"Prescription notes mismatch: {target_appt.get('prescription_notes')}"
    print(f"  [PASS] Appointment #{appt_id} correctly marked COMPLETED with prescription_notes attached.")

    # 6. Patient fetches detailed prescription endpoint
    print("\n--- 5. Testing Patient Access to /consultations/appointment/<id>/ ---")
    r_rx_detail = requests.get(
        f'{BASE}/consultations/appointment/{appt_id}/',
        headers={'Authorization': f'Bearer {patient_token}'}
    )
    assert r_rx_detail.status_code == 200, f"Consultation detail failed: {r_rx_detail.text}"
    rx_data = r_rx_detail.json()['data']
    assert rx_data['prescription_notes'] == test_rx, "Prescription text mismatch"
    assert rx_data['notes'] == test_notes, "Clinical notes mismatch"
    assert rx_data['token_number'] == token_num, "Token mismatch"
    print(f"  [PASS] Patient successfully accessed their own prescription details.")
    print(f"    * Patient: {rx_data['patient_name']}")
    print(f"    * Doctor: {rx_data['doctor_name']} ({rx_data.get('specialization')})")
    print(f"    * Prescription: {rx_data['prescription_notes'][:40]}...")

    # 7. Security: Another patient attempts to access this prescription
    print("\n--- 6. Security Check: Cross-Patient Unauthorized Access Prevention ---")
    r_forbidden = requests.get(
        f'{BASE}/consultations/appointment/{appt_id}/',
        headers={'Authorization': f'Bearer {patient2_token}'}
    )
    assert r_forbidden.status_code == 403, f"Expected 403 Forbidden for unauthorized patient, got {r_forbidden.status_code}"
    print(f"  [PASS] Unauthorized patient correctly received HTTP 403 Forbidden.")

    print("\n" + "=" * 60)
    print("ALL PRESCRIPTION & SECURITY TESTS PASSED 100%!")
    print("=" * 60)

if __name__ == '__main__':
    run()
