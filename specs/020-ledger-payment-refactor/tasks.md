# Tasks: Ledger and Payment System Refactor

**Input**: Design documents from `specs/020-ledger-payment-refactor/`
**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/api-contracts.md ✅ · quickstart.md ✅

**Tests**: Not requested. No test tasks generated.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared write dependencies)
- **[Story]**: User story this task belongs to (US1–US6)
- All file paths are relative to repo root

## Path Conventions

- Backend: `backend/app/Controllers/Api/`, `backend/app/Models/`, `backend/app/Services/`, `backend/app/Database/Migrations/`, `backend/app/Config/`
- Frontend: `frontend/src/api/`, `frontend/src/hooks/`, `frontend/src/pages/`

---

## Phase 1: Setup (Migration Files)

**Purpose**: Create all 6 new migration files on disk before any code changes or `php spark migrate` is run. Writing migrations first ensures every subsequent code change has the correct schema to target.

- [X] T001 Create migration `backend/app/Database/Migrations/2026-04-08-000001_Backfill_charge_type_from_flags.php` — `up()`: UPDATE charges SET charge_type = 'fee_structure' WHERE is_fee_structure = 1 AND charge_type IS NULL; UPDATE charges SET charge_type = 'transport' WHERE is_transport = 1 AND charge_type IS NULL; UPDATE charges SET charge_type = 'other' WHERE charge_type IS NULL. `down()`: no-op (data migration only)
- [X] T002 [P] Create migration `backend/app/Database/Migrations/2026-04-08-000002_Add_charge_type_indexes.php` — `up()`: ADD INDEX `idx_charges_charge_type` on charges(tenant_id, charge_type, status). `down()`: DROP INDEX
- [X] T003 [P] Create migration `backend/app/Database/Migrations/2026-04-08-000003_Add_adjustment_indexes.php` — `up()`: ADD INDEX `idx_adj_status` on ledger_adjustments(tenant_id, student_id, status); ADD INDEX `idx_adj_effective_date` on ledger_adjustments(student_id, effective_date). `down()`: DROP INDEXes
- [X] T004 [P] Create migration `backend/app/Database/Migrations/2026-04-08-000004_Add_billing_run_status_index.php` — `up()`: ADD INDEX `idx_billing_runs_status` on billing_runs(tenant_id, status). `down()`: DROP INDEX
- [X] T005 [P] Create migration `backend/app/Database/Migrations/2026-04-08-000005_Add_payment_date_index.php` — `up()`: ADD INDEX `idx_payments_date` on payments(tenant_id, date DESC). `down()`: DROP INDEX
- [X] T006 [P] Create migration `backend/app/Database/Migrations/2026-04-08-000006_Add_billing_run_unique_constraint.php` — `up()`: ADD INDEX `idx_billing_runs_active` on billing_runs(tenant_id, term_id, status). `down()`: DROP INDEX

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Apply migrations and create `LedgerService` — the single authoritative balance class that every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete. LedgerService is consumed by US1, US2, US3, US4, and US5.

