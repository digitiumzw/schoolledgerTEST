# Data Model: Student Attendance – Class-Linked Event Tracking

**Branch**: `068-student-attendance-classes`  
**Date**: 2026-05-08

---

## New Table: `student_attendance_events`

Primary storage for all class-linked student attendance events. Immutable after insert.

```sql
CREATE TABLE student_attendance_events (
    id               VARCHAR(100)  NOT NULL,
    tenant_id        VARCHAR(50)   NOT NULL,
    student_id       VARCHAR(50)   NOT NULL,
    class_instance_id VARCHAR(50)  NOT NULL,   -- FK to class_instances.id
    class_id         VARCHAR(50)   NOT NULL,   -- denorm from class_instances.class_id
    academic_session VARCHAR(20)   NOT NULL,   -- denorm from class_instances.academic_year
    date             DATE          NOT NULL,
    period_key       VARCHAR(50)   NULL,        -- NULL = per-day; "P1"/"P2" etc = per-period
    status           ENUM('present','absent','late','excused','half_day') NOT NULL,
    is_effective     TINYINT(1)    NOT NULL DEFAULT 1,
    submitted_by     VARCHAR(50)   NOT NULL,   -- users.id of the submitter
    submitted_at     DATETIME      NOT NULL,
    remarks          TEXT          NULL,
    created_at       DATETIME      NULL,

    PRIMARY KEY (id),
    INDEX idx_sae_tenant_instance_date        (tenant_id, class_instance_id, date),
    INDEX idx_sae_tenant_student_date         (tenant_id, student_id, date),
    INDEX idx_sae_tenant_student_instance     (tenant_id, student_id, class_instance_id),
    INDEX idx_sae_effective                   (tenant_id, class_instance_id, date, is_effective),
    CONSTRAINT fk_sae_tenant        FOREIGN KEY (tenant_id)         REFERENCES tenants(id)          ON DELETE CASCADE,
    CONSTRAINT fk_sae_student       FOREIGN KEY (student_id)        REFERENCES students(id)         ON DELETE CASCADE,
    CONSTRAINT fk_sae_class_instance FOREIGN KEY (class_instance_id) REFERENCES class_instances(id) ON DELETE CASCADE
);
```

### Column Notes

| Column | Purpose |
|---|---|
| `id` | App-generated: `sae_{timestamp}_{random_hex_8}` |
| `class_instance_id` | Primary context link — the class × academic year instance |
| `class_id` | Denormalised template class for filter queries without JOIN |
| `academic_session` | Denormalised from `class_instances.academic_year` for grouping |
| `period_key` | NULL in per-day mode; period label string in per-period mode |
| `is_effective` | 1 = current effective record; 0 = superseded by a later correction |
| `submitted_by` | JWT user id — sourced from the decoded token, never from request body |
| `submitted_at` | Server-side `datetime('now')` at insert time |

### No UPDATE or DELETE after insert (immutability)

The service layer (not DB triggers) enforces this. `StudentClassAttendanceController` exposes no UPDATE/DELETE endpoints for events. Corrections are submitted as new INSERT rows; the service sets `is_effective = 0` on prior rows for the same `(tenant_id, student_id, class_instance_id, date, period_key)` in a transaction before inserting the new row as `is_effective = 1`.

---

## Settings Configuration Change (No Migration Required)

The existing `settings` table stores per-tenant configuration as a JSON blob. A new key is added at the application layer only (no schema change):

```json
{
  "studentAttendanceMode": "per_day"
}
```

Valid values: `"per_day"` (default) | `"per_period"`

The `SettingsController` already handles arbitrary JSON settings via `DEFAULT_SETTINGS` — the new key is added to the constant following the same pattern as `chargeProrationEnabled`.

---

## Existing Tables Referenced (No Changes)

| Table | Role in this feature |
|---|---|
| `students` | Subject of each attendance event |
| `class_instances` | Context link (class × academic year) |
| `enrollments` | Enrollment validation guard before batch submission |
| `tenants` | Tenant isolation FK |
| `users` | `submitted_by` identity source |
| `student_attendance` | **Not modified** — existing kiosk-based table remains untouched |

---

## Entity Relationships

```
tenants
  └── class_instances (tenant_id, class_id, academic_year)
        └── student_attendance_events (class_instance_id)
              └── students (student_id)

enrollments (tenant_id, student_id, class_instance_id, status='ACTIVE')
  ↑ guard check at submission time — no stored FK to events
```

---

## Derived / Computed Outputs (Not Stored)

All of the following are computed on the fly from `student_attendance_events` where `is_effective = 1`:

### `StudentAttendanceSummary` (per-student over date range)
```
totalDays, present, absent, late, excused, halfDay, attendanceRate
```

### `ClassAttendanceSummary` (per-class-instance over date range)
```
perStudent: [{ studentId, studentName, present, absent, late, excused, halfDay, attendanceRate }]
classOverallRate: float
totalStudents: int
```

### `TermAttendanceSummary` (per-session aggregation)
```
academicSession, classInstanceId, className, totalStudents, averageAttendanceRate
```

### `AttendanceAuditLog` (all events including superseded)
```
All rows for (student_id, class_instance_id, date, period_key), ordered submitted_at ASC
```

---

## State Transitions for `is_effective`

```
First submission for (student, class_instance, date, period):
  → INSERT row with is_effective = 1

Correction submitted for same tuple:
  → UPDATE student_attendance_events SET is_effective = 0
       WHERE tenant_id = ? AND student_id = ? AND class_instance_id = ?
         AND date = ? AND COALESCE(period_key, '') = COALESCE(?, '')
         AND is_effective = 1
  → INSERT new row with is_effective = 1
  (both steps in a single DB transaction)
```

---

## Index Strategy

- `idx_sae_tenant_instance_date` — primary read pattern: "fetch today's attendance for a class instance"
- `idx_sae_tenant_student_date` — student profile history lookups by date range
- `idx_sae_tenant_student_instance` — term/session reports scoped to one student + class
- `idx_sae_effective` — aggregation queries filter `is_effective = 1`

All indexes are prefixed with `tenant_id` (Principle I compliance).
