# Tasks: Performance & Scalability Optimization

**Input**: Design documents from `specs/066-performance-scalability-optimization/`  
**Branch**: `066-performance-scalability-optimization`  
**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/ ✅ · quickstart.md ✅

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[USn]**: User story this task belongs to
- Exact file paths are included in every task description

---

## Phase 1: Setup

**Purpose**: Confirm branch, verify existing foundation, identify reusable patterns

- [x] T001 Confirm working branch is `066-performance-scalability-optimization` and `StudentsOptimizedController` + `StudentModel::getFilteredStudents()` are present as the reference pattern in `backend/app/Controllers/Api/StudentsOptimizedController.php` and `backend/app/Models/StudentModel.php`
- [x] T002 [P] Verify `useDebounce` hook exists or is absent in `frontend/src/hooks/` — create `frontend/src/hooks/useDebounce.ts` only if missing (300ms default, generic `<T>` typed)
- [x] T003 [P] Verify `LedgerService::ELIGIBLE_CHARGE_TYPES`, `ELIGIBLE_PAYMENT_CATEGORIES`, and `eligiblePaymentCategorySqlList()` constants exist in `backend/app/Services/LedgerService.php` (required for `totalOutstanding` calculation in T009)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared backend model methods that multiple user stories depend on. Must complete before US1–US6 work begins.

**⚠️ CRITICAL**: US1 and US2 both depend on T004–T006. US3 depends on T007. All other stories are independent.

- [x] T004 Add `getFilteredWithStudents(string $tenantId, array $filters, int $limit, int $offset): array` to `backend/app/Models/PaymentModel.php` — JOIN to `students` on `student_id`, apply `WHERE` clauses for `search` (LIKE on `first_name`, `last_name`), `method`, `category`, `classId` (JOIN to `students.class_id`), `month` (MONTH(date)), `year` (YEAR(date)); ORDER BY `sortBy`/`sortOrder`; all queries parameterized; `tenant_id` filtered via JWT-sourced value passed as argument
- [x] T005 Add `getFilteredCount(string $tenantId, array $filters): int` to `backend/app/Models/PaymentModel.php` — same WHERE conditions as T004 but `SELECT COUNT(*)` only (no JOIN to students for count when classId filter absent — optimize if needed)
- [x] T006 Add `getStatsForTenant(string $tenantId): array` to `backend/app/Models/PaymentModel.php` — returns `['totalThisMonth' => float, 'paymentsToday' => int, 'totalOutstanding' => float]`; compute `totalThisMonth` via `SUM(amount) WHERE MONTH(date)=MONTH(CURDATE()) AND YEAR(date)=YEAR(CURDATE())`; `paymentsToday` via `COUNT(*) WHERE date=CURDATE()`; `totalOutstanding` via `(SELECT COALESCE(SUM(amount),0) FROM charges WHERE tenant_id=? AND charge_type IN (...) AND voided_at IS NULL AND deleted_at IS NULL) + debit_adjustments - (SELECT COALESCE(SUM(amount),0) FROM payments WHERE tenant_id=? AND category IN (...)) - credit_adjustments` using `LedgerService::eligibleChargeTypeSqlList()` and `LedgerService::eligiblePaymentCategorySqlList()`
- [x] T007 Add `getClassAttendanceSummary(string $tenantId, string $classId, string $startDate, string $endDate, ?string $search, ?string $sortBy, ?string $sortOrder): array` to `backend/app/Models/AttendanceModel.php` — single SQL query: `SELECT s.id, CONCAT(s.first_name,' ',s.last_name) AS student_name, COUNT(CASE WHEN sa.status='present' THEN 1 END) AS present_days, COUNT(CASE WHEN sa.status='absent' THEN 1 END) AS absent_days, COUNT(CASE WHEN sa.status='late' THEN 1 END) AS late_days, COUNT(CASE WHEN sa.status='excused' THEN 1 END) AS excused_days FROM students s LEFT JOIN student_attendance sa ON sa.student_id=s.id AND sa.tenant_id=? AND sa.date BETWEEN ? AND ? WHERE s.class_id=? AND s.tenant_id=? AND s.status='active' [AND CONCAT(s.first_name,' ',s.last_name) LIKE ?] GROUP BY s.id, student_name ORDER BY [sortBy] [sortOrder]`

