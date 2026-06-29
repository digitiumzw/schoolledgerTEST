# Tasks: Fee Structure Billing Cycle Configuration

**Input**: Design documents from `/specs/047-fee-billing-cycle/`  
**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/ ✅ · quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.  
**Tests**: Integration tests are included (required by Constitution Principle X and spec FR-010).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependency)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup

**Purpose**: Verify pre-conditions and confirm no migrations or new files are needed outside the affected paths.

- [X] T001 Confirm `tenants.fee_structure` JSON already contains `structureType` key by checking existing `SettingsController::getFeeStructure()` response in `backend/app/Controllers/Api/SettingsController.php`
- [X] T002 Confirm `charges` table has all required columns (`due_date`, `description`, `term`, `billing_run_id`) by reviewing migration `backend/app/Database/Migrations/2026-01-29-120000_Improve_charges_schema.php` and `2026-01-25-190000_Add_billing_runs_table.php`
- [X] T003 Create integration test file skeleton `backend/tests/Controllers/Billing/BillingCycleTest.php` extending `CIUnitTestCase` with `DatabaseTestTrait` and `FeatureTestTrait` — no test methods yet, just class + namespace

**Checkpoint**: Confirmed no migrations needed. Test scaffold in place. User story work can begin.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend helper and validation tightening that both US1 and US2 depend on.

**⚠️ CRITICAL**: US1 (charge generation) and US2 (preview API) both require this phase before implementation.

- [X] T004 Add private method `calculateMonthlyInstallments(string $termStart, string $termEnd, float $termFee): array` to `backend/app/Controllers/Api/LedgerController.php` — implements distinct-calendar-month counting and last-installment remainder rule from research.md item 3
- [X] T005 [P] Tighten `$validStructureTypes` in `SettingsController::saveFeeStructure()` from `['termly', 'monthly', 'annual']` to `['termly', 'monthly']` in `backend/app/Controllers/Api/SettingsController.php`
- [X] T006 [P] Update `FeeStructure` TypeScript interface in `frontend/src/types/dashboard.ts` — change `structureType` from `'termly' | 'monthly' | 'custom'` to `'termly' | 'monthly'`

**Checkpoint**: Helper method available. Validation tightened. Frontend type aligned. All US phases can now proceed.

---

## Phase 3: User Story 1 — Charge Generation Respects Billing Cycle (Priority: P1) 🎯 MVP

**Goal**: When billing cycle is `monthly`, `POST /api/billing/finalize` splits each fee into monthly installments using the term's calendar months. When `termly`, existing behaviour is preserved exactly.

**Independent Test**: Set fee structure to `monthly`, trigger `POST /api/billing/finalize` for a 3-month term with 2 fee categories and 10 students → expect 60 charge rows, each with the correct amount, a 1st-of-month due date, and a description containing the month name and year.

### Integration Tests for User Story 1

- [X] T007 [P] [US1] Write termly regression test in `backend/tests/Controllers/Billing/BillingCycleTest.php` — seed fee structure `structureType=termly`, call `POST /api/billing/finalize`, assert 1 charge per student per fee category, assert amounts equal full term fees
- [X] T008 [P] [US1] Write monthly happy-path test in `backend/tests/Controllers/Billing/BillingCycleTest.php` — seed `structureType=monthly`, 3-month term, 2 fees, 3 students; assert 18 total charges, correct installment amounts, due dates = 1st of each month, descriptions contain month+year
- [X] T009 [P] [US1] Write monthly rounding test in `backend/tests/Controllers/Billing/BillingCycleTest.php` — $100 fee over 3 months; assert charges are $33.33, $33.33, $33.34; sum = $100.00 exactly
- [X] T010 [P] [US1] Write single-month term test in `backend/tests/Controllers/Billing/BillingCycleTest.php` — term start and end in same calendar month; assert 1 installment = full fee amount
- [X] T011 [P] [US1] Write bursary + monthly test in `backend/tests/Controllers/Billing/BillingCycleTest.php` — 50% bursary student, 3-month term, $300 fee; assert 3 charges each at $50.00

### Implementation for User Story 1

- [X] T012 [US1] Modify `finalizeBilling()` in `backend/app/Controllers/Api/LedgerController.php` — read `$billingCycle = $feeStructure['structureType'] ?? 'termly'` and `$termStart`/`$termEnd` from `$termInfo` after the existing term lookup block
- [X] T013 [US1] Replace the single-charge insert block inside the per-student per-fee loop in `finalizeBilling()` with a branch: if `$billingCycle === 'monthly'` call `$this->calculateMonthlyInstallments(...)`, else use a single-installment array — iterate and insert one charge row per installment in `backend/app/Controllers/Api/LedgerController.php`
- [X] T014 [US1] Set `due_date` to `$installment['dueDate']` (1st of installment month) and `description` to `"{$feeName} – {$installment['label']}"` for monthly installments; preserve existing description format `"{$feeName} - {$termName}"` for termly path in `backend/app/Controllers/Api/LedgerController.php`

