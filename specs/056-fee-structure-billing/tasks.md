# Tasks: School Fee Structure & Billing Engine

**Input**: Design documents from `/specs/056-fee-structure-billing/`  
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

**Total tasks**: 32 | **MVP scope**: Phase 1–4 (T001–T020, US1 + US2)

## Format: `[ID] [P?] [USn] Description`

- **[P]**: Can run in parallel (different files, no blocking dependencies)
- **[USn]**: User story this task belongs to
- All paths are relative to repository root

---

## Phase 1: Setup

**Purpose**: Confirm environment and branch are ready — no new project scaffolding needed for existing codebase

- [ ] T001 Confirm git branch `056-fee-structure-billing` is active and run `php spark migrate --dry-run` to verify no pending conflicts in `backend/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema and shared code that MUST exist before any user story begins

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T002 Create migration `backend/app/Database/Migrations/2026-05-01-000001_Create_fee_rules_table.php` — `fee_rules` table with fields: id (VARCHAR 50 PK), tenant_id (VARCHAR 50 NOT NULL), name (VARCHAR 255 NOT NULL), amount (DECIMAL 12,2 NOT NULL), assignment_scope_type (ENUM school_wide/class/category/service), assignment_scope_id (VARCHAR 50 NULL), is_active (TINYINT 1 DEFAULT 1), created_by (VARCHAR 50 NULL), created_at, updated_at; UNIQUE KEY `uq_fee_rules_tenant_name (tenant_id, name)`; INDEX `idx_fee_rules_tenant_active (tenant_id, is_active)` — include both `up()` and `down()`
- [x] T003 Create migration `backend/app/Database/Migrations/2026-05-01-000002_Add_fee_rule_id_to_charges.php` — add nullable `fee_rule_id` (VARCHAR 50) and `billing_period` (VARCHAR 20) columns to `charges` table; add UNIQUE KEY `uq_charges_student_rule_period (student_id, fee_rule_id, billing_period)`; add INDEX `idx_charges_tenant_rule_period (tenant_id, fee_rule_id, billing_period)` — include both `up()` and `down()`; guard all adds with `fieldExists()` checks
- [x] T004 [P] Create `backend/app/Models/FeeRuleModel.php` — extends `CodeIgniter\Model`; table `fee_rules`; allowedFields: id, tenant_id, name, amount, assignment_scope_type, assignment_scope_id, is_active, created_by, created_at, updated_at; implement `getByTenant(string $tenantId): array` (active rules only), `findByIdAndTenant(string $id, string $tenantId): ?array`, `getActiveByTenant(string $tenantId): array`; `formatForApi(array $rule): array` (snake_case → camelCase + `assignmentScopeLabel` derived from type)
- [x] T005 [P] Update `backend/app/Models/ChargeModel.php` — add `'fee_rule_id'` and `'billing_period'` to `$allowedFields` array; add `feeRuleId` and `billingPeriod` fields to `formatForApi()` output; add `formatFromApi()` mappings for `fee_rule_id` and `billing_period`
- [x] T006 Register routes in `backend/app/Config/Routes.php` under the `// ==================== Fee Rules ====================` comment block: `GET api/fee-rules` → `FeeRuleController::index`; `POST api/fee-rules` → `FeeRuleController::store`; `PUT api/fee-rules/(:segment)` → `FeeRuleController::update/$1`; `DELETE api/fee-rules/(:segment)` → `FeeRuleController::destroy/$1`; `GET api/fee-rules/billing-meta` → `FeeRuleController::billingMeta`; `POST api/fee-rules/generate` → `FeeRuleController::generate`; `GET api/fee-rules/unbilled-alert` → `FeeRuleController::unbilledAlert`
- [x] T007 [P] Add TypeScript interfaces and stub API functions to `frontend/src/api/api.ts` — interfaces: `FeeRule { id, name, amount, assignmentScopeType, assignmentScopeId, assignmentScopeLabel, isActive, createdAt }`; `CreateFeeRulePayload { name, amount, assignmentScopeType, assignmentScopeId? }`; `FeeRuleRuleBreakdown { feeRuleId, feeRuleName, charged, skipped, subtotal }`; `FeeRuleSkippedDetail { feeRuleId, feeRuleName, studentId, studentName, reason }`; `FeeRuleGenerationResult { billingPeriod, chargesCreated, studentsBilled, studentsSkipped, totalAmount, ruleBreakdown, skippedDetails }`; `BillingMetaResponse { billingCycle, currentPeriod, currentPeriodLabel, hasActiveTerm }`; `UnbilledAlertResponse { billingCycle, currentPeriod, currentPeriodLabel, unbilledCount, hasAlert }` — stub functions: `getFeeRules()`, `createFeeRule()`, `updateFeeRule()`, `deleteFeeRule()`, `getBillingMeta()`, `generateFeeRuleCharges()`, `getUnbilledAlert()` pointing to `/api/fee-rules` paths