- [X] T007 Apply all migrations: run `php spark migrate` from `backend/` and verify `SELECT COUNT(*) FROM charges WHERE charge_type IS NULL` returns 0 after T001 migration runs
- [X] T008 Create `backend/app/Services/LedgerService.php` with class skeleton: constructor accepts `$db` (CI4 database instance), declares all 7 public method stubs with correct signatures (stub bodies throw `RuntimeException('not implemented')`)
- [X] T009 [P] Implement `LedgerService::getStudentBalance(string $studentId, string $tenantId): array` — formula: `SUM(active charges) + SUM(approved debits) - SUM(payments) - SUM(approved credits)`; active = `deleted_at IS NULL AND voided_at IS NULL`; returns array with keys: studentId, totalCharges, totalPayments, creditAdjustments, debitAdjustments, balance, feeBalance, transportBalance. Fee-only charges: `charge_type = 'fee_structure'`; transport charges: `charge_type = 'transport'`
- [X] T010 [P] Implement `LedgerService::getAllBalances(string $tenantId): array` — preserve existing optimised single-subquery pattern from `LedgerController::getAllBalances()`; update subquery to use `charge_type` instead of `is_fee_structure`; return array with keys: studentId, name, class, balance, feeBalance, transportBalance
- [X] T011 Implement `LedgerService::allocatePaymentToCharges(string $studentId, string $tenantId, $db): void` — extract FIFO logic from `PaymentController::updateChargeStatuses()`; replace `WHERE is_fee_structure = 1` with `WHERE charge_type = 'fee_structure'`; fee payments filter: `WHERE route_id IS NULL`; transport payments filter: `WHERE route_id IS NOT NULL` → allocate against `charge_type = 'transport'` charges
- [X] T012 [P] Implement `LedgerService::isBillingRunVoidable(string $billingRunId, string $tenantId): bool` — query charges linked to billing run; for each charge_id check if any payment has been allocated via FIFO (i.e., student has any payments recorded after oldest charge date); return false with reason if payments found; use `billing_run_id = $billingRunId AND tenant_id = $tenantId AND deleted_at IS NULL`
- [X] T013 [P] Implement `LedgerService::getPaymentCollectionReport(string $tenantId, string $termId): array` — single optimised query joining charges (term_id = $termId, deleted_at IS NULL) LEFT JOIN payments by student; return: totalCharged, totalCollected, collectionRate (%), studentsFullyPaid, studentsWithBalance, studentsNotPaid, byStudent[]
- [X] T014 [P] Implement `LedgerService::getAgedBalances(string $tenantId, string $termId): array` — join charges (term_id = $termId) with MIN(due_date) per student; compute daysOverdue = TODAY - min_due_date; bucket into: current (≤ 0), 1-30, 31-60, 61-90, 90+; return summary counts + per-student rows

**Checkpoint**: LedgerService complete and all migrations applied — user story implementation can now begin

---

## Phase 3: User Story 1 — Reliable Charge Generation (Priority: P1) 🎯 MVP

**Goal**: Deliver the complete billing run lifecycle — preview → finalize → void — with idempotency protection and a history endpoint backed by `billing_runs` table instead of the legacy JSON field.

**Independent Test**: Trigger `POST /api/billing/finalize` for a term, verify `billing_runs` record created with status `completed`, all charges have `billing_run_id` set. Then attempt to finalize again — must return 409. Then record no payments and call `POST /api/billing/void` — verify charges soft-deleted and billing run status = `voided`.

### Implementation for User Story 1

- [X] T015 [US1] Implement `LedgerController::getBillingPreview()` for `GET /api/billing/preview?termId=X` in `backend/app/Controllers/Api/LedgerController.php` — read-only: load active students, apply fee structure + bursary multipliers, calculate per-student and per-category totals; check for existing non-voided billing run in `billing_runs` table and return it in `existingBillingRun` field; return shape per `contracts/api-contracts.md`; NO database writes
- [X] T016 [US1] Implement `LedgerController::getBillingStatus()` for `GET /api/billing/status?termId=X` in `backend/app/Controllers/Api/LedgerController.php` — query `billing_runs` WHERE `tenant_id = $tenantId AND term_id = $termId` ORDER BY created_at DESC LIMIT 1; return status, totals, and timestamps per contract shape
- [X] T017 [US1] Implement `LedgerController::finalizeBilling()` for `POST /api/billing/finalize` in `backend/app/Controllers/Api/LedgerController.php` — validate required fields: termId, academicYear, confirmed=true; APPLICATION-LEVEL idempotency: query `billing_runs` for existing non-voided run for this tenant+term → return 409 if found; start DB transaction; INSERT into `billing_runs` (status='completed', confirmed_by, confirmed_at); generate charges for all eligible students (same logic as existing `generateTermCharges()` but with `billing_run_id` set on every INSERT); COMMIT or ROLLBACK; log `billing_run_finalized` audit action; return 201 with billingRunId, totalStudents, totalAmount
- [X] T018 [US1] Implement `LedgerController::voidBilling()` for `POST /api/billing/void` in `backend/app/Controllers/Api/LedgerController.php` — validate: billingRunId, reason required; call `LedgerService::isBillingRunVoidable()` → return 409 with message if not voidable; start transaction; soft-delete all charges WHERE `billing_run_id = $billingRunId AND deleted_at IS NULL` (set deleted_at, deletion_reason); UPDATE billing_runs SET status='voided', voided_by, voided_at, void_reason; COMMIT or ROLLBACK; log `billing_run_voided` audit action; return chargesSoftDeleted count
- [X] T019 [P] [US1] Implement `LedgerController::getUnbilledStudents()` for `GET /api/billing/unbilled-students?termId=X` in `backend/app/Controllers/Api/LedgerController.php` — query active students LEFT JOIN charges on `student_id AND term_id = $termId AND deleted_at IS NULL`; return students WHERE no charge row found; include studentId, name, class
- [X] T020 [P] [US1] Implement `LedgerController::generateSupplementaryBilling()` for `POST /api/billing/supplementary` in `backend/app/Controllers/Api/LedgerController.php` — validate: termId, academicYear, studentIds (non-empty array), reason; reuse charge generation logic (bursary + class overrides) but restricted to provided studentIds; INSERT new `billing_runs` record (no idempotency block — supplementary runs are additive); link billing_run_id on all charges; log audit; return 201
- [X] T021 [US1] Update `LedgerController::getChargeHistory()` for `GET /api/charges/history` in `backend/app/Controllers/Api/LedgerController.php` — replace JSON-field-based history with query against `billing_runs` table: SELECT id, term_id, academic_year, status, total_students, total_amount, confirmed_at, voided_at FROM billing_runs WHERE tenant_id = $tenantId ORDER BY created_at DESC; keep existing JSON fallback for legacy data only if billing_runs is empty
- [X] T022 [US1] Update `useChargeGeneration.ts` in `frontend/src/hooks/useChargeGeneration.ts` — replace `api.generateTermCharges()` call in `generateCharges()` with billing run flow: (1) call `api.getBillingPreview()` to confirm eligibility, (2) call `api.finalizeBilling({termId, academicYear, confirmed: true})` ; update `generationHistory` loading to call `api.getBillingStatus()` and new history endpoint; keep `undoCharges()` calling `api.voidBilling({billingRunId, reason})`

