# Tasks: Subscription Proration for Mid-Cycle Upgrades

**Feature**: 036-subscription-proration  
**Branch**: `036-subscription-proration`  
**Total Tasks**: 42

---

## Implementation Strategy

**MVP Scope**: User Story 1 (P1) only - Core upgrade with proration. This provides immediate value and can be deployed independently.

**Incremental Delivery**:
1. Phase 1-2: Database + foundational service (shared infrastructure)
2. Phase 3: US1 - Core upgrade functionality (MVP)
3. Phase 4: US2 - Breakdown UI (adds transparency)
4. Phase 5: US3 - Downgrade support (completes feature set)
5. Phase 6: Polish + edge cases

**Parallel Opportunities**: Backend and frontend tasks within each user story can be developed in parallel once contracts are defined.

---

## Dependency Graph

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational)
    ↓
├── Phase 3 (US1 - P1) ← MVP TARGET
│       ↓
├── Phase 4 (US2 - P2)
│       ↓
├── Phase 5 (US3 - P3)
│       ↓
└── Phase 6 (Polish)
```

**Story Dependencies**: US2 depends on US1 API contracts. US3 depends on US1 core logic. Each story is independently testable once prerequisites are complete.

---

## Phase 1: Database Setup

**Goal**: Create migration files and run database schema updates

- [X] T001 Create migration for proration_calculations table in `backend/app/Database/Migrations/2026-04-16-100000_Create_proration_calculations_table.php`
- [X] T002 Create migration for subscription_credits table in `backend/app/Database/Migrations/2026-04-16-100001_Create_subscription_credits_table.php`
- [X] T003 Create migration for credit_applications table in `backend/app/Database/Migrations/2026-04-16-100002_Create_credit_applications_table.php`
- [X] T004 Run migrations locally to verify schema in `backend/` with `php spark migrate`
- [ ] T005 [P] Add migration rollback tests for all three tables

---

## Phase 2: Foundational Backend

**Goal**: Build core models and proration service used by all user stories

- [X] T006 Create ProrationCalculationModel in `backend/app/Models/ProrationCalculationModel.php`
- [X] T007 Create SubscriptionCreditModel in `backend/app/Models/SubscriptionCreditModel.php`
- [X] T008 Create CreditApplicationModel in `backend/app/Models/CreditApplicationModel.php`
- [X] T009 Create ProrationService with calculation logic in `backend/app/Services/ProrationService.php`
- [X] T010 Implement calculateProration() method in ProrationService with formula: (price/days)*remaining
- [X] T011 Implement createCreditForDowngrade() method in ProrationService
- [ ] T012 Add unit tests for ProrationService calculation accuracy in `backend/tests/unit/ProrationServiceTest.php`
- [X] T013 [P] Add API routes for proration endpoints in `backend/app/Config/Routes.php`

---

## Phase 3: User Story 1 - Upgrade with Proration (P1)

**Story Goal**: Customers can upgrade mid-cycle with automatic prorated billing

**Independent Test Criteria**: Can fully test upgrade flow: calculate → confirm → pay → activate

### Backend Implementation

- [X] T014 [US1] Add calculateProration() method to SubscriptionController in `backend/app/Controllers/Api/SubscriptionController.php`
- [X] T015 [US1] Add upgradeWithProration() method to SubscriptionController
- [X] T016 [US1] Implement downgrade check (student count limit) in calculateProration
- [X] T017 [US1] Extend webhook handler for prorated payment success in SubscriptionController::activateSubscription
- [X] T018 [US1] Handle payment failure - revert to original subscription in webhook
- [X] T019 [US1] Create billing event 'plan_upgraded' on successful activation
- [ ] T020 [P] [US1] Add integration tests for calculate-proration endpoint

### Frontend Implementation

- [X] T021 [US1] Add calculateProration API method in `frontend/src/api/api.ts`
- [X] T022 [US1] Add initiateUpgrade API method in `frontend/src/api/api.ts`
- [X] T023 [US1] Create useProration hook in `frontend/src/hooks/useProration.ts`
- [X] T024 [US1] Create ProrationBreakdown component in `frontend/src/components/subscription/ProrationBreakdown.tsx`
- [X] T025 [US1] Create UpgradePage route in `frontend/src/pages/subscription/UpgradePage.tsx`
- [X] T026 [US1] Add route definition for /subscription/upgrade in frontend router
- [X] T027 [US1] Handle payment redirect after upgrade initiation

---

## Phase 4: User Story 2 - View Proration Breakdown (P2)

**Story Goal**: Customers see transparent breakdown before confirming upgrade

**Independent Test Criteria**: Proration details visible: days remaining, credit amount, new charge, net amount

### Backend Implementation

- [X] T028 [US2] Add proration-history endpoint to SubscriptionController
- [X] T029 [P] [US2] Add pagination support for proration history queries

### Frontend Implementation

- [X] T030 [US2] Create ProrationHistory component in `frontend/src/components/subscription/ProrationHistory.tsx`
- [X] T031 [US2] Add getProrationHistory API method in `frontend/src/api/api.ts`
- [X] T032 [US2] Add formula explanation expand/collapse in ProrationBreakdown
- [X] T033 [US2] Implement currency formatting helper for cents-to-dollars display

---

## Phase 5: User Story 3 - Handle Downgrade Scenarios (P3)

**Story Goal**: Downgrades generate credits applied to future invoices

**Independent Test Criteria**: Downgrade creates credit balance visible in account

### Backend Implementation

- [X] T034 [US3] Add credits endpoint to SubscriptionController in `backend/app/Controllers/Api/SubscriptionController.php`
- [X] T035 [US3] Implement credit creation on downgrade in ProrationService
- [X] T036 [US3] Add credit balance lookup for tenant
- [X] T037 [US3] Create billing event 'plan_downgraded' on downgrade activation

### Frontend Implementation

- [X] T038 [US3] Create useCredits hook in `frontend/src/hooks/useCredits.ts`
- [X] T039 [US3] Create CreditsPage component in `frontend/src/pages/subscription/CreditsPage.tsx`
- [X] T040 [US3] Add CreditsPage route to router

---

## Phase 6: Polish & Cross-Cutting

**Goal**: Edge cases, error handling, and final integration

- [X] T041 Handle edge case: upgrade on billing cycle day (no proration) in ProrationService
- [X] T042 Handle edge case: same-priced plan (zero net) in ProrationService
- [X] T043 Handle edge case: calculation expiration (30min timeout) in SubscriptionController
- [ ] T044 [P] Add error boundary for ProrationBreakdown component
- [X] T045 Add loading skeleton for proration calculation UI
- [X] T046 Implement downgrade blocked error display component
- [ ] T047 [P] Add accessibility: focus trap in confirmation modal
- [X] T048 [P] Add accessibility: aria-live for loading states
- [X] T049 Add cache invalidation for React Query on upgrade success
- [ ] T050 Update quickstart.md with verified setup steps

---

## Parallel Execution Examples

**Within US1 (Backend + Frontend parallel)**:
```
Developer A: T014, T015, T016, T017, T018, T019 (Backend API)
Developer B: T021, T022, T023, T024, T025, T027 (Frontend UI)
Sync point: T020 integration tests after both complete
```

**Across Stories (when US1 is stable)**:
```
Developer A: T028, T029, T034, T035, T036, T037 (Backend US2+US3)
Developer B: T030, T031, T032, T033, T038, T039, T040 (Frontend US2+US3)
```

---

## Success Criteria Mapping

| Criteria | Tasks That Satisfy |
|----------|-------------------|
| SC-001: 100% calculation accuracy | T009, T010, T012 |
| SC-002: Breakdown within 10s | T024, T032 |
| SC-003: 40% support ticket reduction | T024, T032, T046 |
| SC-004: 95% no manual intervention | T014-T027 (full US1 flow) |

---

## Checklist Format Reference

**Valid task format**:
```
- [ ] T001 [P] [US1] Description with file path
```

**Components**:
- Checkbox: `- [ ]` (REQUIRED)
- Task ID: `T001` (sequential, execution order)
- Parallel marker: `[P]` (optional, indicates parallelizable)
- Story label: `[US1]`, `[US2]`, `[US3]` (REQUIRED for story phases)
- Description: Clear action + exact file path
