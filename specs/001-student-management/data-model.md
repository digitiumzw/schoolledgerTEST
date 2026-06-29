# Data Model: Student Management

**Phase 1 output for**: `001-student-management`
**Date**: 2026-04-03

## Entity Relationship Overview

```
tenants (1) ──────────────────── (N) students
students (1) ──────────────────── (N) enrollments
students (1) ──────────────────── (N) student_status_history  [NEW]
students (1) ──────────────────── (N) charges
students (1) ──────────────────── (N) payments
students (1) ──────────────────── (1) classes   (via class_id)
users   (1) ──────────────────── (N) student_status_history   (via changed_by_user_id)
```

---

## `students` Table (modified by migration 2026-04-03-100000)

Existing columns are unchanged. The following columns are ADDED:

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `admission_number` | VARCHAR(50) | NO | — | Unique per tenant. Auto-generated as `{YEAR}/{SEQ}` if not supplied. |
| `gender` | ENUM('male','female','other') | YES | NULL | Standard demographic field. |
| `photo_url` | VARCHAR(500) | YES | NULL | Relative or absolute URL to uploaded photo. |
| `national_id` | VARCHAR(100) | YES | NULL | Birth certificate number or national ID. |
| `guardian2_name` | VARCHAR(200) | YES | NULL | Second emergency contact — name. |
| `guardian2_phone` | VARCHAR(50) | YES | NULL | Second emergency contact — phone. |
| `guardian2_relationship` | VARCHAR(50) | YES | NULL | Second emergency contact — relationship. |

**Index added**: `UNIQUE (tenant_id, admission_number)` — enforces per-school uniqueness.

### Full `students` column list after migration

```
id                      VARCHAR(50)  PK
tenant_id               VARCHAR(50)  FK → tenants.id
first_name              VARCHAR(100)
last_name               VARCHAR(100)
admission_number        VARCHAR(50)  UNIQUE per tenant  [NEW]
gender                  ENUM(male,female,other)  nullable  [NEW]
date_of_birth           DATE  nullable
national_id             VARCHAR(100)  nullable  [NEW]
email                   VARCHAR(255)  nullable
address                 TEXT  nullable
photo_url               VARCHAR(500)  nullable  [NEW]
class_id                VARCHAR(50)  FK → classes.id  nullable
current_enrollment_id   VARCHAR(50)  nullable
guardian_name           VARCHAR(200)
guardian_phone          VARCHAR(50)
guardian_email          VARCHAR(255)  nullable
guardian_relationship   VARCHAR(50)
guardian2_name          VARCHAR(200)  nullable  [NEW]
guardian2_phone         VARCHAR(50)  nullable  [NEW]
guardian2_relationship  VARCHAR(50)  nullable  [NEW]
enrollment_date         DATE
status                  ENUM(active,inactive,transferred,dropped_out,graduated)  default: active
bursary_status          ENUM(full,partial,none)  default: none
bursary_percentage      INT  default: 0
bursary_reason          TEXT  nullable
created_at              DATETIME
updated_at              DATETIME
```

---

## `student_status_history` Table (created by migration 2026-04-03-110000)  [NEW]

Immutable append-only audit trail for every student status change.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | VARCHAR(50) | NO | UUID PK |
| `tenant_id` | VARCHAR(50) | NO | FK → tenants.id (for scoping queries) |
| `student_id` | VARCHAR(50) | NO | FK → students.id ON DELETE CASCADE |
| `previous_status` | ENUM(active,inactive,transferred,dropped_out,graduated) | YES | NULL for initial enrollment |
| `new_status` | ENUM(active,inactive,transferred,dropped_out,graduated) | NO | |
| `effective_date` | DATE | NO | Date the status change is effective |
| `reason` | TEXT | YES | Admin-supplied reason |
| `changed_by_user_id` | VARCHAR(50) | NO | FK → users.id |
| `created_at` | DATETIME | NO | System timestamp of when record was written |

**Indexes**: `(tenant_id, student_id)`, `(student_id, created_at DESC)`

---

## State Transitions — Student Status

```
                    ┌─────────┐
          (enroll)  │         │
         ──────────►│ active  │
                    │         │
                    └────┬────┘
                         │
          ┌──────────────┼──────────────┬──────────────┐
          ▼              ▼              ▼              ▼
     ┌─────────┐  ┌────────────┐  ┌──────────┐  ┌──────────┐
     │inactive │  │transferred │  │graduated │  │dropped   │
     │         │  │            │  │          │  │ _out     │
     └────┬────┘  └────────────┘  └──────────┘  └──────────┘
          │
          │ (re-activate)
          ▼
       ┌──────┐
       │active│
       └──────┘
```

Rules:
- `inactive` → `active` is allowed (re-enrolment).
- `transferred`, `graduated`, `dropped_out` are terminal from a billing perspective but records
  remain readable.
- Every transition MUST create a `student_status_history` row.

---

## Validation Rules

| Field | Rule |
|-------|------|
| `first_name` | Required, 1–100 chars |
| `last_name` | Required, 1–100 chars |
| `admission_number` | Required; unique per `tenant_id`; 1–50 chars; auto-generated if blank |
| `enrollment_date` | Required; valid date; not in the future |
| `guardian_name` | Required, 1–200 chars |
| `guardian_phone` | Required; must match E.164-compatible pattern |
| `guardian2_phone` | Optional; if provided, must match E.164-compatible pattern |
| `gender` | Optional; if provided must be `male`, `female`, or `other` |
| `date_of_birth` | Optional; must be in the past; not more than 30 years ago |
| `bursary_percentage` | 0–100 integer |
| `status` | Must be one of the defined enum values |
| `effective_date` (status change) | Required for status change; valid date |

---

## API Shape (camelCase, frontend-facing)

### Student object (full)

```json
{
  "id": "uuid",
  "tenantId": "uuid",
  "firstName": "Tafara",
  "lastName": "Moyo",
  "admissionNumber": "2026/001",
  "gender": "male",
  "dateOfBirth": "2012-03-15",
  "nationalId": "63-2145678A21",
  "email": "tafara@example.com",
  "address": "12 Main St, Harare",
  "photoUrl": null,
  "classId": "uuid",
  "className": "Form 2A",
  "enrollmentDate": "2026-01-08",
  "status": "active",
  "balance": 150.00,
  "guardian": {
    "name": "Rudo Moyo",
    "phone": "+263771234567",
    "email": "rudo@example.com",
    "relationship": "Mother"
  },
  "guardian2": {
    "name": "Chipo Moyo",
    "phone": "+263772345678",
    "relationship": "Father"
  },
  "bursaryStatus": "none",
  "bursaryPercentage": 0,
  "bursaryReason": ""
}
```

### Status history entry

```json
{
  "id": "uuid",
  "studentId": "uuid",
  "previousStatus": "active",
  "newStatus": "transferred",
  "effectiveDate": "2026-03-31",
  "reason": "Family relocated to Bulawayo",
  "changedByUserId": "uuid",
  "changedByName": "Admin User",
  "createdAt": "2026-03-31T10:22:00Z"
}
```
