# API Contract: Student Attendance Kiosk

**Feature**: `012-teacher-student-kiosk`  
**Date**: 2026-04-07  
**Base path**: `/api`  
**Auth**: None required — all endpoints are public (no JWT). Tenant is resolved from the opaque `kiosk_code` in the URL or request body.

---

## Endpoints

### GET `/api/kiosk/student-attendance/status/:code`

Check whether the student attendance kiosk is enabled for the tenant identified by `:code`.

**Path params**

| Param | Type | Description |
|-------|------|-------------|
| `code` | string | Opaque kiosk code from tenant settings |

**Response 200**

```json
{
  "status": true,
  "data": {
    "kioskEnabled": true,
    "schoolName": "Demo School",
    "date": "2026-04-07"
  }
}
```

| Field | Type | Notes |
|-------|------|-------|
| `kioskEnabled` | boolean | Reflects `settings.studentKioskModeEnabled` (NOT the staff flag) |
| `schoolName` | string | Displayed on the kiosk idle screen |
| `date` | string | Server date `YYYY-MM-DD` |

**Response 404** — Invalid or unknown kiosk code.

```json
{ "status": false, "message": "Kiosk not found" }
```

---

### POST `/api/kiosk/student-attendance/validate-teacher`

Validate a teacher's Employee ID and return their assigned classes with attendance status for today.

**Request body**

```json
{
  "kiosk_code": "abc123xyz0",
  "employee_id": "EMP0042"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `kiosk_code` | yes | Opaque tenant kiosk code |
| `employee_id` | yes | Teacher's employee ID |

**Response 200**

```json
{
  "status": true,
  "data": {
    "teacherName": "Jane Moyo",
    "employeeId": "EMP0042",
    "classes": [
      {
        "id": "cls_abc",
        "name": "Grade 7A",
        "studentCount": 32,
        "attendanceRecorded": false
      }
    ]
  }
}
```

| Field | Type | Notes |
|-------|------|-------|
| `teacherName` | string | `first_name last_name` of the validated teacher |
| `employeeId` | string | Echo of the submitted Employee ID |
| `classes` | array | Only classes where `teacher_id = staff.id` and `archived_at IS NULL` |
| `classes[].attendanceRecorded` | boolean | `true` if at least one `student_attendance` record exists for this class today |

**Response 403** — Invalid, unrecognised, inactive, or non-teaching employee ID; kiosk disabled.

```json
{ "status": false, "message": "Employee ID not recognized" }
```

> Note: The 403 message deliberately does not distinguish "not found" from "inactive" or "non-teaching" to prevent staff enumeration.

---

### GET `/api/kiosk/student-attendance/class-students/:code`

Fetch the student list for a selected class, pre-populated with today's existing attendance marks.

**Path params**

| Param | Type | Description |
|-------|------|-------------|
| `code` | string | Opaque kiosk code |

**Query params**

| Param | Required | Description |
|-------|----------|-------------|
| `employee_id` | yes | Teacher's employee ID (re-validated on every request) |
| `class_id` | yes | ID of the class to load |

**Response 200**

```json
{
  "status": true,
  "data": {
    "className": "Grade 7A",
    "date": "2026-04-07",
    "students": [
      {
        "id": "stu_001",
        "firstName": "Alice",
        "lastName": "Banda",
        "currentStatus": null
      },
      {
        "id": "stu_002",
        "firstName": "Bob",
        "lastName": "Chisi",
        "currentStatus": "present"
      }
    ]
  }
}
```

| Field | Type | Notes |
|-------|------|-------|
| `students[].currentStatus` | string or null | Pre-fill value from today's existing `student_attendance` record; `null` if no record exists yet |
| `students` | array | Only active students with active enrolment; ordered by `last_name ASC, first_name ASC` |

**Response 400** — Missing required query params.  
**Response 403** — Invalid teacher, class not assigned to teacher, or kiosk disabled.  
**Response 404** — Unknown kiosk code.

---

### POST `/api/kiosk/student-attendance/submit`

Submit (or update) attendance marks for a class. Re-validates teacher and class on every call.

**Request body**

```json
{
  "kiosk_code": "abc123xyz0",
  "employee_id": "EMP0042",
  "class_id": "cls_abc",
  "date": "2026-04-07",
  "records": [
    { "studentId": "stu_001", "status": "present", "remarks": null },
    { "studentId": "stu_002", "status": "absent",  "remarks": "No reason provided" }
  ]
}
```

| Field | Required | Type | Notes |
|-------|----------|------|-------|
| `kiosk_code` | yes | string | Opaque kiosk code |
| `employee_id` | yes | string | Teacher's employee ID — stored in `recorded_by` on every saved record |
| `class_id` | yes | string | Class being submitted for |
| `date` | no | string `YYYY-MM-DD` | Defaults to today's server date if omitted |
| `records` | yes | array | At least one record required |
| `records[].studentId` | yes | string | |
| `records[].status` | yes | enum | `present`, `absent`, `late`, `excused` |
| `records[].remarks` | no | string or null | |

**Upsert behaviour**: If a `student_attendance` row already exists for `(tenant_id, student_id, date)`, it is **updated** (status, remarks, class_id, recorded_by). Otherwise a new row is inserted.

**Response 200**

```json
{
  "status": true,
  "message": "Attendance saved successfully",
  "data": {
    "className": "Grade 7A",
    "date": "2026-04-07",
    "totalStudents": 32,
    "saved": 32,
    "recordedBy": "EMP0042"
  }
}
```

| Field | Type | Notes |
|-------|------|-------|
| `totalStudents` | integer | Total records received in the request |
| `saved` | integer | Records actually written (skips rows with missing/invalid studentId or status) |
| `recordedBy` | string | Employee ID of the submitting teacher — confirms audit attribution |

**Response 400** — Missing required fields or empty records array.  
**Response 403** — Invalid teacher, class not assigned to teacher, or kiosk disabled.

---

## Settings API (admin — JWT required)

These endpoints are consumed by the admin Settings page, not the kiosk page itself.

### GET `/api/settings`

Returns the full settings object for the authenticated tenant.

**Relevant fields in response `data`**

```json
{
  "kioskModeEnabled": true,
  "studentKioskModeEnabled": false,
  "kioskCode": "abc123xyz0"
}
```

| Field | Notes |
|-------|-------|
| `studentKioskModeEnabled` | New field. Defaults to `false` when absent in stored settings. |
| `kioskCode` | Shared between staff and student kiosk. Used to construct `/kiosk/{code}/students` URL. |

### PUT `/api/settings`

Saves settings. The `studentKioskModeEnabled` field must be persisted as `studentKioskModeEnabled` in the tenant's JSON settings blob.

---

## Admin Attendance API (JWT required)

### GET `/api/student-attendance`

Existing endpoint. Needs `recordedBy` filter support.

**Query params (new)**

| Param | Description |
|-------|-------------|
| `recordedBy` | Filter records by the `recorded_by` field (Employee ID string). Optional. |

---

## Error Response Format (all endpoints)

```json
{
  "status": false,
  "message": "Human-readable error description"
}
```

HTTP status codes used: `200` success, `400` bad request, `403` forbidden / invalid identity, `404` not found.
