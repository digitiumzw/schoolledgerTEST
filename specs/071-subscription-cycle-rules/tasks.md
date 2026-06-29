# Tasks: Subscription Billing Cycle Transition Rules

**Input**: Design documents from `/specs/071-subscription-cycle-rules/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/subscription-cycle-rules.md, quickstart.md

**Tests**: Post-implementation curl validation per constitution Principle X; no separate pre-implementation test suite required.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label (US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- Backend: `backend/app/Controllers/Api/`, `backend/app/Controllers/Platform/`, `backend/app/Services/`, `backend/app/Models/`, `backend/app/Database/Migrations/`
- Frontend: `frontend/src/api/`, `frontend/src/admin/pages/`, `frontend/src/components/subscription/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Optional schema additions for stronger subscription transition audit and pending change tracking.

- [X] T001 Add migration for optional `proration_calculations.change_type`, `proration_calculations.policy_code`, and `school_subscriptions` pending change fields (`pending_plan_id`, `pending_change_effective_at`, `pending_change_type`) in `backend/app/Database/Migrations/2026-05-11-000001_AddSubscriptionTransitionAuditFields.php`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Centralized subscription transition policy and tenant-facing metadata that MUST be in place before any user story can be fully implemented.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 Create `SubscriptionTransitionPolicy` service with centralized `canTransition()` logic enforcing one-way billing cycle rules in `backend/app/Services/SubscriptionTransitionPolicy.php`
- [X] T003 Update `SubscriptionController.current()` to include `transitionPolicy` metadata (`canSwitchToAnnual`, `canSwitchToMonthly`, `canChangeTier`, `blockedReason`) in `backend/app/Controllers/Api/SubscriptionController.php`
- [X] T004 [P] Update `SchoolSubscriptionModel` with `getPendingChanges()`, `clearPendingChanges()`, and `hasActiveAnnualSubscription()` helpers in `backend/app/Models/SchoolSubscriptionModel.php`
- [X] T005 [P] Update frontend `api.ts` and `platform.ts` to include `transitionPolicy` and pending change types in `frontend/src/api/api.ts` and `frontend/src/api/platform.ts`

**Checkpoint**: Foundation ready — centralized transition policy exists, tenant metadata exposes allowed actions, models support pending changes.

---

## Phase 3: User Story 4 - Block Annual to Monthly Transition (Priority: P1)

**Goal**: Enforce the one-way billing cycle policy by blocking annual → monthly transitions across all tenant-facing and platform-facing paths.

**Independent Test**: Attempt to initiate a monthly subscription or calculate monthly proration while on an active annual plan; verify HTTP 422 with `ANNUAL_TO_MONTHLY_BLOCKED` and no state mutation.

### Implementation for User Story 4

- [X] T006 Update `SubscriptionController.initiate()` to reject `billingCycle=monthly` when active subscription is annual with `ANNUAL_TO_MONTHLY_BLOCKED` in `backend/app/Controllers/Api/SubscriptionController.php`
- [X] T007 Update `SubscriptionController.initiateEcocash()` to reject `billingCycle=monthly` when active subscription is annual in `backend/app/Controllers/Api/SubscriptionController.php`
- [X] T008 Update `SubscriptionController.calculateProration()` to reject `billingCycle=monthly` when active subscription is annual in `backend/app/Controllers/Api/SubscriptionController.php`
- [X] T009 Update `Platform/SubscriptionsController.assign()` to block monthly assignment for tenants with active annual subscriptions in `backend/app/Controllers/Platform/SubscriptionsController.php`
- [X] T010 Update `Platform/SubscriptionsController.changePlan()` to preserve `expires_at` for annual subscriptions and block cycle changes in `backend/app/Controllers/Platform/SubscriptionsController.php`
- [X] T011 Add billing event logging for blocked transition attempts in `backend/app/Controllers/Api/SubscriptionController.php` and `backend/app/Controllers/Platform/SubscriptionsController.php`
- [X] T012 [P] Frontend: Update tenant subscription UI to hide/disable monthly option when on annual billing in `frontend/src/components/subscription/`
- [X] T013 [P] Frontend: Update platform admin Subscriptions page to prevent monthly assignment for active annual tenants in `frontend/src/admin/pages/Subscriptions.tsx`

