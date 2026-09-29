from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from apps.accounts.views import LoginView, RegisterPatientView, CurrentUserView, UpdateLanguageView

urlpatterns = [
    path('login/', LoginView.as_view(), name='auth_login'),
    path('register/', RegisterPatientView.as_view(), name='auth_register'),
    path('refresh/', TokenRefreshView.as_view(), name='auth_refresh'),
    path('me/', CurrentUserView.as_view(), name='auth_me'),
    path('language/', UpdateLanguageView.as_view(), name='auth_language'),
]
