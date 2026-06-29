# Tasks: Payment & Billing UX Improvements

**Input**: Design documents from `/specs/057-payment-billing-ux/`  
**Prerequisites**: plan.md ✓ · spec.md ✓ · research.md ✓ · data-model.md ✓ · contracts/ ✓ · quickstart.md ✓

**Organization**: Tasks grouped by user story — each story is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: User story label (US1–US5) from spec.md
- Exact file paths included in every task description

---

## Phase 1: Setup

**Purpose**: Branch initialisation and migration scaffolding

- [ ] T001 Checkout branch `057-payment-billing-ux` and confirm clean working tree
- [ ] T002 [P] Create migration file `backend/app/Database/Migrations/2026-05-04-000001_Add_receipt_number_and_snapshot_to_payments.php` (empty scaffold only — up/down stubs)
- [ ] T003 [P] Create migration file `backend/app/Database/Migrations/2026-05-04-000002_Widen_fee_rule_scope_id_to_text.php` (empty scaffold only — up/down stubs)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema changes and shared constants that all user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Implement `up()` / `down()` in `backend/app/Database/Migrations/2026-05-04-000001_Add_receipt_number_and_snapshot_to_payments.php` — add `receipt_number VARCHAR(25) NULL` after `balance_after_payment`, add `snapshot JSON NULL` after `receipt_number`, add unique index `uq_payments_receipt_number(tenant_id, receipt_number)` with `fieldExists` guards (see data-model.md Migration 1)
- [ ] T005 Implement `up()` / `down()` in `backend/app/Database/Migrations/2026-05-04-000002_Widen_fee_rule_scope_id_to_text.php` — `ALTER TABLE fee_rules MODIFY COLUMN assignment_scope_id TEXT NULL` with updated comment (see data-model.md Migration 2)
- [ ] T006 Run `php spark migrate` and verify both migrations show `[up]` in `php spark migrate:status`
- [ ] T007 [P] Create `backend/app/Config/PaymentCategories.php` — define `SYSTEM_CATEGORIES` constant array with `__fees/Fees`, `__transport/Transport`, `__transport_fees/Transport + Fees` entries each having `id`, `name`, `system: true` fields
- [ ] T008 [P] Create `frontend/src/constants/paymentCategories.ts` — define `SYSTEM_PAYMENT_CATEGORIES` as `const` array with same three entries; export `SystemPaymentCategory` type and `isSystemCategory(id: string): boolean` helper
- [ ] T009 [P] Update `frontend/src/api/api.ts` — add `receiptNumber: string | null` and `snapshot: PaymentSnapshot | null` to `Payment` interface; add `PaymentSnapshot` interface with fields `studentName`, `className`, `balanceBefore`, `paymentMethod`, `paymentDate`, `amount`, `category`; change `FeeRule.assignmentScopeId` and `FeeRuleInput.assignmentScopeId` to `string | string[] | null`; add `system?: boolean` to `PaymentCategory` interface

**Checkpoint**: Migrations applied, constants defined, TypeScript interfaces updated — user story implementation can begin

---

## Phase 3: US1 — Ungenerated Charges Alert on Payments Page (Priority: P1) 🎯 MVP

**Goal**: When fee-rule charges have not been generated for the current billing period, a dismissible alert banner appears on the Payments page with a "Generate Charges" CTA.

**Independent Test**: Navigate to the Payments page with at least one fee rule that has `unbilledStudentCount > 0`. Banner should appear. After clicking "Generate Charges", user is navigated to the Fee Rules settings tab. After generation, banner disappears.

### Implementation for US1

- [ ] T010 [P] [US1] Locate the Payments page component (check `frontend/src/pages/` or `frontend/src/admin/` for a file matching Payments/payments) — record the exact file path for use in T011
- [ ] T011 [US1] Add unbilled alert banner to the Payments page (`frontend/src/pages/[Payments].tsx` or equivalent, path confirmed in T010) — import `useFeeRules` hook (or a dedicated `useUnbilledAlert` thin hook calling `api.getFeeRuleUnbilledAlert()`), render a dismissible shadcn/ui `Alert` when `unbilledAlert?.unbilledStudentCount > 0` showing billing period, unbilled count, and a "Generate Charges" `Button` that navigates to `/settings?tab=fee-rules` (or equivalent route); dismiss state stored in local `useState`
- [ ] T012 [US1] Write integration test case in `backend/tests/Integration/PaymentBillingUxTest.php` — `testUnbilledAlertEndpointReturnsCounts`: verify `GET /api/fee-rules/unbilled-alert` returns `billingPeriod`, `eligibleStudentCount`, `unbilledStudentCount` for a tenant with at least one active fee rule and unbilled students

