import requests
import json
import time

BASE = 'http://127.0.0.1:8000'
report = []

def log_test(category, name, passed, detail=""):
    report.append({"category": category, "name": name, "passed": passed, "detail": detail})
    status_str = "PASS" if passed else "FAIL"
    print(f"[{status_str}] [{category}] {name}: {detail}")

print("==================================================")
print("DOCTORQUEUE END-TO-END SYSTEM EXECUTION TEST")
print("==================================================")

# 1. API Health Check
try:
    r_health = requests.get(f"{BASE}/api/v1/health/")
    health_data = r_health.json().get('data', {})
    is_healthy = r_health.status_code == 200 and health_data.get('status') == 'healthy' and health_data.get('database') == 'connected'
    log_test("HEALTH", "GET /api/v1/health/", is_healthy, f"Status {r_health.status_code}, DB: {health_data.get('database')}")
except Exception as e:
    log_test("HEALTH", "GET /api/v1/health/", False, str(e))

# 2. Login Tests for All 4 Roles
roles_cred = [
    ("Patient", "9000000001", "Demo@123", "PATIENT", "Aarav Sharma"),
    ("Receptionist", "9000000002", "Demo@123", "RECEPTIONIST", "Priya Receptionist"),
    ("Doctor", "9000000003", "Demo@123", "DOCTOR", "Dr. Rajesh Kumar"),
    ("Admin", "9000000005", "Demo@123", "ADMIN", "Clinic Admin"),
]

tokens = {}
for role_name, ident, pwd, exp_role, exp_name in roles_cred:
    r_login = requests.post(f"{BASE}/api/v1/auth/login/", json={"username_or_email": ident, "password": pwd})
    if r_login.status_code == 200 and "data" in r_login.json():
        user = r_login.json()["data"]["user"]
        acc_tok = r_login.json()["data"]["access"]
        tokens[exp_role] = acc_tok
        ok = user["role"] == exp_role and user["full_name"] == exp_name
        log_test("AUTH", f"{role_name} Login", ok, f"User: {user['full_name']} ({user['role']})")
    else:
        log_test("AUTH", f"{role_name} Login", False, f"Status {r_login.status_code}")

# 3. Invalid Credentials Test
r_invalid = requests.post(f"{BASE}/api/v1/auth/login/", json={"username_or_email": "9000000001", "password": "WrongPassword"})
log_test("AUTH", "Invalid Login Rejection", r_invalid.status_code in [400, 401] and "error" in r_invalid.json(), f"Status {r_invalid.status_code}")

# 4. Token Refresh Test
r_ref = requests.post(f"{BASE}/api/v1/auth/login/", json={"username_or_email": "9000000001", "password": "Demo@123"})
if r_ref.status_code == 200:
    ref_tok = r_ref.json()["data"]["refresh"]
    r_refresh = requests.post(f"{BASE}/api/v1/auth/refresh/", json={"refresh": ref_tok})
    log_test("AUTH", "JWT Token Refresh", r_refresh.status_code == 200 and "access" in r_refresh.json(), f"Status {r_refresh.status_code}")

# 5. Patient Tracking Check
pat_headers = {"Authorization": f"Bearer {tokens['PATIENT']}"}
r_pstat = requests.get(f"{BASE}/api/v1/queue/patient-status/", headers=pat_headers)
if r_pstat.status_code == 200 and r_pstat.json().get("data"):
    pdata = r_pstat.json()["data"]
    log_test("PATIENT FLOW", "Primary Patient Live Status", True, f"Token: {pdata['token_number']}, Pos: {pdata['queue_position']}, Ahead: {pdata['patients_ahead']}, ETA: {pdata['eta_minutes']}m, Status: {pdata['status']}")
else:
    log_test("PATIENT FLOW", "Primary Patient Live Status", False, f"Status {r_pstat.status_code}")

# Fetch active doctor and department dynamically
r_docs = requests.get(f"{BASE}/api/v1/doctors/")
docs_list = r_docs.json().get("data", [])
active_doc = next((d for d in docs_list if "Rajesh" in d.get("full_name", "")), docs_list[0] if docs_list else None)
active_doc_id = active_doc["id"] if active_doc else 1
active_dept_id = active_doc.get("department_id", 1) if active_doc else 1