**Checkpoint**: Run `php spark migrate` — both new migrations apply cleanly; `php -l` on ChargeModel and new FeeRuleModel passes

---

## Phase 3: User Story 1 — Define Fee Rules (Priority: P1) 🎯 MVP

**Goal**: Admin can create, edit, and delete named fee rules in the fee structure settings page; bursar can view rules only

**Independent Test**: Navigate to Settings → Fee Structure tab → create a "Tuition" rule ($150, school-wide) → verify it persists on reload; edit amount to $160 → verify updated; delete it → verify removed. Repeat as bursar: confirm no add/edit/delete controls visible.

- [x] T008 [P] Write integration test class `FeeRuleCrudTest` in `backend/tests/Integration/FeeRuleBillingTest.php` — test cases (all using seeded tenant + admin/bursar JWTs): (1) `testListRulesAsAdmin` — GET `/api/fee-rules` returns 200 + array; (2) `testListRulesAsBursar` — 200 (read allowed); (3) `testCreateRuleSuccess` — POST with valid payload returns 201 + rule data; (4) `testCreateDuplicateNameReturns409` — second POST with same name returns 409; (5) `testCreateWithoutAmountReturns400`; (6) `testBursarCannotCreateReturns403`; (7) `testUpdateRuleSuccess` — PUT returns 200 + updated amount; (8) `testDeleteRuleSuccess` — DELETE returns 200; (9) `testTenantIsolation` — rule from tenant A not visible to tenant B
- [x] T009 [P] [US1] Create `backend/app/Controllers/Api/FeeRuleController.php` — extends `BaseController`; `index()`: requires admin/bursar role, calls `FeeRuleModel::getByTenant()`, returns `$this->success($formatted)`; `store()`: requires admin role, validates name+amount+assignmentScopeType, validates scopeId required for non-school-wide, checks name uniqueness via model, inserts, returns 201; `update(string $id)`: requires admin, validates, updates, returns 200; `destroy(string $id)`: requires admin, calls model delete, returns 200; all methods use `try/catch` with `log_message('error', ...)` and `$this->serverError()`
- [x] T010 [P] [US1] Implement `getFeeRules()`, `createFeeRule(payload)`, `updateFeeRule(id, payload)`, `deleteFeeRule(id)` in `frontend/src/api/api.ts` — wire to correct HTTP methods and paths; ensure TypeScript types used throughout
- [x] T011 [US1] Create `frontend/src/hooks/useFeeRules.ts` — `useQuery(['feeRules'], api.getFeeRules, { staleTime: 60_000 })`; `useCreateFeeRule()` mutation with `onSuccess: () => queryClient.invalidateQueries(['feeRules'])`; `useUpdateFeeRule()` mutation; `useDeleteFeeRule()` mutation — export as named exports
- [x] T012 [P] [US1] Create `frontend/src/components/settings/FeeRuleModal.tsx` — shadcn Dialog with controlled open state; form fields: name (Input), amount (Input type=number), assignmentScopeType (Select: school_wide/class/category/service); conditional assignmentScopeId selector (class Select populated from `api.getClasses()`, category text input, service Select with "transport"); client-side validation (non-empty name, amount > 0, scopeId required when not school_wide); props: `mode: 'create'|'edit'`, `rule?: FeeRule`, `onSuccess: () => void`; calls `useCreateFeeRule` or `useUpdateFeeRule` on submit; shows toast on success/error
- [x] T013 [US1] Create `frontend/src/components/settings/FeeRulesPanel.tsx` — uses `useFeeRules()` hook; renders table with columns: Name, Amount, Scope, Actions; admin-only "Add Fee Rule" button opens `FeeRuleModal` in create mode; admin-only Edit/Delete buttons per row; Delete shows shadcn AlertDialog confirmation; loading Skeleton state; empty state message "No fee rules configured yet"; bursar sees table without action controls
- [x] T014 [US1] Modify `frontend/src/components/settings/FeeStructureTab.tsx` — import and render `<FeeRulesPanel />` as a new section below the existing fee structure settings with a "Fee Rules" heading and descriptive subtitle