**Checkpoint**: Payments page shows alert when unbilledStudentCount > 0; alert is dismissible; CTA navigates to correct settings tab

---

## Phase 4: US2 — Multi-Class Fee Rule Scope (Priority: P1) 🎯 MVP

**Goal**: When creating or editing a fee rule with scope type "Class", the user can select multiple classes. The scope column in the fee rules table shows resolved class names (not IDs).

**Independent Test**: Create a fee rule scoped to two classes. The fee rules table scope column shows both class names. Edit the rule — both classes are pre-selected in the multi-select. Generate charges — students in both classes receive charges.

### Implementation for US2 — Backend

- [ ] T013 [P] [US2] Add `decodeScopeId(string $raw): string|array` method to `backend/app/Models/FeeRuleModel.php` — `json_decode($raw, true)` returns array if valid JSON array, else returns the raw string; update `buildScopeLabel()` to return `"class:{$scopeId}"` prefix (machine-readable) for class scope, preserving other scope type labels unchanged
- [ ] T014 [P] [US2] Update `backend/app/Controllers/Api/FeeRuleController.php` — in `normaliseScopeId()`: if `assignmentScopeType = "class"` and the incoming `assignmentScopeId` value is a PHP array, `json_encode` it before storing; in `validatePayload()`: when scope is `class` and `assignmentScopeId` is an array, validate each element is a non-empty string and the array is not empty (422 if empty array)
- [ ] T015 [US2] Update `backend/app/Services/FeeRuleBillingService.php` — in `getEligibleStudents()`, class branch: call `FeeRuleModel::decodeScopeId($scopeId)` (or inline equivalent); if result is an array use `$builder->whereIn('class_id', $classIds)`, if scalar use `$builder->where('class_id', $scopeId)` (existing behaviour)

### Implementation for US2 — Frontend

- [ ] T016 [P] [US2] Update `frontend/src/components/modals/FeeRuleModal.tsx` — replace the single `<Select>` for class scope with a multi-select component (shadcn/ui `Popover` + `Command` checkboxes pattern, or equivalent); `scopeId` state becomes `string[]`; serialise as JSON array when passing to `FeeRuleInput.assignmentScopeId`; deserialise incoming `assignmentScopeId` (parse JSON array or wrap scalar in array) on modal open for edit mode
- [ ] T017 [US2] Update `frontend/src/components/settings/FeeRulesPanel.tsx` — in the scope column renderer: when `rule.assignmentScopeType === 'class'`, parse `assignmentScopeId` (JSON array or scalar) and resolve each class ID to its name from the local `classes` list; display as comma-joined names; fall back to raw ID if class not found in list
- [ ] T018 [US2] Write integration test cases in `backend/tests/Integration/PaymentBillingUxTest.php` — `testCreateFeeRuleWithMultipleClasses`: `POST /api/fee-rules` with `assignmentScopeId: ["cls1","cls2"]`, assert 201 and `assignmentScopeId` is array in response; `testMultiClassBillingGeneratesChargesForBothClasses`: generate charges with multi-class rule, assert students in both classes get charges; `testEmptyClassArrayIsRejected`: assert 422 when `assignmentScopeId: []`

**Checkpoint**: Fee rule modal accepts multiple classes; scope column shows names; billing engine charges students in all selected classes

---

## Phase 5: US3 — System Payment Categories (Priority: P1) 🎯 MVP

**Goal**: Three system categories (`Fees`, `Transport`, `Transport + Fees`) appear at the top of the categories list with a visual lock indicator and cannot be edited or deleted. The `TRANSPORT_CATEGORIES` hard-coding in `RecordPaymentModal.tsx` is removed.

