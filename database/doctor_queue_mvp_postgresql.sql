-- ============================================================
-- Doctor Appointment & Queue Management System
-- PostgreSQL MVP Database + Dummy Data
-- ============================================================
-- Compatible with PostgreSQL 14+
-- Run:
--   psql -U postgres -d doctor_queue -f doctor_queue_mvp.sql
--
-- WARNING: This script creates/recreates the MVP tables.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- CLEANUP (safe for a fresh/demo database)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS consultations CASCADE;
DROP TABLE IF EXISTS queue_entries CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS slots CASCADE;
DROP TABLE IF EXISTS doctor_availability CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS doctors CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS clinics CASCADE;

DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS appointment_booking_type CASCADE;
DROP TYPE IF EXISTS appointment_status CASCADE;
DROP TYPE IF EXISTS queue_status CASCADE;
DROP TYPE IF EXISTS consultation_status CASCADE;
DROP TYPE IF EXISTS slot_status CASCADE;

-- ------------------------------------------------------------
-- ENUMS
-- ------------------------------------------------------------

CREATE TYPE user_role AS ENUM (
    'PATIENT',
    'RECEPTIONIST',
    'DOCTOR',
    'ADMIN'
);

CREATE TYPE appointment_booking_type AS ENUM (
    'ONLINE',
    'WALK_IN'
);

CREATE TYPE appointment_status AS ENUM (
    'BOOKED',
    'WAITING',
    'CALLED',
    'CONSULTING',
    'COMPLETED',
    'CANCELLED'
);

CREATE TYPE queue_status AS ENUM (
    'WAITING',
    'CALLED',
    'CONSULTING',
    'COMPLETED'
);

CREATE TYPE consultation_status AS ENUM (
    'STARTED',
    'COMPLETED'
);

CREATE TYPE slot_status AS ENUM (
    'AVAILABLE',
    'BOOKED',
    'BLOCKED'
);

-- ============================================================
-- 1. CLINICS
-- ============================================================

