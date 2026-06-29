# API Contracts: Redo Staff Module & Kiosk Attendance Mode

**Branch**: `006-staff-kiosk-attendance`  
**Date**: 2026-04-06  
**Base URL**: `http://localhost:8080/api`

---

## Auth Requirements

| Route Group | Auth Required | Notes |
|-------------|---------------|-------|
| `/api/staff/*` | JWT Bearer | Admin, teacher (read), bursar (read) |
| `/api/staff-attendance/*` | JWT Bearer | Admin full access; teacher/bursar read |
| `/api/leave-requests/*` | JWT Bearer | Admin full access |
| `/api/settings` (GET/PUT) | JWT Bearer | Admin only for PUT |
| `/api/kiosk/*` | **None** | Public; tenant_id from request body/query |

---

## Settings Endpoints (Modified)

### `GET /api/settings`

**Response** — adds `kioskModeEnabled`:

```json
{
  "tenantId": "t-001",
  "schoolName": "Greenwood Academy",
  "contactEmail": "admin@greenwood.co.zw",
  "contactPhone": "+263...",
  "address": "...",
  "defaultCurrency": "USD",
  "academicYear": "2026",
  "staffWorkHours": { "startTime": "08:30", "endTime": "17:00" },
  "studentWorkHours": { "startTime": "08:30", "endTime": "15:30" },
  "kioskModeEnabled": false
}
```

### `PUT /api/settings`

**Request body** — adds `kioskModeEnabled`:

```json
{
  "kioskModeEnabled": true
}
```

All fields are optional; only provided fields are updated.

---

## Kiosk Endpoints (New — Public, No JWT)

### `GET /api/kiosk/status?tenant_id={id}`

Returns whether kiosk mode is enabled for the tenant and, if enabled, the list of active staff with their attendance state for today.

**Request**:
- Query param: `tenant_id` (required)

**Response — kiosk disabled**:
```json
{
  "status": "success",
  "data": {
    "kioskEnabled": false,
    "staff": []
  }
}
```

**Response — kiosk enabled**:
```json
{
  "status": "success",
  "data": {
    "kioskEnabled": true,
    "date": "2026-04-06",
    "staff": [
      {
        "id": "s-001",
        "name": "Alice Moyo",
        "kioskState": "not_arrived"
      },
      {
        "id": "s-002",
        "name": "Bob Ncube",
        "kioskState": "checked_in"
      },
      {
        "id": "s-003",
        "name": "Carol Dube",
        "kioskState": "completed"
      }
    ]
  }
}
```

**`kioskState` values**:
| Value | Meaning |
|-------|---------|
| `not_arrived` | No check-in recorded today |
| `checked_in` | Checked in, no check-out yet |
| `completed` | Both check-in and check-out recorded |

**Error responses**:
- `400` — `tenant_id` missing
- `404` — Tenant not found

---

### `POST /api/kiosk/action`

Records a check-in or check-out for a staff member. Requires employee ID confirmation.

**Request body**:
```json
{
  "tenant_id": "t-001",
  "staff_id": "s-001",
  "employee_id": "EMP-042",
  "action": "check_in"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| tenant_id | string | Yes | |
| staff_id | string | Yes | |
| employee_id | string | Yes | Must match staff record |
| action | string | Yes | `"check_in"` or `"check_out"` |

**Response — success**:
```json
{
  "status": "success",
  "data": {
    "staffName": "Alice Moyo",
    "action": "check_in",
    "timestamp": "08:47",
    "date": "2026-04-06",
    "attendanceStatus": "present"
  }
}
```

**Error responses**:
- `400` — Missing required fields
- `400` — Invalid action value
- `400` — Staff already checked in (when action is `check_in` and record already exists with check_in)
- `400` — No check-in found (when action is `check_out` but no check_in exists for today)
- `400` — check_out before check_in
- `403` — Kiosk mode is not enabled for this tenant
- `403` — Staff is not active or does not have an employee ID
- `403` — Employee ID does not match
- `404` — Staff not found

---

## Staff Endpoints (Modified)

### `GET /api/staff`

No changes to contract. Existing filters supported: none (returns all for tenant from JWT).

### `GET /api/staff/{id}`

No changes to response contract.

### `POST /api/staff`

**Request body** (no new fields; `employee_id` already in schema):
```json
{
  "firstName": "Alice",
  "lastName": "Moyo",
  "email": "alice@greenwood.co.zw",
  "phone": "+263771234567",
  "dateOfBirth": "1985-03-15",
  "address": "123 Main St, Harare",
  "position": "Mathematics Teacher",
  "department": "Sciences",
  "isTeaching": true,
  "hireDate": "2020-01-10",
  "employmentStatus": "active",
  "employeeId": "EMP-042",
  "nextOfKin": {
    "name": "David Moyo",
    "relationship": "Spouse",
    "phone": "+263771234568",
    "email": "david@example.com",
    "address": "123 Main St, Harare"
  }
}
```

**Validation**:
- `employeeId` must be unique within the tenant (HTTP 409 if duplicate)

### `DELETE /api/staff/{id}`

**Modified behavior**: Returns HTTP 409 (not 200) if the staff member has attendance or leave records.

```json
{
  "status": "error",
  "message": "Cannot delete staff member with existing attendance or leave records. Change their employment status to 'resigned' or 'retired' instead.",
  "code": 409
}
```

---

## Staff Attendance Endpoints (Modified)

### `POST /api/staff-attendance/check-in`

**Request body** (unchanged):
```json
{
  "staffId": "s-001",
  "checkInTime": "08:47",
  "date": "2026-04-06"
}
```

**Modified behavior**:
- If a record already exists for `(tenant_id, staff_id, date)`, the check-in time is updated on the existing record rather than creating a duplicate.
- Response now includes `source: "manual"`.

### `POST /api/staff-attendance/check-in` (kiosk-originated)

Uses the public `/api/kiosk/action` endpoint instead. Not called directly.

### `POST /api/staff-attendance` (manual record)

**Response** now includes `source` field:
```json
{
  "id": "att-001",
  "staffId": "s-001",
  "date": "2026-04-06",
  "checkIn": "08:30",
  "checkOut": "17:00",
  "status": "present",
  "workHours": 8.5,
  "remarks": "",
  "source": "manual"
}
```

---

## Leave Requests Endpoints (Modified)

### `POST /api/leave-requests`

**Modified `leaveType` values** (aligned with new ENUM):

| Old | New |
|-----|-----|
| `vacation` | `annual` |
| `personal` | `annual` |
| `sick` | `sick` (unchanged) |
| `maternity` | `maternity` (unchanged) |
| `paternity` | `paternity` (unchanged) |
| `unpaid` | `unpaid` (unchanged) |
| *(new)* | `study` |
| *(new)* | `compassionate` |

**Validation error for invalid leave type**:
```json
{
  "status": "error",
  "message": "Invalid leave type. Allowed: annual, sick, maternity, paternity, study, unpaid, compassionate",
  "code": 400
}
```