**Independent Test**: Open Settings → Payment Categories. The three system categories appear first with a lock/badge. Edit and Delete are disabled for them. Attempt `DELETE /api/settings/payment-categories/__fees` → 404 (ID not in DB). Attempt to create a category named "Fees" → 409. User-defined categories still work normally.

### Implementation for US3 — Backend

- [ ] T019 [P] [US3] Update `backend/app/Controllers/Api/SettingsController.php` `getPaymentCategories()` — import `PaymentCategories` config; prepend `SYSTEM_CATEGORIES` (with `tenantId` injected) to the fetched user categories array before returning; each system entry has `system: true`
- [ ] T020 [P] [US3] Update `backend/app/Controllers/Api/SettingsController.php` `createPaymentCategory()` — after duplicate-name check, add guard: if `strtolower(trim($data['name']))` matches any system category name (case-insensitive), return `$this->error('Cannot create a category with a reserved system name', 409)`
- [ ] T021 [P] [US3] Update `backend/app/Controllers/Api/SettingsController.php` `updatePaymentCategory()` — add guard: if the existing category's `name` or the submitted `name` matches a system name (case-insensitive), return `$this->error('System categories cannot be modified', 403)`
- [ ] T022 [P] [US3] Update `backend/app/Controllers/Api/SettingsController.php` `deletePaymentCategory()` — add guard: if the found category's `name` matches a system name (case-insensitive), return `$this->error('System categories cannot be deleted', 403)`

### Implementation for US3 — Frontend

- [ ] T023 [P] [US3] Update `frontend/src/components/settings/PaymentCategoriesTab.tsx` — use `isSystemCategory(cat.id)` or `cat.system === true` to conditionally disable Edit and Delete buttons for system category rows; render a `Badge` or lock icon alongside system category names
- [ ] T024 [US3] Update `frontend/src/components/modals/RecordPaymentModal.tsx` — remove the hard-coded `TRANSPORT_CATEGORIES` constant and the client-side prepend logic; system categories are now returned from `api.getPaymentCategories()` with `system: true`; render system categories at the top of the dropdown with a visual distinction (e.g. separator or muted label)
- [ ] T025 [US3] Write integration test cases in `backend/tests/Integration/PaymentBillingUxTest.php` — `testGetPaymentCategoriesInjectsSystemCategories`: assert response includes `__fees`, `__transport`, `__transport_fees` with `system: true` at the start; `testCannotCreateCategoryWithSystemName`: assert 409 when creating "Fees" or "Transport"; `testCannotDeleteSystemCategoryByName`: assert 403 when attempting to delete a category whose name is "Transport"

**Checkpoint**: System categories are returned by the API, protected from mutation, and visually distinguished in the UI; hard-coded TRANSPORT_CATEGORIES removed from RecordPaymentModal

---

## Phase 6: US4 — Receipt Number Generation (Priority: P2)

**Goal**: Every new payment is assigned a human-readable receipt number in `YYYY.MM.DD.HHmmss.X` format (e.g. `2026.05.04.143022.K`). The number is displayed on receipts and in payment lists.

**Independent Test**: Record a new payment. The API response includes `receiptNumber` in format matching `^\d{4}\.\d{2}\.\d{2}\.\d{6}\.[A-Z]$`. Open the receipt URL — receipt number is displayed. Retrieve a legacy payment — `receiptNumber` is null; receipt falls back to payment ID display.

### Implementation for US4 — Backend

- [ ] T026 [US4] Update `backend/app/Controllers/Api/PaymentController.php` `create()` — before building `$paymentData`, generate `$receiptNumber = date('Y.m.d.His') . '.' . chr(random_int(65, 90))`; add `'receipt_number' => $receiptNumber` to `$paymentData` array (migration T004 already added the column)
- [ ] T027 [US4] Update `backend/app/Models/PaymentModel.php` — add `receipt_number` to `$allowedFields`; in `formatForApi()` add `'receiptNumber' => $payment['receipt_number'] ?? null`
- [ ] T028 [US4] Write integration test cases in `backend/tests/Integration/PaymentBillingUxTest.php` — `testNewPaymentHasReceiptNumber`: `POST /api/payments`, assert `receiptNumber` in response matches regex `^\d{4}\.\d{2}\.\d{2}\.\d{6}\.[A-Z]$`; `testReceiptNumberAppearsOnReceiptEndpoint`: `GET /api/receipts/:id`, assert `payment.receiptNumber` is present and matches same regex

