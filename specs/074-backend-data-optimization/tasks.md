# Tasks: Backend Data Optimization

**Input**: Design documents from `/specs/074-backend-data-optimization/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/backend-data-api.md, quickstart.md

**Tests**: Per constitution, endpoint-level validation is performed after implementation via curl. No pre-implementation TDD tests are generated.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish shared API contracts, types, and performance-validation scaffolding used by all stories.

- [ ] T001 Review existing in-scope frontend data derivations and document findings in specs/074-backend-data-optimization/quickstart.md
- [X] T002 [P] Add shared backend pagination/filter/sort validation helpers or constants in backend/app/Controllers/Api/BaseApiController.php
- [X] T003 [P] Add shared frontend response types for backend-prepared list responses in frontend/src/api/api.ts
- [X] T004 [P] Add shared dashboard type aliases for backend pagination, filter, sort, and summary metadata in frontend/src/types/dashboard.ts
- [ ] T005 Evaluate existing query plans for in-scope endpoints and record baseline timings in specs/074-backend-data-optimization/quickstart.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core backend/frontend conventions that MUST be complete before story-specific work.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T006 Implement allowlisted sort/page/limit/date validation behavior for backend list endpoints in backend/app/Controllers/Api/BaseApiController.php
- [X] T007 [P] Add or update frontend API request parameter interfaces for backend-prepared views in frontend/src/api/api.ts
- [X] T008 [P] Add reusable pagination metadata and summary rendering type guards in frontend/src/types/dashboard.ts
- [X] T009 Audit route ordering for in-scope endpoints and update backend/app/Config/Routes.php to prevent wildcard route shadowing
- [ ] T010 Document allowed maximum page sizes and invalid-input behavior in specs/074-backend-data-optimization/contracts/backend-data-api.md
- [ ] T011 Decide whether measured query baselines require a new performance index migration and document the decision in specs/074-backend-data-optimization/quickstart.md

**Checkpoint**: Foundation ready - user story implementation can now begin in priority order or in parallel.

---

## Phase 3: User Story 1 - View backend-prepared student records (Priority: P1) 🎯 MVP

**Goal**: Student page loads, searches, filters, sorts, paginates, and displays summaries from backend-prepared data only.

**Independent Test**: Open Student page or call `/api/students-optimized` with search/filter/sort/page parameters and confirm rows, pagination, and stats match the backend response.

### Implementation for User Story 1

- [X] T012 [P] [US1] Harden student list query validation and normalized response metadata in backend/app/Controllers/Api/StudentsOptimizedController.php
- [X] T013 [P] [US1] Harden main student list query validation and normalized response metadata in backend/app/Controllers/Api/StudentController.php
- [ ] T014 [US1] Ensure student directory rows and counts use tenant-scoped batched balance/enrollment lookups in backend/app/Models/StudentModel.php
- [ ] T015 [US1] Ensure student directory financial summaries preserve LedgerService eligible charge/payment rules in backend/app/Models/StudentModel.php
- [X] T016 [US1] Add `filters` and `sort` metadata to `/api/students-optimized` responses in backend/app/Controllers/Api/StudentsOptimizedController.php
- [X] T017 [US1] Update `getStudentsOptimized` request/response typing to include normalized filters, sort, stats, classes, and pagination in frontend/src/api/api.ts
- [ ] T018 [US1] Remove any remaining student-row filtering, sorting, slicing, or summary calculation from frontend/src/pages/Students.tsx
- [ ] T019 [US1] Update Students page rendering to consume backend stats, filters, sort, and pagination metadata directly in frontend/src/pages/Students.tsx
- [ ] T020 [US1] Validate Student page API behavior with quickstart curl scenario and record results in specs/074-backend-data-optimization/quickstart.md

**Checkpoint**: User Story 1 is independently functional and testable as the MVP.

---

## Phase 4: User Story 2 - Review backend-prepared staff attendance reports (Priority: P1)

**Goal**: Staff Attendance records and reports use backend-prepared rows, summaries, pagination, filters, sorting, attendance-rate calculations, leave handling, and overtime totals.

**Independent Test**: Call staff attendance record/report endpoints with filters and verify frontend renders backend-provided rows, summaries, and pagination exactly.

### Implementation for User Story 2

- [X] T021 [P] [US2] Extend staff attendance records query parameters and validation in backend/app/Controllers/Api/AttendanceController.php
- [X] T022 [US2] Add backend summary aggregation for filtered staff attendance records in backend/app/Models/AttendanceModel.php
- [X] T023 [US2] Add `summary`, `filters`, and `sort` metadata to staff attendance records response in backend/app/Controllers/Api/AttendanceController.php
- [X] T024 [P] [US2] Extend staff period report pagination, search, sort, and summary metadata in backend/app/Models/AttendanceModel.php
- [X] T025 [US2] Update staff period report controller response contract in backend/app/Controllers/Api/AttendanceController.php
- [X] T026 [US2] Update staff attendance API types and methods for records/report metadata in frontend/src/api/api.ts
- [X] T027 [US2] Update staff attendance hooks to consume backend summaries and pagination without cached full-history loading in frontend/src/hooks/useStaffAttendanceData.ts
- [X] T028 [US2] Remove frontend attendance summary calculations from records UI in frontend/src/components/staff-attendance/AttendanceRecordsTab.tsx
- [X] T029 [US2] Update period report UI to render backend-provided summaries, pagination, and sort state in frontend/src/components/staff-attendance/AttendancePeriodReport.tsx
- [ ] T030 [US2] Validate Staff Attendance record and report curl scenarios and record results in specs/074-backend-data-optimization/quickstart.md

**Checkpoint**: User Story 2 is independently functional and testable.

---

## Phase 5: User Story 3 - Manage classes and class attendance through backend views (Priority: P1)

**Goal**: Classes page, class rosters, and Class Attendance registers/summaries use backend-prepared list and summary responses only.

**Independent Test**: Load Classes page, class roster, and Class Attendance register with filters and verify only backend-provided rows, summaries, pagination, and rates are rendered.

### Implementation for User Story 3

- [ ] T031 [P] [US3] Implement backend-prepared class directory query with archive/search/sort/page support in backend/app/Models/ClassModel.php
- [ ] T032 [US3] Add class directory summary aggregation for active/archive counts, capacity, fill rate, and final-class count in backend/app/Models/ClassModel.php
- [X] T033 [US3] Update class directory endpoint response with classes, teachers, summary, pagination, filters, and sort in backend/app/Controllers/Api/ClassController.php
- [X] T034 [P] [US3] Implement backend-prepared class roster query with search/status/sort/page support in backend/app/Controllers/Api/ClassController.php
- [X] T035 [US3] Ensure class roster query uses tenant-scoped enrollment/student joins without per-row lookups in backend/app/Models/ClassModel.php
- [X] T036 [P] [US3] Extend class attendance effective register query with search/status/sort/page parameters in backend/app/Services/StudentClassAttendanceService.php
- [X] T037 [US3] Add class attendance register pagination and summary metadata in backend/app/Controllers/Api/StudentClassAttendanceController.php
- [X] T038 [US3] Update classes, roster, and class-attendance API response types/methods in frontend/src/api/api.ts
- [X] T039 [US3] Remove client-side class active/archive filtering, search filtering, and stats calculations from frontend/src/pages/Classes.tsx
- [X] T040 [US3] Update Classes page to render backend-provided classes, teachers, summary, filters, sort, and pagination in frontend/src/pages/Classes.tsx
- [X] T041 [US3] Update class attendance hooks to pass backend filters and consume register summary/pagination in frontend/src/hooks/useClassAttendance.ts
- [X] T042 [US3] Update Class Attendance tab/table components to render backend-provided summaries and paginated rows in frontend/src/components/attendance/ClassAttendanceTab.tsx
- [ ] T043 [US3] Validate Classes, class roster, and Class Attendance curl scenarios and record results in specs/074-backend-data-optimization/quickstart.md

**Checkpoint**: User Story 3 is independently functional and testable.

---

## Phase 6: User Story 4 - Keep related payment history fast and scalable (Priority: P2)

**Goal**: Related payment-history workflows use backend-prepared paginated payment rows, filters, sorting, and summaries without full-history frontend processing.

**Independent Test**: Open student payment history or call `/api/payments/student/{studentId}` and verify rows are bounded and summaries are backend-derived.

### Implementation for User Story 4

- [X] T044 [P] [US4] Harden student payment history parameter validation and normalized response metadata in backend/app/Controllers/Api/PaymentController.php
- [X] T045 [US4] Ensure student payment history rows and summaries use bounded tenant-scoped queries in backend/app/Models/PaymentModel.php
- [X] T046 [US4] Ensure student payment history current balance uses LedgerService source-derived rules in backend/app/Controllers/Api/PaymentController.php
- [X] T047 [US4] Extend student payment history API types for filters, sort, and summary metadata in frontend/src/api/api.ts
- [X] T048 [US4] Remove any remaining payment-history client-side filtering, sorting, pagination, or calculations from frontend/src/components/modals/PaymentHistoryModal.tsx
- [X] T049 [US4] Update receipt-opening flow to use explicit backend-provided payment rows without refetching full history in frontend/src/components/modals/PaymentHistoryModal.tsx
- [ ] T050 [US4] Validate Student Payment History curl scenario and record results in specs/074-backend-data-optimization/quickstart.md

**Checkpoint**: User Story 4 is independently functional and testable.

---

## Phase 7: User Story 5 - Validate backend efficiency and consistency (Priority: P2)

**Goal**: Provide evidence that converted pages remain fast, bounded, tenant-safe, and free of repeated per-row query patterns.

**Independent Test**: Run large-dataset and query-efficiency checks from quickstart and confirm each primary endpoint meets response-size and performance expectations.

### Implementation for User Story 5

- [ ] T051 [P] [US5] Add new performance index migration only if baseline evidence requires it in backend/app/Database/Migrations/2026-05-14-000001_AddBackendDataOptimizationIndexes.php
- [ ] T052 [US5] Apply and verify any new performance migration with `php spark migrate` and document result in specs/074-backend-data-optimization/quickstart.md
- [ ] T053 [US5] Capture response time and row-count evidence for student, classes, staff attendance, class attendance, and payment history endpoints in specs/074-backend-data-optimization/quickstart.md
- [ ] T054 [US5] Capture query-efficiency evidence showing no repeated per-row lookup patterns in specs/074-backend-data-optimization/quickstart.md
- [ ] T055 [US5] Validate invalid input, unauthorized access, and tenant isolation curl scenarios and record results in specs/074-backend-data-optimization/quickstart.md

**Checkpoint**: User Story 5 is independently functional and testable.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup across all converted workflows.

- [X] T056 [P] Run PHP lint for touched backend controllers, models, services, and migrations listed in specs/074-backend-data-optimization/quickstart.md
- [X] T057 [P] Run TypeScript validation for frontend with `./node_modules/.bin/tsc --noEmit --pretty false` from frontend
- [X] T058 [P] Run targeted ESLint for touched frontend files listed in specs/074-backend-data-optimization/quickstart.md
- [X] T059 Run `git diff --check` from repository root and fix whitespace issues in touched files
- [ ] T060 Update specs/074-backend-data-optimization/quickstart.md with final validation results, deviations, and any pre-existing lint debt
- [ ] T061 Review frontend files to confirm no in-scope client-side filtering, searching, sorting, pagination, or authoritative calculations remain in frontend/src/pages/Students.tsx, frontend/src/pages/Classes.tsx, frontend/src/components/staff-attendance/AttendanceRecordsTab.tsx, frontend/src/components/staff-attendance/AttendancePeriodReport.tsx, frontend/src/components/attendance/ClassAttendanceTab.tsx, and frontend/src/components/modals/PaymentHistoryModal.tsx

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
- **Polish (Phase 8)**: Depends on desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - no dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational - no dependencies on other stories
- **User Story 3 (P1)**: Can start after Foundational - no dependencies on other stories
- **User Story 4 (P2)**: Can start after Foundational; may reuse validation patterns from US1 but remains independently testable
- **User Story 5 (P2)**: Best after US1-US4 to validate final performance and query behavior

### Within Each User Story

- Backend query/model/service work before controller response contract updates
- Controller response contracts before frontend API typing updates
- Frontend API typing before UI/hook refactors
- Curl validation after implementation is complete for that story

---

## Parallel Opportunities

- T002, T003, T004 can run in parallel after T001 starts
- T007, T008, T010 can run in parallel after T006 direction is known
- US1 backend controller hardening T012 and T013 can run in parallel
- US2 staff record work T021-T023 and report work T024-T025 can proceed in parallel before frontend integration
- US3 class directory T031-T033, roster T034-T035, and class attendance T036-T037 can proceed in parallel before frontend integration
- US4 backend hardening T044-T046 can proceed before frontend modal work T047-T049
- T056, T057, T058 can run in parallel during final validation

---

## Parallel Example: User Story 3

```bash
Task: "Implement backend-prepared class directory query with archive/search/sort/page support in backend/app/Models/ClassModel.php"
Task: "Implement backend-prepared class roster query with search/status/sort/page support in backend/app/Controllers/Api/ClassController.php"
Task: "Extend class attendance effective register query with search/status/sort/page parameters in backend/app/Services/StudentClassAttendanceService.php"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Stop and validate Student page independently with quickstart curl and UI checks

### P1 Delivery

1. Complete US1 Student page backend-prepared records
2. Complete US2 Staff Attendance backend-prepared records/reports
3. Complete US3 Classes and Class Attendance backend-prepared views
4. Validate all P1 stories independently before P2 work

### P2 Delivery

1. Complete US4 related payment history scalability
2. Complete US5 performance/query-efficiency evidence
3. Complete final polish validation tasks

---

## Notes

- [P] tasks use different files or independent sections and can be parallelized.
- Story tasks include [US1] through [US5] labels for traceability.
- Curl validation tasks are placed after implementation in each story, per the constitution.
- Optional index migration T051 should be skipped or left documented as not needed if measurement does not justify new indexes.
