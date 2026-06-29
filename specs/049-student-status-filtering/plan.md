# Implementation Plan: Student Status Filtering & Immediate Status Updates

**Branch**: `049-student-status-filtering` | **Date**: 2026-04-28 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `specs/049-student-status-filtering/spec.md`

## Summary

Three targeted fixes: (1) add `students.status = 'active'` predicate to TransportController queries that were only filtering on the assignment-level status; (2) replace the payment modal's 2000-student prefetch + client-side filter with a debounced live backend search returning all statuses; (3) verify the Students page status change already refreshes immediately via its `onSuccess` callback (no structural change needed). No schema migrations required.

## Technical Context

**Language/Version**: PHP 8.1+ (backend) · TypeScript / React 18 (frontend)  
**Primary Dependencies**: CodeIgniter 4 · MySQL (backend) · Vite, TanStack React Query, shadcn/ui, React Hook Form + Zod (frontend)  
**Storage**: MySQL — `students`, `transport_assignments`, `student_status_history`  
**Testing**: PHPUnit via `composer test` (backend)  
**Target Platform**: Linux server (backend) · SPA in modern browser (frontend)  
**Project Type**: Full-stack multi-tenant SaaS web application  
**Performance Goals**: Payment modal search returns results within 500ms; no 2000-student payload on modal open  
**Constraints**: All queries must include `tenant_id` from JWT; no frontend business logic; debounce ≤ 300ms  
**Scale/Scope**: Per-tenant school; up to hundreds of students per tenant

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I — Multi-Tenant Data Isolation | ✅ Pass | All existing queries already carry `tenant_id`; new `limit` parameter doesn't affect isolation |
| II — API-First Separation | ✅ Pass | All changes go through REST API; no direct DB from frontend |
| III — JWT Auth & Role-Based Access | ✅ Pass | Search endpoint already behind JWTAuthFilter; no new public paths |
| IV — Immutable Migrations | ✅ Pass | No schema changes required |
| V — Financial Ledger Integrity | ✅ Pass | Not affected; balance computation unchanged |
| VI — REST Standards & Consistent Responses | ✅ Pass | Existing endpoints reused; `limit` param follows conventions |
| VII — Code Quality | ✅ Pass | Refactoring payment modal reduces complexity |
| VIII — Defensive Security | ✅ Pass | `limit` must be validated and clamped server-side |
| IX — Error Handling | ✅ Pass | Payment modal must handle search errors with inline feedback |
| X — Integration Testing | ✅ Pass | Tests required: transport active-only, payment search all-status, limit capping |
| XI — Performance Discipline | ✅ Pass | Feature removes a 2000-student memory load; improvements are measured |

## Project Structure

### Documentation (this feature)

```text
specs/049-student-status-filtering/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── student-search.md  # Phase 1 output
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit.tasks — not yet created)
```

### Source Code (repository root)

```text
backend/
├── app/
│   └── Controllers/
│       └── Api/
│           ├── TransportController.php   ← add s.status = 'active' to 4 queries
│           └── StudentController.php     ← add limit param to search()
└── tests/
    └── (new integration tests)

frontend/
└── src/
    ├── api/
    │   └── api.ts                        ← update searchStudents() with limit param
    └── components/
        └── modals/
            └── RecordPaymentModal.tsx    ← replace prefetch with live debounced search
```

**Structure Decision**: Web application layout (Option 2). Changes are confined to two backend controller files and two frontend files. No new files are required other than backend test cases.

## Complexity Tracking

No Constitution Check violations. Table not required.

---

## Phase 0: Research (Complete)

See [research.md](research.md) for all findings.

**Resolved decisions**:

| Decision | Resolution |
|----------|-----------|
| Student status ENUM values | `active`, `inactive`, `transferred`, `dropped_out`, `graduated` — from migration |
| Transport status gap | Add `s.status = 'active'` to 4 queries in TransportController |
| Dashboard compliance | Already filters active — no change needed |
| Attendance compliance | Frontend already requests active — no change needed |
| Payment modal approach | Debounced live search via `GET /api/students/search` with `limit=20` |
| Search endpoint change | Add `limit` param (default 20, max 50), clamp server-side |
| Students page refresh | Already wired via `onSuccess={fetchData}` — verify only |

---

## Phase 1: Design & Contracts (Complete)

### Data Model

See [data-model.md](data-model.md).

