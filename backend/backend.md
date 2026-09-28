Haan, existing `backend.md` ke **API Endpoint Table ke baad** ye concise request/response examples add kar do:

# Backend

## 1. Backend Summary

The backend manages the core business logic and API services for the Doctor Appointment & Queue Management System.

It handles:

* User authentication
* Doctor management
* Doctor availability
* Appointment slots
* Appointment management
* API requests and responses
* Data validation
* Database operations

---

## 2. Backend Tech Stack

| Technology            | Purpose              |
| --------------------- | -------------------- |
| Python                | Backend programming  |
| Django                | Web framework        |
| Django REST Framework | REST API development |
| PostgreSQL            | Database             |
| Django ORM            | Database operations  |

---

## 3. Backend Flow

```text
Frontend Request
      ↓
Django URL
      ↓
View / API View
      ↓
Serializer
      ↓
Model / Business Logic
      ↓
PostgreSQL
      ↓
API Response
      ↓
Frontend
```

---

## 4. Main Backend Flow

```text
Login
  ↓
Authentication
  ↓
Dashboard
  ↓
Doctor API
  ↓
Availability API
  ↓
Slot API
  ↓
Appointment API
  ↓
Database Update
```

---

## 5. Important API Rule

API paths must remain consistent and must not be duplicated.

Correct:

```text
/api/v1/doctors/
```

Incorrect:

```text
/api/v1/api/v1/doctors/
```

Keep API URL construction centralized and verify endpoints after backend or frontend changes.

---

## 6. Backend Development Rule

When modifying the backend:

* Preserve existing API contracts.
* Do not delete existing database data unnecessarily.
* Do not change PostgreSQL configuration without a valid reason.
* Use Django ORM for database operations.
* Validate API input properly.
* Test authentication and protected APIs.
* Test doctors, availability, slots and appointments after changes.
* Never bypass authentication just to make a feature work.

**Principle:** Improve backend functionality without breaking existing APIs, database data, or frontend integration.

---

## 7. Backend API Endpoint Table

| Method    | Endpoint                             | Purpose                 |
| --------- | ------------------------------------ | ----------------------- |
| POST      | `/api/v1/login/`                     | User authentication     |
| GET       | `/api/v1/doctors/`                   | Get doctors             |
| GET       | `/api/v1/doctors/{id}/availability/` | Get doctor availability |
| GET       | `/api/v1/doctors/{id}/slots/`        | Get available slots     |
| POST      | `/api/v1/appointments/`              | Create appointment      |
| GET       | `/api/v1/appointments/`              | Get appointments        |
| GET       | `/api/v1/appointments/{id}/`         | Get appointment details |
| PUT/PATCH | `/api/v1/appointments/{id}/`         | Update appointment      |
| DELETE    | `/api/v1/appointments/{id}/`         | Cancel appointment      |

> **Note:** Endpoint names should match the actual Django URL configuration.

---

## 8. Request & Response Examples

### Login

**Request:**

```json
{
  "email": "patient@test.com",
  "password": "Patient@123"
}
```

**Response:**

```json
{
  "access": "jwt_access_token",
  "refresh": "jwt_refresh_token",
  "user": {
    "id": 1,
    "name": "Test Patient",
    "role": "patient"
  }
}
```

### Get Doctors

**Request:**

```http
GET /api/v1/doctors/
```

**Response:**

```json
[
  {
    "id": 3,
    "name": "Dr. Rajesh Kumar",
    "specialization": "Cardiology",
    "consultation_fee": 800
  },
  {
    "id": 4,
    "name": "Dr. Neha Verma",
    "specialization": "Dermatology",
    "consultation_fee": 700
  }
]
```

### Get Availability

**Request:**

```http
GET /api/v1/doctors/3/availability/
```

**Response:**

```json
{
  "doctor_id": 3,
  "today_available": true,
  "schedule": [
    {
      "day": "Monday",
      "start_time": "09:00",
      "end_time": "13:00"
    }
  ]
}
```

### Get Slots

**Request:**

```http
GET /api/v1/doctors/3/slots/
```

**Response:**

```json
[
  {
    "id": 101,
    "time": "09:00",
    "available": true
  },
  {
    "id": 102,
    "time": "09:30",
    "available": true
  }
]
```

### Create Appointment

**Request:**

```json
POST /api/v1/appointments/

{
  "doctor_id": 3,
  "slot_id": 101,
  "date": "2026-09-29"
}
```

**Response:**

```json
{
  "id": 501,
  "doctor_id": 3,
  "slot_id": 101,
  "status": "confirmed",
  "message": "Appointment booked successfully"
}
```

> **Note:** These examples are documentation examples. Actual request/response fields must match the project's implemented serializers and API responses.
