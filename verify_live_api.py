import urllib.request
import urllib.error
import json

BASE = 'http://127.0.0.1:8000/api/v1'

def post_json(url, data):
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode('utf-8'))

def get_json(url, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    req = urllib.request.Request(url, headers=headers, method='GET')
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode('utf-8'))

print('=== 1. TESTING DOCTORS LIST ===')
status_code, data = get_json(f'{BASE}/doctors/')
print('GET /doctors/ status:', status_code)
doctors = data.get('data', [])
print(f'Total doctors returned: {len(doctors)}')
for d in doctors:
    name = d.get('full_name') or d.get('doctor_name')
    dept = d.get('department_name')
    fee = d.get('consultation_fee')
    print(f"  - ID: {d['id']}, Name: {name}, Dept: {dept}, Fee: {fee}")

print('\n=== 2. TESTING AUTH LOGIN FOR ALL ROLES ===')
test_accounts = [
    ('Patient', 'patient@test.com', 'Patient@123', 'PATIENT'),
    ('Doctor', 'doctor@test.com', 'Doctor@123', 'DOCTOR'),
    ('Receptionist', 'receptionist@test.com', 'Receptionist@123', 'RECEPTIONIST'),
    ('Admin', 'admin@test.com', 'Admin@123', 'ADMIN'),
    ('Demo Patient (Phone)', '9000000001', 'Demo@123', 'PATIENT'),
    ('Demo Doctor (Phone)', '9000000003', 'Demo@123', 'DOCTOR'),
]

tokens = {}
for role_name, identifier, pwd, expected_role in test_accounts:
    st, resp = post_json(f'{BASE}/auth/login/', {'username_or_email': identifier, 'password': pwd})
    if st == 200 and resp.get('data', {}).get('user', {}).get('role') == expected_role:
        print(f"  [PASS] {role_name} ({identifier}) -> 200 OK, Role: {expected_role}")
        tokens[expected_role] = resp['data']['access']
    else:
        print(f"  [FAIL] {role_name} ({identifier}) -> Status: {st}, Resp: {resp}")

print('\n=== 3. TESTING DOCTOR AVAILABILITY & SLOTS APIS ===')
for d in doctors:
    doc_id = d['id']
    name = d.get('full_name') or d.get('doctor_name')
    st_avail, resp_avail = get_json(f'{BASE}/doctors/{doc_id}/availability/')
    st_slots, resp_slots = get_json(f'{BASE}/doctors/{doc_id}/slots/')
    num_avails = len(resp_avail.get('data', {}).get('availabilities', []))
    num_slots = len(resp_slots.get('data', {}).get('slots', []))
    print(f"  Doctor ID {doc_id} ({name}): Availability HTTP {st_avail} ({num_avails} schedules), Slots HTTP {st_slots} ({num_slots} slots)")

print('\n=== 4. TESTING PROTECTED ENDPOINTS ===')
st_me, resp_me = get_json(f'{BASE}/auth/me/', token=tokens.get('PATIENT'))
print('GET /auth/me/ (with Patient Token):', st_me, 'User:', resp_me.get('data', {}).get('full_name'))

st_metrics, resp_metrics = get_json(f'{BASE}/dashboard/metrics/', token=tokens.get('ADMIN'))
print('GET /dashboard/metrics/ (with Admin Token):', st_metrics, 'Active Queue Total:', resp_metrics.get('data', {}).get('total_appointments'))
