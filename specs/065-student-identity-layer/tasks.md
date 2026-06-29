# Tasks: Student Identity Layer

**Input**: Design documents from `/specs/065-student-identity-layer/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/student-identity-api.md, quickstart.md

**Tests**: No pre-implementation TDD test files are generated. Constitution-required endpoint validation is captured as post-implementation curl validation tasks in the final phase.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and has no dependency on incomplete tasks.
- **[Story]**: User-story label for implementation phases only.
- Every task includes an exact file path or validation target.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the additive files and type locations required by the feature.

- [x] T001 Create migration file for student profile history in `backend/app/Database/Migrations/2026-05-06-120000_CreateStudentProfileHistory.php`
- [x] T002 [P] Create model file skeleton for profile history in `backend/app/Models/StudentProfileHistoryModel.php`
- [x] T003 [P] Add placeholder student identity response types in `frontend/src/types/dashboard.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core schema, service, routing, and validation foundations that MUST be complete before user-story implementation.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 Implement `student_profile_history` columns, indexes, tenant/student keys, and reversible down migration in `backend/app/Database/Migrations/2026-05-06-120000_CreateStudentProfileHistory.php`
- [x] T005 Implement allowed fields, approved mutable field list, validation helpers, and `formatForApi()` in `backend/app/Models/StudentProfileHistoryModel.php`
- [x] T006 Create `StudentIdentityService` constructor, tenant-scoped student lookup helper, date filter helper, and event formatter helpers in `backend/app/Services/StudentIdentityService.php`
- [x] T007 Wire `StudentIdentityService` dependency into `StudentController::__construct()` in `backend/app/Controllers/Api/StudentController.php`
- [x] T008 Add identity, timeline, and profile-history student sub-resource routes before `students/(:segment)` wildcard routes in `backend/app/Config/Routes.php`
- [x] T009 Expand shared TypeScript identity/timeline/profile-history interfaces in `frontend/src/types/dashboard.ts`

**Checkpoint**: Schema, model, route placeholders, and shared types are ready for user-story implementation.

---

## Phase 3: User Story 1 - Maintain a Stable Student Identity (Priority: P1) 🎯 MVP

**Goal**: Users can view one stable student identity record with linked academic, transport, and financial summary data without duplicating or rewriting identity information.

**Independent Test**: Create or select a student with enrollment, transport, charge, and payment records; call `/api/students/{studentId}/identity`; confirm the same student ID anchors all linked summaries and the UI distinguishes core identity from related activity.

### Implementation for User Story 1

- [x] T010 [US1] Implement `getIdentity()` summary assembly for student, current enrollment, active transport, charges, payments, and profile-history counts in `backend/app/Services/StudentIdentityService.php`
- [x] T011 [US1] Add `identity($id = null)` controller action with tenant validation and standard response envelopes in `backend/app/Controllers/Api/StudentController.php`
- [x] T012 [US1] Ensure student creation keeps enrollment as academic source of truth and only syncs snapshot fields after enrollment creation in `backend/app/Controllers/Api/StudentController.php`
- [x] T013 [US1] Ensure enrollment snapshot synchronization remains derived from active enrollment records in `backend/app/Services/StudentSnapshotService.php`
- [x] T014 [P] [US1] Add `getStudentIdentity(studentId)` API client method in `frontend/src/api/api.ts`
- [x] T015 [P] [US1] Add identity summary and linked-record count types in `frontend/src/types/dashboard.ts`
- [x] T016 [US1] Load identity data on the student profile page and preserve existing profile/fee-statement fetch behavior in `frontend/src/pages/StudentProfile.tsx`
- [x] T017 [US1] Update the student profile overview to visually separate stable identity fields from current academic, transport, and financial snapshots in `frontend/src/pages/StudentProfile.tsx`

**Checkpoint**: User Story 1 is independently functional as the MVP.

---

## Phase 4: User Story 2 - Record Academic and Administrative Changes as History (Priority: P2)

**Goal**: Changes such as address/contact updates, promotions, class transfers, transport changes, and status changes are preserved as dated history instead of silently overwriting prior facts.

**Independent Test**: Make multiple student changes across effective dates; confirm profile history, enrollment history, status history, and transport history preserve prior records while the current student view shows the latest applicable values.

### Implementation for User Story 2