**Checkpoint**: US1 fully functional — all integration tests in T008 pass; admin CRUD confirmed in browser; bursar view-only confirmed

---

## Phase 4: User Story 2 — Generate Student Charges via Billing Engine (Priority: P1) 🎯 MVP

**Goal**: Admin/bursar opens billing tab, sees period selector driven by school billing cycle, confirms generation, billing engine creates charges and shows summary

**Independent Test**: Define one "Tuition" ($150, school-wide) fee rule; navigate to billing tab; if monthly school → month selector shows; click Generate for current month; verify charges created count equals active student count; verify each student has a charge with `fee_rule_id` set and `billing_period = 'YYYY-MM'`.

- [x] T015 [P] Add generation test cases to `FeeRuleBillingTest.php` in `backend/tests/Integration/` — (1) `testGenerateMonthlyHappyPath` — seeds school-wide rule + 3 active students, POST `/api/fee-rules/generate` with `billingPeriod: 'YYYY-MM'` returns 200, `chargesCreated: 3`; (2) `testGenerateTermlyHappyPath` — seeds termly school with active term, generates for term_id, chargesCreated > 0; (3) `testNoFeeRulesReturns404`; (4) `testPeriodTypeMismatchReturns422` — monthly school receives term_id period; (5) `testBillingMetaMonthly` — GET `/api/fee-rules/billing-meta` returns billingCycle=monthly, currentPeriod=YYYY-MM; (6) `testBillingMetaTermlyNoActiveTerm` — termly school with no active term returns currentPeriod=null
- [x] T016 [US2] Create `backend/app/Services/FeeRuleBillingService.php` — `resolveBillingCycle(string $tenantId): string` reads `tenants.fee_structure.structureType`; `validateBillingPeriod(string $tenantId, string $billingPeriod): void` — detects period type (YYYY-MM vs non-date string), compares to cycle, throws `\InvalidArgumentException` with 422 hint on mismatch; `getEligibleStudents(string $tenantId, array $feeRule): array` — switch on `assignment_scope_type`: `school_wide` → all active students; `class` → students where `class_id = assignment_scope_id`; `category` → students where `category = assignment_scope_id`; `service` → empty array (stub for P2); `generateCharges(string $tenantId, string $billingPeriod, string $userId): array` — calls `validateBillingPeriod`, loads all active fee rules, calls `getEligibleStudents` per rule, wraps inserts in `$db->transBegin()` / `transCommit()` with `transRollback()` on exception; inserts use `INSERT IGNORE` or catches duplicate-key to populate `skippedDetails`; returns `GenerationResult` array per data-model.md spec
- [x] T017 [US2] Add `generate()` and `billingMeta()` methods to `backend/app/Controllers/Api/FeeRuleController.php` — `billingMeta()`: requires admin/bursar, instantiates service, calls `resolveBillingCycle`, uses `AcademicCalendarService::getCurrentTerm()` for termly, builds response per contract; `generate()`: requires admin/bursar, reads `billingPeriod` from JSON body, calls `FeeRuleBillingService::generateCharges()`, returns result; catches `\InvalidArgumentException` as 422
- [x] T018 [P] [US2] Implement `getBillingMeta()` and `generateFeeRuleCharges(payload)` in `frontend/src/api/api.ts` — correct return types `BillingMetaResponse` and `FeeRuleGenerationResult`
- [x] T019 [US2] Create `frontend/src/components/settings/FeeRuleGenerationPanel.tsx` — on mount, calls `getBillingMeta()` via `useQuery`; if `billingCycle = 'monthly'`: renders month+year picker (month Select + year numeric input or a date-month input); if `billingCycle = 'termly'`: renders term Select populated from `api.getSettings()` academic calendar terms; "Generate Charges" button disabled until period selected; on confirm, calls `generateFeeRuleCharges()`; on success renders result card: charges created, students billed, total amount, rule breakdown table, skipped details list; on error shows destructive Alert; loading spinner during generation
- [x] T020 [US2] Modify `frontend/src/components/settings/BillingTab.tsx` — import and render `<FeeRuleGenerationPanel />` as the primary charge generation section, replacing or supplementing the existing generation UI; ensure existing billing preview/finalize functionality is preserved below

