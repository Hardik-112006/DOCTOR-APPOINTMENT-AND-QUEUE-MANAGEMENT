import requests

BASE = 'http://127.0.0.1:8000'

# 1. Test Book Appointment Page HTML has correct script and IDs
r_page = requests.get(f'{BASE}/book/')
html = r_page.text
assert 'id="department-tabs"' in html, 'Missing department-tabs element'
assert 'id="doctors-list"' in html, 'Missing doctors-list element'
assert 'id="slots-grid"' in html, 'Missing slots-grid element'
assert 'id="summary-doctor"' in html, 'Missing summary-doctor element'
assert 'id="summary-slot"' in html, 'Missing summary-slot element'
assert 'id="summary-fee"' in html, 'Missing summary-fee element'
assert 'booking.js' in html, 'Missing booking.js script tag'
assert 'api.js' in html, 'Missing api.js script tag'
print('HTML Template & DOM Elements: VERIFIED')

# 2. Test Departments API
r_dept = requests.get(f'{BASE}/api/v1/departments/')
depts = r_dept.json().get('data', [])
print(f'Departments API: {len(depts)} departments returned')
assert len(depts) >= 3, 'Expected at least 3 departments'

# 3. Test Doctors API (All and by department)
r_docs_all = requests.get(f'{BASE}/api/v1/doctors/')
docs_all = r_docs_all.json().get('data', [])
print(f'Doctors API (All): {len(docs_all)} doctors returned')
assert len(docs_all) >= 2, f'Expected at least 2 doctors, got {len(docs_all)}'

for d in docs_all:
    print(f"  - Doctor #{d['id']}: {d.get('full_name', d.get('name'))}, Dept: {d.get('department_name')} (ID: {d.get('department_id')}), Fee: INR {d.get('consultation_fee')}, Available: {d.get('is_available')}")

# 4. Test Doctor Slots API
for d in docs_all[:3]:
    doc_id = d['id']
    r_slots = requests.get(f'{BASE}/api/v1/doctors/{doc_id}/slots/')
    s_data = r_slots.json().get('data', {})
    slots = s_data.get('slots', [])
    print(f"Doctor #{doc_id} Slots API: {len(slots)} slots returned for {s_data.get('date')}")
    assert len(slots) > 0, f'Expected slots for doctor #{doc_id}'

# 5. Test Doctor Availability API
for d in docs_all[:3]:
    doc_id = d['id']
    r_avail = requests.get(f'{BASE}/api/v1/doctors/{doc_id}/availability/')
    a_data = r_avail.json().get('data', {})
    print(f"Doctor #{doc_id} Availability API: today_available={a_data.get('today_available')}, schedule={a_data.get('today_schedule')}")
    assert a_data.get('today_available') is True, f'Expected doctor #{doc_id} to be available today'

print('ALL FRONTEND API CONTRACTS & RESPONSES: PASS')