**Checkpoint**: Run `php spark test --filter BillingCycleTest` — all US1 tests must pass. Verify termly charges are unaffected.

---

## Phase 4: User Story 2 — Preview Reflects Billing Cycle (Priority: P1) 🎯 MVP

**Goal**: `GET /api/billing/preview` response includes `billingCycle`, `installments`, and `installmentAmount` fields so administrators can see the active cycle and installment breakdown before confirming generation.

**Independent Test**: Call `GET /api/billing/preview?termId=...` when fee structure has `structureType=monthly` and the term spans 3 months → response contains `billingCycle: "monthly"`, `installments: 3`, `installmentAmount` = `defaultFeeTotal / 3` truncated to cent.

### Integration Tests for User Story 2

- [X] T015 [P] [US2] Write preview termly test in `backend/tests/Controllers/Billing/BillingCycleTest.php` — `structureType=termly`; assert `billingCycle="termly"`, `installments=1`, `installmentAmount=defaultFeeTotal`
- [X] T016 [P] [US2] Write preview monthly test in `backend/tests/Controllers/Billing/BillingCycleTest.php` — `structureType=monthly`, 3-month term; assert `billingCycle="monthly"`, `installments=3`, `installmentAmount` is truncated-cent value

### Implementation for User Story 2

- [X] T017 [US2] In `getBillingPreview()` in `backend/app/Controllers/Api/LedgerController.php`, after computing `$defaultFeeTotal`, read `$billingCycle` from `$feeStructure['structureType'] ?? 'termly'` and compute `$installments` using the same month-counting formula as `calculateMonthlyInstallments()` (inline — no method call needed for a count-only operation)
- [X] T018 [US2] Compute `$installmentAmount` as `floor($defaultFeeTotal * 100 / $installments) / 100` and add `billingCycle`, `installments`, and `installmentAmount` to the `return $this->success([...])` array in `getBillingPreview()` in `backend/app/Controllers/Api/LedgerController.php`

**Checkpoint**: Run `php spark test --filter BillingCycleTest` — all US2 tests pass. Call `GET /api/billing/preview?termId=...` manually and confirm new fields appear.

---

## Phase 5: User Story 3 — Billing Cycle Selector in Fee Structure UI (Priority: P1) 🎯 MVP

**Goal**: The Fee Structure settings page shows a billing cycle radio selector (Termly / Monthly). The selected value is saved with the fee structure and persists on page reload. The charge generation preview panel labels the active cycle.

**Independent Test**: Open Settings → Fee Structure, select Monthly, click Save Structure, reload page → selector shows Monthly. Open the charge generation preview → label reads "Billing cycle: Monthly".

### Implementation for User Story 3

- [X] T019 [US3] Add `updateBillingCycle(cycle: 'termly' | 'monthly') => void` callback to `useFeeStructure` hook in `frontend/src/hooks/useFeeStructure.ts` — updates `structure.structureType` in local state; expose in the hook's return object and add to `UseFeeStructureResult` interface
- [X] T020 [US3] Add billing cycle `RadioGroup` selector to `FeeStructureTab` in `frontend/src/components/settings/FeeStructureTab.tsx` — import `RadioGroup`, `RadioGroupItem`, `Label` from shadcn/ui; render above `DefaultFeesEditor`; bind value to `structure?.structureType ?? 'termly'`; call `updateBillingCycle` on change; include helper text explaining each option
- [X] T021 [US3] Add billing cycle label to the charge generation confirmation area in `frontend/src/components/settings/ChargeGenerationPanel.tsx` — render a small info row inside the generate dialog showing "Billing cycle: Monthly (installments per term)" or "Billing cycle: Termly" based on `structure?.structureType`; use existing `structure` prop already available in the component

**Checkpoint**: Open Settings → Fee Structure in browser. Toggle selector, save, reload — value persists. Open generate dialog — billing cycle label visible.

---

## Phase 6: Integration & Duplicate-Prevention Verification

**Purpose**: Cross-cutting concerns and guard rails that span both billing cycles.

- [X] T022 Write duplicate-prevention test in `backend/tests/Controllers/Billing/BillingCycleTest.php` — call `POST /api/billing/finalize` twice for same term under `monthly` mode; second call must return `alreadyGenerated: true` with no new charge rows inserted
- [X] T023 [P] Write tenant isolation test in `backend/tests/Controllers/Billing/BillingCycleTest.php` — generate charges for Tenant A under `monthly` mode; authenticate as Tenant B and assert no Tenant A charges are visible
- [X] T024 [P] Write invalid billing cycle rejection test in `backend/tests/Controllers/Billing/BillingCycleTest.php` — `PUT /api/settings/fee-structure` with `structureType: "annual"` → assert HTTP 400 and error message contains "Allowed: termly, monthly"

