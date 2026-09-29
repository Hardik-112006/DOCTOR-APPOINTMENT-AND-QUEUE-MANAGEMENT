# API Contract --- Doctor Appointment & Queue Management System

## 1. Purpose

This document is the single source of truth for the backend API of the
Doctor Appointment & Queue Management System.

### Backend Stack

-   **Backend:** Django
-   **API:** Django REST Framework (DRF)
-   **Database:** PostgreSQL
-   **Authentication:** JWT Bearer Token
-   **API Version:** `/api/v1`
-   **Frontend:** React
-   **Roles:** Patient, Receptionist, Doctor, Clinic Admin
-   **Date/Time:** Store timestamps in UTC; display dates/times in IST
-   **API Format:** JSON
-   **Naming:** API fields use `camelCase`
-   **Authentication Header:**

``` http
Authorization: Bearer <access_token>
```

## 2. Common API Rules

### 2.1 Success Response Envelope

Single object:

``` json
{
  "data": {
    "id": 1
  }
}
```

List:

``` json
{
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

### 2.2 Error Response

``` json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields are invalid.",
    "fields": {
      "email": ["Enter a valid email address."]
    }
  }
}
```

### 2.3 HTTP Status Codes

  Status   Meaning
  -------- -------------------------------------------
  `200`    Successful request
  `201`    Resource created
  `204`    Successful request with no response body
  `400`    Invalid request/business validation
  `401`    Authentication required or token invalid
  `403`    Authenticated but not allowed
  `404`    Resource not found
  `409`    Conflict, such as slot already booked
  `422`    Unprocessable validation request, if used
  `500`    Unexpected server error

### 2.4 General Backend Rules

-   Validate all important business rules on the server.
-   Never trust role information sent by the frontend.
-   Never return password hashes.
-   Protect role-specific endpoints.
-   Check resource ownership where applicable.
-   Store secrets in environment variables.
-   Do not expose stack traces in production.
-   Prevent double booking at the database level.
-   Cancel appointments by changing status rather than deleting
    historical records.
-   Use pagination for large list endpoints.
-   Do not hardcode frontend/backend URLs.
-   All endpoints must use the `/api/v1` prefix.

------------------------------------------------------------------------

# 3. Authentication / Role Access

## 3.1 Login

**POST** `/api/v1/auth/login/`

**Auth:** Public

### Request

``` json
{
  "email": "patient@example.com",
  "password": "Password123"
}
```

### Success --- `200`

``` json
{
  "data": {
    "accessToken": "<jwt_access_token>",
    "refreshToken": "<jwt_refresh_token>",
    "user": {
      "id": 1,
      "name": "Rahul Kumar",
      "email": "patient@example.com",
      "phone": "9876543210",
      "role": "PATIENT"
    }
  }
}
```

### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_CREDENTIALS`

------------------------------------------------------------------------

## 3.2 Send OTP

**POST** `/api/v1/auth/send-otp/`

**Auth:** Public

### Request

``` json
{
  "phone": "9876543210"
}
```

### Success --- `200`

``` json
{
  "data": {
    "message": "OTP sent successfully.",
    "expiresInSeconds": 300
  }
}
```

### Errors

-   `400 VALIDATION_ERROR`
-   `404 USER_NOT_FOUND`
-   `429 OTP_RATE_LIMITED`

------------------------------------------------------------------------

## 3.3 Verify OTP

**POST** `/api/v1/auth/verify-otp/`

**Auth:** Public

### Request

``` json
{
  "phone": "9876543210",
  "otp": "123456"
}
```

### Success --- `200`

``` json
{
  "data": {
    "accessToken": "<jwt_access_token>",
    "refreshToken": "<jwt_refresh_token>",
    "user": {
      "id": 1,
      "name": "Rahul Kumar",
      "role": "PATIENT"
    }
  }
}
```

### Errors

-   `400 VALIDATION_ERROR`
-   `401 INVALID_OTP`
-   `410 OTP_EXPIRED`

------------------------------------------------------------------------

## 3.4 Register Patient

**POST** `/api/v1/auth/register/`

**Auth:** Public

### Request

