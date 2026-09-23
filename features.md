# 🏥 Features — Doctor Appointment & Queue Management

## 1. 🎯 MVP — MoSCoW

| Priority | Feature |
|---|---|
| 🔴 Must Have | Login & role-based access |
| 🔴 Must Have | Admin: add doctors/staff and create sessions |
| 🔴 Must Have | Doctor sessions with a token limit (e.g. Dr. Sharma, Morning 10:00–13:00, max 30 tokens) |
| 🔴 Must Have | Token booking |
| 🔴 Must Have | Unified online + walk-in queue |
| 🔴 Must Have | Live queue position (auto-refresh every 20 seconds) |
| 🔴 Must Have | Dynamic ETA |
| 🔴 Must Have | Doctor & receptionist dashboards |
| 🔴 Must Have | Token status: Waiting → Called → Consulting → Completed (plus Skipped and Cancelled) |
| 🟠 Should Have | Instant real-time updates (push instead of the 20-second refresh) |
| 🟠 Should Have | Turn notifications (in-app) |
| 🟠 Should Have | Patient check-in |
| 🟡 Could Have | QR check-in |
| 🟡 Could Have | English + Hindi |
| 🟡 Could Have | Basic analytics |
| 🟡 Could Have | Basic queue prediction |
| ⚪ Won't Have | Payments, video consultation, EMR, prescription management, AI diagnosis |

## 2. ⚙️ Main Modules / Features

### 👤 Patient
- View doctors & sessions
- Book token
- Live queue tracking
- ETA
- Notifications
- QR check-in
- English/Hindi

### 👨‍💼 Receptionist
- Manage queue
- Add walk-ins
- Manage tokens
- Verify arrivals
- Monitor appointments

### 👨‍⚕️ Doctor
- View patient queue
- Call next patient
- Start/complete consultation
- Skip patient
- Update delay

### 🏥 Admin
- Manage doctors/staff
- Configure sessions and token limits
- Monitor queues
- Basic analytics

### 🔄 Queue Engine ⭐
- Unified queue
- Real-time position
- Patients ahead
- Dynamic ETA
- Automatic queue movement

## 3. 🔍 Gap Analysis

| Existing Solution Gap | Our Solution |
|---|---|
| Appointment booking doesn't show the actual live queue | Live token + queue position |
| Patients don't know how long they will actually wait | Dynamic ETA |
| Online appointments and walk-ins can create queue confusion | Unified queue |
| Queue changes aren't always visible immediately | Real-time updates + notifications |
| Physical arrival/check-in can remain manual | QR check-in |
| Interfaces may not suit every local patient | English + Hindi support |

## 4. 🛠️ Technical Rules

### Accounts & roles
- Public sign-up creates **Patient** accounts only. Doctor, Receptionist and Admin accounts are created by the Admin. The first Admin is created by a seed script.
- The server checks the user's role on every request. A doctor can only act on their own sessions.

### Sessions & tokens
- A doctor's day is split into sessions (for example Morning 10:00–13:00). Patients book a session, not an exact time, and get the next token number.
- Walk-ins get the next token number in the same session, so online and walk-in patients share one queue.
- Token numbers are unique per session (the database enforces this), so two bookings at the same moment can never get the same number.
- Booking is refused when the session reaches its token limit. The limit is checked in the same database step that creates the token, so two last-minute bookings cannot overbook.
- A patient can hold only one active token per session (this is "Prevent duplicate booking").
- Walk-ins don't need an account. The receptionist enters their name and phone number.

### Token statuses

| Status | Set by | Meaning |
|---|---|---|
| Waiting | System, on booking | In the queue |
| Called | Doctor (Call Next) | Asked to come in |
| Consulting | Doctor (Start) | In consultation |
| Completed | Doctor (Complete) | Consultation finished |
| Skipped | Doctor (Skip) | Called but not present |
| Cancelled | Patient or Receptionist | Token cancelled |

### Queue order
- Call Next picks the lowest token number that is Waiting (and has checked in, once check-in is built).
- Call Next works only when the doctor has no patient in Called or Consulting, so a double tap cannot call two patients.
- A Skipped patient who arrives late can be moved back to Waiting by the receptionist. They keep their token number, so they are called next.
- Queue position is never saved in the database. It is calculated each time: patients ahead = Waiting and Called tokens in the same session with a lower token number. Position = patients ahead + 1.

### ETA

```text
average   = the doctor's average over the last 10 completed consultations
            (use 8 min until there are 5 completed consultations)
remaining = time left in the current consultation (at least 1 min)
ETA       = remaining + (patients ahead × average) + doctor's delay
```

- If the session has not started yet, add the time left until the session starts.
- Consultation time is saved as `consult_started_at` and `completed_at` timestamps, not as a timer running in the browser, so a page refresh never loses it.
- "Update delay" sets the delay for that session only. The doctor can set it back to 0.

### Live updates
- MVP: patient and dashboard screens reload the queue every 20 seconds, and straight after the user's own action. Instant push (WebSocket) is a Should-have.
- The patient screen receives only token numbers, counts and the ETA. It never receives other patients' names or phone numbers.

### Check-in & QR
- Check-in saves `arrived_at` on the token.
- The QR code holds a random check-in code, not the token number, so nobody can check someone else in by guessing.
- The QR is scanned from the receptionist's logged-in screen, so a patient cannot check in from home. Manual check-in stays as a fallback.

### Dates & language
- "Today" and all displayed times use Indian time (Asia/Kolkata). Times are stored in UTC.
- All screen text is kept in `en.json` from the start, so adding `hi.json` for Hindi later needs no code changes.

## 5. 🗄️ Database Tables

| Table | Fields |
|---|---|
| users | id, name, phone, email, password (hashed), role (patient, receptionist, doctor, admin) |
| doctors | id, user_id, specialization |
| sessions | id, doctor_id, date, start_time, end_time, max_tokens, delay_min |
| tokens | id, session_id, token_no, patient_id (empty for walk-ins), walk_in_name, walk_in_phone, source (online, walk_in), status, checkin_code, arrived_at, called_at, consult_started_at, completed_at |

Rules:
- `tokens`: unique (session_id, token_no).
- `tokens`: one active token per patient per session.
