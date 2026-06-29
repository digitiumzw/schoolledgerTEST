# Tasks: Backend-Driven Admin Analytics

**Input**: Design documents from `/specs/081-backend-analytics/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Endpoint-level curl validation is required by the constitution and is included in the story phases below.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the backend-driven analytics contract and align the frontend to consume processed data only.

- [ ] T001 [P] Define backend-prepared analytics and payment-history response types in `frontend/src/api/platform.ts` and `frontend/src/api/api.ts`
- [ ] T002 [P] Add server-side analytics response helper methods in `backend/app/Controllers/Platform/AnalyticsController.php` and `backend/app/Controllers/Api/PaymentController.php`
- [ ] T003 Update the admin Analytics and payments screens to rely on server query parameters and backend responses in `frontend/src/admin/pages/Analytics.tsx`, `frontend/src/pages/Payments.tsx`, and `frontend/src/components/modals/PaymentHistoryModal.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the shared backend querying and response foundations required before any story-specific work can be completed.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Refactor `backend/app/Controllers/Platform/AnalyticsController.php` to return backend-formatted growth series with ready-to-render labels, comparisons, and summary metadata
- [ ] T005 Refactor `backend/app/Controllers/Platform/AnalyticsController.php` leaderboard handling to return pre-ranked, display-ready rows and metadata for the Analytics page
- [ ] T006 [P] Strengthen filtered payment-history query helpers in `backend/app/Models/PaymentModel.php` so counts, summaries, and paginated rows are computed server-side with bounded joins
- [ ] T007 [P] Normalize payment-history query validation and pagination metadata in `backend/app/Controllers/Api/PaymentController.php` for `/payments/with-students` and `/payments/student/{studentId}`

**Checkpoint**: Foundation ready - user story implementation can now begin in priority order

---

## Phase 3: User Story 1 - Backend-Prepared Analytics Overview (Priority: P1) 🎯 MVP

**Goal**: The admin Analytics page loads summary cards, charts, and leaderboard data that are already computed by the backend.

**Independent Test**: Open the Analytics page and confirm that the visible series, labels, and values render directly from backend-prepared responses without client-side parsing or aggregation.

### Implementation for User Story 1

- [ ] T008 [US1] Complete backend summary payload composition for admin analytics in `backend/app/Controllers/Platform/AnalyticsController.php`
- [ ] T009 [P] [US1] Remove client-side growth and leaderboard transformations from `frontend/src/admin/pages/Analytics.tsx` so it renders backend-prepared values directly
- [ ] T010 [P] [US1] Update analytics API types and query helpers in `frontend/src/api/platform.ts` to match the backend-prepared analytics payloads
- [ ] T011 [P] [US1] Verify the Analytics page uses only backend-provided series and summary values in `frontend/src/admin/pages/Analytics.tsx` after refactor

### Validation for User Story 1

> **NOTE: Run endpoint validation AFTER implementation using curl URL requests.**

- [ ] T012 [P] [US1] Curl validate `GET /api/platform/analytics/growth` and `GET /api/analytics/leaderboard` for happy path, role access, and invalid filter handling

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Backend Search, Filter, and Pagination for Analytics Detail Views (Priority: P1)

**Goal**: Payment-history and analytics-linked tables search, filter, sort, and paginate entirely on the backend.

**Independent Test**: Apply search, filters, and pagination changes to payments history and confirm the browser receives only the requested page plus backend summary metadata.

### Implementation for User Story 2

- [ ] T013 [US2] Expand `backend/app/Models/PaymentModel.php` so filtered counts, summaries, and row selection stay backend-authoritative and avoid per-row repeated lookups
- [ ] T014 [P] [US2] Keep pagination, sorting, and query normalization server-side in `backend/app/Controllers/Api/PaymentController.php` for the payments history endpoints
- [ ] T015 [P] [US2] Remove any remaining client-side reshaping or calculations from `frontend/src/pages/Payments.tsx` so the page relies on backend summaries and pagination metadata
- [ ] T016 [P] [US2] Refactor `frontend/src/components/modals/PaymentHistoryModal.tsx` to render paginated student payment history only from backend-provided page data and summary fields
- [ ] T017 [US2] Update the payments API contract in `frontend/src/api/api.ts` so the page and modal consume the backend pagination and summary envelope directly

### Validation for User Story 2

- [ ] T018 [P] [US2] Curl validate `GET /api/payments/with-students` and `GET /api/payments/student/{studentId}` for happy path, invalid input, empty result, and access control

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Related Payment and Reporting Views Use Backend Authority (Priority: P2)

**Goal**: Receipts and related drill-down/reporting views use backend-prepared detail payloads and preserve the active reporting context.

**Independent Test**: Open a receipt or related detail view from the analytics/payments flow and confirm it uses backend-prepared data without recomputing balances or summaries in the browser.

### Implementation for User Story 3

