# 🏥 Doctor Appointment & Queue Management System (DoctorQueue)

### Django + DRF + PostgreSQL + Django Templates + Tailwind CSS + Vanilla JavaScript

DoctorQueue is a web-based Doctor Appointment & Queue Management System designed for small clinics to reduce waiting-time uncertainty, manage appointments and walk-ins, and provide real-time queue visibility.

The system connects **patients, receptionists, doctors, and clinic administrators** through a unified appointment and queue management workflow.

---

## 🚀 Key Features

> The site opens on **Sign In / Create Account** (seeded demo accounts are listed there for one-click sign-in).
> Each role sees only its own panel — patients never see reception, doctor or admin pages, and vice versa.
>
> **Flow:** Patient books (optional problem description + health details) → token issued → **receptionist validates the patient on arrival** (walk-ins are validated at registration) → doctor calls validated patients in token order → consultation with timer, notes, private remark and prescription → patient (or receptionist, for walk-ins) downloads the prescription PDF.

### 1. Patient Portal

* Search and discover available doctors and specialties.
* View doctor fees, schedules, and available slots.
* Book appointments and generate queue tokens.
* Prevent double-booking of appointment slots.
* Track live queue position: people ahead of you (split into walk-in / online and checked-in / not yet arrived), now-serving token, expected turn time and an anonymised token board.
* View estimated waiting time (ETA).
* Receive turn/call and check-in notifications.
* Clear booking result — a confirmation with the token, or a "not booked" message with the exact reason.
* Optional problem description at booking; health profile (blood group, age, weight, height).
* Past appointment history with prescription PDF download; English & Hindi.

### 2. Receptionist Queue Control

* Manage online appointments and walk-in patients from one queue.
* Register walk-in patients.
* Generate sequential queue tokens.
* Validate (check in) patients — doctors can call only validated patients.
* Internal remarks per appointment, cancel tokens, download walk-in patients' prescriptions (any date).
* Set doctors' weekly check-in timings and mark doctors available / unavailable.
* Doctors roster: how many doctors, who is on duty now, timings and queue load.

### 3. Doctor Consultation Desk

* View the current waiting queue.
* Call the next patient.
* Update patient consultation status.
* See the patient's problem description and health details (age, blood group, weight, height, BMI).
* Add clinical notes and prescriptions; consultation timer; prescription PDF.
* Private remark for each attended patient, with previous-visit history and an "Attended Patients" list.
* Manage consultation flow:

`CALLED → CONSULTING → COMPLETED`

### 4. Clinic Admin Dashboard

* View total appointments and tokens.
* Monitor patients currently in queue.
* Track average waiting time.
* Monitor active doctors.
* View queue activity and operational information.
* Staff management: add, validate (approve / reject sign-up requests), remove and restore doctors and receptionists.

### 5. Backend & Queue Management

* PostgreSQL as the main database.
* JWT-based authentication.
* Role-based access control.
* Atomic token generation.
* Concurrency-safe queue operations using `select_for_update`.
* Service-layer architecture for appointment, queue, consultation, dashboard, and notification operations.

---

## 🛠️ Tech Stack

| Layer           | Technology                                 |
| --------------- | ------------------------------------------ |
| Backend         | Python, Django 5.1+, Django REST Framework |
| Authentication  | SimpleJWT                                  |
| Database        | PostgreSQL                                 |
| Frontend        | Django Templates, HTML5, Tailwind CSS      |
| JavaScript      | Vanilla JavaScript, Fetch API              |
| API             | REST API                                   |
| Database Driver | psycopg                                    |
| Architecture    | Django Service Layer                       |

---

## 📂 Project Structure

### 🎨 Frontend

The **Frontend** folder contains the user interface, templates, styling, JavaScript logic, and role-based screens used by patients, receptionists, doctors, and administrators.

### ⚙️ Backend

The **Backend** folder contains the Django project, REST APIs, models, serializers, views, authentication, business logic, queue services, and application-level functionality.

### 🗄️ Database

The **Database** folder contains database-related files such as SQL scripts, schema information, seed/demo data, and PostgreSQL setup information.

### 🔗 API Contract

The **API Contract** folder contains the documented API endpoints, request/response structures, authentication requirements, and communication rules between the frontend and backend.

---

## 📚 Project Documentation

* [`features.md`](features.md) — MVP scope, modules, technical requirements, and database-related information.
* [`DOCTOR APPOINTMENT AND QUEUE MANAGEMENT.docx`](DOCTOR%20APPOINTMENT%20AND%20QUEUE%20MANAGEMENT.docx) — Research, pain points, personas, gap analysis, and project background.

---

## 👥 User Roles

| Role             | Responsibilities                                                          |
| ---------------- | ------------------------------------------------------------------------- |
| **Patient**      | Book appointments, generate tokens, track queue and receive notifications |
| **Receptionist** | Manage appointments, walk-ins, check-ins and queue                        |
| **Doctor**       | Manage waiting patients, consultations, notes and prescriptions           |
| **Admin**        | Monitor clinic operations, doctors, appointments and analytics            |

---

## ⚡ Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/Hardik-112006/DOCTOR-APPOINTMENT-AND-QUEUE-MANAGEMENT.git
cd DOCTOR-APPOINTMENT-AND-QUEUE-MANAGEMENT
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Environment

Create a `.env` file and configure your PostgreSQL database and Django settings.

Example:

```ini
DEBUG=True
SECRET_KEY=your-secret-key
ALLOWED_HOSTS=*
DB_NAME=doctor_queue
DB_USER=postgres
DB_PASSWORD=your-password
DB_HOST=localhost
DB_PORT=5432
TIME_ZONE=Asia/Kolkata
```

### 4. Apply Migrations

```bash
python manage.py migrate
```

### 5. Load Demo Data

```bash
python manage.py seed_demo --reset
```

### 6. Run the Development Server

```bash
python manage.py runserver
```

Open:

```text
http://127.0.0.1:8000/
```

---

## 🧪 Running Tests

Run the Django test suite using:

```bash
python manage.py test
```

---

## 🔐 Authentication

The system uses **JWT authentication with Django REST Framework SimpleJWT**.

Different roles are provided with role-specific access and functionality:

* Patient
* Receptionist
* Doctor
* Admin

---

## 🔄 Core System Flow

```text
Patient
   ↓
Book Appointment / Get Token
   ↓
Unified Queue
   ↓
Live Queue Tracking
   ↓
Dynamic ETA
   ↓
Doctor Calls Patient
   ↓
Consultation
   ↓
Completed
```

At the same time:

```text
Receptionist → Appointment & Queue Management
Doctor       → Consultation Management
Admin        → Clinic Monitoring & Analytics
```

---

## 🎯 Problem Statement

Small clinics often face:

* Long and unpredictable waiting times
* Manual token management
* Overcrowded waiting areas
* Poor visibility of queue status
* Difficulty coordinating patients, receptionists, and doctors
* Lack of real-time waiting-time information

### Solution

DoctorQueue provides a unified digital system where patients can book appointments and track their queue while clinic staff can manage appointments, walk-ins, consultations, and daily operations from role-specific dashboards.

---

## 📌 Future Enhancements

* QR-based patient check-in
* SMS/WhatsApp notifications
* Multi-language support
* Advanced clinic analytics
* Multiple clinic/branch management
* Improved real-time notification infrastructure
* Cloud deployment and production monitoring

---

## 👨‍💻 Project

**Doctor Appointment & Queue Management System — DoctorQueue**

Built using **Django, Django REST Framework, PostgreSQL, Django Templates, Tailwind CSS, and Vanilla JavaScript**.