CREATE TABLE clinics (
    id              BIGSERIAL PRIMARY KEY,
    name            VARCHAR(150) NOT NULL,
    address         TEXT,
    phone           VARCHAR(20),
    settings_json   JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 2. USERS
-- ============================================================

CREATE TABLE users (
    id              BIGSERIAL PRIMARY KEY,
    full_name       VARCHAR(150) NOT NULL,
    phone           VARCHAR(20) UNIQUE,
    email           VARCHAR(254) UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            user_role NOT NULL,
    language        VARCHAR(10) NOT NULL DEFAULT 'en'
                    CHECK (language IN ('en', 'hi')),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 3. DEPARTMENTS
-- ============================================================

CREATE TABLE departments (
    id              BIGSERIAL PRIMARY KEY,
    clinic_id       BIGINT NOT NULL REFERENCES clinics(id)
                    ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    specialty       VARCHAR(150),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (clinic_id, name)
);

-- ============================================================
-- 4. DOCTORS
-- ============================================================

CREATE TABLE doctors (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT NOT NULL UNIQUE REFERENCES users(id)
                        ON DELETE CASCADE,
    clinic_id           BIGINT NOT NULL REFERENCES clinics(id)
                        ON DELETE CASCADE,
    department_id       BIGINT NOT NULL REFERENCES departments(id)
                        ON DELETE RESTRICT,
    specialization      VARCHAR(150) NOT NULL,
    experience          INTEGER NOT NULL DEFAULT 0
                        CHECK (experience >= 0),
    consultation_fee    NUMERIC(10,2) NOT NULL DEFAULT 0
                        CHECK (consultation_fee >= 0),
    is_available        BOOLEAN NOT NULL DEFAULT TRUE
);

-- ============================================================
-- 5. PATIENTS
-- ============================================================

CREATE TABLE patients (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL UNIQUE REFERENCES users(id)
                    ON DELETE CASCADE,
    date_of_birth   DATE,
    gender          VARCHAR(30),
    phone           VARCHAR(20),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 6. DOCTOR AVAILABILITY
-- ============================================================

CREATE TABLE doctor_availability (
    id              BIGSERIAL PRIMARY KEY,
    doctor_id       BIGINT NOT NULL REFERENCES doctors(id)
                    ON DELETE CASCADE,
    day_of_week     VARCHAR(10) NOT NULL
                    CHECK (day_of_week IN
                    ('MON','TUE','WED','THU','FRI','SAT','SUN')),
    start_time      TIME NOT NULL,
    end_time        TIME NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    CHECK (end_time > start_time)
);

-- ============================================================
-- 7. SLOTS
-- ============================================================

CREATE TABLE slots (
    id              BIGSERIAL PRIMARY KEY,
    doctor_id       BIGINT NOT NULL REFERENCES doctors(id)
                    ON DELETE CASCADE,
    slot_date       DATE NOT NULL,
    start_time      TIME NOT NULL,
    end_time        TIME NOT NULL,
    capacity        INTEGER NOT NULL DEFAULT 1
                    CHECK (capacity > 0),
    status          slot_status NOT NULL DEFAULT 'AVAILABLE',
    CHECK (end_time > start_time),
    UNIQUE (doctor_id, slot_date, start_time)
);

-- ============================================================
-- 8. APPOINTMENTS
-- ============================================================

CREATE TABLE appointments (
    id                      BIGSERIAL PRIMARY KEY,
    patient_id              BIGINT NOT NULL REFERENCES patients(id)
                            ON DELETE RESTRICT,
    doctor_id               BIGINT NOT NULL REFERENCES doctors(id)
                            ON DELETE RESTRICT,
    department_id           BIGINT NOT NULL REFERENCES departments(id)
                            ON DELETE RESTRICT,
    slot_id                 BIGINT REFERENCES slots(id)
                            ON DELETE SET NULL,
    appointment_date        DATE NOT NULL,
    booking_type            appointment_booking_type NOT NULL,
    token_number            VARCHAR(30) NOT NULL,
    status                  appointment_status NOT NULL DEFAULT 'BOOKED',
    estimated_wait_minutes  INTEGER NOT NULL DEFAULT 0
                            CHECK (estimated_wait_minutes >= 0),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (appointment_date, doctor_id, token_number)
);

-- Prevent a patient from getting two active bookings for the same doctor/date.
CREATE UNIQUE INDEX uq_active_patient_doctor_date
ON appointments (patient_id, doctor_id, appointment_date)
WHERE status <> 'CANCELLED';

-- ------------------------------------------------------------
-- Token numbering helper
-- ------------------------------------------------------------
CREATE INDEX idx_appointments_date_status
ON appointments (appointment_date, status);

CREATE INDEX idx_appointments_patient
ON appointments (patient_id);

CREATE INDEX idx_appointments_doctor_date
ON appointments (doctor_id, appointment_date);

-- ============================================================
-- 9. QUEUE ENTRIES
-- ============================================================

CREATE TABLE queue_entries (
    id                      BIGSERIAL PRIMARY KEY,
    appointment_id          BIGINT NOT NULL UNIQUE REFERENCES appointments(id)
                            ON DELETE CASCADE,
    queue_date              DATE NOT NULL,
    queue_position          INTEGER NOT NULL CHECK (queue_position > 0),
    patients_ahead          INTEGER NOT NULL DEFAULT 0
                            CHECK (patients_ahead >= 0),
    eta_minutes             INTEGER NOT NULL DEFAULT 0
                            CHECK (eta_minutes >= 0),
    status                  queue_status NOT NULL DEFAULT 'WAITING',
    arrival_time            TIMESTAMPTZ,
    called_at               TIMESTAMPTZ,
    consultation_started_at TIMESTAMPTZ,
    completed_at            TIMESTAMPTZ,

    UNIQUE (queue_date, appointment_id),
    UNIQUE (queue_date, queue_position)
);

CREATE INDEX idx_queue_today_status
ON queue_entries (queue_date, status);

-- ============================================================
-- 10. CONSULTATIONS
-- ============================================================

CREATE TABLE consultations (
    id                  BIGSERIAL PRIMARY KEY,
    appointment_id      BIGINT NOT NULL UNIQUE REFERENCES appointments(id)
                        ON DELETE CASCADE,
    doctor_id           BIGINT NOT NULL REFERENCES doctors(id)
                        ON DELETE RESTRICT,
    patient_id          BIGINT NOT NULL REFERENCES patients(id)
                        ON DELETE RESTRICT,
    notes               TEXT,
    prescription_notes  TEXT,
    status              consultation_status NOT NULL DEFAULT 'STARTED',
    started_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at        TIMESTAMPTZ
);

CREATE INDEX idx_consultations_doctor
ON consultations (doctor_id);

CREATE INDEX idx_consultations_patient
ON consultations (patient_id);

-- ============================================================
-- 11. NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id)
                    ON DELETE CASCADE,
    appointment_id  BIGINT REFERENCES appointments(id)
                    ON DELETE SET NULL,
    type            VARCHAR(50) NOT NULL,
    message         TEXT NOT NULL,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user
ON notifications (user_id, is_read, sent_at DESC);

-- ============================================================
-- 12. ACTIVITY LOGS
-- ============================================================

CREATE TABLE activity_logs (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT REFERENCES users(id)
                    ON DELETE SET NULL,
    clinic_id       BIGINT REFERENCES clinics(id)
                    ON DELETE SET NULL,
    action          VARCHAR(100) NOT NULL,
    entity_type     VARCHAR(50),
    entity_id       BIGINT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activity_logs_clinic_time
ON activity_logs (clinic_id, created_at DESC);

-- ============================================================
-- DUMMY DATA
-- ============================================================

-- ------------------------------------------------------------
-- CLINIC
-- ------------------------------------------------------------

INSERT INTO clinics
(name, address, phone, settings_json)
VALUES
(
    'SmartCare Clinic',
    'Sector 62, Noida, Uttar Pradesh',
    '+91-9876500001',
    '{
        "defaultLanguage": "en",
        "supportedLanguages": ["en", "hi"],
        "averageConsultationMinutes": 10,
        "queueRefreshSeconds": 5
    }'::jsonb
);

-- ------------------------------------------------------------
-- USERS
-- Demo password for all accounts:
-- "Demo@123"
--
-- The hash below is a bcrypt-compatible demo hash.
-- If using Django authentication, let Django create/set
-- the password instead of relying on this raw SQL hash.
-- ------------------------------------------------------------

INSERT INTO users
(full_name, phone, email, password_hash, role, language)
VALUES
('Aarav Sharma', '9000000001', 'aarav.patient@example.com',
 '$2b$12$LQv3c1yqBW1gYx5M8VfY0u9qJ8F6Jf5K3qJq8gQ0m6H6f2m8sY7iK',
 'PATIENT', 'en'),

('Priya Receptionist', '9000000002', 'reception@smartcare.example.com',
 '$2b$12$LQv3c1yqBW1gYx5M8VfY0u9qJ8F6Jf5K3qJq8gQ0m6H6f2m8sY7iK',
 'RECEPTIONIST', 'en'),

('Dr. Rajesh Kumar', '9000000003', 'rajesh.doctor@example.com',
 '$2b$12$LQv3c1yqBW1gYx5M8VfY0u9qJ8F6Jf5K3qJq8gQ0m6H6f2m8sY7iK',
 'DOCTOR', 'en'),

('Dr. Neha Verma', '9000000004', 'neha.doctor@example.com',
 '$2b$12$LQv3c1yqBW1gYx5M8VfY0u9qJ8F6Jf5K3qJq8gQ0m6H6f2m8sY7iK',
 'DOCTOR', 'hi'),

('Clinic Admin', '9000000005', 'admin@smartcare.example.com',
 '$2b$12$LQv3c1yqBW1gYx5M8VfY0u9qJ8F6Jf5K3qJq8gQ0m6H6f2m8sY7iK',
 'ADMIN', 'en'),

('Meera Singh', '9000000006', 'meera.patient@example.com',
 '$2b$12$LQv3c1yqBW1gYx5M8VfY0u9qJ8F6Jf5K3qJq8gQ0m6H6f2m8sY7iK',
 'PATIENT', 'hi'),

('Kabir Gupta', '9000000007', 'kabir.patient@example.com',
 '$2b$12$LQv3c1yqBW1gYx5M8VfY0u9qJ8F6Jf5K3qJq8gQ0m6H6f2m8sY7iK',
 'PATIENT', 'en'),

('Ananya Patel', '9000000008', 'ananya.patient@example.com',
 '$2b$12$LQv3c1yqBW1gYx5M8VfY0u9qJ8F6Jf5K3qJq8gQ0m6H6f2m8sY7iK',
 'PATIENT', 'en'),

('Rohan Mehta', '9000000009', 'rohan.patient@example.com',
 '$2b$12$LQv3c1yqBW1gYx5M8VfY0u9qJ8F6Jf5K3qJq8gQ0m6H6f2m8sY7iK',
 'PATIENT', 'en');

-- ------------------------------------------------------------
-- DEPARTMENTS
-- ------------------------------------------------------------

INSERT INTO departments
(clinic_id, name, specialty)
VALUES
(1, 'General Medicine', 'General Physician'),
(1, 'Cardiology', 'Heart & Cardiovascular Care'),
(1, 'Dermatology', 'Skin & Hair');

-- ------------------------------------------------------------
-- DOCTORS
-- ------------------------------------------------------------

INSERT INTO doctors
(user_id, clinic_id, department_id, specialization, experience, consultation_fee, is_available)
VALUES
(3, 1, 1, 'General Physician', 10, 500.00, TRUE),
(4, 1, 2, 'Cardiologist', 8, 800.00, TRUE);

-- ------------------------------------------------------------
-- PATIENTS
-- ------------------------------------------------------------

INSERT INTO patients
(user_id, date_of_birth, gender, phone)
VALUES
(1, '2002-05-15', 'Male', '9000000001'),
(6, '1998-08-22', 'Female', '9000000006'),
(7, '1995-11-10', 'Male', '9000000007'),
(8, '2001-02-18', 'Female', '9000000008'),
(9, '1992-07-03', 'Male', '9000000009');

-- ------------------------------------------------------------
-- DOCTOR AVAILABILITY
-- ------------------------------------------------------------

INSERT INTO doctor_availability
(doctor_id, day_of_week, start_time, end_time)
VALUES
(1, 'MON', '09:00', '13:00'),
(1, 'TUE', '09:00', '13:00'),
(1, 'WED', '09:00', '13:00'),
(1, 'THU', '09:00', '13:00'),
(1, 'FRI', '09:00', '13:00'),
(1, 'SAT', '09:00', '12:00'),

(2, 'MON', '14:00', '18:00'),
(2, 'TUE', '14:00', '18:00'),
(2, 'WED', '14:00', '18:00'),
(2, 'THU', '14:00', '18:00'),
(2, 'FRI', '14:00', '18:00');

-- ------------------------------------------------------------
-- SLOTS
-- Use today's date for the demo booking day.
-- ------------------------------------------------------------

INSERT INTO slots
(doctor_id, slot_date, start_time, end_time, capacity, status)
VALUES
(1, CURRENT_DATE, '09:00', '09:10', 1, 'BOOKED'),
(1, CURRENT_DATE, '09:10', '09:20', 1, 'BOOKED'),
(1, CURRENT_DATE, '09:20', '09:30', 1, 'BOOKED'),
(1, CURRENT_DATE, '09:30', '09:40', 1, 'AVAILABLE'),
(1, CURRENT_DATE, '09:40', '09:50', 1, 'AVAILABLE'),
(1, CURRENT_DATE, '09:50', '10:00', 1, 'AVAILABLE'),

(2, CURRENT_DATE, '14:00', '14:15', 1, 'AVAILABLE'),
(2, CURRENT_DATE, '14:15', '14:30', 1, 'AVAILABLE'),
(2, CURRENT_DATE, '14:30', '14:45', 1, 'AVAILABLE'),
(2, CURRENT_DATE, '14:45', '15:00', 1, 'AVAILABLE');

-- ------------------------------------------------------------
-- APPOINTMENTS
--
-- Demo queue:
-- A-24 = CONSULTING
-- A-25 = WAITING
-- A-26 = WAITING
-- A-27 = WAITING  <-- primary patient
-- A-28 = COMPLETED
-- ------------------------------------------------------------

INSERT INTO appointments
(patient_id, doctor_id, department_id, slot_id, appointment_date,
 booking_type, token_number, status, estimated_wait_minutes)
VALUES
(2, 1, 1, 1, CURRENT_DATE, 'ONLINE',  'A-24', 'CONSULTING',  0),
(3, 1, 1, 2, CURRENT_DATE, 'ONLINE',  'A-25', 'WAITING',     10),
(4, 1, 1, 3, CURRENT_DATE, 'WALK_IN', 'A-26', 'WAITING',     20),
(1, 1, 1, NULL, CURRENT_DATE, 'ONLINE', 'A-27', 'WAITING',   30),
(5, 1, 1, NULL, CURRENT_DATE, 'WALK_IN', 'A-28', 'COMPLETED', 0);

-- ------------------------------------------------------------
-- QUEUE
-- ------------------------------------------------------------

INSERT INTO queue_entries
(appointment_id, queue_date, queue_position, patients_ahead,
 eta_minutes, status, arrival_time, called_at,
 consultation_started_at, completed_at)
VALUES
(
    1, CURRENT_DATE, 1, 0, 0, 'CONSULTING',
    CURRENT_TIMESTAMP - INTERVAL '18 minutes',
    CURRENT_TIMESTAMP - INTERVAL '8 minutes',
    CURRENT_TIMESTAMP - INTERVAL '7 minutes',
    NULL
),
(
    2, CURRENT_DATE, 2, 1, 10, 'WAITING',
    CURRENT_TIMESTAMP - INTERVAL '15 minutes',
    NULL, NULL, NULL
),
(
    3, CURRENT_DATE, 3, 2, 20, 'WAITING',
    CURRENT_TIMESTAMP - INTERVAL '12 minutes',
    NULL, NULL, NULL
),
(
    4, CURRENT_DATE, 4, 3, 30, 'WAITING',
    CURRENT_TIMESTAMP - INTERVAL '8 minutes',
    NULL, NULL, NULL
),
(
    5, CURRENT_DATE, 5, 0, 0, 'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '90 minutes',
    CURRENT_TIMESTAMP - INTERVAL '85 minutes',
    CURRENT_TIMESTAMP - INTERVAL '84 minutes',
    CURRENT_TIMESTAMP - INTERVAL '74 minutes'
);

-- ------------------------------------------------------------
-- CONSULTATION
-- ------------------------------------------------------------

INSERT INTO consultations
(appointment_id, doctor_id, patient_id, notes, prescription_notes, status,
 started_at, completed_at)
VALUES
(
    1,
    1,
    2,
    'Patient reports mild fever and headache for two days.',
    'Paracetamol 500mg after meals if required. Adequate fluids and rest.',
    'STARTED',
    CURRENT_TIMESTAMP - INTERVAL '7 minutes',
    NULL
),
(
    5,
    1,
    5,
    'Routine consultation completed.',
    'Continue prescribed medication and follow-up after 7 days.',
    'COMPLETED',
    CURRENT_TIMESTAMP - INTERVAL '84 minutes',
    CURRENT_TIMESTAMP - INTERVAL '74 minutes'
);

-- ------------------------------------------------------------
-- NOTIFICATIONS
-- ------------------------------------------------------------

INSERT INTO notifications
(user_id, appointment_id, type, message, is_read, sent_at)
VALUES
(
    1, 4, 'QUEUE_UPDATE',
    'Your token A-27 is confirmed. There are 3 patients ahead of you.',
    FALSE,
    CURRENT_TIMESTAMP - INTERVAL '5 minutes'
),
(
    1, 4, 'ETA_UPDATE',
    'Estimated waiting time is approximately 30 minutes.',
    FALSE,
    CURRENT_TIMESTAMP - INTERVAL '4 minutes'
),
(
    6, 1, 'CONSULTATION_STARTED',
    'Consultation has started. Please wait for further instructions.',
    TRUE,
    CURRENT_TIMESTAMP - INTERVAL '6 minutes'
),
(
    5, 5, 'CONSULTATION_COMPLETED',
    'Consultation for token A-28 has been completed.',
    TRUE,
    CURRENT_TIMESTAMP - INTERVAL '70 minutes'
);

-- ------------------------------------------------------------
-- ACTIVITY LOGS
-- ------------------------------------------------------------

INSERT INTO activity_logs
(user_id, clinic_id, action, entity_type, entity_id)
VALUES
(5, 1, 'DASHBOARD_VIEWED', 'CLINIC', 1),
(2, 1, 'QUEUE_VIEWED', 'QUEUE', 1),
(2, 1, 'WALK_IN_REGISTERED', 'APPOINTMENT', 3),
(3, 1, 'CALL_NEXT_PATIENT', 'APPOINTMENT', 1),
(3, 1, 'CONSULTATION_STARTED', 'CONSULTATION', 1),
(1, 1, 'APPOINTMENT_BOOKED', 'APPOINTMENT', 4),
(4, 1, 'DOCTOR_AVAILABILITY_UPDATED', 'DOCTOR', 2);

-- ============================================================
-- HELPFUL VIEWS FOR THE MVP
-- ============================================================

-- Current live queue
CREATE OR REPLACE VIEW live_queue AS
SELECT
    q.id AS queue_id,
    q.queue_date,
    q.queue_position,
    q.patients_ahead,
    q.eta_minutes,
    q.status AS queue_status,
    a.id AS appointment_id,
    a.token_number,
    a.booking_type,
    a.status AS appointment_status,
    p.id AS patient_id,
    u.full_name AS patient_name,
    d.id AS doctor_id,
    du.full_name AS doctor_name,
    dep.name AS department
FROM queue_entries q
JOIN appointments a ON a.id = q.appointment_id
JOIN patients p ON p.id = a.patient_id
JOIN users u ON u.id = p.user_id
JOIN doctors d ON d.id = a.doctor_id
JOIN users du ON du.id = d.user_id
JOIN departments dep ON dep.id = a.department_id
WHERE q.queue_date = CURRENT_DATE
ORDER BY q.queue_position;

-- Today's dashboard summary
CREATE OR REPLACE VIEW today_dashboard AS
SELECT
    COUNT(*) AS total_queue_entries,
    COUNT(*) FILTER (WHERE status = 'WAITING') AS waiting_patients,
    COUNT(*) FILTER (WHERE status = 'CALLED') AS called_patients,
    COUNT(*) FILTER (WHERE status = 'CONSULTING') AS consulting_patients,
    COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed_patients
FROM queue_entries
WHERE queue_date = CURRENT_DATE;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- SELECT * FROM live_queue;
-- SELECT * FROM today_dashboard;
-- SELECT * FROM appointments ORDER BY id;
-- SELECT * FROM consultations ORDER BY id;
-- SELECT * FROM notifications ORDER BY id;
-- SELECT * FROM activity_logs ORDER BY id;

COMMIT;
