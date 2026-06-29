# Data Model: Teacher Student Attendance Kiosk

**Feature**: `012-teacher-student-kiosk`  
**Date**: 2026-04-07

---

## Existing Tables (no schema changes required)

### `student_attendance`

Primary store for all student attendance records. Used by both the admin interface and the kiosk.

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(100) PK | Prefixed ID, e.g. `a_xxxx` |
| `tenant_id` | VARCHAR(50) | Multi-tenant isolation key — always filtered in every query |
| `student_id` | VARCHAR(50) | FK → `students.id` |
| `class_id` | VARCHAR(50) | FK → `classes.id` |
| `date` | DATE | Attendance date |
| `status` | ENUM | `present`, `absent`, `late`, `excused` |
| `remarks` | TEXT nullable | Optional note from teacher |
| `recorded_by` | VARCHAR(50) | **Employee ID string** of submitting teacher (e.g. `EMP0042`). Stored as string, not a FK, so audit trail survives staff deactivation. |
| `created_at` | DATETIME nullable | |
| `updated_at` | DATETIME nullable | |

**Unique constraint (enforced at application level)**: one record per `(tenant_id, student_id, date)`. A second submission for the same student-date updates the existing record rather than inserting a duplicate.

**Indexes**: `(student_id, date)`, `(class_id, date)`

---

### `tenants.settings` (JSON column — relevant keys)

The `tenants` table stores per-tenant configuration as a JSON blob in the `settings` column. No schema migration is needed — only new JSON keys are added.

| JSON Key | Type | Notes |
|----------|------|-------|
| `kioskModeEnabled` | boolean | **Staff** kiosk gate. Existing key. |
| `studentKioskModeEnabled` | boolean | **Student** kiosk gate. **New key** — independent of staff kiosk. `StudentKioskController::status()` must read this key, not `kioskModeEnabled`. |
| `kiosk_code` | string | Shared opaque 10-char alphanumeric token. Used in both `/kiosk/:code` (staff) and `/kiosk/:code/students`. Same key for both kiosk types. |
| `schoolName` | string | Displayed on both kiosk pages. |

---

### `staff`

Read by `StudentKioskController` to validate teacher identity at submission time.

| Column | Relevance |
|--------|-----------|
| `employee_id` | Matched against the ID the teacher types in. The kiosk validates against this. |
| `tenant_id` | Multi-tenant isolation |
| `employment_status` | Must be `active` |
| `is_teaching` | Must be `1` (true) |
| `id` | Used to scope assigned classes query |
| `first_name`, `last_name` | Returned to the frontend as `teacherName` for display |

---

### `classes`

Read by `StudentKioskController` to build the teacher's class list.

| Column | Relevance |
|--------|-----------|
| `id` | Class identifier |
| `tenant_id` | Multi-tenant isolation |
| `teacher_id` | Scopes the class list to only the validated teacher's assigned classes |
| `name` | Displayed in the class selection list |
| `archived_at` | NULL = active; non-NULL = archived and excluded from kiosk |

---

### `students`

Read via JOIN with `enrollments` to populate the student list for a selected class.

| Column | Relevance |
|--------|-----------|
| `id` | Student identifier |
| `tenant_id` | Multi-tenant isolation |
| `class_id` | Scopes to the selected class |
| `status` | Must be `active` to appear on kiosk |
| `first_name`, `last_name` | Displayed in attendance marking list |
| `current_enrollment_id` | Joined to `enrollments` table to confirm active enrolment |

---

### `enrollments`

Joined with `students` to confirm a student is actively enrolled (not just assigned to the class).

| Column | Relevance |
|--------|-----------|
| `id` | Matched against `students.current_enrollment_id` |
| `status` | Must be `active` |

---

## Entity Relationships (kiosk read path)

```
tenants (settings.kiosk_code)
    └── resolved by StudentKioskController::resolveTenant($code)
         ├── staff (employee_id + tenant_id + active + is_teaching)
         │    └── classes (teacher_id = staff.id, archived_at IS NULL)
         │         └── students (class_id, active status)
         │              └── enrollments (current_enrollment_id, active)
         │                   └── student_attendance (LEFT JOIN for pre-fill)
         └── settings.studentKioskModeEnabled (gate check)
```

---

## Write Path (submission)

On `POST /api/kiosk/student-attendance/submit`:

1. Resolve tenant from `kiosk_code` → get `tenant_id`
2. Check `settings.studentKioskModeEnabled = true`
3. Validate `employee_id` → active, teaching staff in tenant
4. Verify `class_id` is assigned to that teacher in that tenant
5. For each record in `records[]`:
   - If `student_attendance` row exists for `(tenant_id, student_id, date)` → **UPDATE** `status`, `remarks`, `class_id`, `recorded_by`
   - Else → **INSERT** new row with all fields including `recorded_by = employee_id`
6. Return summary: `className`, `date`, `totalStudents`, `saved`, `recordedBy`

---

## Settings Schema Change (JSON key only — no migration)

### Before

```json
{
  "kioskModeEnabled": true,
  "kiosk_code": "abc123xyz0",
  "schoolName": "Demo School"
}
```

### After

```json
{
  "kioskModeEnabled": true,
  "studentKioskModeEnabled": false,
  "kiosk_code": "abc123xyz0",
  "schoolName": "Demo School"
}
```

`studentKioskModeEnabled` defaults to `false` when the key is absent (backward compatible — no data migration needed).
