# API Contracts: Classes Module

**Branch**: `004-redo-classes-module` | **Date**: 2026-04-06  
**Base URL**: `/api`  
**Auth**: All endpoints require `Authorization: Bearer <JWT>` header.  
**Tenant scoping**: `tenant_id` is always sourced from the decoded JWT — never from request body.

---

## Grade Levels

### GET /api/grade-levels

List all grade levels for the authenticated tenant.

**Roles**: all authenticated roles

**Response 200**:
```json
{
  "status": "success",
  "data": [
    {
      "id": "gl_001",
      "tenantId": "tenant_001",
      "name": "Form 1",
      "sortOrder": 1,
      "classCount": 3
    }
  ]
}
```

---

### GET /api/grade-levels/:id

Get a single grade level with its attached classes.

**Roles**: all authenticated roles

**Response 200**:
```json
{
  "status": "success",
  "data": {
    "id": "gl_001",
    "tenantId": "tenant_001",
    "name": "Form 1",
    "sortOrder": 1,
    "classCount": 3,
    "classes": [
      { "id": "class_001", "name": "Form 1A", "stream": "A" }
    ]
  }
}
```

**Response 404**: Grade level not found or belongs to different tenant.

---

### POST /api/grade-levels

Create a new grade level.

**Roles**: `admin`, `super_admin`

**Request body**:
```json
{
  "name": "Form 1",
  "sortOrder": 1
}
```

| Field | Required | Notes |
|-------|----------|-------|
| name | YES | Non-empty string; must be unique per tenant |
| sortOrder | NO | Auto-assigned as max + 1 if omitted |

**Response 201**: Created grade level object (same shape as GET /id response, without classes array).

**Response 409**: `{ "status": "error", "message": "A grade level with this name already exists" }`

**Response 422**: Validation error for missing/invalid fields.

---

### PUT /api/grade-levels/:id

Update a grade level's name or sort order.

**Roles**: `admin`, `super_admin`

**Request body** (all fields optional):
```json
{
  "name": "Form 1 Updated",
  "sortOrder": 2
}
```

**Response 200**: Updated grade level object.

**Response 404**: Not found or wrong tenant.

**Response 409**: Name conflict with another grade level in same tenant.

---

### DELETE /api/grade-levels/:id

Delete a grade level. Cascades `grade_level_id` to NULL on linked classes (does not delete classes).

**Roles**: `admin`, `super_admin`

**Response 200**: `{ "status": "success", "message": "Grade level deleted" }`

**Response 404**: Not found or wrong tenant.

**Response 409**: Grade level still has classes — cannot delete.

---

### PUT /api/grade-levels/reorder

Bulk-update sort order for all grade levels.

**Roles**: `admin`, `super_admin`

**Request body**:
```json
{
  "order": [
    { "id": "gl_001", "sortOrder": 1 },
    { "id": "gl_002", "sortOrder": 2 }
  ]
}
```

**Response 200**: `{ "status": "success", "message": "Grade levels reordered" }`

---

## Classes

### GET /api/classes

List all classes for the authenticated tenant. Teachers see only their assigned class.

**Roles**: all authenticated roles

**Query parameters**:
| Param | Type | Notes |
|-------|------|-------|
| include_archived | boolean | Include soft-deleted classes (default: false) |
| grade_level_id | string | Filter by grade level |

**Response 200**:
```json
{
  "status": "success",
  "data": [
    {
      "id": "class_001",
      "tenantId": "tenant_001",
      "name": "Form 1A",
      "gradeLevelId": "gl_001",
      "gradeLevel": { "id": "gl_001", "name": "Form 1", "sortOrder": 1 },
      "stream": "A",
      "teacherId": "staff_001",
      "nextClassId": "class_002",
      "nextClass": { "id": "class_002", "name": "Form 2A" },
      "capacity": 35,
      "studentCount": 28,
      "isFinalClass": false,
      "archivedAt": null
    }
  ]
}
```

---

### GET /api/classes/:id

Get a single class with full details.

**Roles**: all authenticated roles (teachers restricted to their assigned class)

**Response 200**: Single class object (same shape as list item above).

**Response 403**: Teacher attempting to access a class they are not assigned to.

**Response 404**: Class not found or belongs to different tenant.

---

### POST /api/classes

Create a new class.

**Roles**: `admin`, `super_admin`