``` json
{
  "name": "Rahul Kumar",
  "email": "rahul@example.com",
  "phone": "9876543210",
  "password": "Password123"
}
```

### Success --- `201`

``` json
{
  "data": {
    "id": 1,
    "name": "Rahul Kumar",
    "email": "rahul@example.com",
    "phone": "9876543210",
    "role": "PATIENT"
  }
}
```

### Errors

-   `400 VALIDATION_ERROR`
-   `409 EMAIL_ALREADY_EXISTS`
-   `409 PHONE_ALREADY_EXISTS`

------------------------------------------------------------------------

## 3.5 Logout

**POST** `/api/v1/auth/logout/`

**Auth:** Authenticated

### Request

``` json
{
  "refreshToken": "<jwt_refresh_token>"
}
```

### Success --- `204`

No response body.

------------------------------------------------------------------------

## 3.6 Refresh Access Token

**POST** `/api/v1/auth/refresh/`

**Auth:** Public with refresh token

### Request

``` json
{
  "refreshToken": "<jwt_refresh_token>"
}
```

### Success --- `200`

``` json
{
  "data": {
    "accessToken": "<new_access_token>"
  }
}
```

### Errors

-   `401 INVALID_REFRESH_TOKEN`

------------------------------------------------------------------------

## 3.7 Current User

**GET** `/api/v1/auth/me/`

**Auth:** Authenticated

### Success --- `200`

``` json
{
  "data": {
    "id": 1,
    "name": "Rahul Kumar",
    "email": "rahul@example.com",
    "phone": "9876543210",
    "role": "PATIENT"
  }
}
```

------------------------------------------------------------------------

## 3.8 Available Roles

**GET** `/api/v1/auth/roles/`

**Auth:** Public

### Success --- `200`

``` json
{
  "data": [
    "PATIENT",
    "RECEPTIONIST",
    "DOCTOR",
    "ADMIN"
  ]
}
```

------------------------------------------------------------------------

## 3.9 Supported Languages

**GET** `/api/v1/settings/languages/`

**Auth:** Public

### Success --- `200`

``` json
{
  "data": [
    {
      "code": "en",
      "name": "English"
    },
    {
      "code": "hi",
      "name": "Hindi"
    }
  ]
}
```

------------------------------------------------------------------------

# 4. Book Appointment / Get Token

Flow:

``` text
Departments
    ↓
Doctors
    ↓
Doctor Details
    ↓
Availability
    ↓
Dates
    ↓
Slots
    ↓
Preview
    ↓
Create Appointment
```

## 4.1 Departments

**GET** `/api/v1/departments/`

**Auth:** Authenticated

### Success --- `200`

``` json
{
  "data": [
    {
      "id": 1,
      "name": "General Medicine",
      "description": "General medical consultation"
    }
  ]
}
```

------------------------------------------------------------------------

## 4.2 Doctors

**GET** `/api/v1/doctors/`

**Auth:** Authenticated

### Query Parameters

``` text
departmentId
date
available
search
page
pageSize
```

### Success --- `200`