**Checkpoint**: All 16 integration tests pass: `php spark test --filter BillingCycleTest`. No regressions on existing billing tests.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final verification, documentation alignment, and code hygiene.

- [ ] T025 Run full quickstart.md verification checklist from `specs/047-fee-billing-cycle/quickstart.md` — manually confirm all 11 checkboxes against the running dev environment
- [X] T026 [P] Update `frontend/src/types/dashboard.ts` `FeeStructure` JSDoc comment to reflect that `structureType` now controls charge generation behaviour (not just a label) and that `custom`/`annual` are no longer valid values
- [X] T027 [P] Verify `ChargeGenerationPanel` description text in `frontend/src/components/settings/ChargeGenerationPanel.tsx` — update the `CardDescription` from "Generate fee charges for all active students based on the fee structure above" to reference the billing cycle (e.g., "Charges are split according to the configured billing cycle")
- [ ] T028 Review and run existing billing-related tests (if any) to confirm no regressions: `php spark test`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — **blocks all user story phases**
- **Phase 3 (US1 — Charge Generation)**: Depends on Phase 2 (`calculateMonthlyInstallments` helper at T004)
- **Phase 4 (US2 — Preview API)**: Depends on Phase 2 — independent of Phase 3
- **Phase 5 (US3 — UI)**: Depends on Phase 2 (T006 type change) — independent of Phases 3 & 4
- **Phase 6 (Integration)**: Depends on Phases 3, 4, and 5 all being complete
- **Phase 7 (Polish)**: Depends on Phase 6 all-green

### User Story Dependencies

- **US1 (P1)**: After Phase 2 — no dependency on US2 or US3
- **US2 (P1)**: After Phase 2 — no dependency on US1 or US3
- **US3 (P1)**: After Phase 2 — no dependency on US1 or US2
- **All three are independently testable** once Phase 2 is complete

### Within Each User Story

- Integration tests written before implementation (T007–T011 before T012–T014; T015–T016 before T017–T018)
- Backend helper (T004) before charge loop modification (T012–T014)
- Hook update (T019) before component update (T020) — `FeeStructureTab` depends on `useFeeStructure`
- `ChargeGenerationPanel` change (T021) is independent of T019–T020

---

## Parallel Execution Examples

### Phase 2 (can run in parallel after T004 complete)

```
T005 — SettingsController validation tightening  (backend only)
T006 — TypeScript type update                    (frontend only)
```

### Phase 3 + Phase 4 + Phase 5 (all can run in parallel after Phase 2)

```
Developer A: Phase 3 US1 — finalizeBilling monthly path (T007–T014)
Developer B: Phase 4 US2 — getBillingPreview extension  (T015–T018)
Developer C: Phase 5 US3 — FeeStructureTab UI           (T019–T021)
```

### Within Phase 3 — tests can run in parallel (T007–T011)

```
T007 — termly regression test
T008 — monthly happy-path test
T009 — rounding test
T010 — single-month term test
T011 — bursary + monthly test
```

### Within Phase 6 (can run in parallel)

```
T022 — duplicate prevention test
T023 — tenant isolation test
T024 — invalid billing cycle rejection test
```

---

## Implementation Strategy

### MVP First (All Three Stories are P1 — deliver together)

1. Complete **Phase 1**: Setup (T001–T003)
2. Complete **Phase 2**: Foundational (T004–T006) — **critical gate**
3. Complete **Phase 3** (US1) + **Phase 4** (US2) + **Phase 5** (US3) in parallel
4. Complete **Phase 6**: Integration verification (T022–T024)
5. **STOP and VALIDATE**: All integration tests green, quickstart checklist complete
6. Complete **Phase 7**: Polish (T025–T028)

### Solo Developer Order

1. Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7

### Minimal Viable Slice (backend only, no UI)

Deliver Phases 1–4 and T022–T024 to make the API fully functional, then add Phase 5 UI separately.

---

## Notes

- `[P]` tasks = different files, no conflicting dependencies within that phase
- All integration tests live in `backend/tests/Controllers/Billing/BillingCycleTest.php`
- No migrations, no new tables, no new service files — this is a focused enhancement
- Run `php spark test --filter BillingCycleTest` to verify at each checkpoint
- The `calculateMonthlyInstallments()` helper (T004) is the single most critical unit — validate it with the rounding test (T009) before building the loop (T013)
- Commit after each checkpoint to enable clean rollback if needed
