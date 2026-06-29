# API Contracts: Backend Data Optimization

**Feature**: 074-backend-data-optimization  
**Base path**: `/api`  
**Envelope**: Successful responses use `{ "status": "success", "data": ... }`; errors use `{ "status": "error", "message": "...", "errors": ... }`.

## Common Query Parameters

- `page`: integer, minimum 1.
- `limit`: integer, bounded per endpoint.
- `search`: optional bounded text search.
- `sortBy`: endpoint-specific allowlisted field.
- `sortOrder`: `asc` or `desc`.

## Common Pagination Object

```json
{
  "page": 1,
  "limit": 20,
  "total": 250,
  "totalPages": 13
}
```

## GET /api/students-optimized

Backend-prepared Student page response.

**Query parameters**:

- `classId`: optional class id or omitted for all classes.
- `status`: optional `all`, `active`, `inactive`, `graduated`, `transferred`, `dropped_out`.
- `search`: optional text search.
- `balanceOnly`: optional boolean.
- `sortBy`: `name`, `class`, `balance`, `status`, or `admissionNumber`.
- `sortOrder`: `asc` or `desc`.
- `page`, `limit`.
- `includeClasses`: optional boolean lookup inclusion.

**Response data**:

```json
{
  "students": [],
  "classes": [],
  "stats": {
    "totalStudents": 0,
    "studentsWithOutstandingBalance": 0,
    "totalFeesOwed": 0,
    "bursaryCoveragePercentage": 0,
    "studentsOnFinancialAid": 0,
    "statusCounts": {
      "active": 0,
      "inactive": 0,
      "graduated": 0,
      "transferred": 0,
      "dropped_out": 0,
      "total": 0
    }
  },
  "pagination": { "page": 1, "limit": 20, "total": 0, "totalPages": 1 },
  "filters": {},
  "sort": { "sortBy": "name", "sortOrder": "asc" }
}
```

## GET /api/classes

Backend-prepared Classes page response. Existing class create/update/archive endpoints remain unchanged.

**Query parameters**:

- `archived`: optional `true`, `false`, or `all`.
- `search`: optional class-name search.
- `teacherId`: optional tenant-owned teacher/staff id.
- `academicYear`: optional year/session filter if supported by current class display.
- `sortBy`: `name`, `studentCount`, `capacity`, `teacherName`, `createdAt`.
- `sortOrder`: `asc` or `desc`.
- `page`, `limit`.
- `includeTeachers`: optional boolean lookup inclusion.

**Response data**:

```json
{
  "classes": [],
  "teachers": [],
  "summary": {
    "totalStudents": 0,
    "totalCapacity": 0,
    "avgFill": 0,
    "graduatingCount": 0,
    "activeCount": 0,
    "archivedCount": 0
  },
  "pagination": { "page": 1, "limit": 20, "total": 0, "totalPages": 1 },
  "filters": {},
  "sort": { "sortBy": "name", "sortOrder": "asc" }
}
```

## GET /api/classes/{classId}/students

Backend-prepared class roster response.

**Query parameters**:

- `search`: optional student search.
- `status`: optional student status or `all`.
- `academicYear`: optional academic year filter.
- `sortBy`: `name`, `admissionNumber`, `status`, `gender`.
- `sortOrder`: `asc` or `desc`.
- `page`, `limit`.

**Response data**:

```json
{
  "class": {
    "id": "class-id",
    "name": "10D",
    "capacity": 40,
    "studentCount": 0,
    "teacherName": "Teacher Name",
    "teacherId": null,
    "archivedAt": null
  },
  "students": [],
  "summary": {
    "studentCount": 0,
    "capacity": 40,
    "availableSeats": 40
  },
  "pagination": { "page": 1, "limit": 20, "total": 0, "totalPages": 1 },
  "filters": {},
  "sort": { "sortBy": "name", "sortOrder": "asc" }
}
```

## GET /api/staff-attendance

Backend-prepared staff attendance records response. Legacy single staff/date lookups may remain, but records-tab usage must consume paginated metadata.