### Implementation for US4 — Frontend

- [ ] T029 [P] [US4] Update `frontend/src/components/modals/RecordPaymentModal.tsx` (or the payment list component that displays payment rows) — display `payment.receiptNumber` where receipt reference is shown; fall back to `payment.id` when `receiptNumber` is null
- [ ] T030 [P] [US4] Update the receipt page/component that renders `GET /api/receipts/:id` response — display `receiptNumber` prominently (e.g. "Receipt #2026.05.04.143022.K") if present; fall back to payment ID label for legacy payments

**Checkpoint**: New payments carry a formatted receipt number visible on the receipt page and in payment history; legacy payments degrade gracefully

---

## Phase 7: US5 — Payment Snapshot (Priority: P2)

**Goal**: When a payment is recorded, a JSON snapshot capturing `studentName`, `className`, `balanceBefore`, `paymentMethod`, `paymentDate`, `amount`, and `category` is stored atomically. The receipt always shows the class name at the time of payment, even after class renames.

**Independent Test**: Record a payment for a student in class "Form 3A". Rename the class to "Form 3B". Retrieve the receipt — class name shows "Form 3A". Retrieve the payment record — `snapshot.className` is "Form 3A".

### Implementation for US5 — Backend

- [ ] T031 [US5] Update `backend/app/Controllers/Api/PaymentController.php` `create()` — inside the `$db->transBegin()` block, before inserting the payment: (1) fetch the student row to get `first_name`, `last_name`, `class_id`; (2) fetch the class name from `classes` where `id = student.class_id`; (3) call `LedgerService::getStudentBalance()` to get `balanceBefore`; (4) build `$snapshot = json_encode([...])` with all required fields; (5) add `'snapshot' => $snapshot` to `$paymentData`; ensure this runs before `$this->paymentModel->insert($paymentData)`
- [ ] T032 [US5] Update `backend/app/Models/PaymentModel.php` — add `snapshot` to `$allowedFields`; in `formatForApi()` add `'snapshot' => isset($payment['snapshot']) ? json_decode($payment['snapshot'], true) : null`
- [ ] T033 [US5] Update `backend/app/Controllers/Api/ReceiptController.php` `show()` — after fetching `$student` via live JOIN, if `$formatted['snapshot']` is non-null and has `className`, override `$student['class_name']` (or the equivalent key in the student array passed to the response) with `$formatted['snapshot']['className']`
- [ ] T034 [US5] Write integration test cases in `backend/tests/Integration/PaymentBillingUxTest.php` — `testPaymentSnapshotIsPersisted`: record payment, assert `snapshot` in response has all 7 fields with correct values; `testReceiptShowsSnapshotClassName`: record payment for student in class "Alpha", rename class to "Beta", `GET /api/receipts/:id`, assert `student.className` = "Alpha"; `testLegacyPaymentWithoutSnapshotFallsBack`: retrieve an old payment with null snapshot via receipt endpoint, assert no 500 error and class name is from live JOIN

### Implementation for US5 — Frontend

- [ ] T035 [P] [US5] Update receipt display component — when `payment.snapshot` is present, prefer `payment.snapshot.className` and `payment.snapshot.balanceBefore` over any live-data equivalents; display "Balance before payment" field using `snapshot.balanceBefore` if available
- [ ] T036 [P] [US5] Update payment history/ledger display (student profile or payments list) — if `payment.snapshot?.className` is present, show it as the class name on that payment row with a tooltip noting it reflects the class at time of payment

**Checkpoint**: Snapshot is stored on all new payments; receipt class name is immutable post-class-rename; legacy payments degrade gracefully without errors

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Integration validation, lint, type-check, and final smoke test

