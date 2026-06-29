# API Contract: Kiosk Endpoints

**Branch**: `010-kiosk-employee-id` | **Date**: 2026-04-06  
**Auth**: None (public endpoints, exempt from JWTAuthFilter — see Complexity Tracking in plan.md)

---

## GET /api/kiosk/status/:code

Resolves a kiosk access code to a tenant and returns kiosk configuration.

**Path param**: `code` — the opaque kiosk access code from the URL (e.g., `xK3mP9vR2q`)

**Legacy fallback**: Also accepts `?tenant_id={uuid}` as a query parameter for backward compatibility with existing kiosk setups. When both are present, the path param takes precedence.

### Response: 200 OK — kiosk enabled

```json
{
  "success": true,
  "data": {
    "kioskEnabled": true,
    "schoolName": "Greenwood Academy",
    "workHours": {
      "startTime": "08:30",
      "endTime": "17:00"
    },
    "date": "2026-04-06"
  }
}
```

### Response: 200 OK — kiosk disabled

```json
{
  "success": true,
  "data": {
    "kioskEnabled": false,
    "schoolName": "Greenwood Academy",
    "workHours": null,
    "date": "2026-04-06"
  }
}
```

### Response: 404 Not Found

```json
{
  "success": false,
  "error": "Kiosk not found"
}
```

**Change from current**: Removes `staff[]` array from response. Adds `schoolName` and `workHours`. Accepts `:code` path param instead of `?tenant_id` query param.

---

## POST /api/kiosk/action

Records a check-in or check-out for a staff member identified by their Employee ID.  
The backend **auto-detects** whether to check in or check out based on today's attendance record.

### Request Body

```json
{
  "kiosk_code": "xK3mP9vR2q",
  "employee_id": "EMP0042"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `kiosk_code` | string | Yes | Opaque kiosk access code (resolves to tenant server-side) |
| `employee_id` | string | Yes | Staff member's Employee ID |

**Legacy fallback**: If `tenant_id` and `staff_id` are present (old format), the endpoint continues to work. New clients MUST use `kiosk_code` + `employee_id` only.

### Response: 200 OK — Check-in recorded

```json
{
  "success": true,
  "data": {
    "staffName": "Sarah Moyo",
    "action": "check_in",
    "timestamp": "08:22",
    "date": "2026-04-06",
    "attendanceStatus": "present"
  }
}
```

### Response: 200 OK — Check-out recorded

```json
{
  "success": true,
  "data": {
    "staffName": "Sarah Moyo",
    "action": "check_out",
    "timestamp": "16:45",
    "date": "2026-04-06",
    "attendanceStatus": "late",
    "workHours": 8.38,
    "earlyDeparture": false
  }
}
```

### Response: 200 OK — Early departure

```json
{
  "success": true,
  "data": {
    "staffName": "John Banda",
    "action": "check_out",
    "timestamp": "14:30",
    "date": "2026-04-06",
    "attendanceStatus": "early_departure",
    "workHours": 5.83,
    "earlyDeparture": true
  }
}
```

### Response: 400 Bad Request

```json
{
  "success": false,
  "error": "No check-in record found for today. Please sign in first."
}
```

### Response: 403 Forbidden — Invalid Employee ID

```json
{
  "success": false,
  "error": "Employee ID not recognized"
}
```

> **Security note**: The error message MUST NOT distinguish between "ID not found" and "ID belongs to inactive staff". Both cases return the same message to prevent staff enumeration.

### Response: 403 Forbidden — Kiosk disabled

```json
{
  "success": false,
  "error": "Kiosk mode is not enabled for this school"
}
```

**Change from current**: Removes `tenant_id`, `staff_id`, `action` from request body. Adds `kiosk_code`. Backend now auto-detects `action` (check_in/check_out). Adds `earlyDeparture` field to checkout response.

---

## Error Response Format (all endpoints)

All errors follow the `BaseApiController::respondError()` format:

```json
{
  "success": false,
  "error": "Human-readable message"
}
```