**Checkpoint**: Full billing lifecycle (preview → finalize → void) works end-to-end. Charge history backed by `billing_runs` table.

---

## Phase 4: User Story 2 — Accurate and Auditable Payment Recording (Priority: P1)

**Goal**: Fix FIFO allocation to use `charge_type`, fix hardcoded term detection, and delegate allocation logic to `LedgerService`. Payment recording remains atomic.

**Independent Test**: Create a student with two fee-structure charges (older: $200, newer: $150). Record a payment of $250. Verify: older charge status = `paid`, newer charge status = `partial`. Record second payment of $150. Verify: newer charge = `paid`, balance = 0.

### Implementation for User Story 2

- [X] T023 [US2] Refactor `PaymentController::create()` in `backend/app/Controllers/Api/PaymentController.php` — replace inline `updateChargeStatuses()` call with `(new LedgerService($db))->allocatePaymentToCharges($studentId, $tenantId, $db)` inside the existing transaction; all validation logic (amount, method, date, student ownership) remains unchanged; remove the private `updateChargeStatuses()` method after delegation
- [X] T024 [US2] Fix `PaymentController::termTotal()` for `GET /api/payments/student/:studentId/term-total` in `backend/app/Controllers/Api/PaymentController.php` — replace hardcoded month-based term detection with: (1) if `termId` query param provided, use it directly; (2) otherwise load tenant's `academic_calendar` JSON field and find the term whose date range includes today; use that term's start and end dates for the SUM query
- [X] T025 [P] [US2] Update `PaymentModel::formatForApi()` in `backend/app/Models/PaymentModel.php` — add explicit comment documenting that `month` is a virtual field derived from `date` (`date('n', strtotime($payment['date']))`); confirm no `month` column write exists in `formatFromApi()`; no schema change needed
- [X] T026 [P] [US2] Update frontend `api.ts` method `getTotalPaidThisTerm()` in `frontend/src/api/api.ts` — change signature to accept optional `termId` param: `(studentId: string, termId?: string)` → append `?termId=${termId}` to URL when provided

**Checkpoint**: Payment recording uses `charge_type` for FIFO allocation. Term-total endpoint uses academic calendar. Both work independently of billing run changes.

---

## Phase 5: User Story 3 — Clear and Consistent Balance Display (Priority: P1)

**Goal**: Replace the two separate balance implementations with `LedgerService`. Balance response gains `feeBalance` and `transportBalance` sub-totals. Frontend interface updated.

