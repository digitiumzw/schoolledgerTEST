# API Contracts: Staff Attendance Tracking (067)

**Branch**: `067-staff-attendance-tracking` | **Date**: 2026-05-08  
**Auth**: All endpoints require `Authorization: Bearer <token>` (JWT)  
**Envelope**: All responses use `{ "status": true, "data": ... }` on success and `{ "status": false, "message": "..." }` on error.

---

## Existing Endpoints (Modified Behaviour)

These endpoints already exist but their response shapes are extended by this feature.

---

### POST `/api/staff-attendance/check-in`

Records a staff member's check-in. Status is now classified by `StaffAttendanceService`.

**Auth**: Any authenticated role  
**Body**:
```json
{
  "staffId": "string (required)",
  "checkIn": "HH:mm (optional — defaults to current time)",
  "date": "YYYY-MM-DD (optional — defaults to today)"
}
```

**Response 200**:
```json
{
  "status": true,
  "data": {
    "id": "sa_abc123",
    "checkIn": "09:10",
    "status": "late"
  }
}
```

**Status values returned**: `present` | `late`  
**Error 400**: `staffId` missing, invalid time format  
**Error 404**: Staff not found in tenant

---

### POST `/api/staff-attendance/check-out`

Records check-out. Now also classifies `early_departure` / `half_day` and stores `overtime_hours`.

**Auth**: Any authenticated role  
**Body**:
```json
{
  "staffId": "string (required)",
  "checkOut": "HH:mm (optional — defaults to current time)",
  "date": "YYYY-MM-DD (optional — defaults to today)"
}
```

**Response 200**:
```json
{
  "status": true,
  "data": {
    "checkOut": "15:45",
    "workHours": 6.58,
    "overtimeHours": 0.00,
    "status": "early_departure"
  }
}
```

**Status values that may be returned**: `present` | `late` | `early_departure` | `half_day`  
**Overtime rule**: `overtimeHours = MAX(0, workHours − standardHours)` where `standardHours` is derived from `tenants.settings.staffWorkHours`  
**Error 400**: No check-in found, `checkOut ≤ checkIn`, invalid time format  
**Error 404**: No attendance record for staff/date

---

### POST `/api/staff-attendance`

Bulk/manual record creation (admin). Extended to accept and store `overtimeHours`.

**Auth**: Any authenticated role  
**Body**:
```json
{
  "staffId": "string (required)",
  "date": "YYYY-MM-DD (required)",
  "status": "present|absent|late|on_leave|half_day|early_departure (required)",
  "checkIn": "HH:mm (optional)",
  "checkOut": "HH:mm (optional)",
  "workHours": 8.5,
  "overtimeHours": 0.0,
  "remarks": "string (optional)"
}
```

**Response 201**:
```json
{ "status": true, "data": { "id": "sa_xyz789" } }
```

**Error 400**: Missing required fields, `checkOut ≤ checkIn`

---

### GET `/api/staff-attendance`

Paginated attendance records list. Response shape extended with `overtimeHours`.

**Auth**: Any authenticated role  
**Query params** (all optional):
| Param | Type | Description |
|-------|------|-------------|
| `staffId` | string | Filter by staff member |
| `date` | YYYY-MM-DD | Filter by exact date |
| `status` | string | Filter by status |
| `start_date` | YYYY-MM-DD | Date range start |
| `end_date` | YYYY-MM-DD | Date range end |
| `search` | string | Search by staff name |
| `page` | int | Page number (default 1) |
| `limit` | int | Per page (default 20, max 100) |

**Response 200** (paginated mode):
```json
{
  "status": true,
  "data": {
    "records": [
      {
        "id": "sa_abc",
        "staffId": "stf_001",
        "staffName": "John Banda",
        "date": "2026-05-07",
        "checkIn": "08:25",
        "checkOut": "17:10",
        "status": "present",
        "workHours": 8.75,
        "overtimeHours": 0.25,
        "remarks": "",
        "comment": null
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 84,
      "totalPages": 5
    }
  }
}
```

---

### GET `/api/staff-attendance/summary/:staffId`

Monthly summary per staff member. Response extended with `overtimeHours`.

**Auth**: Any authenticated role  
**Path**: `:staffId` — staff UUID  
**Query params**:
| Param | Type | Description |
|-------|------|-------------|
| `month` | YYYY-MM | Month to summarise (default: current month) |
| `includeTrend` | bool | Include previous month comparison |

**Response 200**:
```json
{
  "status": true,
  "data": {
    "totalDays": 22,
    "present": 19,
    "absent": 1,
    "late": 2,
    "onLeave": 0,
    "halfDay": 0,
    "earlyDeparture": 1,
    "totalWorkHours": 186.5,
    "totalOvertimeHours": 3.25,
    "attendanceRate": 95.5
  }
}
```

---

### PUT `/api/leave-requests/:id/review`

Extended: When `status = "approved"`, triggers `StaffAttendanceService::syncLeaveToAttendance()`. When previously approved leave is set to `"rejected"`, triggers `voidLeaveAttendance()`.

**Auth**: `admin` | `super_admin` role required  
**Body**:
```json
{
  "status": "approved|rejected (required)",
  "reviewNotes": "string (optional)"
}
```

**Response 200**:
```json
{
  "status": true,
  "data": {
    "id": "lr_abc123",
    "status": "approved",
    "syncedAttendanceDays": 3
  }
}
```

`syncedAttendanceDays` = number of `on_leave` attendance rows created (0 for rejection).  
**Error 404**: Leave request not found in tenant  
**Error 400**: Invalid status value

