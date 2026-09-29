from rest_framework.permissions import BasePermission
from apps.accounts.models import User

class IsPatient(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == User.Role.PATIENT)

class IsReceptionist(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role in (User.Role.RECEPTIONIST, User.Role.ADMIN))

class IsDoctor(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role in (User.Role.DOCTOR, User.Role.ADMIN))

class IsClinicAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == User.Role.ADMIN)

class IsDoctorOrReceptionist(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role in (User.Role.DOCTOR, User.Role.RECEPTIONIST, User.Role.ADMIN))