- [x] T018 [US2] Implement `createHistoryRecord()`, `getByStudent()`, and field-filter query methods in `backend/app/Models/StudentProfileHistoryModel.php`
- [x] T019 [US2] Implement `recordProfileChange()` transaction flow that writes history before updating current student fields in `backend/app/Services/StudentIdentityService.php`
- [x] T020 [US2] Implement `getProfileHistory()` with field/date filters and tenant-scoped student validation in `backend/app/Services/StudentIdentityService.php`
- [x] T021 [US2] Add `getProfileHistory($id = null)` and `recordProfileHistory($id = null)` controller actions in `backend/app/Controllers/Api/StudentController.php`
- [x] T022 [US2] Update `update($id = null)` to reject direct academic `classId`/`class_id` source-of-truth overwrites and route mutable contact/profile changes through history logic in `backend/app/Controllers/Api/StudentController.php`
- [x] T023 [US2] Confirm promotion, repeat, and status-change actions continue writing enrollment/status history rather than only current snapshots in `backend/app/Controllers/Api/StudentController.php`
- [x] T024 [P] [US2] Add `getStudentProfileHistory()` and `recordStudentProfileHistory()` API client methods in `frontend/src/api/api.ts`
- [x] T025 [P] [US2] Add profile-history input/output and change-type TypeScript interfaces in `frontend/src/types/dashboard.ts`
- [x] T026 [US2] Create profile/contact history change dialog with field, value, change type, effective date, and reason inputs in `frontend/src/components/students/ProfileHistoryChangeDialog.tsx`
- [x] T027 [US2] Integrate profile-history list, change dialog, and success refresh behavior into `frontend/src/pages/StudentProfile.tsx`

**Checkpoint**: User Stories 1 and 2 work independently and preserve historical student changes.

---

## Phase 5: User Story 3 - Reconstruct a Student Journey for Reporting (Priority: P3)

**Goal**: Users can reconstruct a student's academic and administrative journey over a selected period using a consolidated timeline across enrollments, profile changes, status changes, transport, charges, and payments.

**Independent Test**: Generate or view a student timeline for a selected date range or academic year; verify the returned events match source enrollment, transport, charge, payment, status, and profile-history records for that period.

### Implementation for User Story 3

- [x] T028 [US3] Implement enrollment, status, profile-history, transport, charge, payment, and ledger-adjustment timeline source queries in `backend/app/Services/StudentIdentityService.php`
- [x] T029 [US3] Implement timeline filter validation for `from`, `to`, `academicYear`, `types`, `limit`, and `page` in `backend/app/Services/StudentIdentityService.php`
- [x] T030 [US3] Add `timeline($id = null)` controller action with standard 400/403/404 error handling in `backend/app/Controllers/Api/StudentController.php`
- [x] T031 [P] [US3] Add `getStudentTimeline(studentId, filters)` API client method in `frontend/src/api/api.ts`
- [x] T032 [P] [US3] Add timeline filter, event, metadata, and pagination TypeScript interfaces in `frontend/src/types/dashboard.ts`
- [x] T033 [US3] Create timeline presentation component with event-type badges and chronological grouping in `frontend/src/components/students/StudentTimeline.tsx`
- [x] T034 [US3] Integrate timeline tab and period/type filters into the student profile page in `frontend/src/pages/StudentProfile.tsx`
- [x] T035 [US3] Ensure existing fee statement and balance views remain sourced from ledger endpoints and are not replaced by timeline summaries in `frontend/src/pages/StudentProfile.tsx`

**Checkpoint**: All user stories are independently functional and the student journey can be reconstructed for reporting.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validation, security, performance, and documentation cleanup across all user stories.

