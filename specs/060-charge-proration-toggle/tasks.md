# Tasks: Charge Proration Toggle

**Input**: Design documents from `/specs/060-charge-proration-toggle/`
**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/ ✅

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[US1/US2/US3]**: User story label
- Exact file paths in all descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: No new migrations required. Validate environment and create the `ChargeProrationHelper` service — the shared foundation consumed by all three user stories.

- [x] T001 Create `backend/app/Services/ChargeProrationHelper.php` with static `calculate(float $fullAmount, string $periodStart, string $periodEnd, ?string $studentStart): array` method implementing `floor(remaining_days / total_days × fullAmount)` formula (research.md D3, data-model.md §New Service)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Wire `chargeProrationEnabled` into the settings API (GET + PUT) and the TypeScript `Settings` interface. Both billing generators and all frontend story phases depend on this being in place.

**⚠️ CRITICAL**: No user story work can begin until T002–T006 are complete.

- [x] T002 [P] Add `'chargeProrationEnabled' => false` to `DEFAULT_SETTINGS` constant in `backend/app/Controllers/Api/SettingsController.php`
- [x] T003 [P] Add `chargeProrationEnabled` to `index()` response in `backend/app/Controllers/Api/SettingsController.php` (cast to `(bool)`, default `false`)
- [x] T004 Add `chargeProrationEnabled` to `$updatedSettings` build block in `update()` in `backend/app/Controllers/Api/SettingsController.php` (cast to `(bool)`, depends on T002)
- [x] T005 [P] Add `chargeProrationEnabled?: boolean` field to the `Settings` interface in `frontend/src/types/dashboard.ts`
- [x] T006 [P] Add integration test skeleton `backend/tests/Integration/ChargeProrationTest.php` with tenant/helper setup; leave test method stubs for T008, T016, T022 (Constitution Principle X)

**Checkpoint**: `GET /api/settings` returns `chargeProrationEnabled: false`; `PUT /api/settings` with `{"chargeProrationEnabled": true}` persists and returns `true`.

---

## Phase 3: User Story 1 — Admin Configures Proration Behaviour (Priority: P1) 🎯 MVP

**Goal**: Admin can toggle `chargeProrationEnabled` on/off in Settings → Fee Structure; change persists and affects the next charge generation run for both generators.

**Independent Test**: Enable toggle, save, reload settings page → toggle shows ON. Generate fee-rule charges for a student whose `enrollment_date` is 15 days into the billing month → charge amount = `floor(16/31 × full_amount)` (not full_amount).

### Implementation for User Story 1

- [x] T007 [US1] Add `chargeProrationEnabled` reading to `FeeRuleBillingService::generateCharges()` in `backend/app/Services/FeeRuleBillingService.php`: load from `tenants.settings` JSON before the rules loop; pass flag to per-student proration call via `ChargeProrationHelper::calculate()` using `student['enrollment_date']` as `$studentStart` and billing period dates as `$periodStart`/`$periodEnd` (depends on T001, T004)
- [x] T008 [US1] Extend `getEligibleStudents()` in `backend/app/Services/FeeRuleBillingService.php` to include `enrollment_date` in the SELECT for `school_wide`, `class`, and `category` scope queries so T007 has access to the date (depends on T007)
- [x] T009 [US1] Update charge insert in `FeeRuleBillingService::generateCharges()` to use `$result['amount']` from `ChargeProrationHelper` and append `– prorated X/Y days` to description when `$result['wasProrated']` is true (depends on T007, T008)
- [x] T010 [US1] Write integration test cases in `backend/tests/Integration/ChargeProrationTest.php`: (a) toggle OFF → full charge; (b) toggle ON + student `enrollment_date` before period start → full charge; (c) toggle ON + student `enrollment_date` mid-period → correct prorated amount (depends on T006, T009)
- [x] T011 [P] [US1] Add `ChargeProrationCard` component to `frontend/src/components/settings/FeeStructureTab.tsx`: a `Card` with a `Switch` toggling `chargeProrationEnabled`, Save button (disabled when `saving`), reads from and writes to the parent `settings` state via `api.saveSettings()` — visible to all roles, Switch disabled for `bursar` (depends on T005)
- [x] T012 [P] [US1] Add `/settings/fee-structure` route to `frontend/src/pages/Settings.tsx` (import `FeeStructureTab`, wrap in `SubscriptionGuard`, add `Route` alongside existing routes) (depends on T011)
- [x] T013 [P] [US1] Add `fee-structure` entry to `allSettingsLinks` array in `frontend/src/components/settings/SettingsSidebar.tsx` (label "Fee Structure", icon `Receipt` or `Banknote`, roles `['super_admin', 'admin', 'bursar']`) (no dependencies)

