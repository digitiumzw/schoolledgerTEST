# API Contract: Student Attendance – Class-Linked Event Tracking

**Branch**: `068-student-attendance-classes`  
**Date**: 2026-05-08  
**Base URL**: `/api`  
**Auth**: All endpoints require `Authorization: Bearer <JWT>` unless noted.  
**Response envelope**: `{ "status": "success"|"error", "data": {...}, "message": "..." }`

---

## Endpoints

### 1. Submit Class Attendance Batch

**POST** `/api/class-attendance`

Submit attendance for all or selected students in a class instance for a given date (and optional period). Each student submission creates an immutable event. If the student already has an effective event for the same tuple, the prior event is marked superseded and a new effective event is created.

**Role required**: `admin`, `super_admin`, `teacher` (teacher may only submit for their assigned class instance)

#### Request Body

```json
{
  "classInstanceId": "ci_1234_abcd",
  "date": "2026-05-08",
  "periodKey": null,
  "records": [
    {
      "studentId": "s_abcd",
      "status": "present",
      "remarks": ""
    },
    {
      "studentId": "s_efgh",
      "status": "absent",
      "remarks": "Parent notified"
    }
  ]
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `classInstanceId` | string | yes | Must belong to submitter's tenant |
| `date` | string (YYYY-MM-DD) | yes | Cannot be a future date |
| `periodKey` | string\|null | no | Required when `studentAttendanceMode = "per_period"`; must be omitted or null when `"per_day"` |
| `records` | array | yes | Min 1, max 200 per batch |
| `records[].studentId` | string | yes | Must have active enrollment in `classInstanceId` |
| `records[].status` | string | yes | One of: `present`, `absent`, `late`, `excused`, `half_day` |
| `records[].remarks` | string | no | Max 500 chars |

#### Response 201 Created

```json
{
  "status": "success",
  "data": {
    "saved": 2,
    "skipped": 0,
    "skippedReasons": [],
    "date": "2026-05-08",
    "classInstanceId": "ci_1234_abcd",
    "periodKey": null
  },
  "message": "Attendance recorded"
}
```

`skipped` > 0 occurs when a student in `records` does not have an active enrollment in the class instance. Each skipped item includes `{ "studentId": "...", "reason": "not_enrolled" }`.

#### Error Responses

| Status | Condition |
|---|---|
| `400` | `date` is in the future, invalid date format, duplicate `studentId` in batch |
| `400` | `periodKey` provided but mode is `per_day`, or missing when mode is `per_period` |
| `401` | Missing or invalid JWT |
| `403` | Role not permitted |
| `404` | `classInstanceId` not found in tenant |
| `422` | `records` is empty or exceeds 200 entries; invalid status value |

---

### 2. Get Effective Attendance for a Class Instance on a Date

**GET** `/api/class-attendance?classInstanceId={id}&date={YYYY-MM-DD}[&periodKey={key}]`

Returns the current effective attendance records (one per student) for the given class instance and date. This is the primary read for displaying today's attendance register.

**Role required**: `admin`, `super_admin`, `teacher`, `bursar`

#### Response 200 OK

```json
{
  "status": "success",
  "data": {
    "classInstanceId": "ci_1234_abcd",
    "date": "2026-05-08",
    "periodKey": null,
    "records": [
      {
        "id": "sae_1234_abcd5678",
        "studentId": "s_abcd",
        "studentName": "Alice Mutasa",
        "status": "present",
        "remarks": "",
        "submittedBy": "u_xyz",
        "submittedAt": "2026-05-08T07:45:00"
      }
    ],
    "totalStudents": 28,
    "presentCount": 25,
    "absentCount": 2,
    "lateCount": 1,
    "excusedCount": 0,
    "halfDayCount": 0
  },
  "message": ""
}
```

#### Error Responses

| Status | Condition |
|---|---|
| `400` | Missing required query params, invalid date |
| `401` | Missing or invalid JWT |
| `404` | `classInstanceId` not found in tenant |

---

### 3. Get Per-Student Attendance Summary

**GET** `/api/class-attendance/summary/student/{studentId}?sessionId={academicSession}[&startDate={YYYY-MM-DD}&endDate={YYYY-MM-DD}]`

Returns aggregated attendance statistics for one student over a session or date range.

**Role required**: `admin`, `super_admin`, `teacher`, `bursar`

#### Response 200 OK

```json
{
  "status": "success",
  "data": {
    "studentId": "s_abcd",
    "studentName": "Alice Mutasa",
    "academicSession": "2025/2026",
    "startDate": "2026-01-01",
    "endDate": "2026-05-08",
    "totalDays": 80,
    "present": 72,
    "absent": 4,
    "late": 3,
    "excused": 1,
    "halfDay": 0,
    "attendanceRate": 93.8,
    "classBreakdown": [
      {
        "classInstanceId": "ci_1234_abcd",
        "className": "Grade 4A",
        "academicYear": "2025/2026",
        "totalDays": 80,
        "present": 72,
        "attendanceRate": 93.8
      }
    ]
  },
  "message": ""
}
```

---

### 4. Get Class-Level Attendance Summary

**GET** `/api/class-attendance/summary/class/{classInstanceId}?startDate={YYYY-MM-DD}&endDate={YYYY-MM-DD}[&search={string}]`

Returns per-student breakdown and overall rate for a class instance over a date range.

**Role required**: `admin`, `super_admin`, `teacher`, `bursar`

#### Response 200 OK

```json
{
  "status": "success",
  "data": {
    "classInstanceId": "ci_1234_abcd",
    "className": "Grade 4A",
    "academicYear": "2025/2026",
    "startDate": "2026-01-01",
    "endDate": "2026-05-08",
    "classAttendanceRate": 91.5,
    "totalStudents": 28,
    "students": [
      {
        "studentId": "s_abcd",
        "studentName": "Alice Mutasa",
        "totalDays": 80,
        "present": 72,
        "absent": 4,
        "late": 3,
        "excused": 1,
        "halfDay": 0,
        "attendanceRate": 93.8
      }
    ]
  },
  "message": ""
}
```

#### Error Responses

| Status | Condition |
|---|---|
| `400` | Missing `startDate` or `endDate`, invalid date format |
| `401` | Missing or invalid JWT |
| `404` | `classInstanceId` not found in tenant |

---

### 5. Get Term-Level (Session) Attendance Summary

**GET** `/api/class-attendance/summary/session?academicSession={string}&tenantId={from JWT}`

Returns one row per class instance for the given session with overall class rates.

**Role required**: `admin`, `super_admin`

#### Response 200 OK

```json
{
  "status": "success",
  "data": {
    "academicSession": "2025/2026",
    "classes": [
      {
        "classInstanceId": "ci_1234_abcd",
        "className": "Grade 4A",
        "totalStudents": 28,
        "totalDaysRecorded": 80,
        "classAttendanceRate": 91.5
      }
    ]
  },
  "message": ""
}
```

---

### 6. Get Attendance Audit Log

**GET** `/api/class-attendance/audit?studentId={id}&classInstanceId={id}&date={YYYY-MM-DD}[&periodKey={key}]`

Returns all events (including superseded) for the given student, class instance, and date, ordered oldest first. Used to inspect the correction history.

**Role required**: `admin`, `super_admin`

#### Response 200 OK

```json
{
  "status": "success",
  "data": {
    "studentId": "s_abcd",
    "classInstanceId": "ci_1234_abcd",
    "date": "2026-05-08",
    "periodKey": null,
    "events": [
      {
        "id": "sae_1234_abcd1111",
        "status": "absent",
        "isEffective": false,
        "submittedBy": "u_xyz",
        "submittedAt": "2026-05-08T07:45:00",
        "remarks": ""
      },
      {
        "id": "sae_1234_abcd2222",
        "status": "present",
        "isEffective": true,
        "submittedBy": "u_xyz",
        "submittedAt": "2026-05-08T08:30:00",
        "remarks": "Corrected — student arrived late"
      }
    ]
  },
  "message": ""
}
```

#### Error Responses

| Status | Condition |
|---|---|
| `400` | Missing required params, invalid date |
| `401` | Missing or invalid JWT |
| `403` | Role not permitted |
| `404` | Student or class instance not found in tenant |

---

## Settings Endpoint Extension (Existing)

**GET** `/api/settings` — no change to contract; response now includes:

```json
{
  "studentAttendanceMode": "per_day"
}
```

**PUT** `/api/settings` — accepts `studentAttendanceMode: "per_day" | "per_period"` in the body (admin-only, same as all other settings mutations).

---

## Route Registration Order

All new routes must be registered **before** any `(:segment)` wildcard in `Routes.php`:

```
GET  /api/class-attendance/summary/student/(:segment)
GET  /api/class-attendance/summary/class/(:segment)
GET  /api/class-attendance/summary/session
GET  /api/class-attendance/audit
GET  /api/class-attendance
POST /api/class-attendance
```