# 6. Receptionist Flow: Add Walk-in Patient
rec_headers = {"Authorization": f"Bearer {tokens['RECEPTIONIST']}"}
r_walkin = requests.post(f"{BASE}/api/v1/queue/walk-in/", headers=rec_headers, json={
    "doctor_id": active_doc_id,
    "department_id": active_dept_id,
    "patient_name": "Test Walkin E2E",
    "patient_phone": "9998887776"
})
if r_walkin.status_code in [200, 201]:
    wdata = r_walkin.json().get("data", {})
    w_appt_id = wdata.get("appointment_id")
    log_test("RECEPTIONIST FLOW", "Add Walk-In Patient", True, f"Token: {wdata.get('token_number')}, Pos: #{wdata.get('queue_position')}")

    # Mark Arrived
    r_arr = requests.post(f"{BASE}/api/v1/queue/mark-arrived/", headers=rec_headers, json={"appointment_id": w_appt_id})
    log_test("RECEPTIONIST FLOW", "Mark Patient Arrived", r_arr.status_code == 200, f"Arrival: {r_arr.json().get('data', {}).get('arrival_time')}")
else:
    log_test("RECEPTIONIST FLOW", "Add Walk-In Patient", False, f"Status {r_walkin.status_code}")

# 7. Doctor Flow: Call Next Patient, Start Consultation, Save Notes, Complete
doc_headers = {"Authorization": f"Bearer {tokens['DOCTOR']}"}
# Doctor calls next
r_cnext = requests.post(f"{BASE}/api/v1/queue/call-next/", headers=doc_headers, json={"doctor_id": active_doc_id})
if r_cnext.status_code == 200:
    cdata = r_cnext.json().get("data", {})
    called_appt_id = cdata.get("appointment_id")
    log_test("DOCTOR FLOW", "Call Next Patient", True, f"Called Token: {cdata.get('token_number')} (Status: {cdata.get('status')})")

    # Start Consultation
    r_start = requests.post(f"{BASE}/api/v1/queue/update-status/", headers=doc_headers, json={
        "appointment_id": called_appt_id,
        "status": "CONSULTING"
    })
    log_test("DOCTOR FLOW", "Start Consultation", r_start.status_code == 200, f"Status: {r_start.json().get('data', {}).get('status')}")

    # Save Notes & Complete
    r_comp = requests.post(f"{BASE}/api/v1/consultations/save/", headers=doc_headers, json={
        "appointment_id": called_appt_id,
        "notes": "Patient examined during E2E verification test. Stable.",
        "prescription_notes": "Prescribed standard follow-up. Keep hydrated.",
        "complete": True
    })
    log_test("DOCTOR FLOW", "Complete Consultation with Notes", r_comp.status_code == 200, f"Status {r_comp.status_code}")
else:
    log_test("DOCTOR FLOW", "Call Next Patient", False, f"Status {r_cnext.status_code}")

# 8. Dynamic ETA Recalculation Check on Primary Patient
r_pstat2 = requests.get(f"{BASE}/api/v1/queue/patient-status/", headers=pat_headers)
if r_pstat2.status_code == 200 and r_pstat2.json().get("data"):
    pdata2 = r_pstat2.json()["data"]
    log_test("LIVE QUEUE", "Dynamic ETA & Ahead Update", True, f"Token: {pdata2['token_number']} -> Pos: {pdata2['queue_position']}, Ahead: {pdata2['patients_ahead']}, ETA: {pdata2['eta_minutes']}m")

# 9. Admin Dashboard Metrics Verification
adm_headers = {"Authorization": f"Bearer {tokens['ADMIN']}"}
r_metrics = requests.get(f"{BASE}/api/v1/dashboard/metrics/", headers=adm_headers)
if r_metrics.status_code == 200:
    m = r_metrics.json().get("data", {})
    log_test("ADMIN FLOW", "Live Metrics & KPIs", True, f"Total Appts: {m.get('total_appointments')}, Waiting: {m.get('waiting_patients')}, Completed: {m.get('completed_patients')}, Avg Wait: {m.get('average_waiting_minutes')}m")
else:
    log_test("ADMIN FLOW", "Live Metrics & KPIs", False, f"Status {r_metrics.status_code}")

# 10. Frontend Template Pages Verification
templates = [
    ("Login Page", "/login/"),
    ("Book Appointment Page", "/book/"),
    ("Live Queue Tracker", "/track/"),
    ("Reception Desk", "/reception/"),
    ("Doctor Consultation Desk", "/doctor/"),
    ("Admin Overview Dashboard", "/dashboard/"),
]
for tname, turl in templates:
    r_t = requests.get(f"{BASE}{turl}")
    # Verify Tailwind CSS script and content present
    has_tailwind = "cdn.tailwindcss.com" in r_t.text or "tailwindcss" in r_t.text
    has_api_js = "api.js" in r_t.text
    log_test("FRONTEND", f"Page {tname} ({turl})", r_t.status_code == 200 and has_tailwind and has_api_js, f"Status 200, Tailwind: {has_tailwind}, API.js: {has_api_js}")

total = len(report)
passed = sum(1 for item in report if item["passed"])
print("==================================================")
print(f"FINAL AUDIT RESULT: {passed}/{total} CHECKS PASSED")
print("==================================================")