**Checkpoint**: US2 fully functional — integration tests T015 all pass; browser: admin generates charges for current period, summary displayed; charges table shows new records with `fee_rule_id` set

---

## Phase 5: User Story 3 — Duplicate Prevention & Unbilled Alerts (Priority: P2)

**Goal**: Re-running generation skips already-billed students; billing tab shows count of unbilled eligible students

**Independent Test**: Generate charges for current period → all students billed (chargesCreated = N, studentsSkipped = 0). Generate again for same period → chargesCreated = 0, studentsSkipped = N, all listed in skippedDetails with reason "already_billed". Open billing tab before any generation → unbilled alert badge shows correct count. After full generation → badge shows 0 or is hidden.

- [x] T021 [P] Add duplicate-prevention and alert test cases to `FeeRuleBillingTest.php` in `backend/tests/Integration/` — (1) `testSecondRunSkipsAll` — generate twice, second run: chargesCreated=0, studentsSkipped=N; (2) `testPartialRun` — generate for 2 of 3 students (seed charges manually), generate again: only the third billed; (3) `testUnbilledAlertBeforeGeneration` — GET `/api/fee-rules/unbilled-alert` returns hasAlert=true, unbilledCount > 0; (4) `testUnbilledAlertAfterFullGeneration` — after generating all, alert returns hasAlert=false; (5) `testUnbilledAlertTermlyNoActiveTerm` — termly school without active term returns hasAlert=false, unbilledCount=0
- [x] T022 [US3] Add `getUnbilledCount(string $tenantId): array` to `backend/app/Services/FeeRuleBillingService.php` — resolve current period (monthly: `date('Y-m')`; termly: `AcademicCalendarService::getCurrentTerm()['id']` or null if none); if no period → return `[unbilledCount=>0, hasAlert=>false, currentPeriod=>null, ...]`; load all active fee rules; collect all eligible student IDs across all rules (union, deduped); query `charges` for student IDs that already have `fee_rule_id IS NOT NULL AND billing_period = currentPeriod`; unbilledCount = total eligible − already billed; return full response shape per contract
- [x] T023 [US3] Add `unbilledAlert()` method to `backend/app/Controllers/Api/FeeRuleController.php` — requires admin/bursar; calls `FeeRuleBillingService::getUnbilledCount()`; wraps in `try/catch`; returns `$this->success($result)`
- [x] T024 [P] [US3] Implement `getUnbilledAlert()` in `frontend/src/api/api.ts` — GET `/api/fee-rules/unbilled-alert`, returns `UnbilledAlertResponse`
- [x] T025 [US3] Update `frontend/src/components/settings/FeeRuleGenerationPanel.tsx` — add `useQuery(['unbilledAlert'], api.getUnbilledAlert, { staleTime: 30_000 })` on mount; render Alert banner at panel top when `hasAlert: true` — "X students have not been billed for [currentPeriodLabel]"; invalidate `['unbilledAlert']` query after successful generation; update generation result card to show `skippedDetails` table (student name, fee rule, reason) when `studentsSkipped > 0`

