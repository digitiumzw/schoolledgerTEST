# Research: Staff Attendance Tracking (067)

**Branch**: `067-staff-attendance-tracking` | **Date**: 2026-05-08

This document resolves all "NEEDS CLARIFICATION" items from the planning gate and records architectural decisions made from codebase analysis.

---

## 1. What Already Exists

The following was discovered by reading existing migrations, models, controllers, frontend hooks, and API types:

### Backend

| Artefact | File | State |
|----------|------|-------|
| `staff_attendance` table | `2025-12-30-130000_Add_staff_attendance_table.php` | EXISTS — fields: `id`, `tenant_id`, `staff_id`, `date`, `check_in` (TIME), `check_out` (TIME), `status` ENUM, `work_hours` DECIMAL(5,2), `remarks`, `source`, `created_at`, `updated_at` |
| `staff_attendance.status` ENUM | `2025-12-31-140000_Add_half_day_status_to_staff_attendance.php` | EXISTS — values: `present`, `absent`, `late`, `on_leave`, `half_day` |
| `leave_requests` table | `2025-12-30-131000_Add_leave_requests_table.php` | EXISTS — fields: `id`, `tenant_id`, `staff_id`, `leave_type` ENUM, `start_date`, `end_date`, `days`, `reason`, `status` ENUM(`pending`,`approved`,`rejected`), `applied_date`, `reviewed_by`, `reviewed_date`, `review_notes` |
| `tenants.settings` JSON | various migrations | EXISTS — stores `staffWorkHours: { startTime, endTime }` |
| `AttendanceController` | `AttendanceController.php` | EXISTS — methods: `staffIndex`, `checkIn`, `checkOut`, `recordStaffAttendance`, `staffSummary`, `deleteStaffAttendance`, `updateStaffAttendance`, `summary`, `today`, `updateStatus` |
| `LeaveController` | `LeaveController.php` | EXISTS — methods: `index`, `pending`, `byStaff`, `create`, `review`, `update`, `delete` |
| `AttendanceModel` | `AttendanceModel.php` | EXISTS — `getMonthlySummary`, `getTodayAttendance`, `getClassAttendanceSummary`, `updateStatus`, `getBySource` |

### Frontend

| Artefact | File | State |
|----------|------|-------|
| `StaffAttendanceRecord` type | `types/dashboard.ts` | EXISTS — includes `status: 'present' \| 'absent' \| 'late' \| 'half_day' \| 'on_leave' \| 'excused'` |
| `LeaveRequest` type | `types/dashboard.ts` | EXISTS — matches leave_requests table |
| `Settings.staffWorkHours` | `types/dashboard.ts` | EXISTS — `{ startTime: string, endTime: string }` |
| `api.getStaffAttendance`, `checkInStaff`, `checkOutStaff`, `getLeaveRequestsByStaff`, etc. | `api/api.ts` | EXISTS |
| `useStaffAttendanceData.ts` | `hooks/useStaffAttendanceData.ts` | EXISTS — full hooks for attendance + leave + mutation |
| `StaffAttendance.tsx` page | `pages/StaffAttendance.tsx` | EXISTS — daily view, paginated records, leave management |

---

## 2. Gaps vs. Spec

The spec requires the following that do **not** yet exist:

### 2a. `early_departure` status

**Gap**: The `status` ENUM is `present | absent | late | on_leave | half_day`. The spec requires `early_departure` as a distinct status (FR-008).

**Decision**: Add `early_departure` via a new migration that alters the ENUM. The check-out endpoint will classify early departure if `check_out < settings.staffWorkHours.endTime`. The service will return `early_departure` status in the response without modifying historical records.

### 2b. Overtime calculation

**Gap**: `work_hours` field exists but no `overtime_hours` field or calculation. Overtime threshold is `work_hours > standard_hours_per_day`, where `standard_hours_per_day` comes from `endTime - startTime` (derived from `tenants.settings.staffWorkHours`).

**Decision**: Add `overtime_hours DECIMAL(5,2)` column via the same new migration. Populate it on check-out: `overtime_hours = MAX(0, work_hours - standard_hours)`. This is a stored value (not derived on read) to allow efficient reporting queries. The `StaffAttendanceService` will handle the calculation; controllers remain thin.

### 2c. Leave approval → attendance auto-creation

**Gap**: `LeaveController::review()` updates the leave request status but does **not** auto-create `staff_attendance` rows for the leave period. The spec (FR-017, FR-018) requires this.