``` json
{
  "data": [
    {
      "id": 12,
      "name": "Dr. Rajesh Khanna",
      "specialization": "General Medicine",
      "departmentId": 1,
      "room": "Room 3",
      "available": true
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

------------------------------------------------------------------------

## 4.3 Doctor Details

**GET** `/api/v1/doctors/{doctorId}/`

**Auth:** Authenticated

### Success --- `200`

``` json
{
  "data": {
    "id": 12,
    "name": "Dr. Rajesh Khanna",
    "specialization": "General Medicine",
    "departmentId": 1,
    "room": "Room 3",
    "consultationFeePaise": 50000,
    "available": true
  }
}
```

------------------------------------------------------------------------

## 4.4 Doctor Availability

**GET** `/api/v1/doctors/{doctorId}/availability/`

**Auth:** Authenticated

### Query

``` text
date=2026-09-26
```

### Success --- `200`

``` json
{
  "data": {
    "doctorId": 12,
    "date": "2026-09-26",
    "available": true,
    "startTime": "09:00",
    "endTime": "17:00"
  }
}
```

------------------------------------------------------------------------

## 4.5 Available Appointment Dates

**GET** `/api/v1/appointments/available-dates/`

**Auth:** Authenticated

### Query

``` text
doctorId=12
```

### Success --- `200`

``` json
{
  "data": [
    "2026-09-26",
    "2026-09-27",
    "2026-09-28"
  ]
}
```

------------------------------------------------------------------------

## 4.6 Available Slots

**GET** `/api/v1/slots/`

**Auth:** Authenticated

### Query

``` text
doctorId=12
date=2026-09-26
```

### Success --- `200`

``` json
{
  "data": [
    {
      "id": 45,
      "doctorId": 12,
      "date": "2026-09-26",
      "startTime": "10:00",
      "endTime": "10:15",
      "available": true
    }
  ]
}
```

------------------------------------------------------------------------

## 4.7 Walk-in Availability

**GET** `/api/v1/doctors/{doctorId}/walk-in/`

**Auth:** Authenticated

### Success --- `200`

``` json
{
  "data": {
    "doctorId": 12,
    "available": true,
    "estimatedWaitMinutes": 35
  }
}
```

------------------------------------------------------------------------

## 4.8 Appointment Preview

**POST** `/api/v1/appointments/preview/`

**Auth:** Patient

### Request

``` json
{
  "doctorId": 12,
  "departmentId": 3,
  "date": "2026-09-26",
  "slotId": 45,
  "bookingType": "ONLINE"
}
```

### Success --- `200`

``` json
{
  "data": {
    "doctor": "Dr. Rajesh Khanna",
    "date": "2026-09-26",
    "slot": "10:00 - 10:15",
    "estimatedWaitMinutes": 18,
    "queuePosition": 4
  }
}
```

------------------------------------------------------------------------

## 4.9 Create Appointment / Token

**POST** `/api/v1/appointments/`

**Auth:** Patient

### Request

``` json
{
  "doctorId": 12,
  "departmentId": 3,
  "date": "2026-09-26",
  "slotId": 45,
  "bookingType": "ONLINE"
}
```

### Success --- `201`

``` json
{
  "data": {
    "appointmentId": 1052,
    "tokenNumber": 27,
    "doctor": "Dr. Rajesh Khanna",
    "date": "2026-09-26",
    "estimatedWaitMinutes": 18,
    "queuePosition": 4,
    "status": "WAITING"
  }
}
```

### Business Rules

-   Slot must exist.
-   Slot must belong to the selected doctor.
-   Date must not be in the past.
-   Patient must be authenticated.
-   Slot must still be available.
-   The same slot cannot be double-booked.
-   Booking must be atomic.
-   If another request books the slot first, return `409`.

### Errors

-   `400 INVALID_DATE`
-   `400 INVALID_SLOT`
-   `400 PAST_SLOT`
-   `401 UNAUTHORIZED`
-   `409 SLOT_ALREADY_BOOKED`

------------------------------------------------------------------------

## 4.10 Get Appointment

**GET** `/api/v1/appointments/{appointmentId}/`

**Auth:** Authenticated

### Ownership

Patient can access their own appointment.

Receptionist, Doctor and Admin can access appointments allowed by their
role.

### Success --- `200`

``` json
{
  "data": {
    "appointmentId": 1052,
    "tokenNumber": 27,
    "status": "WAITING",
    "bookingType": "ONLINE",
    "doctor": {
      "id": 12,
      "name": "Dr. Rajesh Khanna"
    },
    "date": "2026-09-26",
    "queuePosition": 4,
    "estimatedWaitMinutes": 18
  }
}
```

------------------------------------------------------------------------

## 4.11 Cancel Appointment

**POST** `/api/v1/appointments/{appointmentId}/cancel/`

**Auth:** Authenticated

### Request

``` json
{
  "reason": "Unable to attend"
}
```

### Success --- `200`

``` json
{
  "data": {
    "appointmentId": 1052,
    "status": "CANCELLED"
  }
}
```

### Errors

-   `401 UNAUTHORIZED`
-   `403 NOT_OWNER`
-   `404 APPOINTMENT_NOT_FOUND`
-   `400 APPOINTMENT_CANNOT_BE_CANCELLED`

------------------------------------------------------------------------

# 5. Live Queue / Patient Tracking

Queue states:

``` text
WAITING
   ↓
