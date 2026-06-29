# Quickstart: Route Balance and Printable Student List

**Feature**: 087-route-balance-printing  
**Date**: 2026-06-09

## Prerequisites

- Backend server running on `http://localhost:8080`
- Frontend dev server running on `http://localhost:5173`
- Valid admin credentials for the test tenant (e.g., `admin@greenwood.co.zw` / `12345678`)
- At least one transport route with active student allocations
- At least one student on the route has a non-zero ledger balance

## Backend Setup

No migrations required. After implementing the backend changes:

```bash
# Verify PHP syntax
cd backend && php -l app/Controllers/Api/TransportController.php && php -l app/Services/LedgerService.php

# Restart the backend server if needed
php spark serve
```

## curl Validation Steps

### 1. Login

```bash
curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@greenwood.co.zw","password":"12345678"}' | jq -r '.data.token'
```

Save the token as `TOKEN`.

### 2. Happy Path — Route with Balances

```bash
curl -s -X GET "http://localhost:8080/api/transport/routes/{routeId}" \
  -H "Authorization: Bearer $TOKEN" | jq '.data | {routeName, activeCount, balanceSummary, firstStudent: .students[0] | {studentId, studentName, balance}}'
```

**Result**: `balanceSummary.totalStudents: 82`, `balanceSummary.studentsWithBalance: 67`, `balanceSummary.totalOutstandingBalance: 2746.68`. `students[].balance` is present per student.

### 3. Verify Balance Accuracy

Cross-check one student's balance:

```bash
curl -s -X GET "http://localhost:8080/api/students/{studentId}/balance" \
  -H "Authorization: Bearer $TOKEN" | jq '.data | {studentId, balance}'
```

**Result**: Student `s1779878886_9b71422e` has `balance: 10` in both route response and individual balance endpoint. Values match exactly.

### 4. Route with Zero Students

No empty routes existed in test data. Manual test: create a route with no allocations → `balanceSummary` should be `{ totalStudents: 0, studentsWithBalance: 0, totalOutstandingBalance: 0 }`.

### 5. Unauthorized Access

```bash
curl -s -X GET "http://localhost:8080/api/transport/routes/{routeId}" | jq '{status, message}'
```

**Result**: `{ "status": false, "message": "No authentication token provided." }` with HTTP 401.

### 6. Tenant Isolation

```bash
curl -s -X GET "http://localhost:8080/api/transport/routes/{routeId}" \
  -H "Authorization: Bearer invalid_token_12345" | jq '{status, message}'
```

**Result**: `{ "status": false, "message": "Invalid authentication token. Please sign in again." }` with HTTP 401.

## Frontend Validation Steps

1. Navigate to **Transport → Routes** and click any route.
2. **Verify**: Each student in the list shows a balance amount formatted as currency.
3. **Verify**: A summary card shows "Total Students", "Students with Balance", and "Total Outstanding".
4. Click **Print List** button.
5. **Verify**: Browser print preview shows a clean formatted report with:
   - Route name as header
   - Table with columns: Student Name, Class, Stop, Direction, Outstanding Balance
   - Summary section
   - "Printed on [date] at [time]" footer
6. **Verify**: Non-report UI elements (buttons, sidebar, nav) are hidden in print preview.

## Rollback

If issues are found, revert the backend changes to `TransportController.php` and `LedgerService.php`, and frontend changes to `RouteDetailPage.tsx`, `types/dashboard.ts`, and `api/api.ts`. No database rollback needed.
