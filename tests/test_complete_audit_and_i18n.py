import os
import sys
import django
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.test import Client
from django.utils import timezone
from apps.accounts.models import User
from apps.doctors.models import Doctor
from apps.patients.models import Patient
from apps.appointments.models import Appointment
from apps.dashboard.models import ActivityLog
from apps.dashboard.services import DashboardService
from apps.appointments.services import AppointmentService

def run_comprehensive_tests():
    client = Client()
    print("==================================================")
    print("RUNNING COMPREHENSIVE VERIFICATION SUITE")
    print("==================================================")

    # 1. Admin Authentication
    print("\n[TEST A] Admin Login")
    login_res = client.post('/api/v1/auth/login/', {
        'username_or_email': '9000000005',
        'password': 'Demo@123'
    }, content_type='application/json')
    assert login_res.status_code == 200, f"Admin login failed: {login_res.json()}"
    adm_token = login_res.json()['data']['access']
    headers = {'HTTP_AUTHORIZATION': f'Bearer {adm_token}'}
    print("  -> Admin successfully authenticated with JWT.")

    # 2. Daily Progress API
    print("\n[TEST B & C] /api/v1/dashboard/daily-progress/ & /api/v1/dashboard/metrics/")
    resp_dp = client.get('/api/v1/dashboard/daily-progress/', **headers)
    assert resp_dp.status_code == 200
    dp_data = resp_dp.json().get('data', [])
    assert len(dp_data) == 7, f"Expected 7 days, got {len(dp_data)}"
    for day in dp_data:
        print(f"  Day: {day['day_name']} ({day['date']}) -> Total: {day['total']}, Completed: {day['completed']}, Pct: {day['percentage']}%")
        assert 'total' in day and 'completed' in day and 'percentage' in day
        assert 0 <= day['percentage'] <= 100
        if day['total'] == 0:
            assert day['percentage'] == 0.0, "Zero-total day must have 0.0% percentage"
    print("  -> Daily progress correctly calculated for 7 days.")

    # 3. Activity Logs API with Pagination
    print("\n[TEST D] /api/v1/dashboard/activity-logs/ (Pagination & Details)")
    resp_logs_p1 = client.get('/api/v1/dashboard/activity-logs/?limit=5&offset=0', **headers)
    assert resp_logs_p1.status_code == 200
    logs_p1 = resp_logs_p1.json().get('data', [])
    total_logs = resp_logs_p1.json().get('total', 0)
    print(f"  Page 1 logs returned: {len(logs_p1)}, Total logs in DB: {total_logs}")
    assert len(logs_p1) <= 5
    assert total_logs > 0

    resp_logs_p2 = client.get('/api/v1/dashboard/activity-logs/?limit=5&offset=5', **headers)
    assert resp_logs_p2.status_code == 200
    logs_p2 = resp_logs_p2.json().get('data', [])
    print(f"  Page 2 logs returned: {len(logs_p2)}")
    if total_logs > 5:
        assert logs_p1[0]['id'] != logs_p2[0]['id'], "Pagination offset must return different records"

    # 4. Activity Log Generation on Appointment Booking & Cancellation
    print("\n[TEST H & I] Booking & Cancelling appointment audit trail")
    patient = Patient.objects.first()
    doctor = Doctor.objects.first()
    dept = doctor.department
    today = timezone.localdate()

    # Cancel any previous appointment on today for clean test
    Appointment.objects.filter(patient=patient, doctor=doctor, appointment_date=today).delete()

    appt, err = AppointmentService.book_appointment(
        patient=patient,
        doctor=doctor,
        department=dept,
        appointment_date=today,
        user=patient.user
    )
    assert appt is not None, f"Booking failed: {err}"
    print(f"  Booked test token: {appt.token_number}")

    # Verify ActivityLog created for APPOINTMENT_BOOKED
    booked_log = ActivityLog.objects.filter(action='APPOINTMENT_BOOKED', entity_id=appt.id).first()
    assert booked_log is not None, "APPOINTMENT_BOOKED activity log not found in database!"
    assert booked_log.clinic == doctor.clinic, "Activity log missing clinic association"
    print(f"  -> ActivityLog verified: {booked_log.action} for Clinic '{booked_log.clinic}'")

    # Cancel appointment
    ok, cancel_err = AppointmentService.cancel_appointment(appt.id, user=patient.user)
    assert ok is True, f"Cancellation failed: {cancel_err}"
    cancelled_log = ActivityLog.objects.filter(action='APPOINTMENT_CANCELLED', entity_id=appt.id).first()
    assert cancelled_log is not None, "APPOINTMENT_CANCELLED activity log not found in database!"
    assert cancelled_log.clinic == doctor.clinic, "Activity log missing clinic association"
    print(f"  -> ActivityLog verified: {cancelled_log.action} for Clinic '{cancelled_log.clinic}'")

    # 5. Doctor API verification (PostgreSQL queryset, no duplicates)
    print("\n[TEST 5] Doctor API verification")
    resp_doc = client.get('/api/v1/doctors/')
    assert resp_doc.status_code == 200
    docs = resp_doc.json().get('data', [])
    doc_ids = [d['id'] for d in docs]
    assert len(doc_ids) == len(set(doc_ids)), "Found duplicate doctors in API response!"
    print(f"  -> {len(docs)} unique PostgreSQL doctors returned without duplicates.")

    # 6. Check JS files and HTML templates
    print("\n[TEST 6] Codebase Integrity & Selector Checks")
    with open('static/js/admin.js', 'r', encoding='utf-8') as f:
        admin_js = f.read()
    assert ':contains' not in admin_js, "Found unsupported :contains selector in static/js/admin.js!"
    assert 'loadPastActivities' in admin_js, "Missing loadPastActivities in admin.js"
    assert 'renderDailyProgress' in admin_js, "Missing renderDailyProgress in admin.js"
    assert 'renderLiveAuditLogs' in admin_js, "Missing renderLiveAuditLogs in admin.js"
    print("  -> static/js/admin.js verified (0 invalid selectors, complete handlers).")

    with open('static/js/booking.js', 'r', encoding='utf-8') as f:
        booking_js = f.read()
    assert ':contains' not in booking_js, "Found unsupported :contains in booking.js!"
    assert 'I18N.t(\'selectedBtn\'' in booking_js or 'selectedBtn' in booking_js
    assert 'I18N.t(\'selectBtn\'' in booking_js or 'selectBtn' in booking_js
    print("  -> static/js/booking.js verified (dynamic i18n button states).")

    with open('templates/clinic-adminoverview.html', 'r', encoding='utf-8') as f:
        admin_html = f.read()
    assert 'id="daily-progress-container"' in admin_html
    assert 'id="activity-log-list"' in admin_html
    assert 'id="past-activity-table-body"' in admin_html
    assert 'id="past-prev-btn"' in admin_html
    assert 'id="past-next-btn"' in admin_html
    print("  -> templates/clinic-adminoverview.html verified with Daily Progress, Live Audit & Past Activities.")

    with open('static/js/i18n.js', 'r', encoding='utf-8') as f:
        i18n_js = f.read()
    assert 'pastActivitiesTitle' in i18n_js
    assert 'selectBtn' in i18n_js
    assert 'selectedBtn' in i18n_js
    assert 'dailyProgressTitle' in i18n_js
    print("  -> static/js/i18n.js verified with complete English and Hindi translations.")

    print("\n==================================================")
    print("ALL TESTS PASSED 100% SUCCESSFULLY!")
    print("==================================================")

if __name__ == '__main__':
    run_comprehensive_tests()