**Checkpoint**: Annual → monthly is blocked on all paths with clear error messages and audit logging.

---

## Phase 4: User Story 1 - Monthly to Annual Plan Upgrade (Priority: P1) 🎯 MVP

**Goal**: Allow tenants on monthly billing to upgrade to annual at any time, creating a new annual subscription with a fresh annual renewal period.

**Independent Test**: Create a tenant on monthly billing, initiate an annual subscription, verify the new annual subscription is created and activated after payment, with the old monthly subscription superseded.

### Implementation for User Story 1

- [X] T014 [P] Verify monthly→annual initiation flow creates a new `billing_cycle=annual` pending subscription while keeping the old monthly active until payment confirmation in `backend/app/Controllers/Api/SubscriptionController.php`
- [X] T015 [P] Update frontend tenant subscription UI to show annual upgrade CTA and annual pricing for monthly subscribers in `frontend/src/components/subscription/`
- [X] T016 Record `billing_cycle_change` event in `activateSubscription()` when superseding a monthly subscription with an annual one in `backend/app/Controllers/Api/SubscriptionController.php`

**Checkpoint**: Monthly subscribers can upgrade to annual; old monthly subscription is properly superseded after payment.

---

## Phase 5: User Story 2 - Annual Plan Tier Upgrade with Proration (Priority: P1)

**Goal**: Allow annual subscribers to upgrade plan tier mid-cycle, charging only the prorated price difference while keeping the original renewal date unchanged.

**Independent Test**: Create a tenant on annual Basic, wait a few months, calculate proration to Premium, confirm the upgrade charges only the remaining-period price difference, and verify `expires_at` is unchanged after activation.

### Implementation for User Story 2

- [X] T017 [P] Update `ProrationService` to calculate price-difference proration for annual tier upgrades (`(target_annual_price - current_annual_price) * days_remaining / days_in_cycle`) in `backend/app/Services/ProrationService.php`
- [X] T018 [P] Verify `upgrade-with-proration` preserves the original annual `expires_at` from `cycle_end_date` in `backend/app/Controllers/Api/SubscriptionController.php`
- [X] T019 Verify positive proration `netAmountCents` requires successful Paynow payment before tier activation in `backend/app/Controllers/Api/SubscriptionController.php`
- [X] T020 Add payment failure rollback in `poll()`: cancel pending upgrade subscription, keep original annual active, log event in `backend/app/Controllers/Api/SubscriptionController.php`
- [X] T021 Frontend: Show annual tier upgrade proration preview with amount due, days remaining, and unchanged renewal date in `frontend/src/components/subscription/`

**Checkpoint**: Annual tier upgrades charge prorated difference only, preserve renewal date, and roll back cleanly on payment failure.

---

## Phase 6: User Story 3 - Annual Plan Tier Downgrade (Priority: P1)

**Goal**: Allow annual subscribers to downgrade plan tier without refunds, either immediately with no refund or scheduled at renewal.

**Independent Test**: Create a tenant on annual Premium, initiate downgrade to Basic, verify no refund is issued, renewal date is unchanged, and the change applies according to the configured policy.

### Implementation for User Story 3

- [X] T022 Implement downgrade policy: immediate zero-charge downgrade with no refund OR scheduled downgrade at renewal in `backend/app/Controllers/Api/SubscriptionController.php` and `backend/app/Services/ProrationService.php`
- [X] T023 [P] Frontend: Show downgrade options with clear no-refund disclosure in `frontend/src/components/subscription/`
- [X] T024 Update `SubscriptionController.current()` to include pending downgrade plan and effective date in the response in `backend/app/Controllers/Api/SubscriptionController.php`
- [X] T025 Cancel any scheduled downgrade when a new upgrade is initiated in `backend/app/Controllers/Api/SubscriptionController.php`

**Checkpoint**: Annual downgrades apply without refunds; scheduled downgrades are visible and cancellable on upgrade.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validation, linting, and documentation updates across all user stories.