- [x] T036 Run backend migration and PHP lint validation for `backend/app/Database/Migrations/2026-05-06-120000_CreateStudentProfileHistory.php`, `backend/app/Models/StudentProfileHistoryModel.php`, `backend/app/Services/StudentIdentityService.php`, and `backend/app/Controllers/Api/StudentController.php`
- [ ] T037 Run frontend type-check and targeted ESLint validation for `frontend/src/api/api.ts`, `frontend/src/types/dashboard.ts`, `frontend/src/components/students/ProfileHistoryChangeDialog.tsx`, `frontend/src/components/students/StudentTimeline.tsx`, and `frontend/src/pages/StudentProfile.tsx`
- [x] T038 Execute happy-path curl validation for identity, profile-history create/read, and timeline retrieval using `specs/065-student-identity-layer/quickstart.md`
- [x] T039 Execute error-path curl validation for invalid profile field, invalid timeline date, missing student, unauthorized role, and tenant isolation using `specs/065-student-identity-layer/quickstart.md`
- [x] T040 Verify ledger balance and fee-statement behavior still matches existing source-of-truth expectations for `/api/students/{studentId}/balance` and `/api/students/{studentId}/fee-statement` using `specs/065-student-identity-layer/quickstart.md`
- [x] T041 Update implementation notes and actual validation results in `specs/065-student-identity-layer/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion; blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational; MVP scope.
- **User Story 2 (Phase 4)**: Depends on Foundational and integrates best after US1 identity endpoint exists.
- **User Story 3 (Phase 5)**: Depends on Foundational; can start after service foundations, but is most useful after US1 and US2 source events exist.
- **Polish (Phase 6)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 - Maintain a Stable Student Identity**: Required MVP; no dependency on US2 or US3.
- **US2 - Record Changes as History**: Depends on foundational profile-history schema; benefits from US1 UI separation but remains independently testable through profile-history endpoints.
- **US3 - Reconstruct Student Journey**: Depends on source records from existing modules and the foundational service; integrates US1/US2 data when available.

### Within Each User Story

- Backend models/migrations before services.
- Services before controller actions.
- Routes before frontend API consumption.
- API types before UI integration.
- Story-specific UI after backend contract is implemented.
- Curl validation only after implementation is complete.

### Parallel Opportunities

- T002 and T003 can run in parallel after T001 is identified.
- T014 and T015 can run in parallel in US1.
- T024 and T025 can run in parallel in US2.
- T031 and T032 can run in parallel in US3.
- After Phase 2, US1 backend work and US2 model/service work can be split between developers if merge conflicts in `StudentController.php` are coordinated.
- T036 and T037 can run in parallel once implementation is complete.

---

## Parallel Example: User Story 1

```bash
Task: "Add getStudentIdentity(studentId) API client method in frontend/src/api/api.ts"
Task: "Add identity summary and linked-record count types in frontend/src/types/dashboard.ts"
```

## Parallel Example: User Story 2

```bash
Task: "Add getStudentProfileHistory() and recordStudentProfileHistory() API client methods in frontend/src/api/api.ts"
Task: "Add profile-history input/output and change-type TypeScript interfaces in frontend/src/types/dashboard.ts"
```

## Parallel Example: User Story 3

```bash
Task: "Add getStudentTimeline(studentId, filters) API client method in frontend/src/api/api.ts"
Task: "Add timeline filter, event, metadata, and pagination TypeScript interfaces in frontend/src/types/dashboard.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 setup.
2. Complete Phase 2 foundational schema/service/route/type work.
3. Complete Phase 3 User Story 1.
4. Stop and validate `/api/students/{studentId}/identity` and the student profile identity display.
5. Demo the stable identity layer before adding profile-history mutation and timeline reconstruction.

### Incremental Delivery

1. **Foundation**: Add additive profile-history schema, shared service, routes, and shared types.
2. **US1 MVP**: Stable student identity endpoint and UI separation.
3. **US2**: Profile/contact history mutation plus safeguards against overwriting academic/administrative history.
4. **US3**: Consolidated timeline for reporting and historical reconstruction.
5. **Polish**: Lint/type-check, migration verification, and curl validation.

### Parallel Team Strategy

1. One developer completes migration/model/service foundation.
2. One developer prepares frontend types/API methods once contracts are stable.
3. After Phase 2, backend story work can be split by endpoint while frontend story work is split by component.
4. Coordinate changes to `backend/app/Controllers/Api/StudentController.php`, `frontend/src/api/api.ts`, `frontend/src/types/dashboard.ts`, and `frontend/src/pages/StudentProfile.tsx` because these files are touched by multiple stories.

---

## Notes

- [P] tasks touch separate files or can be completed without depending on another incomplete task in the same phase.
- Story labels map to spec user stories: [US1] stable identity, [US2] history-preserving changes, [US3] student journey reconstruction.
- Endpoint validation is intentionally post-implementation curl validation per the project constitution.
- Do not introduce mutable stored balance fields; financial timeline events must read existing source records.
- Do not accept `tenant_id` from request bodies or query strings; derive tenant scope from the JWT context.
