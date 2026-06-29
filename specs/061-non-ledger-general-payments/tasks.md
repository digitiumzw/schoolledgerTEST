# Tasks: Non-Ledger General Payments

**Input**: Design documents from `/specs/061-non-ledger-general-payments/`
**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/ ✅ · quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (Schema Migrations)

**Purpose**: Apply the two additive schema changes that all user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until both migrations are applied and verified.

- [ ] T001 Create migration `backend/app/Database/Migrations/2026-05-04-200001_Add_is_general_payment_to_payments.php` — adds `is_general_payment TINYINT(1) NOT NULL DEFAULT 0` column + `idx_payments_is_general(tenant_id, is_general_payment)` index to `payments` table, with reversible `down()` per data-model.md
- [ ] T002 [P] Create migration `backend/app/Database/Migrations/2026-05-04-200002_Add_payment_group_id_to_payments.php` — adds `payment_group_id VARCHAR(36) NULL DEFAULT NULL` column + `idx_payments_group(tenant_id, payment_group_id)` index to `payments` table, with reversible `down()` per data-model.md

**Checkpoint**: Run `php spark migrate` — both columns visible in `payments` table.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend model + ledger exclusion filter that ALL user stories depend on.

**⚠️ CRITICAL**: Phases 3–5 cannot begin until this phase is complete.

- [ ] T003 Update `backend/app/Models/PaymentModel.php` — add `is_general_payment` and `payment_group_id` to `$allowedFields`; update `formatForApi()` to return `isGeneralPayment` (bool) and `paymentGroupId` (string|null)
- [ ] T004 [P] Update `LedgerService::getStudentBalance()` in `backend/app/Services/LedgerService.php` — add `AND is_general_payment = 0` (or `COALESCE(is_general_payment,0) = 0` for null safety) to the fee payments pool query (lines ~78–88) and the transport-category payments pool query (lines ~99–106)
- [ ] T005 [P] Update `LedgerService::getAllBalances()` in `backend/app/Services/LedgerService.php` — add `AND COALESCE(is_general_payment, 0) = 0` to the `fp` (fee payments) subquery (line ~208) and the `tp` (transport payments) subquery (line ~217)
- [ ] T006 [P] Update `LedgerService::allocatePaymentToCharges()` in `backend/app/Services/LedgerService.php` — add `AND COALESCE(is_general_payment, 0) = 0` to the fee pool query (lines ~300–310) and both transport pool queries (lines ~344–359)
- [ ] T007 [P] Update `frontend/src/types/dashboard.ts` — add `isGeneralPayment?: boolean` and `paymentGroupId?: string | null` and `categoryLines?: Array<{category: string; amount: number}>` to the `Payment` interface
- [ ] T008 [P] Update `frontend/src/api/api.ts` — add typed `MultiCategoryPaymentInput` interface (`studentId`, `amount`, `date?`, `method`, `description?`, `categories: Array<{categoryName: string; amount: number}>`) and update `createPayment` signature to accept `any | MultiCategoryPaymentInput` (keep existing `any` fallback for backward compat)

**Checkpoint**: Existing single-category system payments still reduce balance correctly; `LedgerService` tests still pass.

---

## Phase 3: User Story 1 — Record a Non-Ledger General Payment (Priority: P1) 🎯 MVP

**Goal**: A payment under a user-defined category is stored with `is_general_payment = 1`, does not reduce the student's balance, and its receipt shows no balance fields.

**Independent Test**: Record a payment under a user-defined category for a student with a known balance → verify balance unchanged, `balanceAfterPayment` is null in API response, receipt renders without balance block.

### Integration Tests for US1

- [ ] T009 [P] [US1] Create `backend/tests/Integration/GeneralPaymentTest.php` with test scaffold (tenant fixture, student fixture, user-defined category name `"School Trip"`) — write and verify failing tests for:
  - `[a]` non-ledger payment does not reduce student balance (`getStudentBalance` unchanged)
  - `[b]` non-ledger payment excluded from `getAllBalances` subquery
  - `[c]` system-category "Fees" payment still posts to ledger and reduces balance (regression)
  - `[h]` receipt for non-ledger payment has `balance_after_payment = NULL` in DB

### Implementation for US1

- [ ] T010 [US1] Update `PaymentController::create()` in `backend/app/Controllers/Api/PaymentController.php` — after resolving `$category`, call `\Config\PaymentCategories::isSystemName($category)` to set `$isGeneralPayment` (bool); set `is_general_payment` on `$paymentData`; skip `allocatePaymentToCharges()` and balance snapshot assembly when `$isGeneralPayment === true`; omit `balance_after_payment` and `snapshot` writes for general payments
- [ ] T011 [US1] Update `PaymentController::create()` snapshot assembly in `backend/app/Controllers/Api/PaymentController.php` — for system-category (ledger) payments, snapshot assembly remains unchanged; for general payments no snapshot is written and `balance_after_payment` stays NULL
- [ ] T012 [P] [US1] Update `frontend/src/components/receipt/ReceiptDocument.tsx` — existing `balance !== null` guard already suppresses the balance block; update `ReceiptData.payment` type to include `isGeneralPayment?: boolean`, `paymentGroupId?: string | null`, and `categoryLines?: Array<{category: string; amount: number}>`; no visual change required for US1 single-category case
- [ ] T013 [US1] Run `GeneralPaymentTest.php` cases `[a]`, `[b]`, `[c]`, `[h]` — all must pass

