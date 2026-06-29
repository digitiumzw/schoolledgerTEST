# Tasks: Fix Ledger Balance Filtering

**Input**: Design documents from `/specs/063-fix-ledger-balance/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ledger-balance-api.md, quickstart.md

**Tests**: Automated fail-first tests were not explicitly requested. Constitution-required endpoint validation is included in the final phase as curl-based post-implementation verification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches a different file or is read-only verification
- **[Story]**: Maps task to a user story from `spec.md`
- All implementation tasks include exact file paths

---

## Phase 1: Setup (Shared Context)

**Purpose**: Confirm existing project context and affected files before changing ledger logic.

- [x] T001 Review feature plan and authoritative scope in specs/063-fix-ledger-balance/plan.md
- [x] T002 [P] Review payment category definitions in backend/app/Config/PaymentCategories.php
- [x] T003 [P] Review existing balance routes in backend/app/Config/Routes.php

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish shared ledger eligibility definitions used by all stories.

**⚠️ CRITICAL**: No user story work should begin until this phase is complete.

- [x] T004 Add centralized eligible charge type and payment category allowlists in backend/app/Services/LedgerService.php
- [x] T005 Add reusable ledger eligibility helper methods for charge and payment filters in backend/app/Services/LedgerService.php
- [x] T006 [P] Confirm opening-balance charge representation remains eligible through `charge_type = 'fee_structure'` in backend/app/Controllers/Api/StudentController.php

**Checkpoint**: Ledger eligibility scope is centralized and ready for story implementation.

---

## Phase 3: User Story 1 - View Accurate Student Balance (Priority: P1) 🎯 MVP

**Goal**: Student balance endpoints and displayed balances use the required formula with only eligible charges, eligible payments, approved debit adjustments, approved credit adjustments, and eligible opening-balance charge rows.

**Independent Test**: Prepare one student with eligible and ineligible charges, eligible and ineligible payments, debit adjustments, credit adjustments, and opening balance; verify balance equals `(eligible charges + approved debits) - (eligible payments + approved credits)`.

### Implementation for User Story 1

- [x] T007 [US1] Update `getStudentBalance()` to use eligible charge types and eligible payment categories in backend/app/Services/LedgerService.php
- [x] T008 [US1] Update `getAllBalances()` bulk SQL to use eligible charge types and eligible payment categories in backend/app/Services/LedgerService.php
- [x] T009 [US1] Align `getFilteredStudents()` balance SQL with eligible charge/payment filters in backend/app/Models/StudentModel.php
- [x] T010 [US1] Align `getFilteredStudentsCount()` balance-only SQL with eligible charge/payment filters in backend/app/Models/StudentModel.php
- [x] T011 [US1] Align `getGlobalStats()` balance aggregation SQL with eligible charge/payment filters in backend/app/Models/StudentModel.php
- [x] T012 [US1] Align `getLedgerBalance()` and `preloadLedgerBalances()` payment aggregation with eligible categories in backend/app/Models/StudentModel.php
- [x] T013 [US1] Verify `LedgerController`, `StudentController`, and `ReconciliationController` continue delegating balance calculations without duplicated formula changes in backend/app/Controllers/Api/LedgerController.php, backend/app/Controllers/Api/StudentController.php, and backend/app/Controllers/Api/ReconciliationController.php

**Checkpoint**: User Story 1 is functional when single-student and bulk balance responses match the required formula for one test student.

---

## Phase 4: User Story 2 - Exclude Non-Ledger Financial Activity (Priority: P2)

**Goal**: Ineligible charge types and payment categories do not affect balance or charge allocation.

**Independent Test**: Add non-eligible charge types and non-eligible payment categories for a student; verify the student's balance does not change.

### Implementation for User Story 2

- [x] T014 [US2] Update payment eligibility in `allocatePaymentToCharges()` so only approved payment categories affect allocation in backend/app/Services/LedgerService.php
- [x] T015 [US2] Preserve existing campaign and general-payment exclusions while applying category allowlists in backend/app/Services/LedgerService.php
- [x] T016 [US2] Ensure student-list balance queries exclude non-eligible payment categories in all remaining balance aggregation paths in backend/app/Models/StudentModel.php

**Checkpoint**: User Story 2 is functional when unrelated charges/payments are present but do not change balance or allocation status.

---

## Phase 5: User Story 3 - Maintain Student-Specific Balance Isolation (Priority: P3)

**Goal**: Each student's balance uses only that student's eligible financial records within the current tenant.

**Independent Test**: Create eligible records for two students and verify each student's balance includes only their own records.

### Implementation for User Story 3

- [x] T017 [US3] Audit and enforce `tenant_id` and `student_id` filters in single-student ledger queries in backend/app/Services/LedgerService.php
- [x] T018 [US3] Audit and enforce `tenant_id` and grouped `student_id` isolation in bulk student balance queries in backend/app/Models/StudentModel.php
- [x] T019 [US3] Verify cross-tenant access remains denied for student balance endpoints in backend/app/Controllers/Api/StudentController.php

**Checkpoint**: User Story 3 is functional when cross-student and cross-tenant records cannot influence a selected student's balance.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate implementation quality, endpoint behavior, and documentation consistency.

- [x] T020 Run PHP lint for ledger service and affected controllers documented in specs/063-fix-ledger-balance/quickstart.md
- [x] T021 Run PHP lint for student model documented in specs/063-fix-ledger-balance/quickstart.md
- [x] T022 Execute single-student, ledger, bulk, reconciliation, and recalculate curl validation scenarios documented in specs/063-fix-ledger-balance/quickstart.md
- [x] T023 Execute unauthorized and multi-tenant curl validation scenarios documented in specs/063-fix-ledger-balance/quickstart.md
- [x] T024 Review API response compatibility against specs/063-fix-ledger-balance/contracts/ledger-balance-api.md
- [x] T025 Review final implementation against constitution checks in specs/063-fix-ledger-balance/plan.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; can start immediately.
- **Foundational (Phase 2)**: Depends on Setup; blocks all user story work.
- **User Story 1 (Phase 3)**: Depends on Foundational; MVP scope.
- **User Story 2 (Phase 4)**: Depends on Foundational; can be implemented after or alongside US1 if same-file conflicts are coordinated.
- **User Story 3 (Phase 5)**: Depends on Foundational; can be implemented after or alongside US1/US2 if same-file conflicts are coordinated.
- **Polish (Phase 6)**: Depends on all selected user stories being complete.

### User Story Dependencies

- **US1 (P1)**: No dependency on other stories after Foundational.
- **US2 (P2)**: No business dependency on US1, but touches the same ledger files and should be sequenced carefully.
- **US3 (P3)**: No business dependency on US1/US2, but audits the same query paths after filters are applied.

### Within Each User Story

- Centralized helpers before query updates.
- Single-student balance before bulk/list balance alignment.
- Ledger service updates before controller verification.
- Implementation before curl validation.

---

## Parallel Opportunities

- T002 and T003 can run in parallel during setup.
- T006 can run in parallel with T004/T005 because it is verification in a different file.
- After T004 and T005, model-focused tasks in `StudentModel.php` and controller verification can be split from `LedgerService.php` work if file conflicts are coordinated.
- Curl validation tasks T022 and T023 can be executed independently after implementation and a running API server are available.

## Parallel Example: Setup

```bash
Task: "Review payment category definitions in backend/app/Config/PaymentCategories.php"
Task: "Review existing balance routes in backend/app/Config/Routes.php"
```

## Parallel Example: Post-Implementation Validation

```bash
Task: "Execute single-student, ledger, bulk, reconciliation, and recalculate curl validation scenarios documented in specs/063-fix-ledger-balance/quickstart.md"
Task: "Execute unauthorized and multi-tenant curl validation scenarios documented in specs/063-fix-ledger-balance/quickstart.md"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational eligibility helpers.
3. Complete Phase 3: User Story 1 accurate balance formula.
4. Stop and validate single-student and bulk balances against the manual formula.

### Incremental Delivery

1. Add US1 to correct official balance totals.
2. Add US2 to ensure unrelated financial activity stays excluded.
3. Add US3 to confirm strict student and tenant isolation.
4. Run Phase 6 validation before marking the feature complete.

### Notes

- No migration tasks are included because the plan determined existing data fields can express the required filters.
- No frontend implementation tasks are included because the feature changes backend calculation semantics while preserving response shapes.
- Constitution-required endpoint validation must be run after implementation using curl URL requests.
