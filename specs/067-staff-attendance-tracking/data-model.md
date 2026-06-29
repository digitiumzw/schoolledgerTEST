# Data Model: Staff Attendance Tracking (067)

**Branch**: `067-staff-attendance-tracking` | **Date**: 2026-05-08

---

## 1. Existing Tables (No Changes)

These tables already exist and are used as-is. Only the `staff_attendance` table gains two column changes.

### `staff` (existing, read-only by this feature)

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(50) PK | Tenant-scoped UUID-style |
| `tenant_id` | VARCHAR(50) | Multi-tenant isolation key |
| `first_name` | VARCHAR | |
| `last_name` | VARCHAR | |
| `department` | VARCHAR | Used for department-level report grouping |
| `employment_status` | ENUM(`active`,`inactive`,`on_leave`,`suspended`,`resigned`,`retired`) | Attendance restricted to `active` staff |
| `employee_id` | VARCHAR | Auto-generated `EMP0001` format |

### `leave_requests` (existing, modified behaviour only)

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(50) PK | |
| `tenant_id` | VARCHAR(50) | |
| `staff_id` | VARCHAR(50) | FK → `staff.id` |
| `leave_type` | ENUM | `sick`, `annual`, `maternity`, `paternity`, `study`, `unpaid`, `compassionate` |
| `start_date` | DATE | |
| `end_date` | DATE | |
| `days` | INT | Inclusive calendar days |
| `reason` | TEXT | |
| `status` | ENUM(`pending`,`approved`,`rejected`) | |
| `applied_date` | DATE | |
| `reviewed_by` | VARCHAR(50) NULL | |
| `reviewed_date` | DATE NULL | |
| `review_notes` | TEXT NULL | |

**Behaviour change (no schema change)**: When `status` transitions to `approved`, `StaffAttendanceService::syncLeaveToAttendance()` is triggered. When a previously-approved leave is modified back to `pending` or `rejected`, `StaffAttendanceService::voidLeaveAttendance()` is triggered.

---

## 2. Modified Table: `staff_attendance`

### Current schema (from migrations)

```sql
CREATE TABLE staff_attendance (
  id          VARCHAR(50)  NOT NULL,
  tenant_id   VARCHAR(50)  NOT NULL,
  staff_id    VARCHAR(50)  NOT NULL,
  date        DATE         NOT NULL,
  check_in    TIME         NULL,
  check_out   TIME         NULL,
  status      ENUM('present','absent','late','on_leave','half_day') NULL,
  work_hours  DECIMAL(5,2) NULL,
  remarks     TEXT         NULL,
  comment     VARCHAR(500) NULL,
  source      VARCHAR(20)  NULL,
  created_at  DATETIME     NULL,
  updated_at  DATETIME     NULL,
  PRIMARY KEY (id),
  KEY idx_tenant_staff  (tenant_id, staff_id),
  KEY idx_tenant_date   (tenant_id, date),
  KEY idx_staff_date    (staff_id, date)
);
```

### New migration: `2026-05-08-000001_ExtendStaffAttendanceForTracking.php`

```sql
-- Add early_departure to status ENUM
ALTER TABLE staff_attendance
  MODIFY COLUMN status
    ENUM('present','absent','late','on_leave','half_day','early_departure') NULL;

-- Add overtime_hours column
ALTER TABLE staff_attendance
  ADD COLUMN overtime_hours DECIMAL(5,2) NULL
  AFTER work_hours;
```

### Final schema after migration

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | VARCHAR(50) | NO | PK |
| `tenant_id` | VARCHAR(50) | NO | Multi-tenant key |
| `staff_id` | VARCHAR(50) | NO | FK → `staff.id` |
| `date` | DATE | NO | Attendance date |
| `check_in` | TIME | YES | HH:mm recorded time |
| `check_out` | TIME | YES | HH:mm recorded time |
| `status` | ENUM | YES | `present` \| `absent` \| `late` \| `on_leave` \| `half_day` \| **`early_departure`** ← new |
| `work_hours` | DECIMAL(5,2) | YES | Derived from check_out − check_in |
| **`overtime_hours`** | DECIMAL(5,2) | YES | **NEW** — MAX(0, work_hours − standard_hours) |
| `remarks` | TEXT | YES | Admin notes |
| `comment` | VARCHAR(500) | YES | Status comment (absent/excused) |
| `source` | VARCHAR(20) | YES | `manual` \| `leave_sync` \| `kiosk` |
| `created_at` | DATETIME | YES | |
| `updated_at` | DATETIME | YES | |