**Checkpoint**: Model methods complete — controller and frontend work can begin per story

---

## Phase 3: User Story 1 — Server-Side Paginated Payments List (Priority: P1) 🎯 MVP

**Goal**: `GET /payments/with-students` returns `{ data, pagination, stats }` with server-side filter/sort/page. Frontend fetches only the current page.

**Independent Test**: `curl "/api/payments/with-students?page=1&limit=20"` returns ≤ 20 rows with `pagination.total` and `stats.totalOutstanding`. Changing `?method=EcoCash` returns only EcoCash rows with updated `pagination.total`. See `quickstart.md` §2.

- [x] T008 [US1] Refactor `PaymentController::withStudents()` in `backend/app/Controllers/Api/PaymentController.php` — read query params `page` (default 1), `limit` (default 20, clamp 1–100), `search`, `method`, `category`, `classId`, `month` (validate 1–12), `year`, `sortBy` (whitelist: `date`, `amount`, `studentName`), `sortOrder` (whitelist: `asc`, `desc`); validate `month` returns HTTP 400 if out of range; call `$this->paymentModel->getFilteredWithStudents(...)` (T004) and `getFilteredCount(...)` (T005); call `getStatsForTenant(...)` (T006); return `$this->success(['data' => $result, 'pagination' => [...], 'stats' => [...]])` per contract in `contracts/payments-api.md`
- [x] T009 [US1] Update `api.getPaymentsWithStudents` in `frontend/src/api/api.ts` — add optional params object `{ page?, limit?, search?, method?, category?, classId?, month?, year?, sortBy?, sortOrder? }`, serialize to URLSearchParams, return typed response `{ data: Payment[], pagination: Pagination, stats: PaymentStats }` (add these types inline or in `frontend/src/types/`)
- [x] T010 [US1] Refactor `frontend/src/pages/Payments.tsx` — replace `fetchData` / `Promise.allSettled` pattern with React Query `useQuery` keyed on `['payments', page, limit, search, method, category, classId, month, year, sortBy, sortOrder]`; add pagination state (`page`, `limit`); add filter state (`searchQuery` with 300ms debounce via `useDebounce`, `selectedMethod`, `selectedCategory`, `selectedClass`, `selectedMonth`, `selectedYear`); add `sortBy`/`sortOrder` state; use `keepPreviousData: true` (`placeholderData: keepPreviousData` in RQ v5) so existing rows stay visible during refetch; disable pagination controls while `isFetching`
- [x] T011 [US1] Remove `api.getAllStudentBalances()` call from `frontend/src/pages/Payments.tsx` and all client-side balance aggregation code; replace the "Total Outstanding" stat display with `stats.totalOutstanding` from the paginated response; remove unused `balances` state variable
- [x] T012 [US1] Remove unused imports and dead client-side filter/sort/pagination code from `frontend/src/pages/Payments.tsx` (the `useMemo`-based `filteredPayments`, `sortedPayments`, `paginatedPayments` computed values); keep only server-driven `data` array for rendering

**Checkpoint**: Payments page loads ≤ 20 rows, filters update table without page reload, `GET /ledger/balances` no longer called

---

## Phase 4: User Story 2 — Eliminate Full-Balance-Scan on Payments Stats (Priority: P1)

**Goal**: `api.getAllStudentBalances()` is never called on the Payments page. `totalOutstanding` is a field in `stats` from the paginated response (already implemented in T006 + T011).

**Independent Test**: Browser Network tab while navigating to `/payments` shows no request to `/api/ledger/balances`. `stats.totalOutstanding` in the payments response is a non-null float.

**Note**: This story's backend work is entirely covered by T006 (getStatsForTenant) and T011 (remove getAllStudentBalances from frontend). This phase adds only the verification task.

- [x] T013 [US2] Verify `frontend/src/pages/Payments.tsx` no longer imports or calls `api.getAllStudentBalances` — confirm via TypeScript compilation (`tsc --noEmit`) that the `balances` state and all usages are fully removed; run `grep -n "getAllStudentBalances\|ledger/balances" frontend/src/pages/Payments.tsx` and confirm no matches

