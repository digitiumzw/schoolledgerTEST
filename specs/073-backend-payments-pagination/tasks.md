# Tasks: Backend Payments Pagination

**Input**: Design documents from `/specs/073-backend-payments-pagination/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/payments-history-api.md, quickstart.md

**Tests**: Curl/API validation tasks are included because the SchoolLedger Constitution requires post-implementation endpoint-level curl validation for every feature.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and has no dependency on incomplete tasks
- **[Story]**: User story label from spec.md; setup/foundational/polish tasks do not use story labels
- All implementation tasks include exact file paths

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Inspect current implementation and prepare safe backend-driven payment history work.

- [X] T001 Inspect existing payment indexes and query plans for payments, students, classes, and payment_group_id access patterns in backend database schema
- [X] T002 [P] Review current Payments page data flow in frontend/src/pages/Payments.tsx and document remaining frontend-side payment processing points
- [X] T003 [P] Review current student payment history modal data flow in frontend/src/components/modals/PaymentHistoryModal.tsx and document client-side sorting, pagination, and calculations to remove
- [X] T004 [P] Review current payment API methods and types in frontend/src/api/api.ts and frontend/src/types/dashboard.ts
- [X] T005 [P] Review current backend payment query methods in backend/app/Models/PaymentModel.php and backend/app/Controllers/Api/PaymentController.php

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared backend query/contract foundations required before any user story implementation.

**CRITICAL**: No user story work can begin until this phase is complete.

- [X] T006 Add PaymentQuery normalization and validation helpers for page, limit, search, filters, date range, paymentType, sortBy, and sortOrder in backend/app/Controllers/Api/PaymentController.php
- [X] T007 Add reusable filtered payment condition helpers covering tenant scope, search, method, category, class, student, month, year, date range, and paymentType in backend/app/Models/PaymentModel.php
- [X] T008 Add reusable payment row select/join helper for backend-prepared student and class display fields in backend/app/Models/PaymentModel.php
- [X] T009 Add filtered count and filtered summary aggregate helper signatures aligned to PaymentResultPage and PaymentSummary in backend/app/Models/PaymentModel.php
- [X] T010 Add shared frontend TypeScript interfaces for PaymentQuery, PaymentResultPage, PaymentSummary, and StudentPaymentHistoryResponse in frontend/src/api/api.ts
- [X] T011 [P] Add or update dashboard Payment-related types for paginated backend responses in frontend/src/types/dashboard.ts
- [X] T012 Create new immutable migration for missing payment-history performance indexes if T001 confirms gaps in backend/app/Database/Migrations/2026-05-13-000001_AddPaymentHistoryPerformanceIndexes.php

**Checkpoint**: Backend query normalization, data shapes, and optional index migration foundation are ready.

---

## Phase 3: User Story 1 - View Paginated Payments History (Priority: P1) MVP

**Goal**: The main payments table loads only one backend-prepared page of payment rows with pagination metadata.

**Independent Test**: Open the payments page or call `/api/payments/with-students?page=1&limit=20`; verify at most 20 rows are returned with total and totalPages metadata.

### Implementation for User Story 1

- [X] T013 [US1] Refactor getFilteredWithStudents to use shared row select, tenant filtering, bounded limit/offset, and deterministic ordering in backend/app/Models/PaymentModel.php
- [X] T014 [US1] Refactor getFilteredCount to reuse the same filter conditions as row retrieval in backend/app/Models/PaymentModel.php
- [X] T015 [US1] Update withStudents endpoint to return `data`, `pagination`, normalized `filters`, and existing summary compatibility fields in backend/app/Controllers/Api/PaymentController.php
- [X] T016 [US1] Update getPaymentsWithStudents API client parameters and response typing in frontend/src/api/api.ts
- [X] T017 [US1] Update Payments table rendering to consume backend-prepared row display fields without full student-list lookup for table row class/name derivation in frontend/src/pages/Payments.tsx
- [X] T018 [US1] Ensure Payments pagination controls rely only on backend pagination metadata and never slice payment arrays locally in frontend/src/pages/Payments.tsx
- [X] T019 [US1] Add empty page and out-of-range page handling for backend pagination results in frontend/src/pages/Payments.tsx

**Checkpoint**: User Story 1 is independently functional and testable as MVP.

---

## Phase 4: User Story 2 - Search and Filter Payments on the Backend (Priority: P1)

**Goal**: Searches and filters are applied against the full authorized payment history on the backend.

**Independent Test**: Search/filter for matching payment records not visible on page 1; verify results, totals, counts, and pagination reflect the full filtered dataset.

### Implementation for User Story 2

- [X] T020 [US2] Extend payment search to include student name, admission number, receipt number, description, method, category, and supported date-related fields in backend/app/Models/PaymentModel.php
- [X] T021 [US2] Add dateFrom/dateTo and paymentType filtering support to filtered payment queries in backend/app/Models/PaymentModel.php
- [X] T022 [US2] Add allowlisted sorting for date, amount, studentName, method, category, and receiptNumber in backend/app/Models/PaymentModel.php
- [X] T023 [US2] Update withStudents request validation for invalid date ranges, unsupported sort fields, unsupported sortOrder, invalid paymentType, month, year, page, and limit in backend/app/Controllers/Api/PaymentController.php
- [X] T024 [US2] Update getPaymentsWithStudents frontend API method to send dateFrom, dateTo, paymentType, sortBy, and sortOrder query params in frontend/src/api/api.ts
- [X] T025 [US2] Update Payments filters/search UI wiring so all filter changes reset to page 1 and refetch backend results without local filtering in frontend/src/pages/Payments.tsx
- [X] T026 [US2] Update Payments table sortable column handlers to request backend sorting instead of sorting rows locally in frontend/src/pages/Payments.tsx

**Checkpoint**: User Story 2 works independently after foundation and US1 endpoint shape.

---

## Phase 5: User Story 3 - Use Backend-Prepared Payment Metrics (Priority: P2)

**Goal**: Payment totals, counts, and breakdowns displayed on the payments page come from backend summaries aligned to active filters.

**Independent Test**: Apply filters and verify displayed summary cards match backend `summary` values for the same filtered dataset.

### Implementation for User Story 3

- [X] T027 [US3] Implement getFilteredSummary aggregate query for totalAmount, totalCount, totalThisMonth, paymentsToday, byMethod, and byCategory in backend/app/Models/PaymentModel.php
- [X] T028 [US3] Preserve source-derived totalOutstanding calculation using existing LedgerService eligible charge/payment rules in backend/app/Models/PaymentModel.php
- [X] T029 [US3] Update withStudents endpoint to return filter-aligned `summary` while preserving existing `stats` compatibility if needed in backend/app/Controllers/Api/PaymentController.php
- [X] T030 [US3] Update Payments stats cards to consume backend `summary`/compatibility stats only and remove frontend payment-total calculations in frontend/src/pages/Payments.tsx
- [X] T031 [US3] Add zero-valued summary handling for empty filtered result sets in frontend/src/pages/Payments.tsx

**Checkpoint**: User Story 3 is functional and summaries stay backend-authoritative.

---

## Phase 6: User Story 4 - Preserve Related Payment Features Without Client-Side Reprocessing (Priority: P2)

**Goal**: Student payment history and receipt/detail related flows avoid full-history fetching and client-side reprocessing.

**Independent Test**: Open payment history and receipt views; verify student history fetches a backend page with summaries and receipt/detail views fetch only needed detail data.

### Implementation for User Story 4

- [X] T032 [US4] Add getStudentPaymentHistory method returning student display data, paginated rows, pagination metadata, totalPaid, totalThisTerm, latestPaymentDate, and daysSinceLastPayment in backend/app/Models/PaymentModel.php
- [X] T033 [US4] Refactor byStudent endpoint to support page, limit, sortBy, sortOrder, dateFrom, dateTo, method, and category query params with backend summaries in backend/app/Controllers/Api/PaymentController.php
- [X] T034 [US4] Ensure byStudent endpoint verifies tenant-owned student and returns standard 404 for cross-tenant or missing student in backend/app/Controllers/Api/PaymentController.php
- [X] T035 [US4] Update getPaymentsByStudent API client to accept query params and return StudentPaymentHistoryResponse in frontend/src/api/api.ts
- [X] T036 [US4] Refactor PaymentHistoryModal to use backend pagination metadata instead of local sorting, slicing, totalPaid, lastPayment, and daysSinceLastPayment calculations in frontend/src/components/modals/PaymentHistoryModal.tsx
- [X] T037 [US4] Remove separate modal calls for term total and balance when the backend student payment history response provides those values in frontend/src/components/modals/PaymentHistoryModal.tsx
- [X] T038 [US4] Confirm PrintReceiptModal and receipt API usage fetches only payment/receipt detail data and not full payment history in frontend/src/components/modals/PrintReceiptModal.tsx
- [X] T039 [US4] Update Payments history button flow to pass only minimal student/payment identity needed for backend paginated history loading in frontend/src/pages/Payments.tsx

**Checkpoint**: Related payment-history features no longer reconstruct payment history in the browser.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validation, cleanup, performance checks, and documentation updates across all stories.

- [X] T040 [P] Run PHP lint on backend/app/Controllers/Api/PaymentController.php and backend/app/Models/PaymentModel.php
- [X] T041 [P] Run TypeScript type-check for frontend changes using frontend TypeScript project configuration
- [ ] T042 [P] Run targeted ESLint on frontend/src/pages/Payments.tsx frontend/src/components/modals/PaymentHistoryModal.tsx frontend/src/api/api.ts frontend/src/types/dashboard.ts
- [X] T043 Run database migration if T012 created an index migration and verify it applies cleanly from backend project root
- [ ] T044 Execute quickstart curl validation for login, main payments first page, search, combined filters, invalid filters, student payment history, unauthorized access, and tenant isolation from specs/073-backend-payments-pagination/quickstart.md
- [X] T045 Capture query count or query timing evidence for main payments page and student payment history to confirm no per-row repeated student/class/balance lookups
- [X] T046 Update specs/073-backend-payments-pagination/quickstart.md with actual validation results, deviations, and any known data-volume limitations
- [X] T047 Run git diff --check and review changed files for constitution compliance

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies; can start immediately.
- **Phase 2 Foundational**: Depends on Setup completion; blocks all user stories.
- **Phase 3 US1**: Depends on Foundation; MVP scope.
- **Phase 4 US2**: Depends on Foundation and should follow US1 endpoint shape.
- **Phase 5 US3**: Depends on Foundation and US1 response shape; can proceed in parallel with US2 after shared filter helpers are stable.
- **Phase 6 US4**: Depends on Foundation; can proceed after shared query helpers exist, independent of US2/US3 except shared types.
- **Phase 7 Polish**: Depends on all desired story phases being complete.

### User Story Dependencies

- **US1 (P1)**: No dependency on other stories after Foundation; recommended MVP.
- **US2 (P1)**: Builds on US1 endpoint response and shared filter helpers.
- **US3 (P2)**: Builds on US1 endpoint response and shared summary helpers.
- **US4 (P2)**: Uses shared backend pagination/summary patterns but is independently testable through `/payments/student/{studentId}`.

### Parallel Opportunities

- T002, T003, T004, and T005 can run in parallel during setup.
- T010, T011, and T012 can run in parallel after backend helper design is clear.
- US2 frontend tasks T024-T026 can proceed after backend query contract T020-T023 is agreed.
- US3 frontend tasks T030-T031 can proceed after backend summary shape T027-T029 is agreed.
- US4 frontend tasks T035-T039 can proceed after byStudent contract T032-T034 is implemented.
- Polish validation tasks T040-T042 can run in parallel.

---

## Parallel Example: User Story 1

```text
Task: "T016 [US1] Update getPaymentsWithStudents API client parameters and response typing in frontend/src/api/api.ts"
Task: "T017 [US1] Update Payments table rendering to consume backend-prepared row display fields without full student-list lookup for table row class/name derivation in frontend/src/pages/Payments.tsx"
```

## Parallel Example: User Story 2

```text
Task: "T020 [US2] Extend payment search to include student name, admission number, receipt number, description, method, category, and supported date-related fields in backend/app/Models/PaymentModel.php"
Task: "T024 [US2] Update getPaymentsWithStudents frontend API method to send dateFrom, dateTo, paymentType, sortBy, and sortOrder query params in frontend/src/api/api.ts"
```

## Parallel Example: User Story 3

```text
Task: "T027 [US3] Implement getFilteredSummary aggregate query for totalAmount, totalCount, totalThisMonth, paymentsToday, byMethod, and byCategory in backend/app/Models/PaymentModel.php"
Task: "T030 [US3] Update Payments stats cards to consume backend summary/compatibility stats only and remove frontend payment-total calculations in frontend/src/pages/Payments.tsx"
```

## Parallel Example: User Story 4

```text
Task: "T033 [US4] Refactor byStudent endpoint to support page, limit, sortBy, sortOrder, dateFrom, dateTo, method, and category query params with backend summaries in backend/app/Controllers/Api/PaymentController.php"
Task: "T036 [US4] Refactor PaymentHistoryModal to use backend pagination metadata instead of local sorting, slicing, totalPaid, lastPayment, and daysSinceLastPayment calculations in frontend/src/components/modals/PaymentHistoryModal.tsx"
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1 Setup.
2. Complete Phase 2 Foundational backend query normalization/types.
3. Complete Phase 3 US1.
4. Validate `/api/payments/with-students?page=1&limit=20` returns only one backend-prepared page and pagination metadata.
5. Confirm Payments page renders from backend rows without local array slicing.

### Incremental Delivery

1. Deliver US1 to make main payments table backend-paginated.
2. Deliver US2 to make search/filter/sort backend-authoritative.
3. Deliver US3 to align payment metrics with backend filtered datasets.
4. Deliver US4 to remove related full-history loading from student payment history and receipt flows.
5. Complete Polish validation and quickstart evidence.

### Validation Gates

- PHP lint must pass for touched backend files.
- TypeScript type-check must pass for frontend changes.
- Targeted ESLint should pass for touched frontend files; document any pre-existing unrelated lint debt.
- Curl validation must cover happy path, invalid input, missing auth, and tenant isolation.
- Query review must confirm no N+1 regressions.

## Notes

- Existing `/api/payments/with-students` already has partial backend pagination; tasks strengthen it and remove remaining frontend-derived calculations.
- Existing `PaymentHistoryModal` currently fetches all student payments and performs local sorting, slicing, and totals; US4 targets that gap.
- Any index work must be done through new migrations only and only when inspection confirms missing support.
- T042 full targeted ESLint remains blocked by pre-existing `frontend/src/api/api.ts` `no-explicit-any` debt; targeted ESLint passed for `Payments.tsx`, `PaymentHistoryModal.tsx`, and `dashboard.ts`.