CALLED
   ↓
CONSULTING
   ↓
COMPLETED
```

## 5.1 Current Patient Queue

**GET** `/api/v1/patient/queue/current/`

**Auth:** Patient

### Success --- `200`

``` json
{
  "data": {
    "appointmentId": 1052,
    "tokenNumber": 27,
    "queuePosition": 4,
    "patientsAhead": 3,
    "estimatedWaitMinutes": 18,
    "status": "WAITING",
    "doctor": {
      "id": 12,
      "name": "Dr. Rajesh Khanna"
    },
    "room": "Room 3"
  }
}
```

------------------------------------------------------------------------

## 5.2 Specific Queue Status

**GET** `/api/v1/patient/queue/{appointmentId}/`

**Auth:** Patient

### Success

Returns the current queue status using the same queue object described
above.

------------------------------------------------------------------------

## 5.3 Queue Position

**GET** `/api/v1/patient/queue/{appointmentId}/position/`

**Auth:** Patient

### Success --- `200`

``` json
{
  "data": {
    "queuePosition": 4,
    "patientsAhead": 3
  }
}
```

------------------------------------------------------------------------

## 5.4 Queue ETA

**GET** `/api/v1/patient/queue/{appointmentId}/eta/`

**Auth:** Patient

### Success --- `200`

``` json
{
  "data": {
    "estimatedWaitMinutes": 18,
    "estimatedCallTime": "10:18"
  }
}
```

------------------------------------------------------------------------

## 5.5 Current Active Appointment

**GET** `/api/v1/patient/appointments/current/`

**Auth:** Patient

### Success --- `200`

Returns the patient's active appointment, if one exists.

------------------------------------------------------------------------

## 5.6 Notification Status

**GET** `/api/v1/patient/notifications/status/`

**Auth:** Patient

### Success --- `200`

``` json
{
  "data": {
    "enabled": true,
    "lastSent": "2026-09-26T01:00:00Z"
  }
}
```

------------------------------------------------------------------------

## 5.7 Manual Queue Refresh

**POST** `/api/v1/patient/queue/{appointmentId}/refresh/`

**Auth:** Patient

### Success --- `200`

Returns the latest queue position and ETA.

------------------------------------------------------------------------

# 6. Receptionist Queue Control

Receptionist manages the unified online + walk-in queue.

## 6.1 Today's Queue

**GET** `/api/v1/receptionist/queue/today/`

**Auth:** Receptionist

### Query

``` text
doctorId
status
date
page
pageSize
```

### Success

Returns paginated queue entries.

------------------------------------------------------------------------

## 6.2 Queue Search / Filter

**GET** `/api/v1/receptionist/queue/`

**Auth:** Receptionist

### Query

``` text
doctorId
status
bookingType
date
search
page
pageSize
```

------------------------------------------------------------------------

## 6.3 Queue Entry

**GET** `/api/v1/receptionist/queue/{queueId}/`

**Auth:** Receptionist

------------------------------------------------------------------------

## 6.4 Search Patients

**GET** `/api/v1/receptionist/patients/`

**Auth:** Receptionist

### Query

``` text
search
page
pageSize
```

------------------------------------------------------------------------

## 6.5 Patient Details

**GET** `/api/v1/receptionist/patients/{patientId}/`

**Auth:** Receptionist

------------------------------------------------------------------------

## 6.6 Register Walk-in

**POST** `/api/v1/receptionist/walk-ins/`

**Auth:** Receptionist

### Request

``` json
{
  "patientId": 205,
  "doctorId": 12,
  "departmentId": 3
}
```

### Success --- `201`

``` json
{
  "data": {
    "queueId": 5008,
    "tokenNumber": 48,
    "queuePosition": 12,
    "estimatedWaitMinutes": 35,
    "status": "WAITING",
    "bookingType": "WALK_IN"
  }
}
```

### Rule

Online appointments and walk-ins enter the same queue.

------------------------------------------------------------------------

## 6.7 Mark Patient Arrived

**POST** `/api/v1/receptionist/queue/{queueId}/arrive/`

**Auth:** Receptionist

### Success

``` json
{
  "data": {
    "queueId": 5008,
    "status": "WAITING"
  }
}
```

------------------------------------------------------------------------

## 6.8 Mark Patient Called

**POST** `/api/v1/receptionist/queue/{queueId}/call/`

**Auth:** Receptionist

### Success

``` json
{
  "data": {
    "queueId": 5008,
    "status": "CALLED"
  }
}
```

------------------------------------------------------------------------

## 6.9 Complete Queue Entry

**POST** `/api/v1/receptionist/queue/{queueId}/complete/`

**Auth:** Receptionist

### Success

``` json
{
  "data": {
    "queueId": 5008,
    "status": "COMPLETED"
  }
}
```

------------------------------------------------------------------------

## 6.10 Update Queue Entry

**PATCH** `/api/v1/receptionist/queue/{queueId}/`

**Auth:** Receptionist

### Request

Only permitted queue fields should be accepted.

``` json
{
  "status": "WAITING"
}
```

------------------------------------------------------------------------

## 6.11 Queue Position / ETA

**GET** `/api/v1/receptionist/queue/{queueId}/position/`

**Auth:** Receptionist

### Success

``` json
{
  "data": {
    "queuePosition": 12,
    "estimatedWaitMinutes": 35
  }
}
```

------------------------------------------------------------------------

# 7. Doctor Queue & Consultation

## 7.1 Today's Doctor Queue

**GET** `/api/v1/doctor/queue/today/`

**Auth:** Doctor

------------------------------------------------------------------------

## 7.2 Waiting Patients

**GET** `/api/v1/doctor/queue/waiting/`

**Auth:** Doctor

------------------------------------------------------------------------

## 7.3 Current Patient

**GET** `/api/v1/doctor/queue/current/`

**Auth:** Doctor

------------------------------------------------------------------------

## 7.4 Completed Patients

**GET** `/api/v1/doctor/queue/completed/`

**Auth:** Doctor

------------------------------------------------------------------------

## 7.5 Call Next Patient

**POST** `/api/v1/doctor/queue/call-next/`

**Auth:** Doctor

### Success --- `200`

``` json
{
  "data": {
    "queueId": 5008,
    "tokenNumber": 48,
    "status": "CALLED"
  }
}
```

### Errors

-   `404 NO_WAITING_PATIENT`
-   `409 PATIENT_ALREADY_BEING_CALLED`

------------------------------------------------------------------------

## 7.6 Call Specific Patient

**POST** `/api/v1/doctor/queue/{queueId}/call/`

**Auth:** Doctor

------------------------------------------------------------------------

## 7.7 Start Consultation

**POST** `/api/v1/doctor/queue/{queueId}/start/`

**Auth:** Doctor

### Success

``` json
{
  "data": {
    "queueId": 5008,
    "status": "CONSULTING"
  }
}
```

------------------------------------------------------------------------

## 7.8 Complete Patient

**POST** `/api/v1/doctor/queue/{queueId}/complete/`

**Auth:** Doctor

### Success

``` json
{
  "data": {
    "queueId": 5008,
    "status": "COMPLETED"
  }
}
```

------------------------------------------------------------------------

## 7.9 Queue Entry Details

**GET** `/api/v1/doctor/queue/{queueId}/`

**Auth:** Doctor

------------------------------------------------------------------------

# 8. Patient Information

## 8.1 Patient Details

**GET** `/api/v1/patients/{patientId}/`

**Auth:** Doctor / Receptionist / Admin according to access rules.

### Success

``` json
{
  "data": {
    "id": 205,
    "name": "Rahul Kumar",
    "phone": "9876543210",
    "email": "rahul@example.com"
  }
}
```

------------------------------------------------------------------------

## 8.2 Consultation History

**GET** `/api/v1/patients/{patientId}/history/`

**Auth:** Authorized staff

### Success

Returns previous consultation records.

------------------------------------------------------------------------

## 8.3 Medical Records

**GET** `/api/v1/patients/{patientId}/records/`

**Auth:** Authorized staff

### Note

Medical records are included only if this functionality remains part of
the MVP.

------------------------------------------------------------------------

# 9. Doctor Consultation APIs

## 9.1 Current Consultation

**GET** `/api/v1/doctor/consultations/current/`

**Auth:** Doctor

------------------------------------------------------------------------

## 9.2 Create Consultation

**POST** `/api/v1/doctor/consultations/`

**Auth:** Doctor

### Request

``` json
{
  "queueId": 5008,
  "notes": "Patient reports mild fever.",
  "diagnosis": "Viral fever",
  "prescription": "As prescribed"
}
```

### Success --- `201`

``` json
{
  "data": {
    "id": 9001,
    "queueId": 5008,
    "status": "IN_PROGRESS",
    "notes": "Patient reports mild fever.",
    "diagnosis": "Viral fever",
    "prescription": "As prescribed"
  }
}
```

------------------------------------------------------------------------

## 9.3 Get Consultation

**GET** `/api/v1/doctor/consultations/{id}/`

**Auth:** Doctor

------------------------------------------------------------------------

## 9.4 Update Consultation

**PATCH** `/api/v1/doctor/consultations/{id}/`

**Auth:** Doctor

### Request

``` json
{
  "notes": "Updated consultation notes.",
  "prescription": "Updated prescription"
}
```

------------------------------------------------------------------------

## 9.5 Complete Consultation

**POST** `/api/v1/doctor/consultations/{id}/complete/`

**Auth:** Doctor

### Success --- `200`

``` json
{
  "data": {
    "id": 9001,
    "status": "COMPLETED"
  }
}
```

------------------------------------------------------------------------

## 9.6 Add Lab Test Request

**POST** `/api/v1/doctor/consultations/{id}/lab-tests/`

**Auth:** Doctor

### Request

``` json
{
  "testName": "CBC",
  "notes": "Routine blood test"
}
```

------------------------------------------------------------------------

## 9.7 Add Specialist Referral

**POST** `/api/v1/doctor/consultations/{id}/referral/`

**Auth:** Doctor

### Request

``` json
{
  "specialist": "Cardiology",
  "reason": "Further evaluation required"
}
```

------------------------------------------------------------------------

# 10. Clinic/Admin Overview

## 10.1 Dashboard Overview

**GET** `/api/v1/admin/dashboard/overview/`

**Auth:** Clinic Admin

### Success --- `200`

``` json
{
  "data": {
    "totalAppointments": 148,
    "waitingPatients": 24,
    "averageWaitMinutes": 18,
    "doctors": {
      "total": 8,
      "available": 6,
      "away": 2
    },
    "queue": {
      "waiting": 45,
      "consulting": 25,
      "completed": 20,
      "cancelled": 10
    }
  }
}
```

------------------------------------------------------------------------

## 10.2 KPI Metrics

**GET** `/api/v1/admin/dashboard/metrics/`

**Auth:** Clinic Admin

------------------------------------------------------------------------

## 10.3 Queue Summary

**GET** `/api/v1/admin/dashboard/queue/`

**Auth:** Clinic Admin

------------------------------------------------------------------------

## 10.4 Patient Flow

**GET** `/api/v1/admin/dashboard/patient-flow/`

**Auth:** Clinic Admin

### Expected data

Hourly patient flow.

------------------------------------------------------------------------

## 10.5 Patient Distribution

**GET** `/api/v1/admin/dashboard/patient-distribution/`

**Auth:** Clinic Admin

### Expected categories

-   Waiting
-   Consulting
-   Completed
-   Cancelled

------------------------------------------------------------------------

## 10.6 Admin Doctor List

**GET** `/api/v1/admin/doctors/`

**Auth:** Clinic Admin

------------------------------------------------------------------------

## 10.7 Doctor Availability

**GET** `/api/v1/admin/doctors/availability/`

**Auth:** Clinic Admin

------------------------------------------------------------------------

## 10.8 Doctor Live Status

**GET** `/api/v1/admin/doctors/live-status/`

**Auth:** Clinic Admin

------------------------------------------------------------------------

## 10.9 Activity Log

**GET** `/api/v1/admin/activity/`

**Auth:** Clinic Admin

------------------------------------------------------------------------

## 10.10 Clinic Settings

**GET** `/api/v1/admin/clinic/settings/`

**Auth:** Clinic Admin

------------------------------------------------------------------------

## 10.11 Update Clinic Settings

**PATCH** `/api/v1/admin/clinic/settings/`

**Auth:** Clinic Admin

### Request

Only supported clinic settings should be accepted.

------------------------------------------------------------------------

# 11. Health Check

**GET** `/api/v1/health/`

**Auth:** Public

### Success --- `200`

``` json
{
  "data": {
    "ok": true
  }
}
```

This endpoint is used to verify that the Django API and database service
are available.

------------------------------------------------------------------------

# 12. Role Access Matrix

  API Group                    Patient   Receptionist       Doctor        Admin
  ---------------------- ------------- -------------- ------------ ------------
  Login/Register                   Yes            Yes          Yes          Yes
  Departments                      Yes            Yes          Yes          Yes
  Doctors                          Yes            Yes          Yes          Yes
  Book Appointment                 Yes             No           No           No
  Patient Queue                    Own             No           No           No
  Walk-in Registration              No            Yes           No           No
  Receptionist Queue                No            Yes           No           No
  Doctor Queue                      No             No          Yes           No
  Consultation                      No             No          Yes           No
  Patient History          Own/limited     Authorized   Authorized   Authorized
  Admin Dashboard                   No             No           No          Yes
  Clinic Settings                   No             No           No          Yes

> The exact ownership rules for staff access should be enforced by the
> Django/DRF backend, not by the frontend.

------------------------------------------------------------------------

# 13. Core Data Relationships

The backend should support the following conceptual relationships:

``` text
User
 ├── Patient
 ├── Receptionist
 ├── Doctor
 └── Clinic Admin

