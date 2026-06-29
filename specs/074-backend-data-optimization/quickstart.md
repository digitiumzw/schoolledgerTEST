# Quickstart: Backend Data Optimization

**Feature**: 074-backend-data-optimization  
**Purpose**: Post-implementation validation guide. Per the constitution, curl endpoint tests must be run after implementation is complete.

## Prerequisites

1. Backend server running at `http://localhost:8080`.
2. Frontend dependencies installed for TypeScript/ESLint validation.
3. Database migrated with any new performance index migrations.
4. Test tenant contains representative data for students, classes, staff attendance, class attendance, and payments.
5. Large-dataset validation should use at least 50,000 relevant records where feasible, or document the available dataset size.

## Login

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@greenwood.co.zw","password":"12345678"}' | jq -r '.data.token')
```

## Student Page API

```bash
curl -s "http://localhost:8080/api/students-optimized?page=1&limit=20&search=a&status=all&sortBy=name&sortOrder=asc&includeClasses=true" \
  -H "Authorization: Bearer $TOKEN" | jq '.status, .data.pagination, .data.stats'
```

Expected:

- HTTP 200.
- `data.students` length is no more than `limit`.
- `pagination.total` reflects all matching records.
- `stats` is present and backend-authoritative.

## Classes Page API

```bash
curl -s "http://localhost:8080/api/classes?archived=false&page=1&limit=20&search=10&sortBy=name&sortOrder=asc&includeTeachers=true" \
  -H "Authorization: Bearer $TOKEN" | jq '.status, .data.pagination, .data.summary'
```

Expected:

- HTTP 200.
- `data.classes` length is bounded by `limit`.
- Class summary metrics are returned by the backend.

## Class Roster API

```bash
CLASS_ID="replace-with-class-id"
curl -s "http://localhost:8080/api/classes/$CLASS_ID/students?page=1&limit=20&search=a&status=all&sortBy=name&sortOrder=asc" \
  -H "Authorization: Bearer $TOKEN" | jq '.status, .data.pagination, .data.summary'
```

Expected:

- HTTP 200 for tenant-owned class.
- Roster rows are paginated.
- Summary includes capacity/student-count metadata.

## Staff Attendance Records API

```bash
curl -s "http://localhost:8080/api/staff-attendance?page=1&limit=20&status=all&start_date=2026-01-01&end_date=2026-12-31&sortBy=date&sortOrder=desc" \
  -H "Authorization: Bearer $TOKEN" | jq '.status, .data.pagination, .data.summary'
```

Expected:

- HTTP 200.
- Records length is bounded by `limit`.
- Summary counts/rates are backend-provided.

## Staff Attendance Report API

```bash
curl -s "http://localhost:8080/api/staff-attendance/report?startDate=2026-01-01&endDate=2026-01-31&page=1&limit=20&sortBy=staffName&sortOrder=asc" \
  -H "Authorization: Bearer $TOKEN" | jq '.status, .data.pagination, .data.summary'
```

Expected:

- HTTP 200.
- Working days, rates, leave handling, and overtime totals are returned by the backend.

## Class Attendance Register API

```bash
curl -s "http://localhost:8080/api/class-attendance?classId=$CLASS_ID&date=2026-01-15&page=1&limit=20&sortBy=studentName&sortOrder=asc" \
  -H "Authorization: Bearer $TOKEN" | jq '.status, .data.pagination, .data.summary'
```

Expected:

- HTTP 200 for valid class/date.
- Effective register rows are bounded.
- Status counts and attendance rate are backend-provided.

## Student Payment History API

```bash
STUDENT_ID="replace-with-student-id"
curl -s "http://localhost:8080/api/payments/student/$STUDENT_ID?page=1&limit=15&sortBy=date&sortOrder=desc" \
  -H "Authorization: Bearer $TOKEN" | jq '.status, .data.pagination, .data.summary, .data.student.currentBalance'
```

Expected:

- HTTP 200 for tenant-owned student.
- Payment rows are bounded by `limit`.
- Summary and balance fields are backend-derived.

## Invalid Input Checks

```bash
curl -i -s "http://localhost:8080/api/students-optimized?page=0&limit=9999&sortBy=unsupported" \
  -H "Authorization: Bearer $TOKEN"

curl -i -s "http://localhost:8080/api/staff-attendance/report?startDate=2026-02-01&endDate=2026-01-01" \
  -H "Authorization: Bearer $TOKEN"
```

Expected:

- HTTP 400 or 422.
- Error envelope includes clear validation messages.

## Auth and Tenant Isolation Checks

```bash
curl -i -s "http://localhost:8080/api/students-optimized?page=1&limit=20"
```

Expected:

- HTTP 401 without token.

For tenant isolation, login as a second tenant and request a known first-tenant class/student/payment-history resource.

Expected:

- HTTP 404 or empty tenant-scoped result.
- No first-tenant row or summary data appears.

## Frontend Validation

```bash
cd frontend
./node_modules/.bin/tsc --noEmit --pretty false
./node_modules/.bin/eslint src/pages/Students.tsx src/pages/Classes.tsx src/pages/StaffAttendance.tsx src/components/staff-attendance/AttendanceRecordsTab.tsx src/components/staff-attendance/AttendancePeriodReport.tsx src/components/attendance/ClassAttendanceTab.tsx src/components/modals/PaymentHistoryModal.tsx src/hooks/useStaffAttendanceData.ts src/hooks/useClassAttendance.ts
```

Expected:

- TypeScript passes.
- Targeted ESLint passes or documents pre-existing unrelated debt.

## Backend Validation

```bash
cd backend
php -l app/Controllers/Api/StudentController.php
php -l app/Controllers/Api/StudentsOptimizedController.php
php -l app/Controllers/Api/AttendanceController.php
php -l app/Controllers/Api/ClassController.php
php -l app/Controllers/Api/StudentClassAttendanceController.php
php -l app/Controllers/Api/PaymentController.php
php -l app/Models/StudentModel.php
php -l app/Models/ClassModel.php
php -l app/Models/AttendanceModel.php
php -l app/Models/StudentClassAttendanceModel.php
php -l app/Models/PaymentModel.php
```

Expected:

- PHP lint passes for all touched files.

## Performance Evidence

For each primary endpoint, capture:

- Dataset size used.
- Request URL and filters.
- Response time.
- Number of returned row records.
- Whether query logs show repeated per-row lookup patterns.
- Any index added and the measured reason for adding it.

## Results

Record implementation validation results here after `/speckit.implement`.
