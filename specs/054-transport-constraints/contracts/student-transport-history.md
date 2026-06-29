# API Contract: Student Transport History

**Base Path**: `/api/students`
**Authentication**: JWT required (Bearer token)
**Authorization**: Any authenticated role can view; mutations require `super_admin` or `admin`

## Endpoints

### GET /:id/transport-history

Retrieve complete chronological transport assignment history for a specific student.

#### Request

```http
GET /api/students/student_456/transport-history
Authorization: Bearer <jwt>
```

#### Success Response (200 OK)

```json
{
  "status": "success",
  "data": {
    "studentId": "student_456",
    "studentName": "John Doe",
    "currentAssignment": {
      "id": "tsa_current",
      "routeId": "route_123",
      "routeName": "Northside Loop",
      "stopId": "stop_789",
      "stopName": "Maple & Oak",
      "direction": "both",
      "startDate": "2026-04-01",
      "status": "active"
    },
    "history": [
      {
        "id": "tsa_001",
        "routeId": "route_123",
        "routeName": "Northside Loop",
        "stopId": "stop_789",
        "stopName": "Maple & Oak",
        "direction": "both",
        "startDate": "2026-04-01",
        "endDate": null,
        "status": "active",
        "academicYear": "2025-2026",
        "notes": "Primary pickup location",
        "assignedDate": "2026-04-01T10:30:00Z"
      },
      {
        "id": "tsa_002",
        "routeId": "route_999",
        "routeName": "Downtown Express",
        "stopId": "stop_111",
        "stopName": "Central Station",
        "direction": "inbound",
        "startDate": "2026-01-15",
        "endDate": "2026-03-31",
        "status": "inactive",
        "academicYear": "2025-2026",
        "notes": "Moved to new neighborhood",
        "assignedDate": "2026-01-15T09:00:00Z",
        "endedDate": "2026-03-31T14:22:00Z"
      },
      {
        "id": "tsa_003",
        "routeId": "route_888",
        "routeName": "Uptown Line",
        "stopId": "stop_222",
        "stopName": "Hillside Ave",
        "direction": "both",
        "startDate": "2025-09-01",
        "endDate": "2026-01-14",
        "status": "inactive",
        "academicYear": "2025-2026",
        "notes": "Changed schools",
        "assignedDate": "2025-09-01T08:15:00Z",
        "endedDate": "2026-01-14T11:45:00Z"
      }
    ],
    "summary": {
      "totalAssignments": 3,
      "activeAssignments": 1,
      "currentRoute": "Northside Loop",
      "earliestAssignment": "2025-09-01"
    }
  },
  "message": "Transport history retrieved"
}
```

#### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| id | string | Allocation ID |
| routeId | string | Route identifier |
| routeName | string | Human-readable route name |
| stopId | string | Stop identifier |
| stopName | string | Human-readable stop name |
| direction | enum | `both`, `inbound`, or `outbound` |
| startDate | date (YYYY-MM-DD) | Assignment start date |
| endDate | date (YYYY-MM-DD) or null | Assignment end date (null if active) |
| status | enum | `active` or `inactive` |
| academicYear | string | Academic year context |
| notes | string or null | Admin notes on this assignment |
| assignedDate | ISO 8601 | Timestamp when assignment was created |
| endedDate | ISO 8601 or null | Timestamp when assignment was ended (if applicable) |

#### Error Responses

**404 Not Found - Student doesn't exist**
```json
{
  "status": "error",
  "message": "Student not found"
}
```

**404 Not Found - Student belongs to different tenant**
```json
{
  "status": "error",
  "message": "Student not found"
}
```

## Data Retention

Transport assignment records are **never hard-deleted**. When a student is removed from transport:
1. `status` is set to `inactive`
2. `end_date` is set to the removal date
3. The record remains in the database for historical reporting and audit purposes

## Usage Patterns

### Student Profile Page

The transport history endpoint is designed to be called when loading a student profile. The response includes:
- Current assignment (if any) for quick reference
- Complete chronological history for audit purposes
- Summary statistics for quick insights

### Reporting

For bulk reporting, use the transport routes endpoints with `?includeHistory=true` parameter instead of calling this endpoint for each student individually.

## Multi-Tenant Isolation

Students are scoped by `tenant_id`. Attempting to access a student from a different tenant returns `404 Not Found` to prevent tenant enumeration attacks.
