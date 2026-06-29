# Quickstart: Performance & Scalability Optimization

**Feature**: 066-performance-scalability-optimization  
**Branch**: `066-performance-scalability-optimization`

---

## Prerequisites

- Backend running at `http://localhost:8080`
- Frontend running at `http://localhost:5173`
- Test school: `admin@greenwood.co.zw` / `12345678`

---

## Verification Steps (run after implementation)

### 1. Acquire auth token

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@greenwood.co.zw","password":"12345678"}' \
  | jq -r '.data.token')
echo "Token: $TOKEN"
```

---

### 2. Payments — paginated list with stats

**Happy path — default page**:
```bash
curl -s http://localhost:8080/api/payments/with-students \
  -H "Authorization: Bearer $TOKEN" | jq '{pagination: .data.pagination, stats: .data.stats, count: (.data.data | length)}'
```
Expected: `pagination.page=1`, `pagination.limit=20`, `data` has ≤ 20 rows, `stats.totalOutstanding` is a number.

**Filter by method**:
```bash
curl -s "http://localhost:8080/api/payments/with-students?method=EcoCash&page=1&limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq '.data.pagination'
```
Expected: `total` reflects only EcoCash payments.

**Search by student name**:
```bash
curl -s "http://localhost:8080/api/payments/with-students?search=ali" \
  -H "Authorization: Bearer $TOKEN" | jq '.data.data[].student | {firstName, lastName}'
```
Expected: only students whose name contains "ali" (case-insensitive).

**Filter by month/year**:
```bash
curl -s "http://localhost:8080/api/payments/with-students?month=5&year=2026" \
  -H "Authorization: Bearer $TOKEN" | jq '.data.pagination.total'
```

**Invalid month**:
```bash
curl -s "http://localhost:8080/api/payments/with-students?month=13" \
  -H "Authorization: Bearer $TOKEN" | jq '.status'
```
Expected: `"error"`, HTTP 400.

**Tenant isolation**:
```bash
TOKEN2=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"<other-tenant-admin>","password":"<password>"}' \
  | jq -r '.data.token')
curl -s "http://localhost:8080/api/payments/with-students" \
  -H "Authorization: Bearer $TOKEN2" | jq '.data.pagination.total'
```
Expected: total reflects only payments for the second tenant.

**Missing auth**:
```bash
curl -s http://localhost:8080/api/payments/with-students | jq '.status'
```
Expected: `"error"`, HTTP 401.

---

### 3. Verify `GET /ledger/balances` is NOT called on Payments page load

Open browser DevTools → Network tab → navigate to `/payments`. Confirm no request to `/api/ledger/balances` is made.

---

### 4. Attendance class summary

```bash
# Replace CLS_ID with a real class ID from your test data
CLS_ID="<class-id>"

curl -s "http://localhost:8080/api/student-attendance/class-summary?classId=$CLS_ID&startDate=2026-04-01&endDate=2026-04-30" \
  -H "Authorization: Bearer $TOKEN" | jq '.data.meta'
```
Expected: `meta.classId` matches, `meta.total` is a positive integer, `summary` is an array of student rows with `presentDays`, `absentDays` etc.

**Missing classId**:
```bash
curl -s "http://localhost:8080/api/student-attendance/class-summary?startDate=2026-04-01&endDate=2026-04-30" \
  -H "Authorization: Bearer $TOKEN" | jq '.status'
```
Expected: `"error"`, HTTP 400.

**Search**:
```bash
curl -s "http://localhost:8080/api/student-attendance/class-summary?classId=$CLS_ID&startDate=2026-04-01&endDate=2026-04-30&search=mo" \
  -H "Authorization: Bearer $TOKEN" | jq '.data.summary[].studentName'
```
Expected: only names containing "mo".

---

### 5. Transport search

```bash
curl -s "http://localhost:8080/api/transport/routes?search=mbare" \
  -H "Authorization: Bearer $TOKEN" | jq '.[].routeName'
```
Expected: only routes whose name contains "mbare".

---

### 6. ClassStudentsPage search

```bash
CLS_ID="<class-id>"
curl -s "http://localhost:8080/api/classes/$CLS_ID/students?search=ali" \
  -H "Authorization: Bearer $TOKEN" | jq '.students[].firstName'
```
Expected: only students with "ali" in their name or admission number.

---

### 7. Dashboard stats — no PHP loop

```bash
curl -s http://localhost:8080/api/dashboard/stats \
  -H "Authorization: Bearer $TOKEN" | jq '{totalOutstanding, paidInFull, withOutstanding}'
```
Expected: all three fields are non-null numbers. Internal verification: the `foreach ($students as $student)` loop in `DashboardController::stats()` has been replaced with a SQL GROUP-BY query.

---

## Frontend Smoke Tests

1. Navigate to `/payments` → table loads with ≤ 20 rows.
2. Type in the search box → requests fire after ≥ 300ms pause; existing rows remain visible (no blank flash) while loading.
3. Click page 2 → table updates in-place; no full page reload.
4. Navigate to `/attendance`, select a class and date range → Summary tab shows pre-aggregated data; no `forEach` aggregation in browser console.
5. Navigate to `/transport`, type in search → rows update after debounce.
