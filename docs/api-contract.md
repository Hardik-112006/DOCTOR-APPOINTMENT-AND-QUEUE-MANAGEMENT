# DoctorQueue API Contract (v1)

Base URL: `/api/v1`

---

## 1. Authentication & Profile

### 1.1 `POST /auth/login/`
Authenticate with email or phone number and password.

**Request Body:**
```json
{
  "username_or_email": "9000000001",
  "password": "Demo@123"
}
```

**Response (200 OK):**
```json
{
  "data": {
    "access": "eyJhbGciOi...",
    "refresh": "eyJhbGciOi...",
    "user": {
      "id": 1,
      "full_name": "Aarav Sharma",
      "email": "aarav.patient@example.com",
      "phone": "9000000001",
      "role": "PATIENT",
      "language": "en"
    }
  }
}
```

---

### 1.2 `POST /auth/register/`
Register a new patient.

**Request Body:**
```json
{
  "full_name": "John Doe",
  "phone": "9876543210",
  "email": "john.doe@example.com",
  "password": "Password123",
  "gender": "Male",
  "date_of_birth": "1990-01-01"
}
```

**Response (201 Created):**
```json
{
  "data": {
    "message": "Registration successful",
    "access": "eyJhbGciOi...",
    "refresh": "eyJhbGciOi...",
    "user": { ... }
  }
}
```

---

### 1.3 `GET /auth/me/`
Get current authenticated user profile.

**Headers:** `Authorization: Bearer <access_token>`

---

## 2. Departments & Doctors

### 2.1 `GET /departments/`
List all active clinic departments.

**Query Params:**
- `clinic_id` (optional, default 1)

---

### 2.2 `GET /doctors/`
List doctors with availability and department info.

**Query Params:**
- `clinic_id` (optional)
- `department_id` (optional)

---

### 2.3 `GET /doctors/{id}/slots/`
Get slots for a doctor on a specific date.

**Query Params:**
- `date` (format: `YYYY-MM-DD`, default today)

---

## 3. Appointments

### 3.1 `POST /appointments/book/`
Book an appointment and generate a queue token.

**Request Body:**
```json
{
  "doctor_id": 1,
  "appointment_date": "2026-09-29",
  "slot_id": 4,
  "booking_type": "ONLINE"
}
```

---

### 3.2 `GET /appointments/my-appointments/`
Get list of appointments for logged-in patient.

---

### 3.3 `POST /appointments/{id}/cancel/`
Cancel an appointment and free its slot and queue position.

---

## 4. Live Queue

### 4.1 `GET /queue/live/`
Get unified live queue for today.

**Query Params:**
- `date` (optional, default today)
- `doctor_id` (optional)
- `status` (optional: `WAITING`, `CALLED`, `CONSULTING`, `COMPLETED`)

---

### 4.2 `GET /queue/patient-status/`
Get live status, position, patients ahead, and dynamic ETA for patient's token.

**Query Params:**
- `appointment_id` (optional)
- `token_number` (optional)

---

### 4.3 `POST /queue/walk-in/`
Register walk-in patient directly into today's queue (Role: `RECEPTIONIST`, `ADMIN`).

**Request Body:**
```json
{
  "doctor_id": 1,
  "department_id": 1,
  "patient_name": "Ramesh Kumar",
  "patient_phone": "9876540001"
}
```

---

### 4.4 `POST /queue/call-next/`
Call the next waiting patient in line (Role: `DOCTOR`, `RECEPTIONIST`, `ADMIN`).

**Request Body:**
```json
{
  "doctor_id": 1
}
```

---

### 4.5 `POST /queue/update-status/`
Transition patient status across lifecycle (`WAITING` $\rightarrow$ `CALLED` $\rightarrow$ `CONSULTING` $\rightarrow$ `COMPLETED`).

---

### 4.6 `POST /queue/mark-arrived/`
Mark patient as arrived at the clinic.

---

## 5. Consultations

### 5.1 `GET /consultations/appointment/{appointment_id}/`
Get consultation details for an appointment.

---

### 5.2 `POST /consultations/save/`
Save clinical notes and prescription, optionally completing the consultation.

**Request Body:**
```json
{
  "appointment_id": 1,
  "notes": "Mild fever, blood pressure normal.",
  "prescription_notes": "Paracetamol 500mg, rest for 2 days.",
  "complete": true
}
```

---

## 6. Dashboard & Notifications

### 6.1 `GET /dashboard/metrics/`
Get live KPI counters, queue breakdown, and doctor availability.

### 6.2 `GET /notifications/`
Get user in-app notifications and unread badge count.

### 6.3 `POST /notifications/{id}/mark-read/`
Mark notification as read.
