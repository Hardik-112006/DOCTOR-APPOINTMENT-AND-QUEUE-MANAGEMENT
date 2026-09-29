# Doctor Appointment & Queue Management System (DoctorQueue)
## Demo & Training Guide

---

## 1. Prerequisites
- Python 3.12+ (tested with Python 3.14)
- PostgreSQL 14+ running locally on port `5432`
- Modern web browser (Chrome, Edge, Firefox, Safari)

---

## 2. PostgreSQL Setup & Environment Variables
Ensure PostgreSQL is running. The database `doctor_queue` is configured in `.env`:
```ini
DEBUG=True
SECRET_KEY=django-insecure-smartcare-doctorqueue-system-key-2026-prod-ready
ALLOWED_HOSTS=*
DB_NAME=doctor_queue
DB_USER=postgres
DB_PASSWORD=1234
DB_HOST=localhost
DB_PORT=5432
TIME_ZONE=Asia/Kolkata
```

---

## 3. Installation & Database Setup
Run the following commands in the project directory:

```bash
# Apply Django migrations
python manage.py migrate

# Seed realistic demo clinic, doctors, patients, and active queue state
python manage.py seed_demo --reset

# Start the Django development server
python manage.py runserver
```

Open your browser at `http://127.0.0.1:8000/`.

---

## 4. Demo User Accounts
All seeded accounts use the password: `Demo@123`

| Role | Name | Phone / Login Identifier | Email | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Patient** | Aarav Sharma | `9000000001` | `aarav.patient@example.com` | Primary Demo Patient (Token **A-27**, Position 4, 3 ahead, ETA 30m) |
| **Receptionist** | Priya Receptionist | `9000000002` | `reception@smartcare.example.com` | Unified queue desk, walk-ins |
| **Doctor** | Dr. Rajesh Kumar | `9000000003` | `rajesh.doctor@example.com` | General Physician |
| **Doctor** | Dr. Neha Verma | `9000000004` | `neha.doctor@example.com` | Cardiologist |
| **Admin** | Clinic Admin | `9000000005` | `admin@smartcare.example.com` | Clinic Operations & Audit Logs |

---

## 5. Demonstration Walkthrough

### Step 1: Patient Tracking Flow
1. Navigate to `http://127.0.0.1:8000/login/`.
2. Click the **Primary Patient (Token A-27)** 1-click card.
3. Click **Sign In to Dashboard**.
4. You are taken to the **Live Queue Tracker** (`/track/`):
   - Token: `#A-27`
   - Position: `4`
   - Patients Ahead: `3`
   - Dynamic ETA: `30 min`
   - Status: `WAITING`
   - 5-second polling actively updates the last sync timestamp.

### Step 2: Doctor Call Next & Consultation Flow
1. In a second browser tab/window, open `http://127.0.0.1:8000/login/`.
2. Click **Doctor Consultation (Dr. Rajesh Kumar)** and Sign In.
3. In the Doctor Desk (`/doctor/`):
   - You see token `A-24` currently in room (`CONSULTING`).
   - Click **Save & Complete Consultation**.
   - `A-24` completes. The next patient in line becomes eligible.
   - Click **Call Next Patient** $\rightarrow$ `A-25` is transitioned to `CALLED`.
4. Switch back to the Patient Tab (Aarav Sharma):
   - Watch the live ETA drop from 30 min to 20 min, and patients ahead drop from 3 to 2 automatically!

### Step 3: Turn Call Alert Demonstration
1. From Doctor Desk, continue advancing the queue until token `A-27` is called (`Call Next Patient`).
2. On Aarav Sharma's tracker screen:
   - Status changes to `CALLED`.
   - The large pulsing alert banner appears: **"Please Proceed to Consultation Room!"**.
   - In-app notification chime and notification bell update.

### Step 4: Receptionist Walk-In Flow
1. Sign in as **Priya Receptionist** (`9000000002` / `Demo@123`).
2. Go to **Reception Desk** (`/reception/`).
3. Click **+ Add Walk-In Patient**:
   - Select Doctor: Dr. Rajesh Kumar
   - Name: `Suresh Patel`
   - Phone: `9876500010`
   - Click **Issue Walk-In Token**.
4. Sequential token is created, and appears immediately in the unified queue table.

### Step 5: Clinic Admin Analytics
1. Sign in as **Clinic Admin** (`9000000005` / `Demo@123`).
2. Go to **Admin Overview** (`/dashboard/`).
3. View real-time KPI metrics, queue distribution bar, doctor availability roster, and the live activity audit logs stream.

---

## 6. Resetting / Reseeding Demo Data
To reset the entire clinic and queue back to the original clean demo state at any time:
```bash
python manage.py seed_demo --reset
```
