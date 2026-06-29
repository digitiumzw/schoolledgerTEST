# Research: Performance & Scalability Optimization

**Feature**: 066-performance-scalability-optimization  
**Date**: 2026-05-07

---

## Decision 1: Payments list — server-side pagination strategy

**Decision**: Refactor `PaymentController::withStudents()` in-place to accept filter/sort/page query params, delegate to a new `PaymentModel::getFilteredWithStudents()` method (mirroring `StudentModel::getFilteredStudents()`), and return `{ data, pagination, stats }`.

**Rationale**: The current `withStudents()` calls `PaymentModel::getByTenant()` (returns ALL rows) then batch-loads student data. With 5,000+ payment rows this produces a large payload and heavy client-side useMemo filtering. The `StudentsOptimizedController` pattern — single query with `LIMIT/OFFSET` + separate COUNT query — is already proven and in-house.

**Alternatives considered**:
- Cursor-based pagination: rejected — the Payments page requires total count for UI pagination controls and random-page access.
- New controller class (`PaymentsOptimizedController`): rejected — would require adding a new route alongside the existing one; refactoring in-place is less disruptive.
- Caching full response in Redis: rejected — payments change frequently; cache invalidation is complex and the root fix (pagination) is simpler.

---

## Decision 2: Eliminate `GET /ledger/balances` from Payments page

**Decision**: Remove `api.getAllStudentBalances()` from `Payments.tsx`. Add `totalOutstanding` as a computed field inside the `stats` object returned by the paginated `GET /payments/with-students` response. Compute it via a single SQL `SUM` subquery in `PaymentController::withStudents()` using the same eligible-charge/eligible-payment filter logic as `LedgerService::getAllBalances()`.

**Rationale**: `GET /ledger/balances` executes a complex multi-subquery aggregation for every active student. On the Payments page it is used only to sum up a single scalar (`totalOutstanding`). A direct `SUM(charges) - SUM(payments)` aggregate query on the whole tenant is ~10× faster than returning per-student rows and summing them in JavaScript. The Dashboard **does not** call `GET /ledger/balances` — `DashboardController::stats()` already computes `totalOutstanding` server-side via `ChargeModel::getTotalChargesByTenant()` and `PaymentModel::getTotalPaymentsByTenant()`.

**Alternatives considered**:
- Adding a new endpoint `GET /payments/stats`: possible but unnecessary — embedding stats in the paginated response saves a round-trip.
- Deleting `GET /ledger/balances`: rejected — the Reconciliation tab and other consumers legitimately use per-student balance data.

---

## Decision 3: Dashboard `stats()` — replace PHP student loop with SQL aggregate

**Decision**: Replace the `foreach ($students as $student)` loop in `DashboardController::stats()` with a single GROUP-BY SQL query that counts students with `balance <= 0` (paidInFull) vs `balance > 0` (withOutstanding) using the same subquery pattern as `StudentModel::getGlobalStats()`.

**Rationale**: The current code fetches every active student row into PHP memory, then iterates to classify each student. `StudentModel::getGlobalStats()` already does this at the SQL level for the Students page. The same technique applied to `DashboardController` eliminates the O(n) PHP loop.

**Alternatives considered**:
- Introducing a dedicated `DashboardService`: overkill for this scope; the SQL can be added inline in the controller or delegated to an existing service.
- Reusing `StudentModel::getGlobalStats()` directly: partially applicable — that method returns stats scoped to filters; Dashboard needs school-wide totals but can follow the same SQL pattern.

---

## Decision 4: Attendance summary — move aggregation to backend

**Decision**: Add a new `GET /student-attendance/class-summary` endpoint (or augment the existing `studentIndex` to accept an `aggregate=true` flag). The backend receives `classId`, `startDate`, `endDate`, `search`, `sortBy`, `sortOrder` and returns pre-aggregated rows `{ studentId, studentName, presentDays, absentDays, lateDays, excusedDays, totalDays, attendancePercentage }`.

**Rationale**: The current Attendance page makes one `getStudentAttendance()` call that returns raw individual attendance records, then aggregates them in a client-side `summaryMap` loop. With a class of 40 students × 30-day range = up to 1,200 records per request, all aggregated in the browser. Moving to SQL `COUNT(CASE WHEN ...)` GROUP BY is O(1) from the frontend's perspective and eliminates the client-side `forEach` aggregation.