**Key findings**:
- No schema migration needed.
- `transport_assignments.status` and `students.status` are independent. Both must be `'active'` for a student to appear in transport rosters.
- `student_status_history` provides an immutable audit trail already written by `StudentController::changeStatus()`.

### Interface Contracts

See [contracts/student-search.md](contracts/student-search.md).

**Change**: `GET /api/students/search` gains an optional `limit` parameter (default 20, max 50, server-side clamped). Response format unchanged. All statuses returned — no status filter.

---

## Implementation Roadmap

### Task 1 — Transport: Add Student Status Filter (Backend)

**File**: `backend/app/Controllers/Api/TransportController.php`

Add `->where('s.status', 'active')` after each existing `->where('ta.status', 'active')` in the following methods:

| Method | Approx. line | Context |
|--------|-------------|---------|
| `getRoutes()` | ~52 | Lists students per route (bulk query) |
| `getRoute()` | ~89 | Lists students for a single route |
| `generateCharges()` | ~369 | Finds active assignments to charge |
| Driver roster query | ~481 | Driver sees their student list |

The `getStudentsWithRouteStatus()` method (~793) already has this filter — no change needed there.

**Acceptance**: An inactive/transferred student with an active transport assignment no longer appears in any route roster or charge run.

---

### Task 2 — Search Endpoint: Add Limit Parameter (Backend)

**File**: `backend/app/Controllers/Api/StudentController.php`

In `search()` method (~line 618):
1. Read `$limit = (int) ($this->request->getGet('limit') ?? 20)`.
2. Clamp: `$limit = max(1, min(50, $limit))`.
3. Pass `$limit` to `StudentModel::search()` (or apply `->limit($limit)` before fetching).

**File**: `backend/app/Models/StudentModel.php`

In `search()` method (~line 500):
1. Accept `int $limit = 20` parameter.
2. Apply `->limit($limit)` to the query builder before `->get()`.

**Acceptance**: `GET /api/students/search?query=a&limit=5` returns at most 5 results; `limit=100` is clamped to 50.

---

### Task 3 — Payment Modal: Live Debounced Search (Frontend)

**File**: `frontend/src/components/modals/RecordPaymentModal.tsx`

**Remove**:
- `fetchStudents()` function and its `useEffect` call on modal open.
- `students` state array holding the prefetched list.
- `filteredStudents` client-side filter.

**Add**:
- `searchResults` state: `Student[]`, initially `[]`.
- `isSearching` state: `boolean`.
- `searchError` state: `string | null`.
- `abortControllerRef`: `useRef<AbortController | null>(null)`.
- Debounced search `useEffect` on `searchQuery`:
  - If `searchQuery` is empty → clear results, return.
  - Cancel previous request via `abortControllerRef.current?.abort()`.
  - Create new `AbortController`, store in ref.
  - Set `isSearching = true`.
  - Call `api.searchStudents(searchQuery, undefined, 20)`.
  - On success: set `searchResults`, clear `isSearching`.
  - On error (not abort): set `searchError`, clear `isSearching`.
  - Debounce delay: 300ms.
- Replace `filteredStudents.map(...)` with `searchResults.map(...)` in the student picker.
- Show empty state when `searchQuery` is empty: "Type a name or admission number to search".
- Show `isSearching` indicator (e.g., spinner or loading text).
- Show `searchError` inline when set.

**File**: `frontend/src/api/api.ts`

Update `searchStudents()` to accept `limit?: number` and append it to the URL params.

**Acceptance**:
- Modal opens with no students pre-loaded.
- Typing "john" returns all students named John regardless of status.
- Network tab shows one request per debounce window; prior requests cancelled.

---

### Task 4 — Students Page: Verify Immediate Update (Frontend)

**File**: `frontend/src/components/modals/StatusChangeModal.tsx`

Verify:
1. `onSuccess()` is called on every successful status change (line 56 — confirmed).
2. Error path does not accidentally call `onSuccess()`.
3. Loading state in the modal button is cleared before `onSuccess()` fires.

No code changes expected unless a bug is found during verification.

**Acceptance**: Change a student's status → list refreshes without a manual page reload within 2 seconds.

---

### Task 5 — Integration Tests (Backend)

**Location**: `backend/tests/`

Write tests covering:
1. `TransportController::getRoutes` — inactive student with active assignment is excluded.
2. `TransportController::getRoute` — same for single route.
3. `StudentController::search` — returns students of all statuses.
4. `StudentController::search` — `limit` parameter is respected; `limit=100` clamped to 50.
5. `StudentController::search` — tenant isolation (cross-tenant students not returned).