**Checkpoint**: US3 fully functional — duplicate prevention tested; unbilled alert appears before generation and clears after

---

## Phase 6: User Story 4 — Assign Fees by Service Enrollment (Priority: P2)

**Goal**: Fee rules scoped to "service" (e.g., transport) only bill students with an active service enrollment in the billing period

**Independent Test**: Create "Transport Fee" ($50, service scope = transport). Enroll 2 students in transport, leave 1 unenrolled. Generate charges → only 2 transport-enrolled students receive the transport charge. End one student's assignment before the billing period starts → that student is excluded.

- [x] T026 [P] Add service scope test cases to `FeeRuleBillingTest.php` in `backend/tests/Integration/` — (1) `testServiceScopeTransportBillsEnrolled` — seed transport_assignment for 2 of 3 students, generate with service-scoped rule → chargesCreated=2; (2) `testServiceScopeExcludesEndedAssignment` — assignment end date before billing period start → student excluded; (3) `testServiceScopeExcludesInactiveStudent` — transport-enrolled but student status=inactive → excluded; (4) `testMultipleServiceRulesSeparateCharges` — 2 service rules → enrolled student gets 2 charges
- [x] T027 [US4] Update `getEligibleStudents()` in `backend/app/Services/FeeRuleBillingService.php` — replace stub `service` case: query `transport_assignments` table where `tenant_id = $tenantId AND is_active = 1`; for monthly billing period: filter assignments whose date range overlaps the month (assigned_at ≤ last day of month AND (end_date IS NULL OR end_date ≥ first day of month)); join to `students` table to verify `status = 'active'`; return eligible student rows; add a `resolveMonthDateRange(string $billingPeriod): array` helper that returns `[firstDay, lastDay]` for `'YYYY-MM'` format
- [x] T028 [US4] Update `frontend/src/components/settings/FeeRuleModal.tsx` — ensure "Service" option in assignment scope type selector is fully wired: when selected, show a service dropdown with at minimum "Transport" option (value: `transport`); remove any stub/TODO placeholder left from T012

**Checkpoint**: US4 fully functional — service-scoped fee rules correctly target transport-enrolled students only

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Quality gates, lint, and integration test validation

- [x] T029 [P] PHP lint all new and modified backend files — run `php -l` on: `backend/app/Controllers/Api/FeeRuleController.php`, `backend/app/Models/FeeRuleModel.php`, `backend/app/Services/FeeRuleBillingService.php`, both new migration files, `backend/app/Models/ChargeModel.php` — all must exit 0
- [x] T030 [P] TypeScript type-check frontend — run `cd frontend && npx tsc --noEmit` — 0 errors; covers: `api.ts`, `useFeeRules.ts`, `FeeRulesPanel.tsx`, `FeeRuleModal.tsx`, `FeeRuleGenerationPanel.tsx`, modified `BillingTab.tsx`, modified `FeeStructureTab.tsx`
- [x] T031 [P] ESLint new frontend files — run `cd frontend && npx eslint src/components/settings/FeeRulesPanel.tsx src/components/settings/FeeRuleModal.tsx src/components/settings/FeeRuleGenerationPanel.tsx src/hooks/useFeeRules.ts` — 0 errors
- [~] T032 Run full integration test suite — `cd backend && ./vendor/bin/phpunit tests/Integration/FeeRuleBillingTest.php --testdox` — all test cases PASS; verify quickstart.md scenarios manually end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Phase 2 (T002, T003, T004, T005, T006, T007)
- **US2 (Phase 4)**: Depends on Phase 2 + US1 service/model (T004); US1 UI not required
- **US3 (Phase 5)**: Depends on US2 (T016 service) — adds `getUnbilledCount` to existing service
- **US4 (Phase 6)**: Depends on US2 (T016 service `getEligibleStudents` stub) — extends service only
- **Polish (Phase 7)**: Depends on all desired user stories complete

