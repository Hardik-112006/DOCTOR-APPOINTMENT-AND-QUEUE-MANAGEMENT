
# pyrefly: ignore [missing-import]
from django.shortcuts import render
# pyrefly: ignore [missing-import]
from django.http import JsonResponse
# pyrefly: ignore [missing-import]
from django.db import connection

def index_redirect_view(request):
    return render(request, 'dashboard.html')

def dashboard_page_view(request):
    return render(request, 'dashboard.html')

def login_page_view(request):
    return render(request, 'login.html')

def book_appointment_page_view(request):
    return render(request, 'bookappointment.html')

def live_queue_page_view(request):
    return render(request, 'livequeuetracking.html')

def receptionist_page_view(request):
    return render(request, 'receptionistcontrol.html')

def doctor_page_view(request):
    return render(request, 'doctorqueueandconsultation.html')

def admin_dashboard_page_view(request):
    return render(request, 'clinic-adminoverview.html')

def health_check_view(request):
    try:
        connection.ensure_connection()
        db_ok = True
    except Exception:
        db_ok = False
    return JsonResponse({
        "data": {
            "status": "healthy" if db_ok else "unhealthy",
            "service": "DoctorQueue",
            "database": "connected" if db_ok else "disconnected"
        }
    })
