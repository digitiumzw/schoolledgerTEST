# API Contract: Transport Assignments

**Base Path**: `/api/transport`
**Authentication**: JWT required (Bearer token)
**Authorization**: `super_admin`, `admin` role required for mutations

## Endpoints

### POST /routes/:routeId/allocations

Create a new student transport assignment.

**Constraints Enforced**:
- Student must not have any active assignment on another route (409 Conflict if violated)
- Stop must belong to the specified route (400 Bad Request if violated)
- Route must have at least one configured stop (400 Bad Request if violated)

#### Request

```http
POST /api/transport/routes/route_123/allocations
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "studentId": "student_456",
  "stopId": "stop_789",
  "direction": "both",
  "notes": "Morning pickup only"
}
```

#### Success Response (201 Created)

```json
{
  "status": "success",
  "data": {
    "id": "tsa_abc123",
    "studentId": "student_456",
    "routeId": "route_123",
    "stopId": "stop_789",
    "direction": "both",
    "status": "active",
    "startDate": "2026-04-30",
    "notes": "Morning pickup only"
  },
  "message": "Student allocated to route"
}
```

#### Error Responses

**409 Conflict - Student already assigned**
```json
{
  "status": "error",
  "message": "Student is already assigned to another route",
  "errors": {
    "existingAssignment": {
      "routeId": "route_999",
      "routeName": "Downtown Express"
    }
  }
}
```

**400 Bad Request - Missing or invalid stop**
```json
{
  "status": "error",
  "message": "Stop validation failed",
  "errors": {
    "stopId": "Stop is required and must belong to the specified route"
  }
}
```

**400 Bad Request - Route has no stops configured**
```json
{
  "status": "error",
  "message": "Route must have at least one stop before students can be assigned"
}
```

---

### POST /allocations/reassign

Atomically reassign a student from one route to another.

**Operation**: Ends current assignment and creates new assignment in a single transaction.

#### Request

```http
POST /api/transport/allocations/reassign
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "studentId": "student_456",
  "fromRouteId": "route_999",
  "toRouteId": "route_123",
  "toStopId": "stop_789",
  "direction": "both",
  "notes": "Moved to new neighborhood",
  "reassignDate": "2026-05-01"
}
```

#### Success Response (200 OK)

```json
{
  "status": "success",
  "data": {
    "endedAssignment": {
      "id": "tsa_old456",
      "routeId": "route_999",
      "endDate": "2026-04-30",
      "status": "inactive"
    },
    "newAssignment": {
      "id": "tsa_new789",
      "routeId": "route_123",
      "stopId": "stop_789",
      "direction": "both",
      "startDate": "2026-05-01",
      "status": "active"
    }
  },
  "message": "Student reassigned successfully"
}
```

#### Error Responses

**409 Conflict - Student not assigned to fromRoute**
```json
{
  "status": "error",
  "message": "Student is not currently assigned to the specified route",
  "errors": {
    "currentAssignment": {
      "routeId": "route_888",
      "routeName": "Uptown Line"
    }
  }
}
```

**400 Bad Request - Invalid reassignment date**
```json
{
  "status": "error",
  "message": "Reassignment date cannot be in the past"
}
```

---

### GET /missing-charges

Get students with active transport assignments who lack charges for the specified month.

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| month | string (YYYY-MM) | No | Default: current month |
| routeId | string | No | Filter to specific route |
| academicYear | string | No | Filter by academic year |

#### Request

```http
GET /api/transport/missing-charges?month=2026-04&routeId=route_123
Authorization: Bearer <jwt>
```

#### Success Response (200 OK)

```json
{
  "status": "success",
  "data": {
    "month": "2026-04",
    "totalMissing": 3,
    "byRoute": [
      {
        "routeId": "route_123",
        "routeName": "Northside Loop",
        "missingCount": 2,
        "students": [
          {
            "studentId": "student_456",
            "firstName": "John",
            "lastName": "Doe",
            "className": "Grade 5A",
            "monthlyFee": 150.00,
            "assignmentDate": "2026-04-01"
          }
        ]
      }
    ]
  },
  "message": "Missing charge report generated"
}
```

---

### DELETE /allocations/:id

Soft-delete (deactivate) a transport assignment.

**Note**: This is the manual deallocation path. Also accessible via `PUT /allocations/:id` with `{ "status": "inactive" }`.

#### Request

```http
DELETE /api/transport/allocations/tsa_abc123
Authorization: Bearer <jwt>
```

#### Success Response (200 OK)

```json
{
  "status": "success",
  "data": {
    "id": "tsa_abc123",
    "status": "inactive",
    "endDate": "2026-04-30"
  },
  "message": "Student removed from route"
}
```

## Error Handling

All errors follow the standard JSON envelope:

```json
{
  "status": "error",
  "message": "Human-readable description",
  "errors": {
    "fieldName": "Field-specific error message",
    "general": "General error context"
  }
}
```

HTTP Status Codes:
- `200` - Success (GET, PUT, DELETE)
- `201` - Created (POST)
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid JWT)
- `403` - Forbidden (insufficient role)
- `404` - Not Found (route/student/assignment doesn't exist)
- `409` - Conflict (business rule violation - duplicate assignment, capacity exceeded)
- `500` - Server Error

## Multi-Tenant Isolation

All endpoints automatically filter by `tenant_id` derived from the JWT payload. Cross-tenant access attempts return `404 Not Found` (not `403`) to prevent tenant enumeration.