**Decision**: When `LeaveController::review()` approves a leave request, it calls `StaffAttendanceService::syncLeaveToAttendance($leaveRequest, $tenantId)`. This service:
1. Calculates working days (Mon–Fri) between `start_date` and `end_date`.
2. For each working day, upserts a `staff_attendance` row with `status = 'on_leave'` and `source = 'leave_sync'`, `remarks = leave request ID`.
3. When a leave is rejected or cancelled (PUT to pending), voids those `source = 'leave_sync'` rows for the date range.
4. Uses `insertBatch` for performance; runs in a DB transaction for atomicity.

**Conflict rule**: If a manual attendance record already exists for a date (e.g., the staff checked in before leave was approved), `syncLeaveToAttendance` skips that date (does not overwrite).

### 2d. Period and department aggregation reporting

**Gap**: `staffSummary($staffId)` returns one staff member's monthly summary. No endpoint exists for:
- Per-period report filtering by `start_date`/`end_date` (not just `YYYY-MM`)
- Department-level aggregation
- Department filter on attendance list

**Decision**: Add two new endpoints:
1. `GET /api/staff-attendance/report` — query params: `start_date`, `end_date`, `department?`, `staff_id?` → returns per-staff aggregates including overtime.
2. `GET /api/staff-attendance/departments` — returns department-level rollup for a period.

These are implemented in `AttendanceModel::getPeriodReport()` and `AttendanceModel::getDepartmentReport()` using SQL aggregate queries. `StaffAttendanceService` contains the business-layer query building.

### 2e. Frontend: overtime column + period report tab

**Gap**: `StaffAttendance.tsx` has no overtime column in the records table and no period report / department breakdown tab.

**Decision**: Modify `StaffAttendance.tsx` to:
- Add `overtimeHours` column to the attendance records table.
- Add a new "Reports" tab with `AttendancePeriodReport.tsx` component (date-range picker + department filter + aggregated results table).

New `useStaffAttendanceReport.ts` hook wraps React Query for the report endpoints.

---

## 3. Architecture Decisions

### 3a. Service Layer

`StaffAttendanceService.php` (new) contains:
- `classifyStatus(checkIn, checkOut, startTime, endTime)` → status string
- `calculateOvertimeHours(workHours, standardHours)` → float
- `syncLeaveToAttendance(leaveRow, tenantId)` → void
- `voidLeaveAttendance(leaveRow, tenantId)` → void
- `getWorkHoursConfig(tenantId)` → `{ startTime, endTime, standardHours }`

Controllers call the service; the service calls models. No business logic in controllers.

### 3b. Migration strategy

A single new migration `2026-05-08-000001_ExtendStaffAttendanceForTracking.php`:
- ALTER `staff_attendance.status` ENUM to add `early_departure`
- ADD `overtime_hours DECIMAL(5,2) NULL` to `staff_attendance`

This is the only schema change needed.

### 3c. Leave types alignment

`LeaveController` uses `VALID_LEAVE_TYPES = ['annual', 'sick', 'maternity', 'paternity', 'study', 'unpaid', 'compassionate']`. The `leave_requests` migration uses a different ENUM (`['sick', 'vacation', 'personal', 'maternity', 'paternity', 'unpaid']`). The controller constant overrides the ENUM at the application layer.

**Decision**: The migration ENUM is not changed (immutable migration rule). The controller constant is the authoritative list. Both the spec and the `LeaveController` agree on `annual`, `sick`, `compassionate` etc., so this is already consistent for new records.

### 3d. `source` field usage

The `staff_attendance.source` field (already in `allowedFields`) is used as follows:
- `'manual'` — admin-recorded or check-in/check-out
- `'leave_sync'` — auto-created by leave approval
- `'kiosk'` — existing kiosk check-in

This classification enables the leave void logic to safely delete only `source = 'leave_sync'` rows.

### 3e. Early departure threshold

Early departure is classified when: `check_out < endTime` AND `work_hours < standardHours`. The threshold uses `tenants.settings.staffWorkHours.endTime` (falls back to `17:00`). The `half_day` status takes precedence when `work_hours < standardHours / 2`.

Status precedence (applied on check-out):
1. `half_day` — if `work_hours < standardHours / 2`
2. `early_departure` — if `check_out < endTime`
3. `late` — if `check_in > startTime` (set on check-in, preserved on check-out if no higher-severity status)
4. `present` — default

---

## 4. Out of Scope (v1)

- Public holiday calendar integration
- Self-service staff check-in portal
- Biometric/hardware integration
- Automated email/SMS notifications on approval
- Leave balance tracking
