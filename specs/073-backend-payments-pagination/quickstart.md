# Quickstart: Backend Payments Pagination

**Feature**: 073-backend-payments-pagination  
**Date**: 2026-05-13

## Goal

Validate that payments history and related payment views consume backend-prepared data only, with backend-side pagination, filtering, searching, sorting, and summary computation.

## Prerequisites

- Backend server running locally.
- Frontend server running locally for UI checks.
- Test tenant with admin or bursar credentials.
- At least one tenant with enough payments to exercise pagination.
- At least one student with multiple payments for student-history modal checks.

## Backend Validation

### 1. Login

```bash
curl -s -X POST "$API_BASE/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@greenwood.co.zw","password":"12345678"}'
```

Expected:

- HTTP 200.
- Response includes a token.

### 2. Main payments table first page

```bash
curl -s "$API_BASE/payments/with-students?page=1&limit=20&sortBy=date&sortOrder=desc" \
  -H "Authorization: Bearer $TOKEN"
```

Expected:

- HTTP 200.
- `data.data` has at most 20 rows.
- Response includes `pagination.total`, `pagination.totalPages`, and backend summary values.
- No full tenant payment history is returned.

### 3. Search outside visible page

```bash
curl -s "$API_BASE/payments/with-students?page=1&limit=20&search=<known-non-first-page-student>" \
  -H "Authorization: Bearer $TOKEN"
```

Expected:

- HTTP 200.
- Matching records can appear even if they were not on the unfiltered first page.
- Pagination and summary reflect the searched dataset.

### 4. Combined filters

```bash
curl -s "$API_BASE/payments/with-students?page=1&limit=20&method=Cash&category=Fees&month=5&year=2026&sortBy=amount&sortOrder=desc" \
  -H "Authorization: Bearer $TOKEN"
```

Expected:

- HTTP 200.
- Rows match all filters.
- Summary and count match the full filtered dataset.

### 5. Invalid filters

```bash
curl -s -i "$API_BASE/payments/with-students?month=13" \
  -H "Authorization: Bearer $TOKEN"
```

Expected:

- HTTP 400.
- Error response uses the standard error envelope.

### 6. Student payment history page

```bash
curl -s "$API_BASE/payments/student/$STUDENT_ID?page=1&limit=15&sortBy=date&sortOrder=desc" \
  -H "Authorization: Bearer $TOKEN"
```

Expected:

- HTTP 200.
- Response includes one student summary, one payment page, pagination metadata, and backend-computed totals.
- Response does not return all payments when more than one page exists.

### 7. Unauthorized request

```bash
curl -s -i "$API_BASE/payments/with-students?page=1&limit=20"
```

Expected:

- HTTP 401.

### 8. Tenant isolation

Use a token from a different tenant and request known Greenwood payment/student data.

Expected:

- Main table returns only that tenant's payments.
- Student-specific payment history for another tenant's student returns 404 or equivalent non-disclosing response.

## Frontend Validation

1. Open Payments page.
2. Confirm network request includes `page`, `limit`, filters, and sort parameters.
3. Confirm response row count does not exceed requested page size.
4. Search for a student/payment not visible on page 1 and confirm it appears.
5. Apply method/category/class/month/year filters and confirm table, totals, and pagination update from backend response.
6. Open Payment History modal from a payment row.
7. Confirm modal requests paginated student history and does not fetch all student payments for local sorting/pagination/totals.
8. Open receipt modal and confirm it fetches only receipt/detail data.

## Performance Checks

- Capture response time for first page and filtered search against a large payment dataset.
- Confirm first page and search responses complete within the spec target under normal local/test conditions where comparable data volume exists.
- Inspect query count or debug toolbar output where available to confirm no per-row repeated student/class/balance lookups.

## Completion Criteria

- Main payments table uses backend-prepared data only.
- Student payment history uses backend-prepared data only.
- Payment summaries are backend-computed and filter-aligned.
- Invalid input, auth guard, and tenant isolation checks pass.
- Frontend TypeScript and targeted lint checks pass for touched files.

## Validation Results - 2026-05-14

### Static validation

- PHP lint passed for:
  - `backend/app/Models/PaymentModel.php`
  - `backend/app/Controllers/Api/PaymentController.php`
  - `backend/app/Database/Migrations/2026-05-13-000001_AddPaymentHistoryPerformanceIndexes.php`
- TypeScript `npx tsc --noEmit` passed.
- Targeted ESLint passed for:
  - `frontend/src/pages/Payments.tsx`
  - `frontend/src/components/modals/PaymentHistoryModal.tsx`
  - `frontend/src/types/dashboard.ts`
- Full targeted ESLint including `frontend/src/api/api.ts` remains blocked by pre-existing `no-explicit-any` debt in `api.ts`.
- `git diff --check` passed.

### Migration validation

- `php spark migrate` applied `2026-05-13-000001_AddPaymentHistoryPerformanceIndexes`.

### Curl validation against `http://localhost:8080/api`

- Login: HTTP 200, token present.
- Main payments first page: HTTP 200, 20 rows, total 26, totalPages 2, backend `summary.totalAmount` 1728.25.
- Search: HTTP 200 for seed `Ropafadzo`, 4 rows, total 4.
- Combined filters: HTTP 200 for `method=Cash&category=Fees&month=5&year=2026&sortBy=amount&sortOrder=desc`, 6 rows, total 6.
- Invalid month: HTTP 400 with message `Invalid month value. Must be 1–12.`
- Student payment history: HTTP 200, 4 rows, total 4, totalPaid 390.
- Unauthorized request: HTTP 401.
- Tenant isolation: attempted with previously available second-tenant credential `curliso_1778043246@example.test`; login returned HTTP 403, so live cross-tenant validation remains pending until valid second-tenant credentials are available.

### Performance evidence

- Main payments first page: HTTP 200 in approximately 43.5ms.
- Search request: HTTP 200 in approximately 42.6ms.
- Student payment history: HTTP 200 in approximately 32.9ms.
- Implementation uses joined student/class row loading and aggregate summary queries; no per-row frontend full-history sorting, pagination, or summary calculation remains in the touched payment consumers.