**Checkpoint**: US1 fully functional. Single-category user-defined payments stored as non-ledger; balance unaffected; receipt shows no balance.

---

## Phase 4: User Story 2 — Record a Payment with Multiple Categories (Priority: P1)

**Goal**: A bursar selects multiple categories (all user-defined OR all system) with per-category amounts summing to a declared total. The backend validates the sum, creates grouped rows with a shared `payment_group_id` + `receipt_number`, and rejects mixed system/user-defined selections.

**Independent Test**: POST multi-category payload → verify two `payments` rows in DB with same `payment_group_id` and `receipt_number`; verify mixed-category payload returns 422; verify sum-mismatch payload returns 422.

### Integration Tests for US2

- [ ] T014 [P] [US2] Extend `backend/tests/Integration/GeneralPaymentTest.php` — add failing tests for:
  - `[d]` mixed system + user-defined categories returns HTTP 422
  - `[e]` category allocations that do not sum to total returns HTTP 422
  - `[f]` multi-category non-ledger: two rows in DB, same `payment_group_id`, same `receipt_number`, both `is_general_payment = 1`, combined balance unchanged
  - `[g]` multi-category system ("Fees" + "Transport"): two rows, same group_id, balance reduced by combined total
  - `[j]` tenant isolation — payment for another tenant's student returns 404

### Implementation for US2

- [ ] T015 [US2] Update `PaymentController::create()` in `backend/app/Controllers/Api/PaymentController.php` — detect `categories` array in payload; validate: (a) not empty, (b) allocations sum equals `amount` (float comparison with epsilon tolerance) → 422 if mismatch, (c) all categories are system OR all are user-defined → 422 if mixed; generate one `$groupId` and one `$receiptNumber` for the group; run a single `transBegin` and insert one row per category with shared `payment_group_id`, `receipt_number`, per-category `amount`; for all-system groups call `allocatePaymentToCharges` once after all inserts; for all-user-defined groups skip allocation; commit or rollback atomically
- [ ] T016 [US2] Update `frontend/src/components/modals/RecordPaymentModal.tsx` — replace single `<Select>` category dropdown with multi-select checkbox list (or multi-select combobox); when more than one category selected show "Total" amount field (maps to existing `amount`) plus per-category split `<Input>` fields; add live sum validation (splits must equal total); add mixed-category warning banner (disable Submit if system + user-defined mix detected); hide "New Balance" preview row when all selected categories are user-defined; preserve existing single-category path when only one category selected
- [ ] T017 [US2] Update `frontend/src/api/api.ts` — update `createPayment` to accept `MultiCategoryPaymentInput` when `categories` array is present; pass payload as-is to `POST /api/payments`; return first row from `data` (existing shape)
- [ ] T018 [US2] Run `GeneralPaymentTest.php` cases `[d]`, `[e]`, `[f]`, `[g]`, `[j]` — all must pass

**Checkpoint**: US2 fully functional. Multi-category payments recorded correctly; validation guards enforced server- and client-side.

---

## Phase 5: User Story 3 — Correct Receipt Display for System vs. Non-Ledger Payments (Priority: P2)

**Goal**: Receipts for multi-category transactions list all category lines. System-category receipts show combined "Amount Paid" + balance block. Non-ledger receipts show category lines only, no balance block.

**Independent Test**: Fetch receipt for a multi-category group payment → verify `categoryLines` array present; verify balance block absent for non-ledger group, present for system group.

### Integration Tests for US3

- [ ] T019 [P] [US3] Extend `backend/tests/Integration/GeneralPaymentTest.php` — add failing tests for:
  - `[i]` receipt for multi-category payment (same `payment_group_id`) returns `categoryLines` array with correct per-line amounts
  - `[i2]` receipt for multi-category system payment includes `balanceAfterPayment` (combined total deducted)
  - `[i3]` receipt for multi-category non-ledger payment has `balanceAfterPayment = null`

### Implementation for US3