**No new indexes required** — existing indexes on `(tenant_id, staff_id)`, `(tenant_id, date)`, and `(staff_id, date)` are sufficient for all new query patterns.

---

## 3. Settings Configuration (no schema change)

Work-hours configuration is already stored in `tenants.settings` JSON column as:

```json
{
  "staffWorkHours": {
    "startTime": "08:30",
    "endTime": "17:00"
  }
}
```

`StaffAttendanceService::getWorkHoursConfig($tenantId)` reads this and derives:

```php
$standardHours = (strtotime($endTime) - strtotime($startTime)) / 3600;
// e.g., (17:00 - 08:30) = 8.5 hours
```

Defaults when not configured: `startTime = 08:30`, `endTime = 17:00`, `standardHours = 8.5`.

---

## 4. Entity Relationships

```
tenants (1)
  └── (N) staff
          └── (N) staff_attendance   [date-keyed records]
          └── (N) leave_requests     [date-range requests]
                      │
                      │ on approve → auto-creates
                      ▼
               staff_attendance rows (source='leave_sync')
```

---

## 5. Derived Values

These are **never stored** in the database — they are calculated at query time in `StaffAttendanceService`:

| Derived Value | Formula |
|---------------|---------|
| `standardHours` | `(endTime − startTime)` in hours from `tenants.settings` |
| `overtime_hours` | Stored on write: `MAX(0, work_hours − standardHours)` |
| `attendanceRate` | `(present + late) / totalRecordedDays × 100` for period summaries |
| `workingDays` | Count of Mon–Fri days in a date range |

---

## 6. Status Classification Logic

Applied by `StaffAttendanceService::classifyStatus()`:

```
On CHECK-IN:
  if check_in > startTime → status = 'late'
  else                    → status = 'present'

On CHECK-OUT (re-evaluate):
  standard_hours = endTime − startTime
  work_hours = check_out − check_in

  if work_hours < standard_hours / 2  → status = 'half_day'
  elif check_out < endTime            → status = 'early_departure'
  elif was 'late'                     → keep 'late'
  else                                → status = 'present'

  overtime_hours = MAX(0, work_hours − standard_hours)
```

---

## 7. `AttendanceModel` New Query Methods

```php
// Period report — per-staff aggregation over a date range
public function getPeriodReport(
    string $tenantId,
    string $startDate,
    string $endDate,
    ?string $department = null,
    ?string $staffId = null
): array;

// Department rollup — one row per department over a date range
public function getDepartmentReport(
    string $tenantId,
    string $startDate,
    string $endDate
): array;
```

Both use a single SQL `GROUP BY` aggregate — no PHP-side loops over per-row results.

---

## 8. `StaffAttendanceService` Interface

```php
namespace App\Services;

class StaffAttendanceService
{
    public function getWorkHoursConfig(string $tenantId): array;
    // Returns: ['startTime' => 'HH:mm', 'endTime' => 'HH:mm', 'standardHours' => float]

    public function classifyStatus(
        string $checkIn,
        ?string $checkOut,
        string $startTime,
        string $endTime,
        float $standardHours
    ): string;

    public function calculateOvertimeHours(float $workHours, float $standardHours): float;

    public function syncLeaveToAttendance(array $leaveRow, string $tenantId): void;
    // Creates staff_attendance rows (status='on_leave', source='leave_sync') for each
    // Mon–Fri working day in leave range. Skips dates that already have a manual record.

    public function voidLeaveAttendance(array $leaveRow, string $tenantId): void;
    // Deletes staff_attendance rows where source='leave_sync' AND staff_id AND date in range.
}
```