**Query parameters**:

- `staffId`: optional staff id.
- `departmentId`: optional department id.
- `status`: optional attendance status or `all`.
- `start_date`, `end_date`: optional date range.
- `search`: optional staff search.
- `sortBy`: `date`, `staffName`, `status`, `workHours`, `overtimeHours`.
- `sortOrder`: `asc` or `desc`.
- `page`, `limit`.

**Response data**:

```json
{
  "records": [],
  "summary": {
    "present": 0,
    "absent": 0,
    "late": 0,
    "onLeave": 0,
    "earlyDeparture": 0,
    "halfDay": 0,
    "totalOvertimeHours": 0,
    "attendanceRate": 0
  },
  "pagination": { "page": 1, "limit": 20, "total": 0, "totalPages": 1 },
  "filters": {},
  "sort": { "sortBy": "date", "sortOrder": "desc" }
}
```

## GET /api/staff-attendance/report

Backend-prepared staff attendance period report.

**Query parameters**:

- `startDate`, `endDate`: required date range.
- `staffId`: optional.
- `departmentId`: optional.
- `search`: optional.
- `page`, `limit`.
- `sortBy`: `staffName`, `departmentName`, `attendanceRate`, `presentDays`, `lateDays`, `totalOvertimeHours`.
- `sortOrder`: `asc` or `desc`.

**Response data**:

```json
{
  "staff": [],
  "summary": {
    "workingDays": 0,
    "staffCount": 0,
    "averageAttendanceRate": 0,
    "totalLateDays": 0,
    "totalOvertimeHours": 0
  },
  "pagination": { "page": 1, "limit": 20, "total": 0, "totalPages": 1 },
  "filters": {},
  "sort": { "sortBy": "staffName", "sortOrder": "asc" }
}
```

## GET /api/class-attendance

Backend-prepared effective class attendance register.

**Query parameters**:

- `classId`: required unless `classInstanceId` is provided.
- `classInstanceId`: optional.
- `date`: required attendance date.
- `status`: optional status or `all`.
- `search`: optional student search.
- `page`, `limit`.
- `sortBy`: `studentName`, `admissionNumber`, `status`, `submittedAt`.
- `sortOrder`: `asc` or `desc`.

**Response data**:

```json
{
  "register": [],
  "summary": {
    "totalStudents": 0,
    "present": 0,
    "absent": 0,
    "late": 0,
    "excused": 0,
    "attendanceRate": 0,
    "corrections": 0
  },
  "pagination": { "page": 1, "limit": 20, "total": 0, "totalPages": 1 },
  "filters": {},
  "sort": { "sortBy": "studentName", "sortOrder": "asc" }
}
```

## GET /api/payments/student/{studentId}

Backend-prepared student payment history response used by related workflows.

**Query parameters**:

- `page`, `limit`.
- `sortBy`: `date`, `amount`, `method`, `category`.
- `sortOrder`: `asc` or `desc`.
- `category`: optional payment category.
- `method`: optional payment method.
- `startDate`, `endDate`: optional date range.
- `search`: optional receipt/description/category search if supported.

**Response data**:

```json
{
  "student": {
    "id": "student-id",
    "name": "Student Name",
    "currentBalance": 0
  },
  "data": [],
  "summary": {
    "totalPaid": 0,
    "totalThisTerm": 0,
    "latestPaymentDate": null,
    "latestPaymentAmount": null,
    "daysSinceLastPayment": null
  },
  "pagination": { "page": 1, "limit": 15, "total": 0, "totalPages": 1 },
  "filters": {},
  "sort": { "sortBy": "date", "sortOrder": "desc" }
}
```

## Error Responses

Invalid filters, date ranges, sort fields, or page bounds return a consistent error envelope:

```json
{
  "status": "error",
  "message": "Invalid request parameters",
  "errors": {
    "sortBy": "Unsupported sort field"
  }
}
```

Unauthorized requests return `401`; role-restricted requests return `403`; tenant-inaccessible resources return `404` where appropriate.
