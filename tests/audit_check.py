import requests
import json

BASE = 'http://127.0.0.1:8000'
results = []

def record(name, passed, details=''):
    results.append({'name': name, 'passed': passed, 'details': details})
    tag = "PASS" if passed else "FAIL"
    print(f"[{tag}] {name}: {details}")

# 1. Test unauthenticated 401
r_unauth = requests.get(f'{BASE}/api/v1/queue/live/')
record('Auth - 401 Unauthenticated Protection', r_unauth.status_code == 401, f'Status {r_unauth.status_code}')

# 2. Test Patient Login
r_pat_login = requests.post(f'{BASE}/api/v1/auth/login/', json={'username_or_email': '9000000001', 'password': 'Demo@123'})
pat_ok = r_pat_login.status_code == 200 and 'access' in r_pat_login.json().get('data', {})
pat_token = r_pat_login.json()['data']['access'] if pat_ok else None
record('Auth - Patient Login', pat_ok, f'Status {r_pat_login.status_code}')

# Check for leaked password_hash
user_obj = r_pat_login.json().get('data', {}).get('user', {})
has_pw_hash = 'password_hash' in user_obj or 'password' in user_obj
record('Security - No Password Hash Leak in Auth API', not has_pw_hash, f'Keys: {list(user_obj.keys())}')

# 3. Test Invalid Credentials
r_bad_login = requests.post(f'{BASE}/api/v1/auth/login/', json={'username_or_email': '9000000001', 'password': 'WrongPassword!'})
record('Auth - Invalid Login 400/401 with standard error', r_bad_login.status_code in [400, 401] and 'error' in r_bad_login.json(), f'Status {r_bad_login.status_code}')

# 4. Test Receptionist Login
r_rec_login = requests.post(f'{BASE}/api/v1/auth/login/', json={'username_or_email': '9000000002', 'password': 'Demo@123'})
rec_ok = r_rec_login.status_code == 200
rec_token = r_rec_login.json()['data']['access'] if rec_ok else None
record('Auth - Receptionist Login', rec_ok, f'Status {r_rec_login.status_code}')

# 5. Test Doctor Login
r_doc_login = requests.post(f'{BASE}/api/v1/auth/login/', json={'username_or_email': '9000000003', 'password': 'Demo@123'})
doc_ok = r_doc_login.status_code == 200
doc_token = r_doc_login.json()['data']['access'] if doc_ok else None
record('Auth - Doctor Login', doc_ok, f'Status {r_doc_login.status_code}')

# 6. Test Admin Login
r_adm_login = requests.post(f'{BASE}/api/v1/auth/login/', json={'username_or_email': '9000000005', 'password': 'Demo@123'})
adm_ok = r_adm_login.status_code == 200
adm_token = r_adm_login.json()['data']['access'] if adm_ok else None
record('Auth - Admin Login', adm_ok, f'Status {r_adm_login.status_code}')

# 7. Test Departments & Doctors APIs
r_depts = requests.get(f'{BASE}/api/v1/departments/')
depts_data = r_depts.json().get('data', [])
record('API - Departments List', r_depts.status_code == 200 and len(depts_data) >= 3, f'{len(depts_data)} depts')
dept_id = depts_data[0]['id'] if depts_data else 1

r_docs = requests.get(f'{BASE}/api/v1/doctors/')
docs_data = r_docs.json().get('data', [])
record('API - Doctors List', r_docs.status_code == 200 and len(docs_data) >= 2, f'{len(docs_data)} docs')
first_doc_id = docs_data[0]['id'] if docs_data else 1

# 8. Test Role RBAC 403 (Patient trying to perform receptionist walk-in)
r_forbid = requests.post(
    f'{BASE}/api/v1/queue/walk-in/',
    headers={'Authorization': f'Bearer {pat_token}'},
    json={'doctor_id': first_doc_id, 'department_id': dept_id, 'patient_name': 'Test', 'patient_phone': '9876543210'}
)
record('RBAC - 403 Forbidden on Unauthorized Role', r_forbid.status_code == 403, f'Status {r_forbid.status_code}')

r_slots = requests.get(f'{BASE}/api/v1/doctors/{first_doc_id}/slots/')
slots_data = r_slots.json().get('data', {}).get('slots', [])
record('API - Doctor Slots', r_slots.status_code == 200 and len(slots_data) > 0, f'{len(slots_data)} slots')

# 9. Test Live Queue and Patient Status API
r_live = requests.get(f'{BASE}/api/v1/queue/live/', headers={'Authorization': f'Bearer {rec_token}'})
queue_entries = r_live.json().get('data', {}).get('queue', [])
total_q = r_live.json().get('data', {}).get('total', 0)
record('API - Live Queue List', r_live.status_code == 200 and total_q >= 1, f'{total_q} in queue')

r_stat = requests.get(f'{BASE}/api/v1/queue/patient-status/', headers={'Authorization': f'Bearer {pat_token}'})
stat_data = r_stat.json().get('data', {})
record('API - Patient Queue Status', r_stat.status_code == 200 and bool(stat_data.get('token_number')), f"Token: {stat_data.get('token_number')}, Pos: {stat_data.get('queue_position')}, Ahead: {stat_data.get('patients_ahead')}, ETA: {stat_data.get('eta_minutes')}m")

# 10. Test Consultation Save
appt_id = queue_entries[0].get('appointment_id', 1) if queue_entries else 1
r_consult = requests.post(f'{BASE}/api/v1/consultations/save/', headers={'Authorization': f'Bearer {doc_token}'}, json={'appointment_id': appt_id, 'notes': 'Test notes', 'prescription_notes': 'Test RX', 'complete': False})
record('API - Doctor Save Consultation Notes', r_consult.status_code in [200, 201], f'Status {r_consult.status_code}')

# 11. Test Admin Dashboard Metrics & Activity Logs
r_metrics = requests.get(f'{BASE}/api/v1/dashboard/metrics/', headers={'Authorization': f'Bearer {adm_token}'})
metrics_data = r_metrics.json().get('data', {})
record('API - Admin Metrics', r_metrics.status_code == 200 and metrics_data.get('total_appointments', 0) >= 1, f"Total: {metrics_data.get('total_appointments')}")

r_logs = requests.get(f'{BASE}/api/v1/dashboard/activity-logs/', headers={'Authorization': f'Bearer {adm_token}'})
logs_data = r_logs.json().get('data', [])
record('API - Activity Logs Feed', r_logs.status_code == 200 and len(logs_data) >= 1, f'{len(logs_data)} logs')

# 12. Test HTML Page Responses
pages = [
    ('/', 200),
    ('/login/', 200),
    ('/book/', 200),
    ('/track/', 200),
    ('/reception/', 200),
    ('/doctor/', 200),
    ('/dashboard/', 200),
]
for p, exp in pages:
    r = requests.get(f'{BASE}{p}')
    record(f'HTML - Page {p}', r.status_code == exp, f'Status {r.status_code}')

total_tests = len(results)
passed_tests = sum(1 for r in results if r['passed'])
print(f"\nAUDIT SUMMARY: {passed_tests}/{total_tests} Tests Passed")
