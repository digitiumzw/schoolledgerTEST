# API Contracts: Academic Year Class Migration via Enrollment History

**Feature**: `048-academic-year-enrollment-migration`  
**Date**: 2026-04-27  
**Base URL**: `/api`  
**Auth**: All endpoints require `Authorization: Bearer <JWT>` (school tenant JWT)  
**Response envelope**: `{ "status": true|false, "data": ..., "message": "..." }` (existing `respondSuccess` / `respondError` pattern)

---

## New Endpoints

### Class Instances

---

#### `GET /api/class-instances`

List all class instances for the authenticated tenant, optionally filtered by academic year.

**Query params**:
| Param | Type | Required | Notes |
|-------|------|----------|-------|
| `academic_year` | string | No | Filter e.g. `2025/2026`. Omit for all years. |
| `class_id` | string | No | Filter by template class. |

**Response `200`**:
```json
{
  "status": true,
  "data": [
    {
      "id": "ci_abc123",
      "tenantId": "tenant_xyz",
      "classId": "c_grade1",
      "className": "Grade 1",
      "gradeLevelId": "gl_primary",
      "gradeLevelName": "Primary",
      "academicYear": "2025/2026",
      "teacherId": "staff_001",
      "capacity": 30,
      "isFinalClass": false,
      "studentCount": 24,
      "createdAt": "2025-01-15T08:00:00Z"
    }
  ],
  "message": "OK"
}
```

---

#### `POST /api/class-instances/generate`

Bulk-generate class instances for a given academic year from all active (non-archived) class templates. Idempotent — existing instances are returned without creating duplicates.

**Request body**:
```json
{
  "academicYear": "2026/2027"
}
```

**Validation**:
- `academicYear` required, format `YYYY/YYYY+1`
- `academicYear` must not precede the tenant's current academic year by more than 1 year (guard against typos)

**Response `200`**:
```json
{
  "status": true,
  "data": {
    "created": 4,
    "existing": 1,
    "total": 5,
    "instances": [ /* array of ClassInstance objects as above */ ]
  },
  "message": "5 class instances ready for 2026/2027 (4 created, 1 already existed)"
}
```

**Response `400`** — missing or invalid academic year:
```json
{ "status": false, "message": "academicYear is required and must match YYYY/YYYY+1 format", "errors": [] }
```

---

#### `GET /api/class-instances/:id`

Get a single class instance with its current student enrollment count.

**Response `200`**: Single ClassInstance object (same shape as array item above).  
**Response `404`**: `{ "status": false, "message": "Class instance not found" }`

---

#### `GET /api/class-instances/:id/students`

List students with an ACTIVE enrollment in this class instance.

**Response `200`**:
```json
{
  "status": true,
  "data": [
    {
      "id": "s_001",
      "firstName": "Alice",
      "lastName": "Mwangi",
      "enrollmentId": "enroll_abc",
      "enrollmentDate": "2025-01-20",
      "status": "active"
    }
  ],
  "message": "OK"
}
```

---

### Year-End Migration

---

#### `POST /api/class-migration/preview`

Dry-run migration. Returns the planned outcome for every ACTIVE enrollment in the current academic year — no data is written.

**Request body**:
```json
{
  "fromAcademicYear": "2025/2026",
  "toAcademicYear": "2026/2027"
}
```

**Validation**:
- Both fields required.
- `toAcademicYear` must be exactly one year ahead of `fromAcademicYear`.

**Response `200`**:
```json
{
  "status": true,
  "data": {
    "fromAcademicYear": "2025/2026",
    "toAcademicYear": "2026/2027",
    "summary": {
      "totalStudents": 120,
      "promoted": 95,
      "repeated": 10,
      "graduated": 12,
      "skipped": 3
    },
    "byClass": [
      {
        "classId": "c_grade1",
        "className": "Grade 1",
        "instanceId": "ci_abc",
        "status": "promotable",
        "action": "promote",
        "destinationClassId": "c_grade2",
        "destinationClassName": "Grade 2",
        "studentsPromoted": 28,
        "studentsRepeated": 2,
        "studentsSkipped": 0
      },
      {
        "classId": "c_form6",
        "className": "Form 6",
        "instanceId": "ci_xyz",
        "status": "final",
        "action": "graduate",
        "destinationClassId": null,
        "destinationClassName": null,
        "studentsPromoted": 0,
        "studentsRepeated": 0,
        "studentsGraduated": 12,
        "studentsSkipped": 0
      }
    ],
    "skippedStudents": [
      {
        "studentId": "s_003",
        "studentName": "Bob Kamau",
        "classId": "c_unconfigured",
        "className": "Remedial",
        "reason": "No next class configured and class is not marked as final"
      }
    ]
  },
  "message": "Preview ready — no changes written"
}
```

**Response `400`** — missing fields or year gap invalid:
```json
{ "status": false, "message": "toAcademicYear must be exactly one year ahead of fromAcademicYear" }
```

**Response `422`** — no ACTIVE enrollments found for `fromAcademicYear`:
```json
{ "status": false, "message": "No active enrollments found for academic year 2025/2026" }
```