**Independent Test**: For a student with $300 tuition charge and $100 transport charge (both outstanding): (1) `GET /api/ledger/student/:id/balance` returns balance=$400, feeBalance=$300, transportBalance=$100. (2) `GET /api/ledger/balances` returns same values. (3) `GET /api/reconciliation/student/:id/balance` returns identical balance figure.

### Implementation for User Story 3

- [X] T027 [US3] Update `LedgerController::getStudentBalance()` for `GET /api/ledger/student/:studentId/balance` in `backend/app/Controllers/Api/LedgerController.php` — replace inline balance SQL with `(new LedgerService($this->db))->getStudentBalance($studentId, $tenantId)`; return the full array including new `feeBalance` and `transportBalance` keys per `contracts/api-contracts.md`
- [X] T028 [US3] Update `LedgerController::getAllBalances()` for `GET /api/ledger/balances` in `backend/app/Controllers/Api/LedgerController.php` — replace inline subquery with `(new LedgerService($this->db))->getAllBalances($tenantId)`; response array now includes `feeBalance` and `transportBalance` per student per contract
- [X] T029 [P] [US3] Update `StudentBalance` TypeScript interface in `frontend/src/hooks/useStudentBalance.ts` — add `feeBalance: number` and `transportBalance: number` to the interface; update any destructuring of `balance` response data in the hook to include the new fields
- [X] T030 [P] [US3] Update balance display in `frontend/src/pages/StudentProfile.tsx` (or wherever student balance is rendered) — surface `feeBalance` and `transportBalance` as separate line items alongside the total balance; use conditional rendering so display degrades gracefully if values are 0

**Checkpoint**: Single source of truth for balance. All three balance endpoints return identical totals. Frontend shows fee vs. transport breakdown.

---

## Phase 6: User Story 4 — Balance Adjustments and Reconciliation (Priority: P2)

**Goal**: Delegate balance calculation in `ReconciliationController` to `LedgerService`. Ensure refund creation always links an adjustment. Verify audit log captures all events.

**Independent Test**: Apply a $50 credit adjustment → verify balance decreases by $50 and audit log entry exists. Void that adjustment with a reason → balance reverts, void entry in audit log. Create a refund → verify a linked credit adjustment record is created in the same transaction.

### Implementation for User Story 6

- [X] T031 [US4] Replace `ReconciliationController::calculateStudentBalance()` private method in `backend/app/Controllers/Api/ReconciliationController.php` — replace the private method body with `return (new LedgerService($this->db))->getStudentBalance($studentId, $tenantId)['balance']`; all calls to the private method stay unchanged (name/signature preserved); verify formula produces same results by comparing output for 5+ students before removing the old implementation body
- [X] T032 [P] [US4] Verify `ReconciliationController::createRefund()` in `backend/app/Controllers/Api/ReconciliationController.php` — confirm the existing implementation inserts both a `refunds` record AND a `ledger_adjustments` record atomically in one transaction; confirm `refunds.adjustment_id` is set; if either insert is missing or outside the transaction, fix it so both writes are within the same transaction block with rollback on failure
- [X] T033 [P] [US4] Verify `ReconciliationController::createAdjustment()` in `backend/app/Controllers/Api/ReconciliationController.php` — confirm `balance_before` and `balance_after` use the LedgerService balance (after T031); confirm `logAuditAction()` is called with action_type `adjustment_created` and correct `balance_before`/`balance_after` values; fix if deviating

**Checkpoint**: ReconciliationController delegates balance to LedgerService. Refund → adjustment link is atomic. Audit log records all reconciliation events.

---

## Phase 7: User Story 5 — Payment and Ledger Reports (Priority: P2)

**Goal**: Add three new report endpoints backed by `LedgerService` report methods. Add corresponding API calls in the frontend. Register routes with role guard.

**Independent Test**: Generate charges and partial payments for a term. Call `GET /api/reports/payment-collection?termId=X` — verify totalCharged, totalCollected, collectionRate are numerically consistent with manual SQL SUM. Call `GET /api/reports/aged-balances?termId=X` — verify students are bucketed correctly by days since due_date.

### Implementation for User Story 5

