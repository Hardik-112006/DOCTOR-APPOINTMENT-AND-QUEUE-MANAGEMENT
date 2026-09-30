from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from config.page_views import (
    index_redirect_view,
    dashboard_page_view,
    login_page_view,
    book_appointment_page_view,
    live_queue_page_view,
    receptionist_page_view,
    doctor_page_view,
    admin_dashboard_page_view,
    health_check_view
)

urlpatterns = [
    path('django-admin/', admin.site.urls),

    # Web Pages (Django Templates)
    path('', dashboard_page_view, name='page_index'),
    path('portal/', dashboard_page_view, name='page_dashboard'),
    path('login/', login_page_view, name='page_login'),
    path('book/', book_appointment_page_view, name='page_book_appointment'),
    path('track/', live_queue_page_view, name='page_live_queue'),
    path('reception/', receptionist_page_view, name='page_receptionist'),
    path('doctor/', doctor_page_view, name='page_doctor'),
    path('dashboard/', admin_dashboard_page_view, name='page_admin_dashboard'),

    # Health API
    path('api/v1/health/', health_check_view, name='api_health'),

    # REST APIs v1
    path('api/v1/auth/', include('apps.accounts.urls')),
    path('api/v1/departments/', include('apps.departments.urls')),
    path('api/v1/doctors/', include('apps.doctors.urls')),
    path('api/v1/appointments/', include('apps.appointments.urls')),
    path('api/v1/queue/', include('apps.queue.urls')),
    path('api/v1/consultations/', include('apps.consultations.urls')),
    path('api/v1/notifications/', include('apps.notifications.urls')),
    path('api/v1/dashboard/', include('apps.dashboard.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATICFILES_DIRS[0])
