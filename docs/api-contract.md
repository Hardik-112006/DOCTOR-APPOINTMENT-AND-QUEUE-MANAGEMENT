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

---

## 7. Role Access, Validation & Staff (v2)

Every role only sees its own panel: patients `/track/` + `/book/`, receptionists `/reception/`, doctors `/doctor/`, admins `/dashboard/`. The site root `/` is the Sign In / Create Account page.

**Role restrictions now enforced by the API**
| Endpoint | Allowed |
| --- | --- |
| `POST /appointments/book/` | `PATIENT` (always booked as `ONLINE`) |
| `GET /queue/live/` | `DOCTOR` (own queue only), `RECEPTIONIST`, `ADMIN` |
| `GET /queue/patient-status/` | Patients see only their own entries; staff any |
| `GET /dashboard/*` | `ADMIN` |

**Booking rules** (`POST /appointments/book/` and walk-ins) — rejected with a readable `error.message` when: the date is in the past, the doctor is unavailable / not validated, the doctor does not consult on that weekday, today's sessions are over, or the chosen slot has already passed.

### 7.1 `POST /appointments/book/` — new optional fields
```json
{
  "doctor_id": 1, "appointment_date": "2026-10-15", "slot_id": 12,
  "problem_description": "Fever and cough for 3 days",
  "blood_group": "B+", "age": 30, "weight_kg": "68.5", "height_cm": "172"
}
```
Health fields are saved on the patient's profile.

### 7.2 `GET /queue/patient-status/` — `queue` snapshot
```json
"queue": {
  "is_today": true, "avg_consultation_minutes": 10,
  "ahead": {"total": 3, "in_room": 1, "walk_in": 1, "online": 2, "checked_in": 2, "not_checked_in": 1},
  "now_serving": {"token_number": "A-24", "status": "CONSULTING"},
  "total_waiting": 4, "completed_count": 1, "walk_in_total": 2,
  "expected_call_at": "2026-10-14T11:40:00+05:30",
  "board": [{"token_number": "A-24", "booking_type": "ONLINE", "status": "CONSULTING", "is_validated": true, "is_you": false}]
}
```
Queue order is token order (`queue_position`). People ahead = patients in the room + waiting patients with an earlier token. The board never includes names or phone numbers.

### 7.3 `POST /queue/validate/` (alias: `/queue/mark-arrived/`)
Receptionist validates (checks in) a patient. **Doctors can only call validated patients**; walk-ins are validated automatically. Body: `{"appointment_id": 1}`.

### 7.4 `POST /queue/remark/`
Receptionist's internal remark (never shown to patients). Body: `{"appointment_id": 1, "remark": "Fee paid"}`.

### 7.5 `POST /queue/walk-in/` — new optional fields
`problem_description`, `age`, `gender`, `blood_group`, `weight_kg`, `height_cm`. `department_id` is optional (defaults to the doctor's department).

### 7.6 `GET /doctors/roster/?date=YYYY-MM-DD`
Staff only. Summary (`total`, `on_duty`, `later_today`, `scheduled`, `off`) plus per doctor: `duty_status` (`ON_DUTY`, `LATER_TODAY`, `DONE_FOR_TODAY`, `SCHEDULED`, `OFF_TODAY`, `UNAVAILABLE`), today's `windows`, weekly `availabilities`, `waiting`, `waiting_validated`, `in_room`, `completed`, `now_serving`.

### 7.7 `PUT /doctors/{id}/schedule/`
Receptionist / admin sets check-in timings and availability. Either field may be sent alone; `availabilities` replaces the whole weekly schedule (overlaps rejected).
```json
{"is_available": true, "availabilities": [{"day_of_week": "MON", "start_time": "09:00", "end_time": "13:00"}]}
```
`GET /doctors/` and `GET /doctors/{id}/slots/` follow the current schedule; slots carry `is_past`, and the slots response includes `unavailable_reason` when booking is not possible.

### 7.8 Doctor remarks & history
- `POST /consultations/save/` accepts `doctor_remark` (private to the consulting doctor; hidden from patients, receptionists and the PDF). Saving a draft requires a started consultation (`CONSULTATION_NOT_STARTED`).
- `GET /consultations/attended/?q=&patient_id=&exclude_appointment_id=&limit=` — the doctor's own past consultations with remarks.
- `POST /consultations/appointment/{appointment_id}/remark/` — edit the remark later. Body: `{"doctor_remark": "..."}`.

### 7.9 Patient health profile
`PATCH /auth/me/` (patients): `gender`, `date_of_birth`, `age`, `blood_group`, `weight_kg`, `height_cm`. `GET /auth/me/` returns them (with computed `age`) under `patient`.

### 7.10 Staff accounts
- `POST /auth/register-staff/` (public) — doctor / receptionist sign-up request; stays `is_verified=false`. Login returns `403 ACCOUNT_PENDING_APPROVAL` until an admin approves.
  ```json
  {"role": "DOCTOR", "full_name": "Dr. New", "phone": "9000000099", "password": "Secret@123", "department_id": 3, "specialization": "Dermatology", "experience": 5, "consultation_fee": "600"}
  ```
- `GET /staff/?role=DOCTOR|RECEPTIONIST&status=pending|active|removed` (admin)
- `POST /staff/` (admin) — create an already-validated staff account (same body as above).
- `POST /staff/{user_id}/approve|reject|remove|restore/` (admin) — `reject` deletes a pending request; `remove` deactivates (history is kept) and `restore` reactivates.
