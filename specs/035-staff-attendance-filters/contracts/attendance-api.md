# Attendance API Contracts

**Feature**: 035-staff-attendance-filters  
**Base URL**: `/api/attendance`  
**Authentication**: JWT Bearer Token required for all endpoints

---

## GET /api/attendance/summary

Retrieve attendance summary filtered by month.

### Request

```http
GET /api/attendance/summary?month=2026-04
Authorization: Bearer <jwt_token>
```

**Query Parameters**:
| Name | Type | Required | Description |
|------|------|----------|-------------|
| month | string (YYYY-MM) | No | Month to filter. Defaults to current month if not provided. |

### Response

**200 OK**
```json
{
  "success": true,
  "data": {
    "month": "2026-04",
    "records": [
      {
        "staff_id": 1,
        "first_name": "John",
        "last_name": "Doe",
        "department": "Mathematics",
        "total_days": 20,
        "present_days": 18,
        "absent_days": 1,
        "excused_days": 1
      }
    ]
  }
}
```

**400 Bad Request** - Invalid month format
```json
{
  "success": false,
  "message": "Invalid month format. Use YYYY-MM"
}
```

**401 Unauthorized** - Missing or invalid JWT

**403 Forbidden** - User lacks admin/teacher role

---

## GET /api/attendance/today

Retrieve today's attendance status for all staff, including unchecked (missing) staff.

### Request

```http
GET /api/attendance/today
Authorization: Bearer <jwt_token>
```

### Response

**200 OK**
```json
{
  "success": true,
  "data": {
    "date": "2026-04-16",
    "unchecked_count": 3,
    "staff": [
      {
        "staff_id": 1,
        "first_name": "John",
        "last_name": "Doe",
        "department": "Mathematics",
        "status": "present",
        "check_in_time": "08:30:00",
        "check_out_time": null,
        "comment": null,
        "has_record": true
      },
      {
        "staff_id": 2,
        "first_name": "Jane",
        "last_name": "Smith",
        "department": "Science",
        "status": null,
        "check_in_time": null,
        "check_out_time": null,
        "comment": null,
        "has_record": false
      }
    ]
  }
}
```

**Field Descriptions**:
- `has_record`: Boolean indicating if attendance record exists for today
- `unchecked_count`: Number of active staff without attendance records

**401 Unauthorized** - Missing or invalid JWT

**403 Forbidden** - User lacks admin/teacher role

---

## POST /api/attendance/{staff_id}/status

Update attendance status for a staff member (mark as absent or excused).

### Request

```http
POST /api/attendance/2/status
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "status": "excused",
  "comment": "Medical appointment"
}
```

**Path Parameters**:
| Name | Type | Description |
|------|------|-------------|
| staff_id | integer | Staff member ID |

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| status | string | Yes | One of: "absent", "excused" |
| comment | string | No | Optional explanation (max 500 chars) |

### Response

**200 OK** - Status updated successfully
```json
{
  "success": true,
  "data": {
    "attendance_id": 123,
    "staff_id": 2,
    "date": "2026-04-16",
    "status": "excused",
    "comment": "Medical appointment",
    "updated_at": "2026-04-16T09:30:00Z"
  }
}
```

**400 Bad Request** - Invalid input
```json
{
  "success": false,
  "message": "Invalid status. Must be 'absent' or 'excused'"
}
```

**404 Not Found** - Staff ID does not exist
```json
{
  "success": false,
  "message": "Staff member not found"
}
```

**401 Unauthorized** - Missing or invalid JWT

**403 Forbidden** - User lacks admin role

**409 Conflict** - Staff already has present status for today
```json
{
  "success": false,
  "message": "Cannot modify status for staff who has already checked in"
}
```

---

## Error Handling

All errors follow the standard SchoolLedger error format:

```json
{
  "success": false,
  "message": "Human-readable error description",
  "errors": {} // Optional: validation error details
}
```

Common HTTP Status Codes:
- `200` - Success
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (business logic violation)
- `500` - Internal Server Error
