# Data Model: Redo Staff Module & Kiosk Attendance Mode

**Branch**: `006-staff-kiosk-attendance`  
**Date**: 2026-04-06

---

## Existing Tables (No Changes)

### `tenants`
| Column | Type | Notes |
|--------|------|-------|
| id | VARCHAR(50) PK | Opaque UUID |
| name | VARCHAR(255) | |
| settings | JSON | Extended — see Settings Schema below |
| fee_structure | JSON | |
| payment_categories | JSON | |
| academic_calendar | JSON | |
| charge_generation_history | JSON | |
| created_at / updated_at | DATETIME | |

### `staff` (existing, no new columns)
| Column | Type | Notes |
|--------|------|-------|
| id | VARCHAR(50) PK | |
| tenant_id | VARCHAR(50) FK | |
| employee_id | VARCHAR(50) | Unique per tenant — required for kiosk |
| first_name / last_name | VARCHAR(255) | |
| email | VARCHAR(255) | |
| phone | VARCHAR(50) | |
| date_of_birth | DATE | |
| address | TEXT | |
| position / department | VARCHAR(255) | |
| is_teaching | TINYINT(1) | |
| hire_date | DATE | |
| employment_status | ENUM('active','on_leave','suspended','resigned','retired') | |
| next_of_kin_name / _relationship / _phone / _email / _address | VARCHAR / TEXT | |
| created_at / updated_at | DATETIME | |

**Constraint**: `UNIQUE KEY (tenant_id, employee_id)` — existing migration added this.

---

## Modified Tables

### `staff_attendance` — Add `source` column + unique constraint

**New column** (via new migration `2026-04-06-001_Add_source_to_staff_attendance.php`):

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| source | ENUM('manual','kiosk','system') | 'manual' | Audit trail for record origin |

**New constraint** (same migration):

```
UNIQUE KEY uq_staff_date (tenant_id, staff_id, date)
```

Full column set after migration:

| Column | Type | Notes |
|--------|------|-------|
| id | VARCHAR(50) PK | |
| tenant_id | VARCHAR(50) | |
| staff_id | VARCHAR(50) FK → staff.id | |
| date | DATE | |
| check_in | TIME | |
| check_out | TIME | |
| status | ENUM('present','absent','late','half_day','on_leave') | |
| work_hours | DECIMAL(4,2) | Computed from check_in/check_out |
| remarks | TEXT | |
| source | ENUM('manual','kiosk','system') | NEW |
| created_at / updated_at | DATETIME | |

**Unique constraint**: `(tenant_id, staff_id, date)` — one record per staff per day.

### `leave_requests` — Fix leave_type ENUM

**Migration** `2026-04-06-002_Fix_leave_type_enum.php`:

1. UPDATE existing rows: `vacation → annual`, `personal → annual`  
2. ALTER COLUMN: `leave_type ENUM('annual','sick','maternity','paternity','study','unpaid','compassionate')`

Full column set after migration:

| Column | Type | Notes |
|--------|------|-------|
| id | VARCHAR(50) PK | |
| tenant_id | VARCHAR(50) | |
| staff_id | VARCHAR(50) FK → staff.id | |
| leave_type | ENUM('annual','sick','maternity','paternity','study','unpaid','compassionate') | FIXED |
| start_date / end_date | DATE | |
| days | INT | |
| reason | TEXT | |
| status | ENUM('pending','approved','rejected') | |
| applied_date | DATE | |
| reviewed_by | VARCHAR(255) | |
| reviewed_date | DATE | |
| review_notes | TEXT | |
| created_at / updated_at | DATETIME | |

---

## Settings Schema Extension

The `tenants.settings` JSON blob is extended to include:

```json
{
  "schoolName": "",
  "contactEmail": "",
  "contactPhone": "",
  "address": "",
  "defaultCurrency": "USD",
  "academicYear": "2026",
  "staffWorkHours": { "startTime": "08:30", "endTime": "17:00" },
  "studentWorkHours": { "startTime": "08:30", "endTime": "15:30" },
  "kioskModeEnabled": false
}
```

New key: **`kioskModeEnabled`** (boolean, default `false`).  
No migration required — the JSON column already exists; the application layer enforces this key's presence and default.

---

## State Transitions

### Staff Employment Status

```
(create) → active
active → on_leave | suspended | resigned | retired
on_leave → active | resigned | retired
suspended → active | resigned | retired
resigned → (no transition — terminal)
retired → (no transition — terminal)
```

- Only `active` staff appear in kiosk list and daily attendance tracking.
- Staff in `resigned` or `retired` cannot be returned to `active`.

### Staff Attendance Record Status

```
(kiosk/admin creates) → present | late | absent | on_leave | half_day
present → (check-out recorded) → work_hours computed
late → (check-out recorded) → work_hours computed
absent → (admin correction) → present | late | half_day | on_leave
on_leave → (admin correction) → other statuses
```

- `late` is auto-set when `check_in > staffWorkHours.startTime`
- `on_leave` is set automatically when an approved leave request covers the date

### Leave Request Status

```
pending → approved | rejected
approved → (no edit/delete allowed — terminal)
rejected → (no edit/delete allowed — terminal)
pending → (edit allowed) → pending
pending → (delete allowed) → (removed)
```

---

## Entity Relationships

```
tenants 1 ──< staff (via tenant_id)
tenants 1 ──< leave_requests (via tenant_id)
staff 1 ──< staff_attendance (via staff_id)
staff 1 ──< leave_requests (via staff_id)
```

### Validation Rules

| Entity | Field | Rule |
|--------|-------|------|
| staff | employee_id | Unique per tenant; required for kiosk access |
| staff | employment_status | Only `active` staff accessible via kiosk |
| staff_attendance | (tenant_id, staff_id, date) | Unique — one record per staff per day |
| staff_attendance | check_out | Must be after check_in if both present |
| staff_attendance | work_hours | `(check_out - check_in)` in decimal hours; 0 if check_out missing |
| leave_requests | end_date | Must be ≥ start_date |
| leave_requests | days | Must be ≥ 1 |
| leave_requests | status | Only `pending` requests can be edited or deleted |