**Request body**:
```json
{
  "name": "Form 1A",
  "gradeLevelId": "gl_001",
  "stream": "A",
  "teacherId": "staff_001",
  "capacity": 35,
  "nextClassId": "class_002"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| name | YES | Non-empty string |
| gradeLevelId | NO | Must belong to same tenant if provided |
| stream | NO | Stream identifier within the grade |
| teacherId | NO | Must be a valid staff member in same tenant |
| capacity | NO | Positive integer; defaults to 30 |
| nextClassId | NO | Must not create a promotion cycle |

**Uniqueness rule**: `(tenant_id, grade_level_id, name, stream)` must be unique.

**Response 201**: Created class object.

**Response 409**: Uniqueness conflict on name+stream within grade level.

**Response 422**: Validation error (missing name, invalid grade level, promotion cycle detected).

---

### PUT /api/classes/:id

Update a class.

**Roles**: `admin`, `super_admin`

**Request body** (all fields optional):
```json
{
  "name": "Form 1A",
  "gradeLevelId": "gl_001",
  "stream": "A",
  "teacherId": "staff_001",
  "capacity": 35,
  "nextClassId": "class_002"
}
```

**Response 200**: Updated class object.

**Response 404**: Not found or wrong tenant.

**Response 409**: Uniqueness conflict or promotion cycle detected.

---

### DELETE /api/classes/:id

Soft-delete (archive) a class.

**Roles**: `admin`, `super_admin`

**Business rule**: Blocked if class has active enrolled students.

**Response 200**: `{ "status": "success", "message": "Class archived" }`

**Response 409**: `{ "status": "error", "message": "Cannot archive a class with active students", "data": { "activeStudentCount": 12 } }`

---

### POST /api/classes/:id/unarchive

Restore an archived class.

**Roles**: `admin`, `super_admin`

**Response 200**: `{ "status": "success", "message": "Class restored" }`

**Response 404**: Not found or wrong tenant.

---

### DELETE /api/classes/:id/permanent-delete

Permanently delete a class.

**Business rule**: Blocked if class has any enrollment history (any status, any time).

**Roles**: `admin`, `super_admin`

**Response 200**: `{ "status": "success", "message": "Class permanently deleted" }`

**Response 409**: `{ "status": "error", "message": "Cannot permanently delete a class with enrollment history" }`

---

### GET /api/classes/:id/students

Get all active students enrolled in a class.

**Roles**: all authenticated roles (teachers restricted to their class)

**Response 200**:
```json
{
  "status": "success",
  "data": [
    {
      "id": "student_001",
      "admissionNumber": "ADM001",
      "firstName": "Jane",
      "lastName": "Doe",
      "status": "active"
    }
  ]
}
```

---

### GET /api/classes/:id/student-count

Get the active student count for a single class.

**Roles**: all authenticated roles

**Response 200**: `{ "status": "success", "data": { "count": 28 } }`

---

### GET /api/classes/student-counts

Batch fetch active student counts for all tenant classes.

**Roles**: all authenticated roles

**Response 200**:
```json
{
  "status": "success",
  "data": {
    "class_001": 28,
    "class_002": 32
  }
}
```

---

### GET /api/classes/:id/enrollment-history

Check whether a class has any historical enrollment records.

**Roles**: `admin`, `super_admin`

**Response 200**: `{ "status": "success", "data": { "hasHistory": true, "count": 45 } }`

---

### POST /api/classes/:id/assign-students

Assign one or more students to a class.

**Roles**: `admin`, `super_admin`

**Request body**:
```json
{
  "studentIds": ["student_001", "student_002"],
  "force": false
}
```

| Field | Required | Notes |
|-------|----------|-------|
| studentIds | YES | Array of student IDs to assign |
| force | NO | Override capacity limit (admin only); default false |

**Business rules**:
- Students already assigned to another class are moved (unenrolled from current, enrolled in new).
- Duplicate assignments to the same class are rejected.
- Capacity is enforced unless `force: true`.

**Response 200**: `{ "status": "success", "message": "Students assigned", "data": { "assigned": 2, "skipped": 0 } }`

**Response 409** (capacity exceeded, force=false):
```json
{
  "status": "error",
  "message": "Class capacity exceeded",
  "data": {
    "capacity": 30,
    "currentCount": 28,
    "requestedCount": 5,
    "availableSlots": 2
  }
}
```

---

### GET /api/classes/:id/next-class

Get the next class in the promotion chain.

**Response 200**: `{ "status": "success", "data": { "id": "class_002", "name": "Form 2A" } }`

**Response 200** (no next class): `{ "status": "success", "data": null }`

---

### PUT /api/classes/:id/next-class

Set the next class in the promotion chain.

**Roles**: `admin`, `super_admin`

**Request body**: `{ "nextClassId": "class_002" }` or `{ "nextClassId": null }` to clear.

**Response 200**: `{ "status": "success", "message": "Next class updated" }`

**Response 422**: Promotion cycle detected.

---

### GET /api/classes/final

Get all classes with no next class (graduation/final classes).

**Roles**: all authenticated roles

**Response 200**: Array of class objects.

---

### GET /api/classes/promotion-preview

Get a preview of all students eligible for promotion per class.

**Roles**: `admin`, `super_admin`

**Response 200**:
```json
{
  "status": "success",
  "data": [
    {
      "classId": "class_001",
      "className": "Form 1A",
      "nextClassId": "class_002",
      "nextClassName": "Form 2A",
      "eligibleStudents": [
        { "id": "student_001", "name": "Jane Doe" }
      ],
      "repeatingStudentCount": 2
    }
  ]
}
```

---

## Error Response Format (standard)

All error responses follow this shape:

```json
{
  "status": "error",
  "message": "Human-readable description",
  "data": { }
}
```

HTTP status codes used:
- `200` — success
- `201` — created
- `400` — bad request (malformed input)
- `401` — unauthenticated
- `403` — forbidden (wrong role)
- `404` — not found (or belongs to different tenant)
- `409` — conflict (uniqueness, capacity, business rule violation)
- `422` — unprocessable (validation failure)
- `500` — unexpected server error