**Checkpoint**: Full-balance-scan eliminated from Payments page; verified by network trace

---

## Phase 5: User Story 3 — Server-Side Attendance Summary (Priority: P2)

**Goal**: Attendance Summary tab calls new `GET /student-attendance/class-summary` endpoint. Client-side `summaryMap` aggregation loop replaced by pre-aggregated response.

**Independent Test**: `curl "/api/student-attendance/class-summary?classId=CLS&startDate=2026-04-01&endDate=2026-04-30"` returns `{ summary: [...], meta: { total, classId, startDate, endDate } }` per `contracts/attendance-summary-api.md`. Changing `?search=ali` returns only matching students. See `quickstart.md` §4.

- [x] T014 [US3] Add `classSummary()` method to `backend/app/Controllers/Api/AttendanceController.php` — read query params `classId` (required), `startDate` (required, validate YYYY-MM-DD), `endDate` (required, validate YYYY-MM-DD), `search`, `sortBy` (whitelist: `name`, `presentDays`, `attendancePercentage`), `sortOrder`; return HTTP 400 if any required param missing; call `$this->attendanceModel->getClassAttendanceSummary(...)` (T007); compute `attendancePercentage` in PHP as `round(($presentDays + $lateDays) / max($totalDays, 1) * 100)` where `totalDays` is passed as a param (frontend provides weekday count) OR omit and let frontend compute it; return `$this->success(['summary' => $rows, 'meta' => ['classId' => ..., 'startDate' => ..., 'endDate' => ..., 'total' => count($rows)]])`
- [x] T015 [US3] Register new route in `backend/app/Config/Routes.php` — add `$routes->get('student-attendance/class-summary', 'AttendanceController::classSummary');` before the existing `student-attendance` wildcard routes to avoid shadowing
- [x] T016 [US3] Add `getClassAttendanceSummary` to `frontend/src/api/api.ts` — accepts `{ classId, startDate, endDate, search?, sortBy?, sortOrder? }`, calls `GET /student-attendance/class-summary`, returns typed `{ summary: AttendanceSummaryRow[], meta: AttendanceMeta }` (define types inline)
- [x] T017 [US3] Refactor `fetchAttendanceSummary()` in `frontend/src/pages/Attendance.tsx` — replace the `getStudentAttendance()` call + client-side `summaryMap` forEach aggregation with `api.getClassAttendanceSummary(...)` call; remove `summaryMap`, the `filteredRecords.forEach` loop, and the `summaryMap.forEach` percentage calculation block; keep `countWeekdays()` to pass `totalDays` to the component for percentage display if needed; add 300ms debounced search input to the Summary tab using `useDebounce` (T002)

**Checkpoint**: Attendance Summary tab shows server-aggregated data; no client-side forEach attendance loop

---

## Phase 6: User Story 4 — Transport Page Server-Side Search (Priority: P2)

**Goal**: `GET /transport/routes`, `GET /transport/vehicles`, `GET /transport/drivers` accept `search` query param. Frontend search input is debounced and passes param to API.

**Independent Test**: `curl "/api/transport/routes?search=mbare"` returns only routes with "mbare" in the name. See `quickstart.md` §5.

- [x] T018 [P] [US4] Add `search` LIKE filter to `TransportController::getRoutes()` in `backend/app/Controllers/Api/TransportController.php` — read `$search = $this->request->getGet('search')` and add `WHERE r.route_name LIKE ?` (or equivalent column) when non-empty; keep existing `tenant_id` filter; use parameterized query
- [x] T019 [P] [US4] Add `search` LIKE filter to the vehicles list method in `backend/app/Controllers/Api/TransportController.php` (or its dedicated controller if split) — filter on `name` or `reg_number` column when `search` param present
- [x] T020 [P] [US4] Add `search` LIKE filter to the drivers list method in `backend/app/Controllers/Api/TransportController.php` (or its dedicated controller if split) — filter on `name` column when `search` param present
- [x] T021 [US4] Update `api.getRoutes()`, `api.getVehicles()`, `api.getDrivers()` in `frontend/src/api/api.ts` — add optional `search?: string` param, append to URLSearchParams when present
- [x] T022 [US4] Update `frontend/src/pages/Transport.tsx` — replace the `useMemo` client-side search filter with a debounced `searchQuery` state (300ms via `useDebounce`); pass `search: debouncedSearchQuery` to the relevant `api.getRoutes()` / `api.getVehicles()` / `api.getDrivers()` calls; preserve search term when switching tabs; remove the `useMemo` filtered lists for routes, vehicles, and drivers

