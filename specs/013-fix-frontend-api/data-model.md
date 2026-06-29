# Data Model: Fix Frontend Bugs and Replace MockApi

**Branch**: `013-fix-frontend-api` | **Date**: 2026-04-07

> No schema changes. All entities below describe existing tables being queried by new endpoints.

---

## Existing Tables Referenced

### `transport_assignments`
| Column | Type | Notes |
|--------|------|-------|
| id | varchar | PK |
| tenant_id | varchar | Multi-tenancy filter (mandatory) |
| student_id | varchar | FK → students |
| route_id | varchar | FK → transport_routes |
| pickup_point | varchar | Nullable |
| drop_point | varchar | Nullable |
| start_date | date | When assignment begins |
| end_date | date | Nullable; null = still active |
| status | enum | `active` / `inactive` |
| created_at | datetime | |
| updated_at | datetime | |

### `transport_routes`
| Column | Type | Notes |
|--------|------|-------|
| id | varchar | PK |
| tenant_id | varchar | Multi-tenancy filter |
| route_name | varchar | Display name |
| driver_name | varchar | Nullable |
| monthly_fee | decimal | Fee per student per month |
| status | varchar | `active` / `inactive` |

### `payments`
| Column | Type | Notes |
|--------|------|-------|
| id | varchar | PK |
| tenant_id | varchar | Multi-tenancy filter |
| student_id | varchar | FK → students |
| amount | decimal | |
| category | varchar | e.g., `transport` |
| method | varchar | `cash` / `bank` / etc. |
| notes | text | Nullable |
| date | date | Payment date |
| created_at | datetime | |

### `staff_attendance`
| Column | Type | Notes |
|--------|------|-------|
| id | varchar | PK |
| tenant_id | varchar | Multi-tenancy filter |
| staff_id | varchar | FK → staff |
| date | date | Attendance date |
| check_in | time | Nullable |
| check_out | time | Nullable |
| status | enum | `present` / `absent` / `late` / `half_day` / `on_leave` |
| remarks | text | Nullable |
| work_hours | decimal | Nullable; computed from check in/out |

### `student_attendance`
| Column | Type | Notes |
|--------|------|-------|
| id | varchar | PK |
| tenant_id | varchar | Multi-tenancy filter |
| student_id | varchar | FK → students |
| class_id | varchar | FK → classes |
| date | date | |
| status | enum | `present` / `absent` / `late` / `excused` |
| remarks | text | Nullable |
| recorded_by | varchar | Staff ID from JWT |

---

## API Response Shapes (new endpoints)

### `GET /transport/routes/:routeId/students-with-status`

```json
{
  "status": true,
  "data": [
    {
      "id": "stu_xxx",
      "firstName": "Alice",
      "lastName": "Smith",
      "className": "Form 1A",
      "routeStatus": "available",
      "assignedRouteName": null
    },
    {
      "id": "stu_yyy",
      "firstName": "Bob",
      "lastName": "Jones",
      "className": "Form 2B",
      "routeStatus": "assigned_this_route",
      "assignedRouteName": "Route 1 - City Centre"
    },
    {
      "id": "stu_zzz",
      "firstName": "Carol",
      "lastName": "Lee",
      "className": "Form 1A",
      "routeStatus": "assigned_other_route",
      "assignedRouteName": "Route 2 - Suburbs"
    }
  ]
}
```

### `GET /transport/routes/:routeId/assignments?month=YYYY-MM`

```json
{
  "status": true,
  "data": [
    {
      "id": "ta_xxx",
      "studentId": "stu_xxx",
      "studentName": "Alice Smith",
      "studentClass": "Form 1A",
      "paymentId": null,
      "access": true,
      "assignedDate": "2026-01-15",
      "startDate": "2026-01-15",
      "endDate": null,
      "routeFee": 45.00,
      "routeName": "Route 1 - City Centre",
      "driverName": "John Driver",
      "month": "2026-04",
      "routeId": "rt_xxx",
      "transportStatus": "Active"
    }
  ]
}
```

### `POST /transport/payment`

Request:
```json
{
  "studentId": "stu_xxx",
  "routeId": "rt_xxx",
  "month": "2026-04",
  "amount": 45.00,
  "method": "cash",
  "notes": "Transport fee for April 2026"
}
```

Response:
```json
{
  "status": true,
  "data": { "id": "pay_xxx" },
  "message": "Transport payment recorded"
}
```

### `POST /transport/routes/:routeId/assign-with-charges`

Request:
```json
{
  "studentIds": ["stu_xxx", "stu_yyy"],
  "startDate": "2026-04-01",
  "endDate": "2026-06-30"
}
```

Response:
```json
{
  "status": true,
  "data": {
    "createdAssignments": 2,
    "createdCharges": 6,
    "totalAmount": "270.00"
  }
}
```

### `POST /transport/routes/:routeId/preview-charges`

Request:
```json
{
  "routeId": "rt_xxx",
  "startDate": "2026-04-01",
  "endDate": "2026-06-30"
}
```

Response:
```json
{
  "status": true,
  "data": {
    "routeFee": 45.00,
    "durationMonths": 3,
    "totalAmount": "135.00",
    "startDate": "2026-04-01",
    "endDate": "2026-06-30",
    "charges": [
      { "month": "April 2026", "amount": 45.00, "isProrated": false },
      { "month": "May 2026", "amount": 45.00, "isProrated": false },
      { "month": "June 2026", "amount": 45.00, "isProrated": false }
    ]
  }
}
```

### `POST /api/staff-attendance` (recordStaffAttendance — already in backend)

Request:
```json
{
  "staffId": "stf_xxx",
  "date": "2026-04-07",
  "checkIn": "08:00",
  "checkOut": "17:00",
  "status": "present",
  "remarks": "",
  "workHours": 9
}
```
