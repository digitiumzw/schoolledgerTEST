# Tasks: Route Balance and Printable Student List

**Input**: Design documents from `/specs/087-route-balance-printing/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/route-balance-api.md, quickstart.md

**Tests**: Endpoint-level curl validation per quickstart.md (Constitution Principle X).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Review existing code patterns and confirm no new infrastructure is needed.

- [x] T001 Review existing `TransportController::getRoute()` and `LedgerService::getAllBalances()` code patterns to confirm extension approach

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Add the bulk balance lookup method that both user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 Add `getBalancesForStudentIds(array $studentIds, string $tenantId)` to `backend/app/Services/LedgerService.php` using the existing `getAllBalances()` subquery pattern with `WHERE s.id IN (...)` filter

**Checkpoint**: Foundation ready — the bulk balance method is available and returns correct `totalBalance` values for any set of student IDs.

---

## Phase 3: User Story 1 - View Outstanding Balances on Route Details (Priority: P1) 🎯 MVP

**Goal**: Enrich the route detail API response with per-student balances and route-level aggregates, then display them on the Route Detail page.

**Independent Test**: Load a route detail page with active student allocations and verify each student row displays a balance amount, and the summary card shows total outstanding balance and count.

### Validation for User Story 1

- [x] T003 [P] [US1] curl validation: `GET /transport/routes/:id` returns `students[].balance` and `balanceSummary`; cross-check one student's balance against `GET /students/:id/balance`

### Implementation for User Story 1

- [x] T004 [P] [US1] Enrich `TransportController::getRoute()` in `backend/app/Controllers/Api/TransportController.php` to call `getBalancesForStudentIds()` for route-assigned students and build `balanceSummary` aggregates
- [x] T005 [P] [US1] Extend `TransportAllocationStudent` interface with `balance: number | null` in `frontend/src/types/dashboard.ts`
- [x] T006 [P] [US1] Add `RouteBalanceSummary` interface to `frontend/src/types/dashboard.ts`
- [x] T007 [P] [US1] Extend `TransportRoute` interface with `balanceSummary?: RouteBalanceSummary` in `frontend/src/types/dashboard.ts`
- [x] T008 [US1] Update `api.ts` type definitions to reflect enriched `TransportRoute` and `TransportAllocationStudent` shapes in `frontend/src/api/api.ts`
- [x] T009 [US1] Display each student's `balance` as formatted currency in the student list card on `frontend/src/pages/RouteDetailPage.tsx`
- [x] T010 [US1] Add a route balance summary card (total students, students with balance, total outstanding) to `frontend/src/pages/RouteDetailPage.tsx`
- [x] T011 [US1] Ensure ledger errors are caught and gracefully degraded to `null` balance / zero summary (per edge-case spec) in `backend/app/Controllers/Api/TransportController.php`

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently.

---

## Phase 4: User Story 2 - Print Student List with Balances and Stops (Priority: P2)

**Goal**: Add a browser-native print button and print-optimized report layout to the Route Detail page.

**Independent Test**: Click "Print List" on a route detail page and verify the browser print preview shows a clean formatted report with route header, student table, summary, and print timestamp.

### Validation for User Story 2

- [x] T012 [P] [US2] Manual UI validation: click Print List, verify browser print preview contains all required fields and hides non-report UI

### Implementation for User Story 2

- [x] T013 [P] [US2] Add a "Print List" button to the student list card header on `frontend/src/pages/RouteDetailPage.tsx`
- [x] T014 [P] [US2] Add a print-optimized report section (hidden on screen, visible in print) with route header, student table, summary, and print timestamp to `frontend/src/pages/RouteDetailPage.tsx`
- [x] T015 [US2] Add `@media print` CSS rules to `frontend/src/index.css` to hide navigation, action buttons, modals, and other non-report UI elements during printing

**Checkpoint**: At this point, both User Stories 1 and 2 should work independently.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Lint, type-check, curl validation, and documentation updates.

- [x] T016 [P] PHP lint for `backend/app/Controllers/Api/TransportController.php` and `backend/app/Services/LedgerService.php`
- [x] T017 [P] Frontend TypeScript `tsc --noEmit` validation
- [x] T018 [P] ESLint on touched frontend files (`RouteDetailPage.tsx`, `types/dashboard.ts`, `api/api.ts`)
- [x] T019 curl validation: happy path, unauthorized access, tenant isolation (per `quickstart.md`)
- [x] T020 `git diff --check` for clean diffs
- [x] T021 Update `quickstart.md` with actual curl validation results

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3–4)**: Both depend on Foundational phase completion
  - US1 and US2 can proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2)
- **Polish (Phase 5)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2). No dependencies on other stories.
- **User Story 2 (P2)**: Can start after Foundational (Phase 2). Depends on US1 types being defined (T005–T007) but can run in parallel with US1 implementation if types are established first.

### Within Each User Story

- Backend controller enrichment (T004) depends on Foundational (T002)
- Frontend type updates (T005–T007) can run in parallel
- Frontend page updates (T009–T010) depend on type updates (T005–T007)
- Print feature (T013–T015) depends on US1 page structure being in place

### Parallel Opportunities

- T004 (backend controller) and T005–T007 (frontend types) can run in parallel
- T009 (balance display) and T010 (summary card) can run in parallel
- T013 (print button) and T014 (print report section) can run in parallel
- All Polish phase tasks (T016–T021) marked [P] can run in parallel after implementation

---

## Parallel Example: User Story 1

```bash
# Backend controller enrichment + frontend types can run together:
Task: "Enrich TransportController::getRoute() with balances and balanceSummary"
Task: "Extend TransportAllocationStudent with balance field in types/dashboard.ts"
Task: "Add RouteBalanceSummary interface to types/dashboard.ts"
Task: "Extend TransportRoute interface with balanceSummary in types/dashboard.ts"

# Then page updates can run together:
Task: "Display student balances in RouteDetailPage student list"
Task: "Add route balance summary card to RouteDetailPage"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002)
3. Complete Phase 3: User Story 1 (T003–T011)
4. **STOP and VALIDATE**: Test US1 independently via curl and UI
5. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 backend + frontend balance display
   - Developer B: US2 print feature (leverages US1 types)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
