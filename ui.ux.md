## UI/UX Design

Designed the complete **DoctorQueue UI/UX** for patients, receptionists, doctors, and clinic admins, covering login, appointment booking, live queue tracking, queue control, consultation, and clinic overview.

- Clean, responsive, role-based interface with clear user flows.
- Loading, empty, error, and success states across screens.
- Improved using 5 real-world UX rules:
  - Real-time data freshness
  - Consistent date formatting
  - 44px+ mobile touch targets
  - WCAG AA color contrast
  - Consistent **Retry** actions
- Implemented as a **static Tailwind CSS HTML skeleton**, ready for API/backend integration.

### User Flow

![DoctorQueue UI/UX User Flow](uiux%20userflow.png)

### Key Screens

| Screen | User | Purpose |
|---|---|---|
| Login / Role Access | All users | Secure role-based entry |
| Book Appointment | Patient | Select doctor, slot and get token |
| Live Queue | Patient | Track token, position and ETA |
| Queue Control | Receptionist | Manage online + walk-in patients |
| Doctor Consultation | Doctor | Manage queue and consultation |
| Clinic Overview | Admin | Monitor clinic performance |

### UX Principles

**Clarity → Accessibility → Real-time Feedback → Consistency → Error Recovery**

The interface is designed to reduce waiting uncertainty for patients and simplify queue management for clinic staff.