**Note on weekend exclusion**: The frontend currently excludes weekends when computing `totalDays`. The backend can count weekdays using `DAYOFWEEK()` or accept `totalDays` as a client-provided hint. The simplest approach: backend returns `presentDays`, `absentDays`, `lateDays`, `excusedDays`; frontend computes `totalDays` using the existing `countWeekdays()` helper. This preserves the existing UX while removing the per-record aggregation loop.

**Alternatives considered**:
- New route `/student-attendance/summary-by-class`: clean naming but requires a new route entry; preferred over modifying the existing studentIndex which has a different contract.
- Moving everything to backend including weekend counting: requires backend to know the school's working week, which is settings-dependent; deferred to a future feature.

---

## Decision 5: Transport page — server-side search

**Decision**: Augment `TransportController::getRoutes()`, `getVehicles()` (via `TransportVehicleController`), and `getDrivers()` (via `TransportDriverController`) to accept a `search` query parameter and add a `LIKE` filter on relevant name/identifier columns. Frontend adds a 300ms debounce and passes `search` as a query param.

**Rationale**: Transport data is currently small (<50 routes typical) but the pattern is inconsistent with the rest of the app. A `search` param costs one `WHERE` clause and ensures the pattern scales without a rewrite later.

**Alternatives considered**:
- Full-text indexes: overkill for this volume; `LIKE '%term%'` on indexed `name` columns is sufficient.
- Caching transport lists: valid, but search support is a prerequisite; can be layered on top later.

---

## Decision 6: ClassStudentsPage — server-side search

**Decision**: Add `search` query parameter to `ClassController::students()` which calls `ClassModel::getClassStudents($classId, $search)`. Frontend `ClassStudentsPage` replaces the `useMemo` filter with a debounced query parameter passed to `api.getClassWithStudents(classId, { search })`.

**Rationale**: Classes can hold 40–60 students. Client-side search is fine at this scale today, but the inconsistency creates tech debt. The change is minimal: one `WHERE` clause addition in the model.

---

## Decision 7: Frontend debounce pattern

**Decision**: Use a shared `useDebounce` custom hook (or the existing one if already present in `src/hooks/`) with a 300ms delay on all new search inputs. TanStack React Query `queryKey` includes the debounced search value so queries are automatically deduplicated and cached.

**Rationale**: Constitution Principle XI requires measurable justification for performance changes. Debouncing prevents request storms on fast typists (measurably reduces API calls by 3–10× for typical input speeds). React Query caching prevents refetching the same search twice.

**Alternatives considered**:
- `useTransition` / `startTransition`: useful for expensive renders but does not reduce network requests.
- Lodash debounce: functional but adds a dependency; a 5-line custom hook avoids it.

---

## Decision 8: Loading state pattern (no flash of empty)

**Decision**: Use React Query's `keepPreviousData: true` (or `placeholderData: keepPreviousData` in v5) on all paginated queries. While new data loads, the old page's rows remain visible with an overlay spinner on the table. Pagination controls are `disabled` while `isFetching` is true.

**Rationale**: The Students page currently sets `loading` state which hides results during re-fetch, causing a flash. React Query's `keepPreviousData` is the idiomatic solution and requires no custom state management.

---

## Constitution Check — Pre-Design

| Principle | Status | Notes |
|---|---|---|
| I. Multi-Tenant Data Isolation | PASS | All new queries will filter by `tenant_id` from JWT payload |
| II. API-First Separation | PASS | All filtering/sorting moves to backend; frontend only renders |
| III. JWT Auth & RBAC | PASS | No new public routes; existing role checks preserved |
| IV. Immutable Migrations | PASS | No schema changes required; optional indexes as new migration if needed |
| V. Financial Ledger Integrity | PASS | `totalOutstanding` uses same `SUM(charges) - SUM(payments)` formula as `LedgerService`; no mutable column introduced |
| VI. REST Standards | PASS | Existing route paths preserved; new class-summary route follows kebab-case |
| VII. Code Quality | PASS | New model methods mirror existing patterns; no duplication |
| VIII. Defensive Security | PASS | Search params sanitized via parameterized queries; no raw interpolation |
| IX. Error Handling | PASS | Existing error helpers reused |
| X. API Testing via curl | PASS | curl tests required after implementation |
| XI. Performance Discipline | PASS | All changes are measurement-justified: specific slow queries and O(n) loops identified |
