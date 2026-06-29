# Contract: Student Identity API

## Conventions

- All endpoints are under `/api` and require JWT authentication unless explicitly public.
- `tenant_id` is always derived from the JWT and is never accepted from request body or query parameters.
- Successful responses use:

```json
{ "status": "success", "data": {}, "message": "..." }
```

- Error responses use:

```json
{ "status": "error", "message": "...", "errors": {} }
```

- Mutable operations require `admin` or `super_admin` unless existing module permissions are more restrictive.

## GET /api/students/{studentId}/identity

Returns the stable student identity with current derived references and summary metadata.

### Path Parameters

- `studentId`: Student identifier.

### Query Parameters

None.

### Success: 200

```json
{
  "status": "success",
  "data": {
    "student": {
      "id": "s_123",
      "tenantId": "tenant_123",
      "admissionNumber": "2026/001",
      "firstName": "Tariro",
      "lastName": "Moyo",
      "status": "active",
      "enrollmentDate": "2026-01-10",
      "currentEnrollmentId": "enr_123",
      "currentClassId": "class_123",
      "currentClassName": "Grade 4",
      "address": "123 Main Road",
      "guardian": {
        "name": "Mary Moyo",
        "phone": "+263...",
        "email": "mary@example.com",
        "relationship": "Mother"
      }
    },
    "summary": {
      "enrollmentRecords": 3,
      "profileHistoryRecords": 2,
      "transportAssignments": 1,
      "charges": 5,
      "payments": 4,
      "hasActiveTransport": true
    }
  },
  "message": "Student identity retrieved"
}
```

### Errors

- `401`: Missing/invalid JWT.
- `403`: Role not permitted to view student identity.
- `404`: Student not found in authenticated tenant.

## GET /api/students/{studentId}/timeline

Returns a consolidated chronological timeline across enrollment, profile history, status changes, transport assignments, charges, payments, and ledger adjustments.

### Path Parameters

- `studentId`: Student identifier.

### Query Parameters

- `from`: Optional start date, `YYYY-MM-DD`.
- `to`: Optional end date, `YYYY-MM-DD`.
- `academicYear`: Optional academic-year filter.
- `types`: Optional comma-separated event types. Allowed values: `profile_change`, `status_change`, `enrollment`, `transport_assignment`, `charge`, `payment`, `ledger_adjustment`.
- `limit`: Optional page size, default `100`, maximum `250`.
- `page`: Optional page number, default `1`.

### Success: 200

```json
{
  "status": "success",
  "data": {
    "studentId": "s_123",
    "studentName": "Tariro Moyo",
    "filters": {
      "from": "2026-01-01",
      "to": "2026-12-31",
      "academicYear": "2026",
      "types": ["enrollment", "transport_assignment", "charge", "payment"]
    },
    "events": [
      {
        "id": "enrollment:enr_123",
        "eventType": "enrollment",
        "eventDate": "2026-01-10",
        "title": "Enrolled in Grade 4",
        "summary": "Active enrollment for 2026",
        "sourceType": "enrollment",
        "sourceId": "enr_123",
        "metadata": {
          "classId": "class_123",
          "className": "Grade 4",
          "status": "active"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 100,
      "total": 1,
      "totalPages": 1
    }
  },
  "message": "Student timeline retrieved"
}
```

### Errors

- `400`: Invalid date, event type, limit, or page value.
- `401`: Missing/invalid JWT.
- `403`: Role not permitted to view student timeline.
- `404`: Student not found in authenticated tenant.

## GET /api/students/{studentId}/profile-history

Returns field-level history for mutable profile/contact details.

### Query Parameters

- `fieldName`: Optional field filter.
- `from`: Optional start date, `YYYY-MM-DD`.
- `to`: Optional end date, `YYYY-MM-DD`.

### Success: 200

