# Tasks: Student Status Filtering & Immediate Status Updates

**Input**: Design documents from `specs/049-student-status-filtering/`  
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/student-search.md ✓, quickstart.md ✓

**Tests**: Integration tests are included — required by Constitution Principle X and specified in plan.md.

**Organization**: Tasks are grouped by user story. US1, US2, and US3 are independent of each other and can be implemented in any order or in parallel.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup

**Purpose**: Confirm development environment is ready and branch is checked out.

- [ ] T001 Confirm branch `049-student-status-filtering` is active (`git branch --show-current`)
- [ ] T002 Confirm backend dev server starts cleanly (`php spark serve` in `backend/`)
- [ ] T003 Confirm frontend dev server starts cleanly (`npm run dev` in `frontend/`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: No shared foundational infrastructure is needed for this feature — no migrations, no new shared models, no new middleware. Each user story touches independent files.

**⚠️ CRITICAL**: Skip directly to Phase 3. User stories can begin immediately after Phase 1.

---

## Phase 3: User Story 1 — Immediate Student Status Update (Priority: P1) 🎯 MVP

**Goal**: Confirm and, if needed, fix the Students page so that a status change is reflected immediately without a manual page reload.

**Independent Test**: Open the Students page, change a student from Active to Inactive, and verify the status badge updates in the table without a page reload.

### Implementation for User Story 1

- [ ] T004 [US1] Audit `StatusChangeModal` in `frontend/src/components/modals/StatusChangeModal.tsx` — verify `onSuccess()` is called on every success path and NOT on any error path (line 56)
- [ ] T005 [US1] Audit the `onSuccess={fetchData}` prop wiring in `frontend/src/pages/Students.tsx` (line 876) — confirm `fetchData` calls `fetchStudents(1, true)` and the student list re-renders with updated data
- [ ] T006 [US1] Audit `api.changeStudentStatus` in `frontend/src/api/api.ts` (line 766) — confirm HTTP method is `PUT` matching the backend route `PUT /api/students/(:id)/status` in `backend/app/Config/Routes.php` (line 85)
- [ ] T007 [US1] Audit `StudentController::changeStatus` in `backend/app/Controllers/Api/StudentController.php` — confirm it validates status against migration ENUM values (`active`, `inactive`, `transferred`, `dropped_out`, `graduated`), writes to `student_status_history` atomically, and returns the updated student record
- [ ] T008 [US1] If any gap is found in T004–T007: fix the broken link in the relevant file (StatusChangeModal, Students.tsx, api.ts, or StudentController) so the immediate-update flow works end-to-end

**Checkpoint**: Change a student's status → the Students page list reflects the new status within 2 seconds with no manual reload required.

---

## Phase 4: User Story 2 — Active-Only Students in Operational Modules (Priority: P2)

**Goal**: Non-active students are excluded from all Transport module rosters and charge runs. Dashboard and Class Attendance are already compliant (no change needed there).

**Independent Test**: Mark a student Inactive → open the Transport module → confirm the student does not appear on any route roster.

### Integration Tests for User Story 2

- [ ] T009 [P] [US2] Write integration test in `backend/tests/` — `GET /api/transport/routes` with an inactive student who has an active assignment: assert the student is absent from the route's student list
- [ ] T010 [P] [US2] Write integration test in `backend/tests/` — `GET /api/transport/routes/:id` (single route): same assertion as T009

### Implementation for User Story 2

- [ ] T011 [US2] In `TransportController::getRoutes()` at `backend/app/Controllers/Api/TransportController.php` (~line 52): add `->where('s.status', 'active')` immediately after `->where('ta.status', 'active')` on the `transport_assignments` bulk query
- [ ] T012 [US2] In `TransportController::getRoute()` (~line 89): add `->where('s.status', 'active')` after `->where('ta.status', 'active')` on the single-route student query
- [ ] T013 [US2] In `TransportController::generateCharges()` (~line 369): add `->where('s.status', 'active')` after `->where('ta.status', 'active')` so inactive students are not charged
- [ ] T014 [US2] In the driver roster query in `TransportController` (~line 481): add `->where('s.status', 'active')` after `->where('ta.status', 'active')`
- [ ] T015 [US2] Run integration tests T009–T010 and confirm they pass
- [ ] T016 [US2] Manually verify: Dashboard student count and Class Attendance roster are already active-only (no code change needed; confirm via browser)

**Checkpoint**: Transport rosters show only active students. Dashboard and Attendance already comply.

---

## Phase 5: User Story 3 — All-Students Search in Payment Recording Modal (Priority: P3)

**Goal**: The payment modal searches the backend live on each keystroke (debounced, 300ms), returns students of all statuses, loads no students on open, and cancels superseded requests.

**Independent Test**: Mark a student Inactive → open the payment modal → type the student's name → confirm the student appears in the results.

### Integration Tests for User Story 3

- [ ] T017 [P] [US3] Write integration test in `backend/tests/` — `GET /api/students/search?query=<name>`: assert response includes students of all statuses (not filtered to active)
- [ ] T018 [P] [US3] Write integration test in `backend/tests/` — `GET /api/students/search?query=a&limit=5`: assert exactly 5 results returned
- [ ] T019 [P] [US3] Write integration test in `backend/tests/` — `GET /api/students/search?query=a&limit=100`: assert result count is clamped to 50 (not 100)
- [ ] T020 [P] [US3] Write integration test in `backend/tests/` — cross-tenant isolation: a search from tenant A must not return students belonging to tenant B

### Backend: Search Endpoint Limit Parameter

- [ ] T021 [US3] In `StudentModel::search()` at `backend/app/Models/StudentModel.php` (~line 500): add `int $limit = 20` parameter and apply `->limit($limit)` to the query builder before fetching results
- [ ] T022 [US3] In `StudentController::search()` at `backend/app/Controllers/Api/StudentController.php` (~line 618): read `$limit = (int)($this->request->getGet('limit') ?? 20)`, clamp to `max(1, min(50, $limit))`, and pass to `StudentModel::search()`
- [ ] T023 [US3] Run integration tests T017–T020 and confirm they pass

### Frontend: API Helper Update

- [ ] T024 [US3] In `api.searchStudents()` at `frontend/src/api/api.ts` (line 787): add `limit?: number` parameter and append `params.append('limit', String(limit ?? 20))` to the URLSearchParams before the request

### Frontend: Payment Modal Refactor

- [ ] T025 [US3] In `frontend/src/components/modals/RecordPaymentModal.tsx`: remove the `fetchStudents` async function (lines ~92–113), remove the `useEffect` that calls it on modal open, and remove the `students` state array
- [ ] T026 [US3] In `RecordPaymentModal.tsx`: add three new state variables — `searchResults: Student[]` (initial `[]`), `isSearching: boolean` (initial `false`), `searchError: string | null` (initial `null`)
- [ ] T027 [US3] In `RecordPaymentModal.tsx`: add `abortControllerRef = useRef<AbortController | null>(null)` to hold a cancellable request handle
- [ ] T028 [US3] In `RecordPaymentModal.tsx`: add a `useEffect` watching `searchQuery` with 300ms debounce — if `searchQuery` is empty: clear `searchResults`; otherwise: abort previous request, create new `AbortController`, set `isSearching = true`, call `api.searchStudents(searchQuery, undefined, 20)`, on success set `searchResults` and clear `isSearching`, on error (non-abort) set `searchError` and clear `isSearching`
- [ ] T029 [US3] In `RecordPaymentModal.tsx`: replace `filteredStudents.map(...)` with `searchResults.map(...)` in the student picker `CommandList`
- [ ] T030 [US3] In `RecordPaymentModal.tsx`: add empty-state UI in `CommandEmpty` when `searchQuery` is empty — display "Type a name or admission number to search"; when `isSearching` is true — display a loading indicator; when `searchError` is set — display the error message inline
- [ ] T031 [US3] In `RecordPaymentModal.tsx`: update `handleStudentChange` to look up the selected student from `searchResults` instead of the removed `students` array
- [ ] T032 [US3] Manual verify: open payment modal → no network request fires on open; type a name → one request fires per debounce window (check Network tab); inactive student appears in results

**Checkpoint**: Payment modal loads without prefetching, searches all statuses live, debounces correctly, and cancels stale requests.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup and validation across all stories.

- [ ] T033 [P] Remove any `console.log` or debug statements introduced during implementation in `frontend/src/components/modals/RecordPaymentModal.tsx`
- [ ] T034 [P] Run `npm run lint` in `frontend/` and fix any TypeScript or ESLint errors introduced by the RecordPaymentModal refactor
- [ ] T035 Run full quickstart.md manual test checklist (`specs/049-student-status-filtering/quickstart.md`) end-to-end
- [ ] T036 Confirm Constitution Principle X (integration tests): all five tests written in T009, T010, T017–T020 pass via `cd backend && composer test`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Skipped — no shared prerequisites
- **User Story phases (Phases 3–5)**: All depend only on Phase 1 completion; stories are independent of each other
- **Polish (Phase 6)**: Depends on all desired stories being complete

### User Story Dependencies

- **US1 (P1)**: Independent — can start after Phase 1
- **US2 (P2)**: Independent — can start after Phase 1; no dependency on US1
- **US3 (P3)**: Independent — can start after Phase 1; no dependency on US1 or US2

### Within Each User Story

- US2: Integration tests (T009–T010) → backend fix (T011–T014) → test run (T015)
- US3: Integration tests (T017–T020) → backend model (T021) → backend controller (T022) → test run (T023) → api.ts (T024) → modal refactor (T025–T031) → verify (T032)

---

## Parallel Opportunities

### US2 and US3 can run entirely in parallel (different files, independent logic)

```
US2 backend work (T011–T015)  ────────────────────────────────────────┐
                                                                        ├── T033–T036
US3 backend work (T021–T023)  ─┐                                       │
                                ├── US3 frontend (T024–T032) ──────────┘
US3 integration tests (T017–T020) [P] ─┘
```

### Within US3, these tasks can run in parallel after T021 is complete

- T017, T018, T019, T020 — all integration tests are in separate test functions, can be written simultaneously

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (T001–T003)
2. Complete US1 (T004–T008) — verify or fix the status refresh path
3. **STOP and VALIDATE**: manually confirm status update is immediate
4. This alone is shippable

### Incremental Delivery

1. Phase 1 → US1 → validate → deploy
2. US2 (transport fix) → validate → deploy
3. US3 (payment modal search) → validate → deploy

### Parallel Team Strategy

With two developers:
- Developer A: US1 (T004–T008) + US2 backend (T009–T015)
- Developer B: US3 backend (T017–T023) + US3 frontend (T024–T032)

---

## Notes

- [P] tasks = different files, no dependencies — safe to run concurrently
- [Story] labels trace each task to its user story for independent review
- No schema migrations required for any story
- Constitution Principle X mandates integration tests — included in US2 (T009–T010) and US3 (T017–T020)
- US1 is primarily an audit task; code changes only if a gap is found