---

#### `POST /api/class-migration/run`

Execute year-end migration. Closes all ACTIVE enrollments for `fromAcademicYear`, creates new enrollments for `toAcademicYear`, and updates `students.class_id` / `students.current_enrollment_id`. Entire operation runs in a single DB transaction per tenant.

**Request body**:
```json
{
  "fromAcademicYear": "2025/2026",
  "toAcademicYear": "2026/2027",
  "confirm": true
}
```

**Validation**:
- `confirm: true` required — prevents accidental execution.
- Same academic year validations as preview.
- Guard: if any enrollment for `fromAcademicYear` is already non-ACTIVE (i.e., migration was already run), returns `409`.

**Response `200`** — migration completed:
```json
{
  "status": true,
  "data": {
    "fromAcademicYear": "2025/2026",
    "toAcademicYear": "2026/2027",
    "summary": {
      "totalStudents": 120,
      "promoted": 95,
      "repeated": 10,
      "graduated": 12,
      "skipped": 3
    },
    "skippedStudents": [
      {
        "studentId": "s_003",
        "studentName": "Bob Kamau",
        "reason": "No next class configured and class is not marked as final"
      }
    ],
    "newAcademicYear": "2026/2027"
  },
  "message": "Year-end migration completed: 95 promoted, 10 repeated, 12 graduated, 3 skipped"
}
```

**Response `409`** — migration already run for this year:
```json
{ "status": false, "message": "Migration from 2025/2026 has already been executed. No ACTIVE enrollments remain for that year." }
```

**Response `400`** — `confirm` not set:
```json
{ "status": false, "message": "confirm: true is required to execute migration" }
```

**Response `500`** — transaction failure (rolled back fully):
```json
{ "status": false, "message": "Migration failed and was rolled back. No data was modified. Error: ..." }
```

---

### Class Progression Mappings (P3)

---

#### `GET /api/class-progression-mappings`

List all progression mapping overrides for the tenant.

**Response `200`**:
```json
{
  "status": true,
  "data": [
    {
      "id": "cpm_001",
      "tenantId": "tenant_xyz",
      "sourceClassId": "c_form2",
      "sourceClassName": "Form 2",
      "stream": "Science",
      "destinationClassId": "c_form3sci",
      "destinationClassName": "Form 3 Science"
    }
  ]
}
```

---

#### `POST /api/class-progression-mappings`

Create a new progression mapping.

**Request body**:
```json
{
  "sourceClassId": "c_form2",
  "stream": "Science",
  "destinationClassId": "c_form3sci"
}
```

**Validation**:
- `sourceClassId` and `destinationClassId` required, must belong to the same tenant.
- `stream` optional; when provided, matches against `classes.stream` of the source class instance.
- `sourceClassId !== destinationClassId`.
- Duplicate `(sourceClassId, stream)` for tenant returns `409`.

**Response `201`**: Created mapping object.  
**Response `409`**: `{ "status": false, "message": "A mapping for this source class and stream already exists" }`

---

#### `DELETE /api/class-progression-mappings/:id`

Delete a progression mapping. Does not affect any existing enrollments.

**Response `200`**: `{ "status": true, "data": { "id": "cpm_001" }, "message": "Mapping deleted" }`  
**Response `404`**: Mapping not found or not owned by tenant.

---

## Modified Existing Endpoints

### `GET /api/students/:id/enrollment-history`

**Change**: When `class_instance_id` is populated on an enrollment, the response includes `academicYear` (from the class instance) and `classTemplateName` in addition to the existing fields.

**Updated response item**:
```json
{
  "id": "enroll_abc",
  "tenantId": "tenant_xyz",
  "studentId": "s_001",
  "classId": "c_grade1",
  "classInstanceId": "ci_abc123",
  "className": "Grade 1",
  "academicYear": "2025/2026",
  "academicSession": "2025/2026",
  "status": "PROMOTED",
  "enrollmentDate": "2025-01-20",
  "completionDate": "2025-11-30",
  "remarks": "Promoted to Grade 2"
}
```

**Backward compatibility**: Enrollments without `class_instance_id` (legacy) still return `classInstanceId: null` and `academicYear` derived from `academic_session`.

---

## Role Requirements

All new endpoints require admin-level JWT (role: `admin` or `super_admin`). Teachers may read class instance student lists for their own assigned class instances only.

| Endpoint | admin | teacher | bursar |
|----------|-------|---------|--------|
| `GET /class-instances` | ✅ | ✅ (own only) | ✅ |
| `POST /class-instances/generate` | ✅ | ❌ | ❌ |
| `GET /class-instances/:id/students` | ✅ | ✅ (own only) | ❌ |
| `POST /class-migration/preview` | ✅ | ❌ | ❌ |
| `POST /class-migration/run` | ✅ | ❌ | ❌ |
| `GET /class-progression-mappings` | ✅ | ❌ | ❌ |
| `POST /class-progression-mappings` | ✅ | ❌ | ❌ |
| `DELETE /class-progression-mappings/:id` | ✅ | ❌ | ❌ |
