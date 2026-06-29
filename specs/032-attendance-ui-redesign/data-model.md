# Data Model: Attendance UI Redesign & Staff Attendance Bug Fixes

**Feature**: `032-attendance-ui-redesign`  
**Date**: 2026-04-14

> This feature is **frontend-only**. No database schema changes. All entities below are existing types from `src/types/dashboard.ts`. This document records how they are used and what minor type-level changes are required.

---

## Existing Entities (No Schema Change)

### `StudentAttendanceRecord`

Used by: `Attendance.tsx`

```
studentId   : string          — FK to Student
classId     : string          — FK to Class
date        : string          — YYYY-MM-DD
status      : 'present' | 'absent' | 'late' | 'excused'
remarks     : string          — optional notes
```

No changes. Saved via `api.saveStudentAttendance()`.

---

### `StudentAttendanceSummary`

Used by: `Attendance.tsx` (computed client-side from raw records)

```
studentId            : string
studentName          : string
presentDays          : number
absentDays           : number
lateDays             : number
excusedDays          : number   ← already computed, just not displayed; ADD to table
totalDays            : number   — weekday count for the selected period
attendancePercentage : number   — (present + late) / totalDays * 100
```

**Change**: The `excusedDays` field is already computed in the summary map inside `Attendance.tsx` but is not rendered in the table. Add it as a column.

---

### `StaffAttendanceRecord`

Used by: `DailyAttendanceTab`, `AttendanceRecordsTab`

```
id          : string
staffId     : string          — FK to Staff
date        : string          — YYYY-MM-DD
checkIn     : string | null   — HH:mm
checkOut    : string | null   — HH:mm
status      : 'present' | 'late' | 'absent' | 'on_leave' | 'half_day' | 'pending'
remarks     : string | null
```

No changes.

---

### `LeaveRequest`

Used by: `LeaveManagementTab`, `attendanceStateTransitions.ts`

```
id           : string
staffId      : string
leaveType    : 'annual' | 'sick' | 'maternity' | 'paternity' | 'study' | 'unpaid' | 'compassionate'
startDate    : string          — YYYY-MM-DD
endDate      : string          — YYYY-MM-DD
days         : number
reason       : string
status       : 'pending' | 'approved' | 'rejected'
appliedDate  : string
reviewedBy   : string | null
reviewNotes  : string | null
```

**No schema change**. Bug fix: `attendanceStateTransitions.ts` incorrectly reads `staffLeave.type` — corrected to `staffLeave.leaveType`.

> Note: `'half_day'` is not in the `leaveType` union. The half-day detection branch in `attendanceStateTransitions.ts` will remain unreachable until the data model is extended to support `'half_day'` as a leave type. The property-name fix is still required for correctness.

---

### `WorkHours`

Used by: `staffAttendanceUtils.ts`, `attendanceStateTransitions.ts`, `StatusReasonPanel`

```
startTime : string   — HH:mm (e.g. "08:30")
endTime   : string   — HH:mm (e.g. "17:00")
```

No changes. Bug fix: `getWorkHours(settings)` must receive the `settings` object.

---

### `Staff`

Used by: `DailyAttendanceTab`, `AttendanceRecordsTab`, `LeaveManagementTab`

```
id                 : string
firstName          : string
lastName           : string
position           : string
employmentStatus   : 'active' | 'resigned' | 'suspended' | 'retired'
...
```

No changes. `employmentStatus !== 'active'` → `'inactive'` attendance state.

---

## State Transitions (Unchanged)

```
AttendanceState flow (staff):

  pending ──────────────────────────────────────────── (before cutoff, no check-in)
     │
     ├── checkIn ≤ startTime  → present
     │                              │
     ├── checkIn > startTime  → late│
     │                              │
     │             ← ─ ─ checkOut ──┘
     │                              ↓
     │                         checked_out  (terminal)
     │
     └── after cutoff, no check-in → absent (terminal)

  Override rules (highest priority first):
    1. employmentStatus !== 'active'  → inactive
    2. approved leave on date         → on_leave  (or half_day — pending leaveType extension)
    3. above flow
```

---

## Component State Model

### `Attendance.tsx` (Student Attendance Page)

Local state additions / changes:

| State | Type | Change |
|-------|------|--------|
| `summarySearchQuery` | `string` | **NEW** — debounced search for summary table |
| `summarySortOrder` | `'asc' \| 'desc'` | **NEW** — sort direction for Attendance % column |

Derived state changes:
- `filteredSummary` — memoised from `attendanceSummary` filtered by `summarySearchQuery` and sorted by `attendancePercentage` per `summarySortOrder`

---

### `DailyAttendanceTab.tsx` (Staff Daily)

No new state. Bug fix: pass `settings` to `getWorkHours()`.

Inactive staff excluded from attendance rate denominator:
```
const activeStaff = staff.filter(s => !isStaffInactive(s));
// rate = (present + late) / activeStaff.length * 100
```

---

### `AttendanceRecordsTab.tsx` (Staff Records)

Local state additions:

| State | Type | Change |
|-------|------|--------|
| `filtersActive` | `boolean` | **NEW** — computed: true when any filter differs from default |

UI change: results count shown unconditionally (not only when `totalPages > 1`). Reset Filters button appears when `filtersActive`.

---

### `LeaveManagementTab.tsx` (Staff Leave)

Bug fix only: destructure `loading` (not `isLoading`) from `useStaff()` and `useLeaveRequests()`.
