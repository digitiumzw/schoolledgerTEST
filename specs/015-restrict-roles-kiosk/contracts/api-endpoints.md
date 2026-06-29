# API Contracts: Driver Kiosk

## New Public Endpoints (No JWT Required)

These endpoints follow the established kiosk pattern from `StudentKioskController`. They are registered before the JWT group in `Routes.php`.

---

### POST /api/kiosk/driver/validate

Authenticates a driver by Employee ID and returns their assigned routes.

**Request Body**:
```json
{
  "kiosk_code": "abc1234xyz",
  "employee_id": "DRV001"
}
```

**Success Response (200)**:
```json
{
  "status": "success",
  "data": {
    "driverName": "John Banda",
    "employeeId": "DRV001",
    "routes": [
      {
        "id": "rt_abc123",
        "routeName": "Route A – Borrowdale",
        "vehicle": "Toyota Coaster",
        "driverPhone": "+263771234567",
        "monthlyFee": 50.00,
        "status": "active",
        "activeCount": 12
      }
    ]
  }
}
```

**Error Responses**:
- `400` — Missing `kiosk_code` or `employee_id`
- `403` — Employee ID not recognized (unified error; does not distinguish not-found vs inactive)
- `403` — Kiosk mode not enabled for this school

---

### GET /api/kiosk/driver/routes/:code

Returns the student roster for a specific route, authenticated by Employee ID query param.

**URL Parameters**:
- `:code` — opaque kiosk code (from tenant settings)

**Query Parameters**:
- `employee_id` — driver's Employee ID
- `route_id` — route UUID to fetch roster for

**Success Response (200)**:
```json
{
  "status": "success",
  "data": {
    "route": {
      "id": "rt_abc123",
      "routeName": "Route A – Borrowdale",
      "vehicle": "Toyota Coaster",
      "driverPhone": "+263771234567",
      "monthlyFee": 50.00,
      "status": "active"
    },
    "roster": [
      {
        "studentId": "s_xyz",
        "studentName": "Alice Moyo",
        "studentClass": "Grade 4",
        "pickupPoint": "Borrowdale Police Station",
        "dropPoint": "School Gate"
      }
    ],
    "total": 12
  }
}
```

**Error Responses**:
- `400` — Missing `employee_id` or `route_id`
- `403` — Employee ID not recognized or not assigned to this route
- `404` — Route not found

---

## Modified Endpoints

### POST /api/users (UserController::create)

**New constraint**: Returns `429` if the tenant already has 5 or more active accounts.

**New validation**: `role` field must be `admin` or `bursar` (for non-super_admin callers). Returns `400` with message `"Invalid role. Allowed roles for tenant accounts: admin, bursar"` if any other role is supplied.

---

## Removed Endpoints (Frontend Routing Only)

The following routes are removed from `App.tsx` as they are no longer accessible via login:

| Route | Component | Reason |
|-------|-----------|--------|
| `/driver` | `DriverDashboard` | Drivers use kiosk instead |

The teacher attendance route (`/attendance`) remains in the app but the `teacher` role is removed from its `allowedRoles` list. Teachers no longer log in; attendance is only marked via the existing student-attendance kiosk at `/kiosk/student-attendance/:code`.
