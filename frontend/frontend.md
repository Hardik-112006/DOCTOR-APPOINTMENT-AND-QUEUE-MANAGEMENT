# Frontend

## 1. Frontend Summary

The frontend provides the user interface for the Doctor Appointment & Queue Management System.

It handles:

* Login & authentication UI
* Doctor listing and selection
* Doctor availability
* Appointment slot selection
* Appointment summary
* Responsive and interactive UI
* API-based dynamic data rendering

---

## 2. Frontend Tech Stack

| Technology       | Purpose                     |
| ---------------- | --------------------------- |
| HTML5            | Page structure              |
| CSS3             | Styling & responsive design |
| JavaScript       | UI logic & interactions     |
| Fetch API        | API communication           |
| Django Templates | Frontend page rendering     |

---

## 3. User Flow

```text
Login
  ↓
Dashboard
  ↓
Book Appointment
  ↓
View Doctors
  ↓
Select Doctor
  ↓
Check Availability
  ↓
Select Date & Slot
  ↓
Appointment Summary
  ↓
Confirm Appointment
```

---

## 4. Frontend Data Flow

```text
User
 ↓
Frontend UI
 ↓
JavaScript API Layer
 ↓
Django API
 ↓
Data Response
 ↓
UI Rendering
```

---

## 5. Important API Rule

The API base URL must **never be duplicated**.

Correct:

```text
/api/v1/doctors/
```

Incorrect:

```text
/api/v1/api/v1/doctors/
```

Always use the existing `api.js` API helper for requests instead of manually adding `/api/v1`.

---

## 6. Frontend Development Rule

When changing the UI/UX:

* Preserve existing API calls.
* Do not hardcode database data.
* Do not change working API paths unnecessarily.
* Test login, doctors, availability and slots after changes.
* Check the browser Network/Console for API or JavaScript errors.

**Principle:** Improve the UI without breaking the existing functionality.
