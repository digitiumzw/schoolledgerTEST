# API Contract: Transport Endpoints (New)

**Feature**: `013-fix-frontend-api`  
**Base URL**: `/api/transport`  
**Auth**: All endpoints require `Authorization: Bearer <JWT>`. Role: `admin` or `super_admin`.

---

## GET `/transport/routes/:routeId/students-with-status`

Returns all active students in the tenant with their assignment status relative to the specified route.

**Query params**: `term` (optional string, ignored by backend — reserved for future use)

**Success 200**:
```json
{
  "status": true,
  "data": [
    {
      "id": "string",
      "firstName": "string",
      "lastName": "string",
      "className": "string",
      "routeStatus": "available | assigned_this_route | assigned_other_route",
      "assignedRouteName": "string | null"
    }
  ]
}
```

**Error 404**: Route not found for this tenant.

---

## GET `/transport/routes/:routeId/assignments`

Returns all students assigned to the route, optionally filtered by month.

**Query params**: `month` (optional, format `YYYY-MM`)

**Success 200**:
```json
{
  "status": true,
  "data": [
    {
      "id": "string",
      "studentId": "string",
      "studentName": "string",
      "studentClass": "string",
      "paymentId": "null",
      "access": "boolean",
      "assignedDate": "string | null",
      "startDate": "string",
      "endDate": "string | null",
      "routeFee": "number",
      "routeName": "string",
      "driverName": "string",
      "month": "string",
      "routeId": "string",
      "transportStatus": "Active | Suspended"
    }
  ]
}
```

**Error 404**: Route not found.

---

## POST `/transport/payment`

Records a transport fee payment for a student for a given month.

**Body**:
```json
{
  "studentId": "string (required)",
  "routeId": "string (required)",
  "month": "string YYYY-MM (required)",
  "amount": "number (required, > 0)",
  "method": "string (required)",
  "notes": "string (optional)"
}
```

**Success 200**:
```json
{
  "status": true,
  "data": { "id": "string" },
  "message": "Transport payment recorded"
}
```

**Error 400**: Missing required fields or invalid amount.  
**Error 404**: Student or route not found.

---

## POST `/transport/routes/:routeId/assign-with-charges`

Assigns students to a route and generates monthly transport charges for the specified date range.

**Body**:
```json
{
  "studentIds": ["string"],
  "startDate": "string YYYY-MM-DD (required)",
  "endDate": "string YYYY-MM-DD (required)"
}
```

**Success 200**:
```json
{
  "status": true,
  "data": {
    "createdAssignments": "number",
    "createdCharges": "number",
    "totalAmount": "string (decimal)"
  }
}
```

**Error 400**: Empty studentIds, invalid dates, or endDate before startDate.  
**Error 404**: Route not found.

---

## POST `/transport/routes/:routeId/preview-charges`

Previews transport charges that would be generated. Non-destructive — no data written.

**Body**:
```json
{
  "routeId": "string",
  "startDate": "string YYYY-MM-DD (required)",
  "endDate": "string YYYY-MM-DD (required)"
}
```

**Success 200**:
```json
{
  "status": true,
  "data": {
    "routeFee": "number",
    "durationMonths": "number",
    "totalAmount": "string (decimal)",
    "startDate": "string",
    "endDate": "string",
    "charges": [
      {
        "month": "string (human-readable, e.g. 'April 2026')",
        "amount": "number",
        "isProrated": "boolean"
      }
    ]
  }
}
```

**Error 400**: Invalid date range.  
**Error 404**: Route not found.