**Checkpoint**: Transport page search triggers server-side queries; no client-side `useMemo` filtering

---

## Phase 7: User Story 5 — ClassStudentsPage Server-Side Search (Priority: P2)

**Goal**: `GET /classes/:id/students` accepts `search` query param. `ClassStudentsPage` debounces search and passes param to API.

**Independent Test**: `curl "/api/classes/CLS_ID/students?search=ali"` returns only matching students. Frontend search box triggers API call with `search` param after 300ms. See `quickstart.md` §6.

- [x] T023 [US5] Add `search` param to `ClassController::students()` in `backend/app/Controllers/Api/ClassController.php` — read `$search = $this->request->getGet('search')` and add `WHERE (s.first_name LIKE ? OR s.last_name LIKE ? OR s.admission_number LIKE ?)` when non-empty; keep existing `tenant_id` and `class_id` filters; parameterized query
- [x] T024 [US5] Update `api.getClassWithStudents(classId, options?)` in `frontend/src/api/api.ts` — add optional second param `{ search?: string }`, append to URLSearchParams when present
- [x] T025 [US5] Update `frontend/src/pages/ClassStudentsPage.tsx` — replace the `useMemo` client-side search filter with a debounced `search` state (300ms via `useDebounce`); pass `search: debouncedSearch` to `api.getClassWithStudents(classId!, { search: debouncedSearch })` in the `useQuery` queryFn; update `queryKey` to include `debouncedSearch` so React Query re-fetches on search change; remove the `useMemo` `filtered` computed value

**Checkpoint**: ClassStudentsPage search triggers server-side query; `useMemo` filtering removed

---

## Phase 8: User Story 6 — Dashboard Student Loop → SQL Aggregate (Priority: P2)

**Goal**: `DashboardController::stats()` no longer iterates over every active student in PHP. `paidInFull` and `withOutstanding` counts are computed via a single SQL GROUP-BY query.

**Independent Test**: `curl "/api/dashboard/stats"` returns `{ totalStudents, paidInFull, withOutstanding, totalOutstanding, ... }` with correct values. Internal verification: no `foreach ($students as $student)` loop executes. See `quickstart.md` §7.

- [x] T026 [US6] Replace the `$students = $studentModel->...->findAll()` + `foreach` student loop in `backend/app/Controllers/Api/DashboardController.php` with a single SQL aggregate query — use `SELECT SUM(CASE WHEN balance <= 0 THEN 1 ELSE 0 END) AS paid_in_full, SUM(CASE WHEN balance > 0 THEN 1 ELSE 0 END) AS with_outstanding FROM (SELECT s.id, COALESCE(c.total_charges, 0) + COALESCE(da.total_debit, 0) - COALESCE(p.total_paid, 0) - COALESCE(ca.total_credit, 0) AS balance FROM students s LEFT JOIN (...charges subquery...) c ON c.student_id=s.id LEFT JOIN (...payments subquery...) p ON p.student_id=s.id LEFT JOIN (...adjustments subqueries...) WHERE s.tenant_id=? AND s.status='active') sub` — follow the same subquery pattern as `StudentModel::getGlobalStats()` and `LedgerService::getAllBalances()`; retain `studentsOnBursary` count from the same query or a separate single-query `COUNT`
- [x] T027 [US6] Remove the now-unused `$chargesByStudent`, `$paymentsByStudent`, `$creditAdjByStudent`, `$debitAdjByStudent` pre-load variables and the `foreach ($students as $student)` block from `backend/app/Controllers/Api/DashboardController.php`; run `php -l backend/app/Controllers/Api/DashboardController.php` to confirm no syntax errors