- [ ] T019 [US3] Update `backend/app/Controllers/Api/ReceiptController.php` and `backend/app/Controllers/Api/PaymentController.php` to return backend-prepared receipt and payment-detail payloads with authoritative values
- [ ] T020 [P] [US3] Update `frontend/src/components/modals/PrintReceiptModal.tsx` so receipt display uses backend-prepared detail payloads without recomputing balances
- [ ] T021 [P] [US3] Preserve analytics-to-report navigation context in `frontend/src/admin/pages/Analytics.tsx` and `frontend/src/pages/Payments.tsx` so filters and reporting periods are passed through unchanged
- [ ] T022 [US3] Update related API types in `frontend/src/api/api.ts` so receipt and drill-down consumers accept the backend-prepared detail payloads

### Validation for User Story 3

- [ ] T023 [P] [US3] Curl validate receipt/detail and related reporting responses for minimal payloads, tenant isolation, and consistent context handling

**Checkpoint**: At this point, User Story 3 should be independently functional and consistent with the analytics context

---

## Phase 6: User Story 4 - Performance-Optimized Analytics Data Loading (Priority: P2)

**Goal**: High-volume analytics and payment-history pages stay fast by using bounded queries, shared aggregates, caching, and minimal payloads.

**Independent Test**: Load the analytics and payment-history views against large datasets and confirm the backend response remains bounded, stable, and quick without repeated per-row lookup behavior.

### Implementation for User Story 4

- [ ] T024 [US4] Add backend query-efficiency improvements in `backend/app/Controllers/Platform/AnalyticsController.php` and `backend/app/Models/PaymentModel.php` using shared aggregates, bounded selects, and reduced repeated lookups
- [ ] T025 [P] [US4] Add caching or precomputed response reuse for high-volume analytics and payment-history reads in `backend/app/Controllers/Platform/AnalyticsController.php` and `backend/app/Controllers/Api/PaymentController.php` where freshness allows it
- [ ] T026 [P] [US4] Add or adjust database indexes or query-support migrations under `backend/app/Database/Migrations/` only if profiling or explain plans identify a real hotspot for analytics or payment-history queries
- [ ] T027 [US4] Document the final backend query strategy and performance assumptions in `specs/081-backend-analytics/research.md` or `specs/081-backend-analytics/quickstart.md`

### Validation for User Story 4

- [ ] T028 [P] [US4] Capture performance validation evidence for analytics and payment-history endpoints in `specs/081-backend-analytics/quickstart.md`

**Checkpoint**: At this point, the feature should be scalable and performant for large tenant datasets

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Cross-cutting validation and cleanup across analytics and payments flows

- [ ] T029 [P] Verify the frontend no longer performs analytics or payment-history filtering, searching, pagination, or summary calculations in `frontend/src/admin/pages/Analytics.tsx`, `frontend/src/pages/Payments.tsx`, and `frontend/src/components/modals/PaymentHistoryModal.tsx`
- [ ] T030 [P] Run PHP lint, frontend TypeScript type-check, targeted ESLint, and curl smoke validation for the changed analytics and payment-history endpoints, then record the results in `specs/081-backend-analytics/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel if staffing allows
  - Or sequentially in priority order (P1 → P2)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational (Phase 2) - May integrate with US1 but should be independently testable
- **User Story 3 (P2)**: Can start after Foundational (Phase 2) - Depends on payment/receipt detail contracts but should remain independently testable
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) - Applies across the analytics and payment-history surfaces

### Within Each User Story

- Backend contracts and helpers before frontend rendering changes
- Backend filtering/sorting/pagination before frontend page wiring
- Core implementation before validation
- Curl validation tasks MUST run after implementation
- Story complete before moving to next priority

### Parallel Opportunities

- Setup tasks marked [P] can run in parallel where they touch different files
- Foundational tasks marked [P] can run in parallel once the shared contract shape is agreed
- After Foundation is complete, user stories can start in parallel if the team has capacity
- Validation tasks can run in parallel with one another after their target story is implemented
- Different frontend and backend files within the same story can often be worked in parallel

---

## Parallel Example: User Story 1

```bash
# Run the analytics backend validation after implementation:
Task: "Curl validate GET /api/platform/analytics/growth and GET /api/analytics/leaderboard for happy path, role access, and invalid filter handling"

# Implement the backend and frontend rendering changes in parallel once the response shape is set:
Task: "Complete backend summary payload composition for admin analytics in backend/app/Controllers/Platform/AnalyticsController.php"
Task: "Remove client-side growth and leaderboard transformations from frontend/src/admin/pages/Analytics.tsx so it renders backend-prepared values directly"
Task: "Update analytics API types and query helpers in frontend/src/api/platform.ts to match the backend-prepared analytics payloads"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Demo or deploy the analytics overview once it is backend-driven

### Incremental Delivery

1. Complete Setup + Foundational → backend contract and query foundations are ready
2. Add User Story 1 → analytics overview becomes backend-prepared
3. Add User Story 2 → payment-history and analytics-linked tables become backend-driven
4. Add User Story 3 → receipts and drill-down views consume backend authority
5. Add User Story 4 → performance hardening and query efficiency improvements
6. Finish with polish and cross-cutting validation

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1
   - Developer B: User Story 2
   - Developer C: User Story 3
   - Developer D: User Story 4
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing where practical
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid vague tasks, same-file conflicts, and cross-story dependencies that break independence