---

## New Endpoints

---

### GET `/api/staff-attendance/report`

Period-based attendance report per staff member. Aggregates across a date range with optional department filter.

**Auth**: `admin` | `super_admin` role required  
**Query params**:
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `start_date` | YYYY-MM-DD | ✅ | Report period start |
| `end_date` | YYYY-MM-DD | ✅ | Report period end |
| `department` | string | ❌ | Filter to one department |
| `staff_id` | string | ❌ | Filter to one staff member |

**Validation**:
- `start_date` and `end_date` required; 400 if missing or malformed
- `end_date` must be ≥ `start_date`; 400 otherwise
- Max date range: 366 days; 400 if exceeded

**Response 200**:
```json
{
  "status": true,
  "data": {
    "period": {
      "startDate": "2026-01-01",
      "endDate": "2026-03-31",
      "workingDays": 65
    },
    "staff": [
      {
        "staffId": "stf_001",
        "firstName": "John",
        "lastName": "Banda",
        "department": "Science",
        "totalDays": 58,
        "present": 52,
        "absent": 3,
        "late": 5,
        "onLeave": 3,
        "halfDay": 0,
        "earlyDeparture": 1,
        "totalWorkHours": 430.5,
        "totalOvertimeHours": 5.0,
        "attendanceRate": 94.8
      }
    ]
  }
}
```

**Empty result**: Returns `{ "data": { "period": {...}, "staff": [] } }` — not an error.  
**Error 400**: Missing `start_date`/`end_date`, malformed dates, range > 366 days  
**Error 403**: Insufficient role

---

### GET `/api/staff-attendance/departments`

Department-level attendance rollup for a period.

**Auth**: `admin` | `super_admin` role required  
**Query params**:
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `start_date` | YYYY-MM-DD | ✅ | Period start |
| `end_date` | YYYY-MM-DD | ✅ | Period end |

**Response 200**:
```json
{
  "status": true,
  "data": {
    "period": {
      "startDate": "2026-01-01",
      "endDate": "2026-03-31"
    },
    "departments": [
      {
        "department": "Science",
        "staffCount": 8,
        "totalDays": 464,
        "presentDays": 420,
        "absentDays": 24,
        "lateDays": 18,
        "onLeaveDays": 22,
        "totalOvertimeHours": 12.5,
        "attendanceRate": 95.3
      },
      {
        "department": "Administration",
        "staffCount": 5,
        "totalDays": 290,
        "presentDays": 265,
        "absentDays": 10,
        "lateDays": 12,
        "onLeaveDays": 13,
        "totalOvertimeHours": 4.0,
        "attendanceRate": 95.5
      }
    ]
  }
}
```

**Empty result**: Returns `{ "data": { "departments": [] } }` — not an error.  
**Error 400**: Missing/malformed dates  
**Error 403**: Insufficient role

---

## Unchanged Endpoints (Reference)

These endpoints exist and are unchanged by this feature. They are listed for completeness:

| Method | Path | Handler |
|--------|------|---------|
| GET | `/api/staff-attendance` | `AttendanceController::staffIndex` |
| DELETE | `/api/staff-attendance/:id` | `AttendanceController::deleteStaffAttendance` |
| PUT | `/api/staff-attendance/:id` | `AttendanceController::updateStaffAttendance` |
| GET | `/api/leave-requests` | `LeaveController::index` |
| GET | `/api/leave-requests/pending` | `LeaveController::pending` |
| GET | `/api/leave-requests/staff/:staffId` | `LeaveController::byStaff` |
| POST | `/api/leave-requests` | `LeaveController::create` |
| PUT | `/api/leave-requests/:id` | `LeaveController::update` |
| DELETE | `/api/leave-requests/:id` | `LeaveController::delete` |
| GET | `/api/attendance/summary` | `AttendanceController::summary` |
| GET | `/api/attendance/today` | `AttendanceController::today` |

---

## Frontend TypeScript Types (additions to `api.ts`)

```typescript
// Extended StaffAttendanceRecord (in types/dashboard.ts)
// Add overtimeHours field:
export interface StaffAttendanceRecord {
  // ... existing fields ...
  overtimeHours?: number;   // NEW — hours worked beyond standard hours
}

// New interfaces in api.ts:

export interface AttendancePeriodSummaryStaff {
  staffId: string;
  firstName: string;
  lastName: string;
  department: string;
  totalDays: number;
  present: number;
  absent: number;
  late: number;
  onLeave: number;
  halfDay: number;
  earlyDeparture: number;
  totalWorkHours: number;
  totalOvertimeHours: number;
  attendanceRate: number;
}

export interface AttendancePeriodReport {
  period: { startDate: string; endDate: string; workingDays: number };
  staff: AttendancePeriodSummaryStaff[];
}

export interface AttendanceDepartmentSummary {
  department: string;
  staffCount: number;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  onLeaveDays: number;
  totalOvertimeHours: number;
  attendanceRate: number;
}

export interface AttendanceDepartmentReport {
  period: { startDate: string; endDate: string };
  departments: AttendanceDepartmentSummary[];
}
```

---

## Routes to Add in `Routes.php`

```php
// ==================== Staff Attendance (New) ====================
$routes->get('staff-attendance/report', 'AttendanceController::periodReport');
$routes->get('staff-attendance/departments', 'AttendanceController::departmentReport');
```

> **Note**: These routes must be declared **before** the existing `staff-attendance/(:segment)` wildcard routes to avoid being swallowed by the catch-all segment matcher.