**Checkpoint**: Dashboard stats computed entirely in SQL; O(n) PHP loop eliminated

---

## Phase 9: User Story 7 — Loading States & Optimistic UI (Priority: P3)

**Goal**: All optimized pages (Payments, Attendance, Transport, ClassStudentsPage) keep existing data visible with a loading overlay while new data fetches. No blank flash on filter/search/page change.

**Independent Test**: On `/payments`, change a filter. The table rows remain visible with a subtle opacity/spinner overlay until the new data arrives. Pagination controls are `disabled` while `isFetching`.

- [x] T028 [P] [US7] Payments page — in `frontend/src/pages/Payments.tsx`, wrap the data table in a relative container; add `isFetching` from the React Query result; apply `opacity-50 pointer-events-none` to the table body while `isFetching`; disable prev/next pagination buttons when `isFetching || page === 1` and `isFetching || page === totalPages` respectively; show a small spinner icon in the table header area while `isFetching`
- [x] T029 [P] [US7] Attendance Summary tab — in `frontend/src/pages/Attendance.tsx`, add `isFetching` (or `loadingSummary` already present) overlay to the summary table while the new class-summary API call is in flight; keep existing rows visible during refetch
- [x] T030 [P] [US7] Transport page — in `frontend/src/pages/Transport.tsx`, add loading indicator while debounced search request is in flight; keep existing route/vehicle/driver rows visible during loading (do not replace with empty state)
- [x] T031 [P] [US7] ClassStudentsPage — in `frontend/src/pages/ClassStudentsPage.tsx`, ensure existing students remain visible (using React Query `keepPreviousData` / `placeholderData`) while debounced search request is in flight; show a subtle loading indicator

**Checkpoint**: All optimized pages have non-flickering, non-blanking data table updates

---

## Phase 10: Polish & Validation

**Purpose**: PHP lint, TypeScript type-check, curl validation, cleanup

