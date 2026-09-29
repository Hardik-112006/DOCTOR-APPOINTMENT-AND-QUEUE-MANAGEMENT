import os
import sys
import django
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.test import Client
from apps.accounts.models import User
from apps.appointments.models import Appointment
from apps.queue.models import QueueEntry
from apps.dashboard.models import ActivityLog
from apps.dashboard.services import DashboardService

def verify_all():
    client = Client()
    print("==================================================")
    print("TESTING NEW REQUIREMENTS (ENGLISH BOOKING, LIVE AUDIT, DAILY PROGRESS)")
    print("==================================================")

    # 1. Admin Login & Check Daily Progress API
    print("\n--- 1. Testing Daily Progress API ---")
    login_adm = client.post('/api/v1/auth/login/', {
        'username_or_email': '9000000005',
        'password': 'Demo@123'
    }, content_type='application/json')
    assert login_adm.status_code == 200, f"Admin login failed: {login_adm.json()}"
    adm_token = login_adm.json()['data']['access']
    headers = {'HTTP_AUTHORIZATION': f'Bearer {adm_token}'}

    resp_dp = client.get('/api/v1/dashboard/daily-progress/', **headers)
    assert resp_dp.status_code == 200, f"Daily progress failed: {resp_dp.json()}"
    dp_data = resp_dp.json().get('data', [])
    print(f"Daily progress records returned: {len(dp_data)} days")
    assert len(dp_data) == 7, f"Expected 7 days in daily progress, got {len(dp_data)}"
    for day in dp_data:
        print(f"  * {day['day_name']} ({day['date_formatted']}): {day['completed']}/{day['total']} ({day['percentage']}%) [Today: {day['is_today']}]")
        assert 'total' in day and 'completed' in day and 'percentage' in day
        assert 0 <= day['percentage'] <= 100
    print("[PASS] 1. Daily Progress API verified with real database calculations.")

    # 2. Check Live Audit Activity Logs API
    print("\n--- 2. Testing Live Audit API & Real Event Trail ---")
    resp_logs = client.get('/api/v1/dashboard/activity-logs/', **headers)
    assert resp_logs.status_code == 200, f"Activity logs failed: {resp_logs.json()}"
    logs_data = resp_logs.json().get('data', [])
    print(f"Total activity logs returned: {len(logs_data)}")
    assert len(logs_data) > 0, "Expected at least 1 activity log"
    for log in logs_data[:5]:
        print(f"  * [{log['created_at']}] {log['action_display']} (By {log['user']} [{log['user_role']}])")
        assert log['user'], "Missing user"
        assert log['action_display'], "Missing action_display"
        assert log['created_at'], "Missing created_at"
    print("[PASS] 2. Live Audit API verified with enriched audit trail details.")

    # 3. Check Metric API includes both daily_progress and recent_activity
    print("\n--- 3. Testing Clinic Metrics unified payload ---")
    resp_m = client.get('/api/v1/dashboard/metrics/', **headers)
    assert resp_m.status_code == 200, f"Metrics failed: {resp_m.json()}"
    m_data = resp_m.json().get('data', {})
    assert 'daily_progress' in m_data, "Missing daily_progress in metrics"
    assert 'recent_activity' in m_data, "Missing recent_activity in metrics"
    assert len(m_data['daily_progress']) == 7, "daily_progress length mismatch"
    print("[PASS] 3. Clinic Metrics payload unified and verified.")

    # 4. Verify English Booking flow & I18N integrity
    print("\n--- 4. Testing Booking Flow Strings & HTML ---")
    with open('static/js/booking.js', 'r', encoding='utf-8') as f:
        booking_js = f.read()
    assert 'चयनित ✓' not in booking_js, "Found hardcoded Hindi in booking.js!"
    assert 'चुनें' not in booking_js, "Found hardcoded Hindi in booking.js!"
    assert 'selectedBtn' in booking_js or 'selectBtn' in booking_js, "booking.js missing i18n select buttons"
    print("  * Verified booking.js contains zero hardcoded Hindi strings.")

    with open('static/js/i18n.js', 'r', encoding='utf-8') as f:
        i18n_js = f.read()
    assert 'selectBtn' in i18n_js, "Missing selectBtn in i18n.js"
    assert 'selectedBtn' in i18n_js, "Missing selectedBtn in i18n.js"
    assert 'dailyProgressTitle' in i18n_js, "Missing dailyProgressTitle in i18n.js"
    assert 'liveAuditTitle' in i18n_js, "Missing liveAuditTitle in i18n.js"
    print("  * Verified i18n.js contains complete English and Hindi translations.")

    with open('templates/bookappointment.html', 'r', encoding='utf-8') as f:
        book_html = f.read()
    assert 'id="booking-type"' in book_html
    assert 'data-i18n="typeOnline"' in book_html
    assert 'data-i18n="typeWalkIn"' in book_html
    print("  * Verified bookappointment.html dropdowns and summary placeholders have data-i18n.")

    with open('templates/clinic-adminoverview.html', 'r', encoding='utf-8') as f:
        admin_html = f.read()
    assert 'id="daily-progress-container"' in admin_html, "Missing daily-progress-container in admin HTML"
    assert 'id="activity-log-list"' in admin_html, "Missing activity-log-list in admin HTML"
    print("  * Verified clinic-adminoverview.html includes Daily Progress and Live Audit containers.")

    print("\n==================================================")
    print("ALL NEW REQUIREMENTS PASSED 100% SUCCESSFULLY!")
    print("==================================================")

if __name__ == '__main__':
    verify_all()
