# Data Model: Performance & Scalability Optimization

**Feature**: 066-performance-scalability-optimization  
**Date**: 2026-05-07

---

## Schema Changes

**No new tables or columns are required.** All optimizations are query-level changes to existing tables.

Optional follow-up (separate migration if profiling confirms need):

```sql
-- Optional: index to speed payments list filtering
ALTER TABLE payments ADD INDEX idx_payments_tenant_date (tenant_id, date DESC);
ALTER TABLE payments ADD INDEX idx_payments_tenant_method (tenant_id, method);
ALTER TABLE payments ADD INDEX idx_payments_tenant_category (tenant_id, category);
```

These indexes are NOT part of this feature's implementation scope; they are noted here for the implementer to add if query EXPLAIN shows full table scans on the payments table.

---

## New Model Methods

### `PaymentModel`

```text
getFilteredWithStudents(
    tenantId: string,
    filters: {
        search?: string,        // matches student first_name, last_name
        method?: string,
        category?: string,
        classId?: string,
        month?: int,            // 1–12
        year?: int,
        sortBy?: string,        // 'date' | 'amount' | 'studentName'
        sortOrder?: string,     // 'asc' | 'desc'
        limit: int,             // default 20, max 100
        offset: int,
    }
): array                        // paginated payment rows with student data joined

getFilteredCount(
    tenantId: string,
    filters: { search, method, category, classId, month, year }
): int                          // total matching rows (for pagination)

getStatsForTenant(
    tenantId: string
): array {
    totalThisMonth: float,
    paymentsToday: int,
    totalOutstanding: float,    // SUM(charges) - SUM(payments) using LedgerService constants
}
```

### `StudentModel` (no new methods — existing pattern reused)

`getFilteredStudents` and `getFilteredStudentsCount` already exist and are the reference implementation.

### `AttendanceModel` (new method)

```text
getClassAttendanceSummary(
    tenantId: string,
    classId: string,
    startDate: string,   // YYYY-MM-DD
    endDate: string,     // YYYY-MM-DD
    search?: string,     // filter by student name
    sortBy?: string,     // 'name' | 'presentDays' | 'attendancePercentage'
    sortOrder?: string   // 'asc' | 'desc'
): array [
    {
        studentId: string,
        studentName: string,
        presentDays: int,
        absentDays: int,
        lateDays: int,
        excusedDays: int,
    }
]
```

The query uses `COUNT(CASE WHEN status = 'present' THEN 1 END) AS present_days` etc., grouped by student, filtered by `tenant_id`, `class_id` (via JOIN to students), and `date BETWEEN startDate AND endDate`.

### `ClassModel` (existing method extended)

```text
getClassStudents(
    classId: string,
    tenantId: string,
    search?: string    // NEW — LIKE filter on first_name, last_name, admission_number
): array
```

### `TransportController` / model (search param added)

The `getRoutes()`, `getVehicles()` and `getDrivers()` endpoints accept an optional `search` query param. Filtering is a simple `LIKE '%{search}%'` on `route_name` / `name` columns, scoped by `tenant_id`.

---

## Response Shapes

### Paginated Payments Response (`GET /payments/with-students`)

```json
{
  "status": "success",
  "data": {
    "data": [ ...Payment[] ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 547,
      "totalPages": 28
    },
    "stats": {
      "totalThisMonth": 12500.00,
      "paymentsToday": 3,
      "totalOutstanding": 48200.00
    }
  }
}
```

### Attendance Class Summary Response (`GET /student-attendance/class-summary`)

```json
{
  "status": "success",
  "data": {
    "summary": [
      {
        "studentId": "s123",
        "studentName": "Alice Moyo",
        "presentDays": 18,
        "absentDays": 2,
        "lateDays": 1,
        "excusedDays": 0
      }
    ],
    "meta": {
      "classId": "cls_abc",
      "startDate": "2026-04-01",
      "endDate": "2026-04-30",
      "total": 40
    }
  }
}
```

### Dashboard Stats (no shape change — existing `totalOutstanding` field already present)

`DashboardController::stats()` already returns `totalOutstanding`. The optimization is internal: replace the PHP `foreach` student loop with a SQL GROUP-BY aggregate query. The response shape is unchanged.

---

## State Transitions

No new state transitions. This feature does not add any new domain entities or lifecycle states.