Department
 └── Doctors

Doctor
 ├── Availability
 ├── Slots
 └── Queue Entries

Patient
 ├── Appointments
 ├── Queue Entries
 └── Consultations

Appointment
 └── Queue Entry

Queue Entry
 └── Consultation
```

------------------------------------------------------------------------

# 14. Appointment / Queue Statuses

## Appointment Status

``` text
WAITING
CALLED
CONSULTING
COMPLETED
CANCELLED
```

## Booking Type

``` text
ONLINE
WALK_IN
```

## User Roles

``` text
PATIENT
RECEPTIONIST
DOCTOR
ADMIN
```

------------------------------------------------------------------------

# 15. Important Business Rules

## Booking

1.  A patient must be authenticated to book.
2.  A selected doctor must exist.
3.  A selected department must exist.
4.  The slot must belong to the selected doctor.
5.  The date/slot cannot be in the past.
6.  A booked slot cannot be booked again.
7.  Double booking must be prevented at the database level.
8.  Appointment creation and queue-token creation should be atomic.

## Queue

1.  Online appointments and walk-ins use the same queue.
2.  Queue position changes as patients are called/completed.
3.  ETA should be recalculated from current queue information.
4.  Queue transitions must follow valid status transitions.
5.  A completed/cancelled appointment should not return to `WAITING`
    without an explicit supported business operation.

## Cancellation

1.  Cancellation should update status.
2.  Historical appointment data should not be deleted.
3.  Invalid cancellation attempts return an appropriate `400` error.

## Permissions

1.  Patient can access their own appointment/queue.
2.  Receptionist can manage receptionist queue operations.
3.  Doctor can manage their own queue and consultations.
4.  Admin can access clinic-level dashboard and settings.
5.  Unauthorized users receive `401`.
6.  Authenticated users without permission receive `403`.

------------------------------------------------------------------------

# 16. Frontend Integration Rules

The React application should not directly implement backend business
rules.

The frontend should:

1.  Use one API client layer.
2.  Read the API base URL from environment variables.
3.  Attach the JWT Bearer token.
4.  Parse the standard success/error envelope.
5.  Handle `401` by clearing authentication and redirecting to login.
6.  Show loading state.
7.  Show empty state.
8.  Show error state.
9.  Show successful state.
10. Disable submit buttons during requests.
11. Prevent double submission.
12. Refetch queue/appointment data after important mutations.
13. Display UTC timestamps as IST.

------------------------------------------------------------------------

# 17. Backend Implementation Order

Build the Django backend vertically in this order:

``` text
1. Django project + DRF
        ↓