**Checkpoint**: US1 fully functional. Toggle persists. Fee-rule charges are prorated when toggle ON, unchanged when OFF.

---

## Phase 4: User Story 2 — Prorated Charge Visibility (Priority: P2)

**Goal**: Prorated charge descriptions include `– prorated X/Y days`; full-period charge descriptions are unchanged.

**Independent Test**: Generate charges with proration ON for a mid-period enrollee. Query `charges` table — `description` contains `– prorated X/Y days`. For a full-period enrollee, description is identical to pre-feature output.

### Implementation for User Story 2

- [x] T014 [US2] Verify and harden `ChargeProrationHelper::calculate()` annotation output in `backend/app/Services/ChargeProrationHelper.php`: unit-level validation that `wasProrated = false` when `studentStart ≤ periodStart` and `true` + correct fraction when mid-period (confirms T001 logic, no code change expected unless gap found)
- [x] T015 [US2] Write integration test cases in `backend/tests/Integration/ChargeProrationTest.php`: (d) prorated description contains `– prorated X/Y days`; (e) full-period description has no proration annotation (depends on T010, T009)
- [x] T016 [US2] Confirm transport charge description annotation format in `backend/app/Controllers/Api/TransportController.php` matches fee-rule format (same `– prorated X/Y days` suffix) — aligns both generators on a single annotation standard (depends on T018)

**Checkpoint**: US1 + US2 complete. All prorated charges are annotated; full charges are not.

---

## Phase 5: User Story 3 — Proration Applies to Both Charge Types (Priority: P2)

**Goal**: Transport monthly charge generator also reads `chargeProrationEnabled` and applies the same proration formula using the allocation's `start_date`.

**Independent Test**: With toggle ON, POST `/api/transport/generate-charges` for a month where a student's allocation `start_date` is 10 days in → charge `amount = floor(22/31 × monthly_fee)`, description contains `– prorated 22/31 days`.

### Implementation for User Story 3

- [x] T017 [US3] Add `chargeProrationEnabled` reading to `TransportController::generateMonthlyCharges()` in `backend/app/Controllers/Api/TransportController.php`: after loading `$tenantId`, read tenant settings JSON and extract the flag (depends on T004)
- [x] T018 [US3] Apply `ChargeProrationHelper::calculate()` inside the allocation loop in `TransportController::generateMonthlyCharges()` in `backend/app/Controllers/Api/TransportController.php`: use `$a['start_date']` as `$studentStart`, `$monthStart` as `$periodStart`, `$monthEnd` as `$periodEnd`; use `$result['amount']` in the insert; append `– prorated X/Y days` to description when `$result['wasProrated']` is true (depends on T001, T017)
- [x] T019 [US3] Extend `getEligibleStudents()` for `service` scope in `backend/app/Services/FeeRuleBillingService.php` to SELECT `ta.start_date` from `transport_assignments` so fee-rule service-scoped charges can also be prorated using the assignment start date (depends on T008)
- [x] T020 [US3] Apply proration to service-scoped charges in `backend/app/Services/FeeRuleBillingService.php`: when scope is `service`, use `student['start_date']` (from T019) instead of `student['enrollment_date']` in the `ChargeProrationHelper::calculate()` call (depends on T019, T009)
- [x] T021 [US3] Write integration test cases in `backend/tests/Integration/ChargeProrationTest.php`: (f) transport monthly charge prorated when toggle ON + mid-month allocation; (g) tenant isolation — toggle ON for tenant A does not affect tenant B charges (depends on T015, T018, T020)

**Checkpoint**: All three user stories functional. Single toggle controls both generators consistently.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Null-safety hardening, fallback logging, lint/type-check validation.

