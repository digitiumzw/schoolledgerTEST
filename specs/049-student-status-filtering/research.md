# Research: Student Status Filtering

**Feature**: 049-student-status-filtering  
**Date**: 2026-04-28

---

## 1. Student Status Values

**Decision**: Use the exact ENUM values defined in migration `2026-04-03-110000_Add_student_status_history.php`.

**Valid values**: `active`, `inactive`, `transferred`, `dropped_out`, `graduated`

**Rationale**: Migration-defined ENUM is authoritative. Frontend status options in `StatusChangeModal` and the Students page tabs already match these values. No new values needed for this feature.

**Alternatives considered**: None — ENUM is already in production.

---

## 2. Students Page — Immediate Status Update

**Decision**: The Students page status refresh is already wired correctly via `onSuccess={fetchData}` in the `StatusChangeModal` component. No structural change needed on the immediate-update path.

**Rationale**: 
- `StatusChangeModal` (line 56) calls `onSuccess()` after a successful API call.
- `onSuccess` is `fetchData` from `Students.tsx`, which calls `fetchStudents(1, true)`, re-fetching the full student list from the backend.
- Backend route `PUT /api/students/(:id)/status → StudentController::changeStatus` validates the status, updates the DB atomically, and records student_status_history — all in a single request.
- Frontend `api.changeStudentStatus` correctly uses `PUT` matching the backend route.

**What needs verification during implementation**: Confirm there are no edge cases where `onSuccess` is not fired (e.g., partial success or error swallowing). The flow itself is sound.

---

## 3. Transport Module — Student Status Gap

**Decision**: Add `->where('s.status', 'active')` to all transport assignment queries that JOIN the `students` table.

**Rationale**: `TransportController` currently filters by `transport_assignments.status = 'active'` (assignment is active) but does NOT also filter by `students.status = 'active'`. A student who has been made inactive, transferred, or graduated can still appear in transport rosters if their assignment was never deactivated. These queries need the additional predicate.

**Affected queries in TransportController**:
- `getRoutes()` line ~52: `->where('ta.status', 'active')` — missing `s.status = 'active'`
- `getRoute()` line ~89: same gap
- `generateCharges()` line ~369: generates fees for active assignments — should also guard against inactive students being charged
- Driver roster query line ~481: same gap
- `getStudentsWithRouteStatus()` line ~793: already has `->where('s.status', 'active')` ✓

**Alternative considered**: Deactivate all transport assignments when a student's status changes in `StudentController::changeStatus`. Rejected — the transport deactivation is a separate concern and would couple two modules. Filtering at query time is simpler and more resilient.

---

## 4. Dashboard — Student Status

**Decision**: No change needed.

**Rationale**: `DashboardController` already hardcodes `->where('status', 'active')` when counting students (line ~32). Confirmed compliant.

---

## 5. Class Attendance — Student Status

**Decision**: No backend change needed. Verify frontend.

**Rationale**: `Attendance.tsx` (line 129) calls `api.getStudentsByClass(selectedClassId, 'active')` which passes `status='active'` to the backend endpoint `GET /api/students/by-class/:classId`. Backend `StudentModel::getByClass()` defaults to `'active'` and applies the filter. Confirmed compliant.

---

## 6. Payment Modal — Live All-Status Search

**Decision**: Replace the prefetch approach with debounced live search using the existing `GET /api/students/search` endpoint.

**Rationale**:
- Current implementation: fetches up to 2000 active students on modal open; applies client-side filtering — inefficient, excludes non-active students.
- `GET /api/students/search?query=&classId=` already exists, returns all students regardless of status (no status filter applied in `StudentController::search()`), and includes `status` in the response payload.
- The endpoint calls `StudentModel::search()` which has no status restriction.
- Debounce + cancellation (AbortController) prevents redundant requests.
- No pre-load: empty state until user types.

**Search endpoint behaviour confirmed**:
- Returns `id`, `firstName`, `lastName`, `admissionNumber`, `className`, `status`, `balance`
- No pagination parameter currently — will need to add a `limit` parameter to prevent oversized responses (default 20 results).

**Alternatives considered**:
- Create a new dedicated payment-search endpoint: unnecessary — the existing search endpoint already meets the requirements after adding a `limit` parameter.
- Keep prefetch but include all statuses: would still load all students into memory and limit results to the initial fetch. Rejected on performance grounds.

---

## 7. Backend Search Endpoint — Limit Parameter

**Decision**: Add optional `limit` query parameter to `GET /api/students/search`. Default: 20. Maximum: 50.

**Rationale**: The current endpoint returns all matching students. In large schools, a single-character search term could match hundreds of students. Capping results at 20 (with a hard max of 50) keeps response payloads small and renders quickly without requiring pagination UI in the modal.

**Alternatives considered**: Full pagination with `page` parameter — overkill for a modal search; 20 results is sufficient for interactive selection.

---

## 8. Constitution Compliance Pre-check

| Principle | Assessment |
|-----------|------------|
| I (tenant_id) | All existing queries already include `tenant_id`. New `limit` parameter does not affect isolation. |
| II (API separation) | All changes are through the REST API; no direct DB access from frontend. |
| III (JWT auth) | Search endpoint is already behind JWTAuthFilter. No new public paths. |
| IV (migrations) | No schema changes required for this feature. |
| V (ledger integrity) | Not affected. |
| VI (REST standards) | Existing endpoints reused; `limit` param follows convention. |
| VII (code quality) | Refactoring payment modal reduces code: removes prefetch logic, simplifies filtering. |
| VIII (security) | `limit` parameter must be validated/clamped server-side before use. |
| IX (error handling) | Payment modal must handle search errors gracefully. |
| X (integration tests) | Tests needed: transport active-only, payment search all-status, limit capping. |
| XI (performance) | This feature improves performance: removes 2000-student prefetch. |
