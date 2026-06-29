# Tasks: Roll Back or Void Generated Charges

**Input**: Design documents from `/specs/064-rollback-void-charges/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/charge-batch-rollback-api.md, quickstart.md

**Tests**: No pre-implementation automated test tasks are generated because TDD was not requested. Post-implementation endpoint validation is required via curl and is included in the Polish phase per the project constitution.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and does not depend on incomplete tasks.
- **[Story]**: Maps task to a specific user story from `spec.md`.
- All tasks include exact file paths.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm existing charge generation, billing run, and UI touchpoints before foundational changes.

- [x] T001 Verify existing `charges`, `billing_runs`, `voided_at`, and `voided_by` assumptions against backend/app/Models/ChargeModel.php and backend/app/Database/Migrations/2026-01-25-190000_Add_billing_runs_table.php
- [x] T002 [P] Review fee rule generation entry points in backend/app/Services/FeeRuleBillingService.php and backend/app/Controllers/Api/FeeRuleController.php
- [x] T003 [P] Review transport generation entry points in backend/app/Controllers/Api/TransportController.php and frontend/src/pages/Transport.tsx

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core batch, voiding, and API primitives required before any user story can be implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 Create migration for missing batch rollback fields in backend/app/Database/Migrations/2026-05-06-000001_AddChargeBatchRollbackFields.php
- [x] T005 Update charge and billing run allowed fields/formatting support in backend/app/Models/ChargeModel.php
- [x] T006 Implement shared latest-batch lookup and summary methods in backend/app/Services/ChargeBatchRollbackService.php
- [x] T007 Implement shared transaction-safe void latest batch method in backend/app/Services/ChargeBatchRollbackService.php
- [x] T008 Add period label and charge description formatting helpers in backend/app/Services/ChargeBatchRollbackService.php
- [x] T009 Add shared API response DTO/type definitions for latest batches and void results in frontend/src/api/api.ts
- [x] T010 [P] Add frontend rollback hook skeleton for latest batch fetch/void mutations in frontend/src/hooks/useChargeBatchRollback.ts
- [x] T011 Verify tenant filtering and role requirements are documented in backend/app/Services/ChargeBatchRollbackService.php and backend/app/Config/Routes.php

**Checkpoint**: Foundation ready - user story implementation can now begin in priority order or in parallel where file ownership allows.

---

## Phase 3: User Story 1 - Reverse Latest Fee Rule Charge Generation (Priority: P1) 🎯 MVP

**Goal**: Administrators can identify and void the latest fee rule charge batch without changing transport charge batches.

**Independent Test**: Generate fee rule charges, fetch the latest fee rule batch, void it, confirm the same batch cannot be voided again, and confirm transport charges remain active.

### Implementation for User Story 1

- [x] T012 [US1] Update fee rule charge generation to create/update a fee-structure billing batch in backend/app/Services/FeeRuleBillingService.php
- [x] T013 [US1] Update fee rule charge inserts to set `billing_run_id` and preserve `charge_type = fee_structure` in backend/app/Services/FeeRuleBillingService.php
- [x] T014 [US1] Add latest fee rule batch summary endpoint method in backend/app/Controllers/Api/FeeRuleController.php
- [x] T015 [US1] Add latest fee rule batch void endpoint method in backend/app/Controllers/Api/FeeRuleController.php
- [x] T016 [US1] Register fee rule latest-batch and void routes in backend/app/Config/Routes.php
- [x] T017 [US1] Add fee rule latest-batch and void API client methods in frontend/src/api/api.ts
- [x] T018 [US1] Add fee rule rollback state/actions to frontend/src/hooks/useFeeRules.ts
- [x] T019 [US1] Add fee rule latest-batch rollback UI action in frontend/src/components/settings/FeeRuleGenerationPanel.tsx

**Checkpoint**: User Story 1 should be fully functional and testable independently as the MVP.

---

## Phase 4: User Story 2 - Reverse Latest Transport Charge Generation (Priority: P1)

**Goal**: Administrators can identify and void the latest transport charge batch without changing fee rule charge batches.

**Independent Test**: Generate transport charges, fetch the latest transport batch, void it, confirm the same batch cannot be voided again, and confirm fee rule charges remain active.

### Implementation for User Story 2

- [x] T020 [US2] Update transport charge generation to create/update a transport billing batch in backend/app/Controllers/Api/TransportController.php
- [x] T021 [US2] Update transport charge inserts to set `billing_run_id`, `charge_type = transport`, and period metadata in backend/app/Controllers/Api/TransportController.php
- [x] T022 [US2] Add latest transport batch summary endpoint method in backend/app/Controllers/Api/TransportController.php
- [x] T023 [US2] Add latest transport batch void endpoint method in backend/app/Controllers/Api/TransportController.php
- [x] T024 [US2] Register transport latest-batch and void routes in backend/app/Config/Routes.php
- [x] T025 [US2] Add transport latest-batch and void API client methods in frontend/src/api/api.ts
- [x] T026 [US2] Add transport latest-batch rollback UI action in frontend/src/pages/Transport.tsx

**Checkpoint**: User Story 2 should be fully functional and testable independently from fee rule rollback.

---

## Phase 5: User Story 3 - Confirm and Audit Charge Voids (Priority: P2)

**Goal**: Administrators see a clear confirmation summary before voiding, and each completed reversal is auditable.

**Independent Test**: Open rollback confirmation for each charge type, verify charge type/label/count/amount/affected students, complete or cancel the action, and confirm only confirmed actions create audit data.

### Implementation for User Story 3

- [x] T027 [US3] Extend latest-batch summaries with blocked/paid-charge impact details in backend/app/Services/ChargeBatchRollbackService.php
- [x] T028 [US3] Persist reversal audit metadata when a batch is voided in backend/app/Services/ChargeBatchRollbackService.php
- [x] T029 [US3] Ensure void failure paths return explicit 404, 409, and 422 errors in backend/app/Services/ChargeBatchRollbackService.php
- [x] T030 [US3] Surface rollback summary fields and blocked reasons in frontend/src/hooks/useChargeBatchRollback.ts
- [x] T031 [US3] Add fee rule confirmation dialog details and reason input in frontend/src/components/settings/FeeRuleGenerationPanel.tsx
- [x] T032 [US3] Add transport confirmation dialog details and reason input in frontend/src/pages/Transport.tsx
- [x] T033 [US3] Add audit/history visibility for voided charge batches in backend/app/Controllers/Api/ReconciliationController.php

**Checkpoint**: User Story 3 should provide safe confirmation and audit visibility without changing generation behavior.

---

## Phase 6: User Story 4 - Generate Charges with Descriptive Labels (Priority: P2)

**Goal**: Newly generated fee rule and transport charges have canonical descriptive labels that distinguish charge source and period.

**Independent Test**: Generate fee rule and transport charges and confirm charge descriptions match `TERM-{termNumber}-{year} Fee Rules Charges` and `TERM-{termNumber}-{monthName}-{year} Transport Charges` in ledgers/reports.

### Implementation for User Story 4

- [x] T034 [US4] Replace fee rule charge description generation with canonical fee rule label in backend/app/Services/FeeRuleBillingService.php
- [x] T035 [US4] Replace transport charge description generation with canonical transport label in backend/app/Controllers/Api/TransportController.php
- [x] T036 [US4] Add term/year/month label resolution from tenant calendar data in backend/app/Services/ChargeBatchRollbackService.php
- [x] T037 [US4] Include `descriptionLabel` in fee rule generation responses in backend/app/Controllers/Api/FeeRuleController.php
- [x] T038 [US4] Include `descriptionLabel` in transport generation responses in backend/app/Controllers/Api/TransportController.php
- [x] T039 [US4] Display generated description labels in frontend/src/components/settings/FeeRuleGenerationPanel.tsx and frontend/src/pages/Transport.tsx

**Checkpoint**: User Story 4 should be verifiable through newly generated charge records and UI generation summaries.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, cleanup, and constitution-required checks across all stories.

- [x] T040 Verify all new backend queries include JWT-derived tenant filtering in backend/app/Services/ChargeBatchRollbackService.php
- [x] T041 Verify ledger balance calculations still exclude voided charges without storing mutable balances in backend/app/Services/LedgerService.php
- [x] T042 Run backend migration and syntax checks from backend/spark and backend/composer.json
- [x] T043 Run frontend build/lint checks from frontend/package.json
- [x] T044 Execute curl validation scenarios documented in specs/064-rollback-void-charges/quickstart.md
- [x] T045 Update implementation notes if API behavior differs from planned contract in specs/064-rollback-void-charges/contracts/charge-batch-rollback-api.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion - blocks all user stories.
- **User Stories (Phase 3+)**: Depend on Foundational completion.
- **Polish (Phase 7)**: Depends on implemented stories selected for delivery.

### User Story Dependencies

- **US1 (P1)**: Can start after Foundation and is the suggested MVP.
- **US2 (P1)**: Can start after Foundation; independent from US1 except shared service and routes file coordination.
- **US3 (P2)**: Depends on at least one rollback story (US1 or US2) being implemented; applies to both when both exist.
- **US4 (P2)**: Can start after Foundation; independent from rollback execution but benefits from shared label helpers.

### Within Each User Story

- Backend batch/service behavior before controller endpoints.
- Controller endpoints before frontend API client methods.
- Frontend API client methods before hook/UI integration.
- UI integration before quickstart validation.

---

## Parallel Opportunities

- T002 and T003 can run in parallel during setup.
- T010 can run in parallel with backend foundational work after API shapes are agreed.
- US1 and US2 can be implemented in parallel after T004-T011, with coordination on backend/app/Config/Routes.php and frontend/src/api/api.ts.
- US3 frontend dialog work can split between frontend/src/components/settings/FeeRuleGenerationPanel.tsx and frontend/src/pages/Transport.tsx.
- US4 label work can split between backend/app/Services/FeeRuleBillingService.php and backend/app/Controllers/Api/TransportController.php after shared label helper design is complete.

## Parallel Example: User Story 1

```bash
Task: "Add latest fee rule batch summary endpoint method in backend/app/Controllers/Api/FeeRuleController.php"
Task: "Add fee rule latest-batch and void API client methods in frontend/src/api/api.ts"
```

## Parallel Example: User Story 2

```bash
Task: "Add latest transport batch summary endpoint method in backend/app/Controllers/Api/TransportController.php"
Task: "Add transport latest-batch rollback UI action in frontend/src/pages/Transport.tsx"
```

## Parallel Example: User Story 3

```bash
Task: "Add fee rule confirmation dialog details and reason input in frontend/src/components/settings/FeeRuleGenerationPanel.tsx"
Task: "Add transport confirmation dialog details and reason input in frontend/src/pages/Transport.tsx"
```

## Parallel Example: User Story 4

```bash
Task: "Replace fee rule charge description generation with canonical fee rule label in backend/app/Services/FeeRuleBillingService.php"
Task: "Replace transport charge description generation with canonical transport label in backend/app/Controllers/Api/TransportController.php"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational shared batch/void infrastructure.
3. Complete Phase 3: US1 fee rule rollback.
4. Stop and validate US1 independently with generated fee rule charges.
5. Demo or deploy MVP if fee rule rollback is the immediate need.

### Incremental Delivery

1. Deliver US1 for fee rule rollback MVP.
2. Deliver US2 for transport rollback parity.
3. Deliver US3 for richer confirmation and audit visibility.
4. Deliver US4 for standardized labels in new generated charges.
5. Run Phase 7 validation after the selected story set is implemented.

### Parallel Team Strategy

1. One developer owns backend shared service and migration.
2. One developer owns fee rule controller/service/UI tasks.
3. One developer owns transport controller/UI tasks.
4. Coordinate changes to backend/app/Config/Routes.php and frontend/src/api/api.ts to avoid merge conflicts.

## Notes

- Each task is intentionally scoped to concrete files so another LLM or developer can execute it without additional planning.
- Do not edit existing migrations; create only new migration files.
- Preserve tenant isolation and query-time ledger balance calculation throughout implementation.
- Run curl endpoint checks only after implementation is complete, as required by the constitution.