### User Story Dependencies

| Story | Depends on | Independently Testable? |
|-------|-----------|------------------------|
| US1 (P1) | Phase 2 only | ✅ Yes — CRUD works without billing engine |
| US2 (P1) | Phase 2 + FeeRuleModel (T004) | ✅ Yes — can seed rules via DB if US1 UI not done |
| US3 (P2) | US2 service (T016) | ✅ Yes — builds on existing `generateCharges` |
| US4 (P2) | US2 service (T016) | ✅ Yes — replaces service stub only |

### Within Each Phase (parallelisable tasks)

- **Phase 2**: T002 ∥ T003 ∥ T004 ∥ T005 ∥ T006 ∥ T007 (all different files)
- **Phase 3**: T008 ∥ T009 ∥ T010 ∥ T012 (then T011 after T010, T013 after T011/T012, T014 after T013)
- **Phase 4**: T015 ∥ T016 ∥ T018 (then T017 after T016, T019 after T018, T020 after T019)
- **Phase 5**: T021 ∥ T022 ∥ T024 (then T023 after T022, T025 after T022+T024)
- **Phase 6**: T026 ∥ T027 ∥ T028
- **Phase 7**: T029 ∥ T030 ∥ T031 (then T032 after all three)

---

## Parallel Execution Example: Phase 2 (Foundational)

```bash
# All of these can run simultaneously (different files):
Task T002: Create_fee_rules_table.php migration
Task T003: Add_fee_rule_id_to_charges.php migration
Task T004: FeeRuleModel.php
Task T005: ChargeModel.php update (allowedFields + formatForApi)
Task T006: Routes.php fee-rules block
Task T007: api.ts TypeScript interfaces + stubs
```

## Parallel Execution Example: Phase 3 (US1)

```bash
# Launch in parallel (different files, no blocking deps):
Task T008: Integration test skeleton (FeeRuleBillingTest.php)
Task T009: FeeRuleController.php CRUD methods
Task T010: api.ts CRUD functions
Task T012: FeeRuleModal.tsx

# After T010 completes:
Task T011: useFeeRules.ts hook

# After T011 + T012 complete:
Task T013: FeeRulesPanel.tsx

# After T013 completes:
Task T014: FeeStructureTab.tsx integration
```

---

## Implementation Strategy

### MVP First (US1 + US2 — Phase 1–4)

1. Complete **Phase 1** (T001)
2. Complete **Phase 2** (T002–T007) — run migrations, confirm DB schema
3. Complete **Phase 3** (T008–T014) — fee rule CRUD UI + API ✅ Stop and validate US1
4. Complete **Phase 4** (T015–T020) — billing engine + generation UI ✅ Stop and validate US2
5. **MVP DONE** — admins can define fees and generate charges

### Incremental P2 Delivery

6. Complete **Phase 5** (T021–T025) — duplicate prevention + unbilled alert
7. Complete **Phase 6** (T026–T028) — service-scoped fees (transport)
8. Complete **Phase 7** (T029–T032) — lint, type-check, full test run

### Single Developer Order

T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009 → T010 → T011 → T012 → T013 → T014 → T015 → T016 → T017 → T018 → T019 → T020 → T021 → T022 → T023 → T024 → T025 → T026 → T027 → T028 → T029 → T030 → T031 → T032

---

## Notes

- `[P]` tasks operate on different files — safe to assign to parallel agents or developers
- `[USn]` label maps each task to its user story for traceability to spec.md acceptance criteria
- Constitution Principle X requires integration tests — T008, T015, T021, T026 cover the full test suite
- Commit after each checkpoint (end of Phase 2, end of each user story phase)
- Do not modify existing `billing/finalize` flow — this feature introduces a parallel generation path only
- Existing charges without `fee_rule_id` are unaffected by the new UNIQUE constraint (NULL exemption)