- [x] T022 [P] Add null-guard in `ChargeProrationHelper::calculate()` in `backend/app/Services/ChargeProrationHelper.php`: if `$studentStart` is null or empty, return full charge with `wasProrated = false` and log a `debug` message (research.md D3 fallback)
- [x] T023 [P] Add `try/catch` in `ChargeProrationHelper::calculate()` in `backend/app/Services/ChargeProrationHelper.php` for invalid date string inputs — catch `\Exception`, log warning, return full charge (Constitution Principle IX)
- [x] T024 [P] Run PHP lint check: `php -l backend/app/Services/ChargeProrationHelper.php backend/app/Services/FeeRuleBillingService.php backend/app/Controllers/Api/SettingsController.php backend/app/Controllers/Api/TransportController.php`
- [x] T025 [P] Run TypeScript type-check: `cd frontend && npx tsc --noEmit` — confirm `chargeProrationEnabled` field is correctly typed across `dashboard.ts`, `FeeStructureTab.tsx`, and any other consumers
- [x] T026 Run full integration test suite: `cd backend && php vendor/bin/phpunit tests/Integration/ChargeProrationTest.php --testdox` — all 7 cases must pass
- [x] T027 Verify quickstart.md steps end-to-end: toggle ON via API, generate fee-rule charges, confirm prorated amount + description in DB (validates `specs/060-charge-proration-toggle/quickstart.md`)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (T001)**: No dependencies — start immediately
- **Phase 2 (T002–T006)**: Depends on T001 for helper; T002/T003/T005/T006 fully parallel; T004 depends on T002
- **Phase 3 (T007–T013)**: Depends on Phase 2 complete; T011/T012/T013 parallel with each other and with T007–T010
- **Phase 4 (T014–T016)**: Depends on Phase 3 complete
- **Phase 5 (T017–T021)**: T017–T020 depend on Phase 2; T021 depends on T018+T020; US3 can be developed in parallel with US2
- **Phase 6 (T022–T027)**: Depends on all user story phases complete

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 1+2 only → MVP, deliver first
- **US2 (P2)**: Depends on US1 (description annotation is output of T009)
- **US3 (P2)**: Depends on Phase 1+2; can run in parallel with US2

### Within Each Phase — Parallel Opportunities

**Phase 2** (all parallel after T001):
```
T002 SettingsController DEFAULT_SETTINGS
T003 SettingsController index()
T005 dashboard.ts Settings interface
T006 ChargeProrationTest.php skeleton
→ T004 SettingsController update() (waits for T002)
```

**Phase 3** (frontend tasks parallel with backend tasks):
```
T007 → T008 → T009 → T010  (backend chain)
T011, T012, T013            (frontend — all parallel with each other and the backend chain)
```

**Phase 5** (T017+T019 parallel):
```
T017 TransportController read toggle
T019 FeeRuleBillingService service-scope start_date
→ T018 (waits for T017)
→ T020 (waits for T019)
→ T021 (waits for T018 + T020)
```

---

## Implementation Strategy

### MVP (User Story 1 only — P1)

1. Complete Phase 1 (T001)
2. Complete Phase 2 (T002–T006)
3. Complete Phase 3 US1 (T007–T013)
4. **STOP and VALIDATE**: toggle, save, reload settings; generate fee-rule charges; confirm prorated amount
5. Run `php -l` + `npx tsc --noEmit`

### Incremental Delivery

1. T001 → T002–T006 → T007–T013 → **US1 demo** (fee-rule proration + settings toggle)
2. T014–T016 → **US2 demo** (annotated descriptions)
3. T017–T021 → **US3 demo** (transport charges prorated)
4. T022–T027 → **Polish + full test run**

### Total Task Count

| Phase | Tasks | Notes |
|-------|-------|-------|
| Phase 1 Setup | 1 (T001) | New service file |
| Phase 2 Foundational | 5 (T002–T006) | Settings controller + TS type |
| Phase 3 US1 (P1 MVP) | 7 (T007–T013) | Backend billing + frontend card |
| Phase 4 US2 (P2) | 3 (T014–T016) | Description visibility |
| Phase 5 US3 (P2) | 5 (T017–T021) | Transport proration |
| Phase 6 Polish | 6 (T022–T027) | Hardening + validation |
| **Total** | **27** | |

---

## Notes

- `[P]` = different files, no pending dependencies within the same phase
- Each user story is independently testable from the checkpoint onward
- No database migrations — zero `php spark migrate` step required
- Commit after each phase checkpoint
- `ChargeProrationHelper` (T001) is the only genuinely new file; everything else is additive modification