- [X] T034 [US5] Add report routes in `backend/app/Config/Routes.php` — add route group `/api/reports/` with `JWTAuthFilter`; register: `GET reports/payment-collection` → `ReportController::paymentCollection`, `GET reports/aged-balances` → `ReportController::agedBalances`, `GET reports/revenue-by-category` → `ReportController::revenueByCategory`
- [X] T035 [US5] Create `backend/app/Controllers/Api/ReportController.php` extending `BaseApiController` — add role check at top of each method: reject with 403 if role not in `['bursar', 'admin', 'super_admin']`; inject `LedgerService`
- [X] T036 [US5] Implement `ReportController::paymentCollection()` for `GET /api/reports/payment-collection?termId=X` in `backend/app/Controllers/Api/ReportController.php` — validate termId required; call `(new LedgerService($this->db))->getPaymentCollectionReport($tenantId, $termId)`; return 200 with full shape per `contracts/api-contracts.md` including byStudent array
- [X] T037 [US5] Implement `ReportController::agedBalances()` for `GET /api/reports/aged-balances?termId=X` in `backend/app/Controllers/Api/ReportController.php` — validate termId required; call `(new LedgerService($this->db))->getAgedBalances($tenantId, $termId)`; return 200 with summary buckets + per-student rows per contract
- [X] T038 [US5] Implement `ReportController::revenueByCategory()` for `GET /api/reports/revenue-by-category?termId=X&category=Y` in `backend/app/Controllers/Api/ReportController.php` — validate termId required; run single SQL: SELECT category, SUM(c.amount) as totalCharged, SUM(p.amount) as totalCollected FROM charges c LEFT JOIN payments p ON p.student_id = c.student_id AND p.category = c.category WHERE c.tenant_id = $tenantId AND c.term_id = $termId AND c.deleted_at IS NULL GROUP BY category; apply optional category filter; return per-category rows with collectionRate % and outstanding per contract
- [X] T039 [P] [US5] Add three new API methods in `frontend/src/api/api.ts` — `getPaymentCollectionReport(termId: string)` → GET `/reports/payment-collection?termId=${termId}`; `getAgedBalances(termId: string)` → GET `/reports/aged-balances?termId=${termId}`; `getRevenueByCategoryReport(termId: string, category?: string)` → GET `/reports/revenue-by-category?termId=${termId}${category ? &category=${category} : ''}`; each returns the typed response matching the contract shapes
- [X] T040 [P] [US5] Add TypeScript interfaces for report response types in `frontend/src/api/api.ts` (or a types file if one exists) — `PaymentCollectionReport`, `AgedBalancesReport`, `RevenueByCategoryReport` matching the JSON shapes in `contracts/api-contracts.md`

**Checkpoint**: All three report endpoints return data. Frontend can call them. Role guard blocks teachers.

---

## Phase 8: User Story 6 — Consistent Charge Type Classification (Priority: P3)

**Goal**: Remove all backward-compatibility code that reads `is_fee_structure` / `is_transport` boolean flags from queries and `ChargeModel`. All classification uses `charge_type` ENUM only. (Column drop is deferred to Phase B migration — out of scope.)

**Independent Test**: After T007 migration, query `SELECT COUNT(*) FROM charges WHERE charge_type IS NULL` must return 0. After ChargeModel changes, generate a new transport charge and verify API response shows `chargeType: 'transport'` and NOT `isTransport: true` in the response body.

### Implementation for User Story 6

- [X] T041 [US6] Update `ChargeModel::formatForApi()` in `backend/app/Models/ChargeModel.php` — remove the backward-compatibility block that sets `isFeeStructure` from `is_fee_structure` and `isTransport` from `is_transport`; replace with direct mapping: `'chargeType' => $charge['charge_type']`; remove `isFeeStructure` and `isTransport` from the returned array (breaking: coordinate with frontend T045)
- [X] T042 [P] [US6] Update `ChargeModel::getTransportChargesByStudent()` in `backend/app/Models/ChargeModel.php` — replace `WHERE charge_type = 'transport' OR is_transport = 1` with `WHERE charge_type = 'transport'`
- [X] T043 [P] [US6] Audit all other ChargeModel query methods in `backend/app/Models/ChargeModel.php` — search for any remaining references to `is_fee_structure` or `is_transport` column names in WHERE clauses; replace each with `charge_type = 'fee_structure'` or `charge_type = 'transport'` respectively
- [X] T044 [P] [US6] Audit `LedgerController.php` and `PaymentController.php` for any remaining raw SQL or query builder calls that reference `is_fee_structure` or `is_transport` — replace each with `charge_type`-based equivalents; search specifically in `generateTermCharges()`, `undoTermCharges()`, and `checkTermChargesExist()`
- [X] T045 [P] [US6] Update frontend TypeScript types for Charge in `frontend/src/api/api.ts` (and any related type files) — replace `isFeeStructure: boolean` and `isTransport: boolean` fields with `chargeType: 'fee_structure' | 'transport' | 'other'`; update all usages in components and hooks (search for `isFeeStructure`, `isTransport`, `is_fee_structure`, `is_transport`)
- [X] T046 [P] [US6] Update `frontend/src/lib/chargeUtils.ts` — replace any logic branching on `isFeeStructure` or `isTransport` with `chargeType === 'fee_structure'` or `chargeType === 'transport'`