- [ ] T037 [P] Run `php -l` on all modified backend files: `PaymentController.php`, `ReceiptController.php`, `SettingsController.php`, `FeeRuleController.php`, `PaymentModel.php`, `FeeRuleModel.php`, `FeeRuleBillingService.php`, `PaymentCategories.php` — all must return no syntax errors
- [ ] T038 [P] Run `cd frontend && bun run tsc --noEmit` — zero TypeScript errors
- [ ] T039 [P] Run `cd frontend && bun run lint` on modified files — zero ESLint errors
- [ ] T040 Run full integration test suite `cd backend && php spark test --filter PaymentBillingUxTest` — all test cases pass
- [ ] T041 Run quickstart.md smoke test checklist manually against a dev environment — all 5 US checkboxes pass
- [ ] T042 Commit all changes with message `feat(057): payment billing UX improvements`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately; T002 and T003 are parallel
- **Phase 2 (Foundational)**: Depends on Phase 1 — T004 and T005 can run in parallel; T006 depends on T004+T005; T007, T008, T009 can run in parallel after T001
- **Phase 3 (US1)**: Depends on Phase 2 complete — T010 and T012 can run in parallel with T011
- **Phase 4 (US2)**: Depends on Phase 2 complete — T013, T014, T016 can run in parallel; T015 depends on T013; T017 depends on T016
- **Phase 5 (US3)**: Depends on Phase 2 complete — T019–T022 can run in parallel; T023, T024 can run in parallel with T019–T022
- **Phase 6 (US4)**: Depends on T004 (column exists) and T009 (type updated) — T026 → T027; T029 and T030 parallel
- **Phase 7 (US5)**: Depends on T004 (column exists) and T009 (type updated) — T031 → T032 → T033; T035 and T036 parallel
- **Phase 8 (Polish)**: Depends on all user story phases complete

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 2 — no schema changes needed, can start as soon as T009 is done
- **US2 (P1)**: Depends on Phase 2 (T005 widen column, T009 types) — can proceed in parallel with US1
- **US3 (P1)**: Depends on Phase 2 (T007 backend constant, T008 frontend constant, T009 types) — can proceed in parallel with US1, US2
- **US4 (P2)**: Depends on T004 (receipt_number column) and T027 (PaymentModel update)
- **US5 (P2)**: Depends on T004 (snapshot column) and T032 (PaymentModel update); T033 can run parallel to T032

### Parallel Opportunities

```bash
# Phase 2 — can run together after T001:
T002, T003   # migration scaffolds
T007, T008, T009  # constants + types (independent files)

# Phase 3+4+5 — all three P1 user stories can start simultaneously after Phase 2:
T010/T011 (US1) | T013/T014/T016 (US2) | T019–T022/T023 (US3)

# Phase 8:
T037, T038, T039  # lint/type checks are independent
```

---

## Implementation Strategy

### MVP (US1 + US2 + US3 — all P1, Phases 1–5)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T009)
3. Complete Phases 3, 4, 5 in parallel or sequence (US1, US2, US3)
4. **STOP and VALIDATE**: All three P1 stories independently testable
5. Deploy/demo if ready

### Full Delivery (+ US4 + US5 — P2)

6. Add Phase 6 (US4 receipt number)
7. Add Phase 7 (US5 payment snapshot)
8. Run Phase 8 (Polish)

### Task count summary

| Phase | Tasks | Stories |
|---|---|---|
| Phase 1 Setup | T001–T003 | 3 tasks |
| Phase 2 Foundational | T004–T009 | 6 tasks |
| Phase 3 US1 Alert | T010–T012 | 3 tasks |
| Phase 4 US2 Multi-class | T013–T018 | 6 tasks |
| Phase 5 US3 System categories | T019–T025 | 7 tasks |
| Phase 6 US4 Receipt number | T026–T030 | 5 tasks |
| Phase 7 US5 Snapshot | T031–T036 | 6 tasks |
| Phase 8 Polish | T037–T042 | 6 tasks |
| **Total** | **T001–T042** | **42 tasks** |

---

## Notes

- [P] tasks operate on different files and have no shared in-progress dependencies
- Each user story phase ends with a checkpoint — validate before proceeding to next
- Backend integration tests are grouped in a single `PaymentBillingUxTest.php` class; add test methods as each phase completes
- Snapshot assembly (T031) is the most complex task — read `contracts/payments.md` and `data-model.md §D5` carefully before implementing
- `TRANSPORT_CATEGORIES` removal in T024 must happen after T019 confirms the backend injects system categories — do not remove the constant until the API is confirmed to supply them