2. PostgreSQL connection
        ↓
3. Environment variables
        ↓
4. Health API
        ↓
5. Custom User + JWT
        ↓
6. Roles / permissions
        ↓
7. Departments + Doctors
        ↓
8. Availability + Slots
        ↓
9. Appointment booking
        ↓
10. Unified Queue
        ↓
11. Patient queue tracking
        ↓
12. Receptionist operations
        ↓
13. Doctor queue
        ↓
14. Consultation
        ↓
15. Admin dashboard
        ↓
16. Testing + validation
```

------------------------------------------------------------------------

# 18. Suggested Django App Structure

``` text
backend/
│
├── manage.py
├── .env
├── .env.example
├── requirements.txt
│
├── config/
│   ├── settings.py
│   ├── urls.py
│   ├── wsgi.py
│   └── asgi.py
│
└── apps/
    ├── accounts/
    ├── departments/
    ├── doctors/
    ├── appointments/
    ├── queue/
    ├── consultations/
    └── dashboard/
```

The exact internal Django structure can be adjusted during
implementation, but the API paths in this document should remain the
contract.

------------------------------------------------------------------------

# 19. Minimum API Testing Checklist

Before moving to frontend integration, verify:

### Health

``` text
GET /api/v1/health/
```

### Auth

``` text
POST /api/v1/auth/register/
POST /api/v1/auth/login/
GET  /api/v1/auth/me/
POST /api/v1/auth/refresh/
POST /api/v1/auth/logout/
```

### Booking

``` text
GET  /api/v1/departments/
GET  /api/v1/doctors/
GET  /api/v1/slots/
POST /api/v1/appointments/preview/
POST /api/v1/appointments/
GET  /api/v1/appointments/{appointmentId}/
POST /api/v1/appointments/{appointmentId}/cancel/
```

### Patient Queue

``` text
GET /api/v1/patient/queue/current/
GET /api/v1/patient/queue/{appointmentId}/
GET /api/v1/patient/queue/{appointmentId}/position/
GET /api/v1/patient/queue/{appointmentId}/eta/
```

### Receptionist

``` text
GET  /api/v1/receptionist/queue/today/
POST /api/v1/receptionist/walk-ins/
POST /api/v1/receptionist/queue/{queueId}/arrive/
POST /api/v1/receptionist/queue/{queueId}/call/
POST /api/v1/receptionist/queue/{queueId}/complete/
```

### Doctor

``` text
GET  /api/v1/doctor/queue/today/
GET  /api/v1/doctor/queue/waiting/
POST /api/v1/doctor/queue/call-next/
POST /api/v1/doctor/queue/{queueId}/start/
POST /api/v1/doctor/queue/{queueId}/complete/
POST /api/v1/doctor/consultations/
PATCH /api/v1/doctor/consultations/{id}/
POST /api/v1/doctor/consultations/{id}/complete/
```

### Admin

``` text
GET /api/v1/admin/dashboard/overview/
GET /api/v1/admin/dashboard/metrics/
GET /api/v1/admin/dashboard/queue/
GET /api/v1/admin/dashboard/patient-flow/
GET /api/v1/admin/dashboard/patient-distribution/
GET /api/v1/admin/doctors/
GET /api/v1/admin/doctors/live-status/
GET /api/v1/admin/activity/
GET /api/v1/admin/clinic/settings/
PATCH /api/v1/admin/clinic/settings/
```

------------------------------------------------------------------------

# 20. Contract Completion Rule

This file is the API contract for implementation.

When implementing a feature:

1.  Pick one feature.
2.  Implement its database models.
3.  Implement serializer validation.
4.  Implement service/business logic.
5.  Implement DRF view/API endpoint.
6.  Implement URL route.
7.  Test the endpoint.
8.  Verify the exact request/response against this document.
9.  Only then connect the React screen.

Do not create frontend mocks that contradict this contract.

If an API needs to change during development, update this document first
and then update the Django implementation and React API client.