**Checkpoint**: Zero references to `is_fee_structure` / `is_transport` in active query paths. API response uses `chargeType` string. Frontend uses `chargeType`. Column drop deferred to a future Phase B migration.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Verification, documentation cleanup, and any cross-story issues surfaced during implementation

- [ ] T047 [P] Balance consistency verification — for 10+ students, compare `GET /api/ledger/student/:id/balance` vs `GET /api/reconciliation/student/:id/balance` response; log any discrepancy; if any found, trace to LedgerService and fix
- [ ] T048 [P] Billing run idempotency verification — call `POST /api/billing/finalize` twice for the same tenant+term; confirm second call returns HTTP 409 and zero charges were double-generated
- [ ] T049 [P] Concurrent billing run race condition check — verify application-level guard in `finalizeBilling()` checks for existing non-voided billing run before inserting; document the check in a code comment
- [ ] T050 [P] Void safety verification — record a payment for a student after finalizing a billing run; attempt to void that billing run; confirm `LedgerService::isBillingRunVoidable()` returns false and API returns 409
- [ ] T051 [P] Report accuracy cross-check — run `GET /api/reports/payment-collection?termId=X`; manually compute `SUM(amount) FROM charges WHERE term_id=X AND deleted_at IS NULL` and `SUM(amount) FROM payments p JOIN charges c...`; verify report figures match manual queries
- [X] T052 Run `php spark migrate` on a clean database (from seed) and confirm all 6 migrations apply cleanly with `php spark migrate:status`
- [X] T053 Update `CLAUDE.md` Recent Changes entry for feature `020-ledger-payment-refactor` to reflect the actual changes shipped (LedgerService, billing run lifecycle, 3 report endpoints, charge_type consolidation)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup — Migrations)**: No dependencies — write migration files first, before any code change
- **Phase 2 (Foundational — LedgerService)**: Depends on Phase 1 migrations applied (T007) — BLOCKS Phase 3, 4, 5, 6, 7
- **Phase 3 (US1 — Charge Generation)**: Depends on Phase 2 complete
- **Phase 4 (US2 — Payment Recording)**: Depends on Phase 2 complete (specifically T011 — allocatePaymentToCharges)
- **Phase 5 (US3 — Balance Display)**: Depends on Phase 2 complete (T009, T010)
- **Phase 6 (US4 — Reconciliation)**: Depends on Phase 2 complete (T009); Phase 5 recommended first
- **Phase 7 (US5 — Reports)**: Depends on Phase 2 complete (T013, T014)
- **Phase 8 (US6 — Charge Type)**: Depends on Phase 2 complete (T011); can run in parallel with Phase 3–7 if care taken with ChargeModel changes
- **Phase 9 (Polish)**: Depends on all desired phases complete

### User Story Dependencies

- **US1 (P1)**: After Phase 2 — no dependency on other user stories
- **US2 (P1)**: After Phase 2 — no dependency on other user stories
- **US3 (P1)**: After Phase 2 — US3 is a prerequisite for US4 (both use LedgerService balance)
- **US4 (P2)**: After US3 recommended (balance delegation should match)
- **US5 (P2)**: After Phase 2 — independent of US1–US4 at the report-query level
- **US6 (P3)**: After Phase 2 — model changes must coordinate with any in-flight ChargeModel edits from US1–US4

### Within Each User Story