- [X] T026 [P] PHP lint for all touched backend files (`SubscriptionController.php`, `SubscriptionsController.php`, `ProrationService.php`, `SchoolSubscriptionModel.php`)
- [ ] T027 [P] Frontend TypeScript type-check and targeted ESLint for `frontend/src/api/api.ts`, `frontend/src/api/platform.ts`, and subscription UI components
- [ ] T028 Run quickstart.md curl validation scenarios in `specs/071-subscription-cycle-rules/quickstart.md` (login, plans, monthly→annual, annual→monthly block, tier upgrade proration, payment failure, tenant isolation, platform guard)
- [X] T029 [P] Update `specs/071-subscription-cycle-rules/quickstart.md` with actual curl validation results and any deviation notes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately. Optional if no schema changes are needed.
- **Foundational (Phase 2)**: Depends on Setup completion (if migration added). BLOCKS all user stories.
- **User Stories (Phase 3–6)**: All depend on Foundational phase completion.
  - US4 blocking must be in place before US1/US2/US3 are functionally complete.
  - Stories can proceed sequentially in priority order or in parallel if team capacity allows.
- **Polish (Phase 7)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US4 (Block Annual → Monthly)**: Can start after Foundational. No dependencies on other stories. Must complete before US1/US2/US3 are validated.
- **US1 (Monthly → Annual)**: Can start after Foundational. Independent of US2 and US3.
- **US2 (Annual Tier Upgrade)**: Can start after Foundational. Independent of US1 and US3.
- **US3 (Annual Tier Downgrade)**: Can start after Foundational. Independent of US1 and US2, but may interact with US2 if scheduled downgrade + upgrade cancel logic is implemented.

### Within Each User Story

- Core backend blocking/behavior before frontend affordances
- Services before controllers
- Controllers before frontend components
- Story complete before moving to next priority

### Parallel Opportunities

- T004 and T005 (model + API type changes) are parallel — different files
- T012 and T013 (frontend tenant + platform admin) are parallel — different files
- T014 and T015 (backend flow verify + frontend CTA) are parallel
- T017 and T018 (service update + controller verify) are parallel
- T023 (frontend downgrade UI) is parallel with T022 (backend downgrade policy)
- T026, T027, T029 (lint, type-check, docs) are parallel
- T028 (curl validation) is sequential after all implementation is complete

---

## Parallel Example: User Story 2

```bash
# Backend service update and controller verification in parallel:
Task: "Update ProrationService for price-difference proration in backend/app/Services/ProrationService.php"
Task: "Verify upgrade-with-proration preserves expires_at in backend/app/Controllers/Api/SubscriptionController.php"

# Frontend work parallel with backend:
Task: "Show annual tier upgrade proration preview in frontend/src/components/subscription/"
```

---

## Implementation Strategy

### MVP First (US4 + US1)

1. Complete Phase 1: Setup (optional migration)
2. Complete Phase 2: Foundational — centralized transition policy
3. Complete Phase 3: US4 — block annual → monthly across all paths
4. Complete Phase 4: US1 — monthly → annual upgrade
5. **STOP and VALIDATE**: Test US1 and US4 independently via curl
6. Deploy/demo if ready

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US4 → Test independently → Deploy (core business rule enforced)
3. Add US1 → Test independently → Deploy (monthly→annual conversion)
4. Add US2 → Test independently → Deploy (annual tier upgrade with proration)
5. Add US3 → Test independently → Deploy (annual tier downgrade)
6. Polish → Final validation

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US4 (blocking enforcement)
   - Developer B: US1 (monthly→annual)
   - Developer C: US2 (annual tier upgrade)
   - Developer D: US3 (annual tier downgrade)
3. Stories complete and integrate independently; blocking logic protects all paths

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (if pre-implementation tests are written)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence

## Task Summary

| Phase | Story | Tasks | Count |
|-------|-------|-------|-------|
| Phase 1 | Setup | T001 | 1 |
| Phase 2 | Foundational | T002–T005 | 4 |
| Phase 3 | US4 | T006–T013 | 8 |
| Phase 4 | US1 | T014–T016 | 3 |
| Phase 5 | US2 | T017–T021 | 5 |
| Phase 6 | US3 | T022–T025 | 4 |
| Phase 7 | Polish | T026–T029 | 4 |
| **Total** | | | **29** |

**MVP scope**: Phase 1 + Phase 2 + US4 (T001–T013) = 13 tasks.
**Full feature**: All 29 tasks.