```json
{
  "status": "success",
  "data": {
    "studentId": "s_123",
    "history": [
      {
        "id": "sph_123",
        "studentId": "s_123",
        "fieldName": "address",
        "previousValue": "Old Address",
        "newValue": "New Address",
        "changeType": "historical_change",
        "effectiveDate": "2026-05-01",
        "reason": "Family moved residence",
        "changedByUserId": "user_123",
        "changedByName": "Admin User",
        "createdAt": "2026-05-06 12:00:00"
      }
    ]
  },
  "message": "Profile history retrieved"
}
```

### Errors

- `400`: Invalid date or field filter.
- `401`: Missing/invalid JWT.
- `403`: Role not permitted to view profile history.
- `404`: Student not found in authenticated tenant.

## POST /api/students/{studentId}/profile-history

Records a profile/contact field change and updates the current student profile value.

### Request Body

```json
{
  "fieldName": "address",
  "newValue": "New Address",
  "changeType": "historical_change",
  "effectiveDate": "2026-05-01",
  "reason": "Family moved residence"
}
```

### Validation

- `fieldName` is required and must be an approved mutable profile field.
- `newValue` may be nullable only for fields where clearing is allowed.
- `changeType` must be `correction` or `historical_change`.
- `effectiveDate` is required and must be `YYYY-MM-DD`.
- `reason` is required.
- Request must not include `tenantId`.
- Request must not change immutable identity fields through this endpoint.
- If `newValue` equals the current value, the endpoint returns a validation error and no history row is created.

### Success: 201

```json
{
  "status": "success",
  "data": {
    "historyRecord": {
      "id": "sph_123",
      "studentId": "s_123",
      "fieldName": "address",
      "previousValue": "Old Address",
      "newValue": "New Address",
      "changeType": "historical_change",
      "effectiveDate": "2026-05-01",
      "reason": "Family moved residence",
      "changedByUserId": "user_123",
      "createdAt": "2026-05-06 12:00:00"
    },
    "student": {
      "id": "s_123",
      "address": "New Address"
    }
  },
  "message": "Student profile change recorded"
}
```

### Errors

- `400`: Malformed JSON or invalid field/date value.
- `401`: Missing/invalid JWT.
- `403`: Role not permitted to mutate profile history.
- `404`: Student not found in authenticated tenant.
- `409`: Submitted change conflicts with a current protected state or duplicate effective change.
- `422`: Validation failed.

## PUT /api/students/{studentId}

Existing student update contract remains available but must route mutable historical fields through the profile-history behavior where applicable.

### Required Behavior

- Core corrections may update allowed core fields with audit context.
- Real-world changes to mutable contact/profile fields create `student_profile_history` records before updating current values.
- Academic class changes must use enrollment/promote/transfer workflows, not direct current-class overwrite.
- Transport changes must use transport assignment workflows.
- Financial changes must use charge/payment/adjustment workflows.

### Errors

- `409`: Attempted update would overwrite a historical source of truth or create ambiguous current state.

## Existing Related Contracts Preserved

The following existing endpoints remain part of the student identity boundary and should continue to reference the stable student ID:

- `GET /api/students/{studentId}/profile`
- `GET /api/students/{studentId}/fee-statement`
- `GET /api/students/{studentId}/status-history`
- `GET /api/students/{studentId}/transport-history`
- `GET /api/students/{studentId}/enrollment-history`
- `POST /api/students/{studentId}/promote`
- `POST /api/students/{studentId}/repeat`
- `GET /api/payments/student/{studentId}`
- Transport assignment endpoints that create/deactivate student route allocations

## Curl Validation Requirements After Implementation

- Happy path: create/read a profile history change and confirm timeline includes it.
- Happy path: promote/transfer a student and confirm timeline includes prior and current enrollment.
- Happy path: assign/deactivate transport and confirm timeline includes transport events.
- Financial path: create charge/payment through existing workflows and confirm timeline includes financial events without changing ledger formulas.
- Error path: invalid field name returns validation error.
- Conflict path: direct class overwrite returns conflict or is routed to enrollment workflow.
- Tenant isolation: user from another tenant cannot read or mutate the student identity/timeline/profile history.