- Backend model changes before backend service/controller changes
- Controller changes before frontend API changes
- Frontend API changes before hook/page changes

### Parallel Opportunities

All tasks marked [P] within the same phase can run simultaneously. Key parallel groups:
- **Phase 1**: T002–T006 all in parallel (different migration files)
- **Phase 2**: T009, T010, T012, T013, T014 in parallel (different LedgerService methods)
- **Phase 3**: T019, T020 in parallel (read-only endpoints with no shared writes)
- **Phase 4**: T025, T026 in parallel (different files)
- **Phase 5**: T029, T030 in parallel (different frontend files)
- **Phase 6**: T032, T033 in parallel (different controller methods)
- **Phase 7**: T039, T040 in parallel (frontend only)
- **Phase 8**: T042–T046 in parallel (different files)
- **Phase 9**: T047–T051 all in parallel (read-only verification)

---

## Parallel Example: Phase 2 (LedgerService Methods)

```
# All 5 LedgerService method implementations can run in parallel:
Task T009: LedgerService::getStudentBalance()      → single-student balance
Task T010: LedgerService::getAllBalances()           → bulk subquery balance
Task T011: LedgerService::allocatePaymentToCharges() → FIFO allocation (sequential after T009)
Task T012: LedgerService::isBillingRunVoidable()    → void safety check
Task T013: LedgerService::getPaymentCollectionReport() → collection report
Task T014: LedgerService::getAgedBalances()         → aged balance report
```

## Parallel Example: User Story 3 (Balance Display)

```
# After T027 and T028 complete, frontend tasks can run in parallel:
Task T029: Update StudentBalance TypeScript interface in useStudentBalance.ts
Task T030: Update balance display in StudentProfile.tsx
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3 Only — All P1 Stories)

1. Complete Phase 1: Create migration files
2. Complete Phase 2: Apply migrations + create LedgerService (T007–T014)
3. Complete Phase 3: Billing run lifecycle (US1) — T015–T022
4. Complete Phase 4: Payment recording fix (US2) — T023–T026
5. Complete Phase 5: Balance display (US3) — T027–T030
6. **STOP and VALIDATE**: All three P1 user stories independently functional
7. Deploy/demo MVP

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready
2. Phase 3 → Billing runs work (US1) — demo to bursar
3. Phase 4 → Payments accurate (US2) — demo payment FIFO
4. Phase 5 → Balance unified (US3) — demo balance breakdown
5. Phase 6 → Reconciliation delegated (US4) — demo adjustment voiding
6. Phase 7 → Reports live (US5) — demo collection rate report
7. Phase 8 → Charge type clean (US6) — internal cleanup only
8. Phase 9 → Polish + verification

### Parallel Team Strategy (2 developers)

1. Both complete Phase 1 (migration files) and Phase 2 (LedgerService) together
2. Once LedgerService is done:
   - **Developer A**: US1 (billing run lifecycle) → US6 (charge type cleanup)
   - **Developer B**: US2 (payment fix) → US3 (balance display) → US4 (reconciliation) → US5 (reports)

---

## Notes

- [P] tasks = different files, no write dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story is independently testable after its phase checkpoint
- **Do not drop `is_fee_structure` or `is_transport` columns in this branch** — Phase B column drop is a future migration
- All new LedgerController and ReportController methods must call `$this->jwtPayload->tenant_id` for tenantId — never accept it from request body
- The billing run unique constraint is application-level (not DB-level UNIQUE) because status='voided' runs must be allowed to repeat; guard with a SELECT check + 409 before INSERT
- Commit after completing each phase checkpoint to enable easy rollback

---

## Task Count Summary

| Phase | Tasks | Parallel [P] |
|-------|-------|-------------|
| Phase 1: Setup (Migrations) | 6 | 5 |
| Phase 2: Foundational (LedgerService) | 8 | 6 |
| Phase 3: US1 — Charge Generation | 8 | 2 |
| Phase 4: US2 — Payment Recording | 4 | 2 |
| Phase 5: US3 — Balance Display | 4 | 2 |
| Phase 6: US4 — Reconciliation | 3 | 2 |
| Phase 7: US5 — Reports | 7 | 2 |
| Phase 8: US6 — Charge Type | 6 | 5 |
| Phase 9: Polish | 7 | 5 |
| **Total** | **53** | **31** |