- [x] T032 [P] Run PHP lint on all modified backend files: `php -l backend/app/Controllers/Api/PaymentController.php backend/app/Controllers/Api/AttendanceController.php backend/app/Controllers/Api/ClassController.php backend/app/Controllers/Api/TransportController.php backend/app/Controllers/Api/DashboardController.php backend/app/Models/PaymentModel.php backend/app/Models/AttendanceModel.php backend/app/Config/Routes.php` — all must exit 0
- [x] T033 [P] Run TypeScript type-check on modified frontend files: `./node_modules/.bin/tsc --noEmit --pretty false` from `frontend/` — must exit 0
- [ ] T034 [P] Run targeted ESLint on modified frontend files: `./node_modules/.bin/eslint src/pages/Payments.tsx src/pages/Attendance.tsx src/pages/Transport.tsx src/pages/ClassStudentsPage.tsx src/api/api.ts src/hooks/useDebounce.ts` from `frontend/` — fix any errors reported
- [x] T035 Execute curl validation per `specs/066-performance-scalability-optimization/quickstart.md` — run all happy-path, error-path, and tenant-isolation checks for Payments pagination (§2), balance scan elimination (§3), attendance class summary (§4), transport search (§5), class students search (§6), and dashboard stats (§7); confirm all expected responses received
- [x] T036 Update `specs/066-performance-scalability-optimization/tasks.md` — mark all completed tasks with `[x]`; add any notes on implementation decisions that deviated from the plan

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **BLOCKS Phase 3, 4, 5**
- **Phase 3 (US1)**: Depends on Phase 2 (T004, T005, T006)
- **Phase 4 (US2)**: Depends on Phase 3 (T006, T011) — verification task only
- **Phase 5 (US3)**: Depends on Phase 2 (T007)
- **Phase 6 (US4)**: Independent after Phase 1 — no foundational model dep
- **Phase 7 (US5)**: Independent after Phase 1 — no foundational model dep
- **Phase 8 (US6)**: Independent after Phase 1 — no foundational model dep
- **Phase 9 (US7)**: Depends on Phases 3, 5, 6, 7 (each loading state wraps the corresponding page's data fetch)
- **Phase 10 (Polish)**: Depends on all story phases complete

### User Story Dependencies

- **US1 (P1)**: Needs T004, T005, T006 (Phase 2)
- **US2 (P1)**: Needs T006, T011 — covered by US1 completion
- **US3 (P2)**: Needs T007 (Phase 2) — independent of US1/US2
- **US4 (P2)**: Independent — no shared model deps
- **US5 (P2)**: Independent — no shared model deps
- **US6 (P2)**: Independent — no shared model deps
- **US7 (P3)**: Needs US1, US3, US4, US5 complete (wraps each page)

### Within Each Story

- Backend model method → Backend controller → Route registration → Frontend api.ts → Frontend page component
- Run PHP lint after each backend task
- Run `tsc --noEmit` after each frontend task

### Parallel Opportunities

- T002 and T003 (Phase 1) can run in parallel
- T004, T005, T006, T007 (Phase 2) can run in parallel — different methods in different models
- T018, T019, T020 (Phase 6, US4) can run in parallel — different endpoints
- T028, T029, T030, T031 (Phase 9, US7) can run in parallel — different files
- T032, T033, T034 (Phase 10) can run in parallel — different tools

---

## Parallel Example: Phase 2 (Foundational)

```bash
# All 4 model methods can be implemented simultaneously:
Task T004: PaymentModel::getFilteredWithStudents()     → backend/app/Models/PaymentModel.php
Task T005: PaymentModel::getFilteredCount()            → backend/app/Models/PaymentModel.php (same file, different method — coordinate)
Task T006: PaymentModel::getStatsForTenant()           → backend/app/Models/PaymentModel.php (same file — sequential within PaymentModel)
Task T007: AttendanceModel::getClassAttendanceSummary()→ backend/app/Models/AttendanceModel.php (different file — fully parallel with T004–T006)
```

> Note: T004, T005, T006 are in the same file. Work them sequentially or in one session. T007 is a fully independent parallel track.

## Parallel Example: Phase 6 (Transport Search)

```bash
# Backend and frontend can proceed after routes identified:
Task T018: TransportController — routes search  → different endpoint method
Task T019: TransportController — vehicles search → different endpoint method
Task T020: TransportController — drivers search  → different endpoint method
# T018–T020 all in same controller file: sequential within the file
# T021 (api.ts) can begin once the param contract is known (after T018)
```

---

## Implementation Strategy

### MVP (US1 + US2) — Phases 1–4

1. Phase 1: Setup (T001–T003)
2. Phase 2 partial: T004, T005, T006 (PaymentModel methods)
3. Phase 3: US1 — T008–T012 (paginated Payments backend + frontend)
4. Phase 4: US2 — T013 (verify balance scan eliminated)
5. **STOP and VALIDATE**: Run `quickstart.md` §2 and §3 curl checks + browser Network tab check

### Incremental Delivery

1. Phases 1–4 → **MVP: Payments page fully optimized** ✅
2. Phase 2 partial + Phase 5 → **Attendance summary optimized** ✅
3. Phase 6 → **Transport search** ✅
4. Phase 7 → **ClassStudentsPage search** ✅
5. Phase 8 → **Dashboard loop eliminated** ✅
6. Phase 9 → **Loading UX polish across all pages** ✅
7. Phase 10 → **Lint, type-check, curl validation** ✅

---

## Notes

- `[P]` tasks operate on different files or are independently executable
- `[USn]` maps every task to its user story for traceability
- Reference implementation throughout: `StudentsOptimizedController` + `StudentModel::getFilteredStudents()`
- **`GET /ledger/balances` must NOT be deleted** — Reconciliation tab depends on it
- `totalOutstanding` must use `LedgerService::ELIGIBLE_CHARGE_TYPES` and `ELIGIBLE_PAYMENT_CATEGORIES` constants (not raw `charge_type = 'fee_structure'` strings) to stay in sync with the ledger service
- Constitution Principle V: all balance computations remain derived at query time — no mutable column added
- Default page size: 20; max: 100 (enforced with `min(100, max(1, $limit))` in controller)
- Debounce interval: 300ms minimum on all search inputs