- [ ] T020 [US3] Update `ReceiptController` in `backend/app/Controllers/Api/ReceiptController.php` — after loading the primary payment row, check if `payment_group_id` is non-null; if so query all rows with the same `payment_group_id` and `tenant_id`; compute `totalAmount = SUM(row.amount)`; build `categoryLines = [{category, amount}]` array; return `categoryLines` in the response data; use `totalAmount` as `payment.amount` in the combined receipt; `balanceAfterPayment` is taken from the first row (which is NULL for non-ledger groups, or the ledger value for system groups)
- [ ] T021 [US3] Update `frontend/src/components/receipt/ReceiptDocument.tsx` — add `categoryLines` rendering: when `payment.categoryLines` is non-empty and has more than one entry, replace the single `{payment.category}` row in the payment details section with a list of category lines showing each name + amount; keep "Amount Paid" box showing the combined total; balance block rendering unchanged (null-guard already correct)
- [ ] T022 [US3] Update `frontend/src/components/modals/PrintReceiptModal.tsx` (or wherever receipt data is fetched) — ensure that after a multi-category payment the receipt is fetched using the returned `id` (first row); the updated `ReceiptController` will return the full group data via `categoryLines`
- [ ] T023 [US3] Run `GeneralPaymentTest.php` cases `[i]`, `[i2]`, `[i3]` — all must pass

**Checkpoint**: All three user stories functional. Receipt display correct for all payment types.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T024 [P] PHP lint check — run `php -l` on all modified backend files: `PaymentController.php`, `ReceiptController.php`, `LedgerService.php`, `PaymentModel.php`, both migration files, `GeneralPaymentTest.php`
- [ ] T025 [P] TypeScript type-check — run `npx tsc --noEmit` in `frontend/` — 0 errors
- [ ] T026 [P] ESLint check — run `npx eslint src/components/modals/RecordPaymentModal.tsx src/components/receipt/ReceiptDocument.tsx src/api/api.ts src/types/dashboard.ts` — 0 errors
- [ ] T027 Run full integration test suite — `php vendor/bin/phpunit tests/Integration/GeneralPaymentTest.php --testdox` — all 10 cases pass
- [ ] T028 Verify quickstart.md scenarios manually — run each `curl` command from `quickstart.md` and confirm expected responses (non-ledger balance unchanged, mixed-category 422, split-mismatch 422, multi-category group rows in DB)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately; T001 and T002 are parallel
- **Phase 2 (Foundational)**: Depends on Phase 1 — T003–T008 can all run in parallel after migrations applied
- **Phase 3 (US1)**: Depends on Phase 2 — T009 (tests) and T012 (types) parallel; T010–T011 sequential
- **Phase 4 (US2)**: Depends on Phase 2 — T014 (tests) and T016–T017 (frontend) parallel; T015 sequential (extends T010/T011 work)
- **Phase 5 (US3)**: Depends on Phase 2 — T019 (tests) parallel; T020–T022 sequential
- **Phase 6 (Polish)**: Depends on Phases 3–5

### User Story Dependencies

- **US1 (P1)**: Independent after Phase 2
- **US2 (P1)**: Independent after Phase 2; builds on `PaymentController` changes from US1 (T010/T011 must be complete first)
- **US3 (P2)**: Independent after Phase 2; `ReceiptController` changes are isolated; `ReceiptDocument` changes depend on type additions from T007/T012

### Critical Path

```
T001/T002 (parallel) → T003-T008 (parallel) → T010/T011 → T015/T016/T017 → T020/T021/T022 → T024-T028
```

---

## Parallel Execution Examples

### Phase 1 (can run simultaneously)
```
T001: Add is_general_payment migration
T002: Add payment_group_id migration
```

### Phase 2 (can run simultaneously after Phase 1)
```
T003: PaymentModel.php allowedFields + formatForApi
T004: LedgerService getStudentBalance filter
T005: LedgerService getAllBalances filter
T006: LedgerService allocatePaymentToCharges filter
T007: dashboard.ts Payment type updates
T008: api.ts MultiCategoryPaymentInput interface
```

### Phase 3 (T009 and T012 parallel, T010/T011 sequential)
```
T009: Write GeneralPaymentTest.php scaffold + US1 test cases
T012: ReceiptDocument.tsx type updates
  ↓ (after T009 tests written)
T010: PaymentController single-category classification + general payment path
T011: PaymentController snapshot skip for general payments
```

---

## Implementation Strategy

### MVP (US1 only — Phase 1 + 2 + 3)

1. Apply migrations (T001, T002)
2. Complete foundational updates (T003–T008)
3. Write + run US1 tests (T009)
4. Implement non-ledger single-category path in `PaymentController` (T010, T011)
5. Update receipt types (T012)
6. Validate: record user-defined category payment → balance unchanged, receipt no balance block

### Full Delivery (all stories — all phases)

1. MVP above
2. Add multi-category backend + frontend (Phase 4, T014–T018)
3. Add receipt group display (Phase 5, T019–T023)
4. Polish + lint + full test run (Phase 6, T024–T028)

### Total: 28 tasks across 6 phases
- **Phase 1**: 2 tasks (both parallel)
- **Phase 2**: 6 tasks (all parallel)
- **Phase 3 (US1)**: 5 tasks (2 parallel)
- **Phase 4 (US2)**: 5 tasks (3 parallel)
- **Phase 5 (US3)**: 5 tasks (2 parallel)
- **Phase 6 (Polish)**: 5 tasks (2 parallel)

**MVP scope**: T001–T013 (13 tasks, Phases 1–3)
