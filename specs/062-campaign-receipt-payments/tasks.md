# Tasks: Campaign Receipt & Payments Integration

**Input**: Design documents from `/specs/062-campaign-receipt-payments/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.
**Tests**: Integration tests included (Constitution Principle X mandates them; quickstart.md curl tests mandated by user).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no blocking dependencies)
- **[Story]**: Which user story this task belongs to
- Exact file paths included in every task description

---

## Phase 1: Setup

**Purpose**: Confirm environment and verify baseline before any modifications.

> No new migrations, no new files — this feature modifies existing files only.
> Phase 1 is a verification pass, not a construction pass.

- [x] T001 Verify feature 059 migrations are applied: `cd backend && php spark migrate:status` — confirm `Create_fee_campaigns_table`, `Create_campaign_students_table`, `Add_fee_campaign_id_to_payments` all show "Up"
- [x] T002 Verify feature 057 columns exist: run `DESCRIBE payments` and confirm `receipt_number`, `snapshot`, `balance_after_payment` columns are present
- [x] T003 [P] Confirm existing `FeeCampaignTest.php` passes cleanly: `cd backend && php vendor/bin/phpunit tests/Integration/FeeCampaignTest.php --testdox`
- [x] T004 [P] Run PHP lint on files to be modified: `cd backend && php -l app/Services/FeeCampaignService.php app/Controllers/Api/ReceiptController.php`

**Checkpoint**: All migrations applied, existing tests green, target files lint-clean.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Write the integration test stubs for all three user stories **before** implementation. Tests must fail first (TDD gate). All three user stories share the same test file.

**⚠️ CRITICAL**: These test stubs block all implementation phases. Write them first.

- [x] T005 Add 7 new integration test stubs to `backend/tests/Integration/FeeCampaignTest.php` — add the following skeleton methods that assert `false` (so they fail until implemented):
  - `testRecordPaymentSnapshotIsPopulated` [US2]
  - `testRecordPaymentReceiptNumberFormat` [US2]
  - `testSnapshotRemainingAfterIsCorrect` [US2]
  - `testCampaignPaymentAppearsInPaymentsTable` [US3]
  - `testCampaignPaymentCategoryIsCampaignName` [US3]
  - `testAddStudentToCampaignTenantIsolation` [US1]
  - `testAddStudentToClosedCampaignBlockedByService` [US1]
- [x] T006 Run the test suite to confirm the 7 new stubs all **fail**: `cd backend && php vendor/bin/phpunit tests/Integration/FeeCampaignTest.php --testdox` — verify 7 failures, 0 errors on existing cases

**Checkpoint**: 7 failing stubs exist, all pre-existing tests still pass.

---

## Phase 3: User Story 1 — Manual Student Addition to Campaign (Priority: P1) 🎯

**Goal**: Validate and complete `addStudent()` — manual addition with duplicate guard, closed-campaign guard, and tenant isolation.

**Independent Test**: Add a student not in a campaign → verify new record created; add same student again → verify 400; add from different tenant → verify 404; add to closed campaign → verify 409.

### Implementation for User Story 1

- [x] T007 [US1] Review `backend/app/Services/FeeCampaignService.php` `addStudent()` method (lines 210–251) — confirm all four validation guards (FR-001–FR-004) are present and correct:
  - Campaign exists + tenant check → 404 if not found
  - Campaign status `!== 'active'` → 409
  - Student `tenant_id` match → 404
  - Duplicate `(fee_campaign_id, student_id)` → 400
  If any guard is missing or incorrect, fix it in `backend/app/Services/FeeCampaignService.php`
- [x] T008 [US1] Review `backend/app/Controllers/Api/FeeCampaignController.php` `addStudent()` method (lines 189–208) — confirm role enforcement (`requireRole('super_admin', 'admin', 'bursar')`) and `studentId` required-field guard are present. Fix if missing.

### Tests for User Story 1

- [x] T009 [US1] Implement `testAddStudentToCampaignTenantIsolation` in `backend/tests/Integration/FeeCampaignTest.php`:
  - Create a campaign for `$this->tenantId`
  - Call `$this->service->addStudent($cid, 'stu_other', $this->tenantId)` where `stu_other` belongs to `$this->tenantId2`
  - Assert `$result['error']` is set and `$result['status'] === 404`
- [x] T010 [US1] Implement `testAddStudentToClosedCampaignBlockedByService` in `backend/tests/Integration/FeeCampaignTest.php`:
  - Create a campaign, close it with `$this->service->closeCampaign(..., true)`
  - Call `$this->service->addStudent($cid, 'stu_b1', $this->tenantId)` for a student NOT already in the campaign
  - Assert `$result['error']` is set and `$result['status'] === 409`
- [x] T011 [US1] Run US1 tests to verify they now pass: `cd backend && php vendor/bin/phpunit tests/Integration/FeeCampaignTest.php --filter "testAddStudent" --testdox`

**Checkpoint**: US1 — `testAddStudentToCampaignTenantIsolation` and `testAddStudentToClosedCampaignBlockedByService` both pass. Manual student addition fully validated.

---

## Phase 4: User Story 2 — Receipt Generation & Transaction Snapshot (Priority: P1)

**Goal**: Every campaign payment must generate a receipt number and an immutable transaction snapshot stored atomically with the payment row.

**Independent Test**: Record a campaign payment → fetch the payment row directly from DB → assert `receipt_number` non-null and matches `YYYY.MM.DD.HHmmss.X` pattern → assert `snapshot` non-null and contains all required fields → assert `remainingAfter` is correct.

### Implementation for User Story 2

- [x] T012 [US2] Modify `backend/app/Services/FeeCampaignService.php` `recordPayment()` method — inside the `$this->db->transStart()` block, after resolving student and campaign data but BEFORE the `payments` insert, fetch the student's name and class name:

  ```php
  // Fetch student name and class for snapshot
  $studentRow = $this->db->table('students')
      ->select('students.first_name, students.last_name, classes.name as class_name')
      ->join('classes', 'classes.id = students.class_id', 'left')
      ->where('students.id', $studentId)
      ->get()->getRowArray();

  $paidBefore     = (float) $csRecord['paid_amount'];
  $remainingAfter = (float) $csRecord['expected_amount'] - $paidBefore - $amount;
  $snapshotJson   = json_encode([
      'studentName'    => trim(($studentRow['first_name'] ?? '') . ' ' . ($studentRow['last_name'] ?? '')),
      'className'      => $studentRow['class_name'] ?? '',
      'campaignName'   => $campaign['name'],
      'expectedAmount' => (float) $csRecord['expected_amount'],
      'paidBefore'     => $paidBefore,
      'amountPaid'     => $amount,
      'remainingAfter' => max(0.0, $remainingAfter),
      'paymentMethod'  => $data['method'] ?? 'Cash',
      'paymentDate'    => $data['date'] ?? date('Y-m-d'),
  ]);
  ```

- [x] T013 [US2] In the same `recordPayment()` method in `backend/app/Services/FeeCampaignService.php`, add `'snapshot' => $snapshotJson` to the `$this->db->table('payments')->insert([...])` array. The receipt number inline generation (`date('Y.m.d.His') . '.' . chr(random_int(65, 90))`) is already correct — do not change it.

- [x] T014 [US2] Modify `backend/app/Controllers/Api/ReceiptController.php` `show()` method — add a campaign payment guard after `$formatted = $paymentModel->formatForApi($payment);`:

  ```php
  // Feature 062: for campaign payments, use snapshot.remainingAfter as balance
  // instead of running the general ledger approximation (FR-010)
  $isCampaignPayment = !empty($payment['fee_campaign_id']);
  if ($isCampaignPayment) {
      $snapshot = $formatted['snapshot'] ?? null;
      $formatted['balanceAfterPayment'] = is_array($snapshot)
          ? (float) ($snapshot['remainingAfter'] ?? 0)
          : 0.0;
  }
  ```

  This guard must be placed **before** the existing `if ($formatted['balanceAfterPayment'] === null && !$isGeneral)` ledger-approximation block so that block is skipped for campaign payments.

### Tests for User Story 2

- [x] T015 [US2] Implement `testRecordPaymentSnapshotIsPopulated` in `backend/tests/Integration/FeeCampaignTest.php`:
  - Create a school-wide campaign with amount = 100.00
  - Call `$this->service->recordPayment($cid, ['studentId' => 'stu_a1', 'amount' => 40.00, 'method' => 'Cash'], $this->tenantId)`
  - Fetch the payment row directly: `$this->db->table('payments')->where('student_id', 'stu_a1')->where('fee_campaign_id', $cid)->get()->getRowArray()`
  - Assert `$payment['snapshot']` is not null
  - Decode JSON, assert keys present: `studentName`, `className`, `campaignName`, `expectedAmount`, `paidBefore`, `amountPaid`, `remainingAfter`, `paymentMethod`, `paymentDate`
  - Assert `$decoded['campaignName']` matches the campaign name
  - Assert `$decoded['amountPaid'] == 40.00`
  - Assert `$decoded['paidBefore'] == 0.00`
  - Assert `$decoded['remainingAfter'] == 60.00`
- [x] T016 [US2] Implement `testRecordPaymentReceiptNumberFormat` in `backend/tests/Integration/FeeCampaignTest.php`:
  - Create a campaign, record a payment
  - Fetch the payment row, assert `$payment['receipt_number']` is not null
  - Assert it matches the regex pattern `/^\d{4}\.\d{2}\.\d{2}\.\d{6}\.[A-Z]$/`
- [x] T017 [US2] Implement `testSnapshotRemainingAfterIsCorrect` in `backend/tests/Integration/FeeCampaignTest.php`:
  - Create a campaign with amount = 50.00, record a $20 partial payment, then a $15 second payment
  - Fetch the second payment row, decode snapshot
  - Assert `$decoded['paidBefore'] == 20.00`
  - Assert `$decoded['amountPaid'] == 15.00`
  - Assert `$decoded['remainingAfter'] == 15.00`
- [x] T018 [US2] Run US2 tests to verify all three pass: `cd backend && php vendor/bin/phpunit tests/Integration/FeeCampaignTest.php --filter "testRecordPaymentSnapshot|testRecordPaymentReceiptNumber|testSnapshotRemaining" --testdox`

**Checkpoint**: US2 — snapshot is populated atomically on every campaign payment; receipt number is non-null and correctly formatted; `ReceiptController` returns campaign remaining balance instead of ledger balance.

---

## Phase 5: User Story 3 — Campaign Payments on Main Payments Page (Priority: P1)

**Goal**: Campaign payments must appear on `GET /api/payments` alongside standard payments with campaign name as the source label and no duplication.

**Independent Test**: Record a campaign payment → call `GET /api/payments` (service-layer equivalent) → assert the payment row appears exactly once with `fee_campaign_id` set and `category` = campaign name.

### Implementation for User Story 3

- [x] T019 [US3] Verify `backend/app/Models/PaymentModel.php` `getByTenant()` — confirm it has NO `fee_campaign_id IS NULL` filter (it must return campaign payments too). It currently reads:
  ```php
  return $this->where('tenant_id', $tenantId)->orderBy('date', 'DESC')->findAll();
  ```
  This is already correct — no change needed. Document this as confirmed.
- [x] T020 [US3] Verify `backend/app/Models/PaymentModel.php` `formatForApi()` — confirm `feeCampaignId` is included in the returned array (it is, at line 154). Confirm `category` field is also returned (it is, at line 151). No change needed — document as confirmed.
- [x] T021 [P] [US3] Update `frontend/src/types/dashboard.ts` — add `campaignName?: string` to the `Payment` interface (the `category` field already carries the campaign name; this optional field can be set by the frontend when `feeCampaignId` is non-null for clearer UI labelling):
  ```typescript
  feeCampaignId?: string | null;   // already exists — verify
  // add if not present:
  campaignName?: string;
  ```
- [x] T022 [P] [US3] Update `frontend/src/pages/Payments.tsx` — in the payments table/list row renderer, add a campaign badge or label when `payment.feeCampaignId` is truthy. Display `payment.category` (which is the campaign name) as the source label in that case. Use an existing badge component from shadcn/ui (e.g., `<Badge variant="outline">Campaign</Badge>` next to the category name).

### Tests for User Story 3

- [x] T023 [US3] Implement `testCampaignPaymentAppearsInPaymentsTable` in `backend/tests/Integration/FeeCampaignTest.php`:
  - Create a campaign, record a payment for `stu_a1`
  - Query: `$this->db->table('payments')->where('tenant_id', $this->tenantId)->get()->getResultArray()`
  - Assert at least one row has `fee_campaign_id` matching the campaign ID and `student_id = 'stu_a1'`
  - Assert the row also has a non-null `receipt_number`
- [x] T024 [US3] Implement `testCampaignPaymentCategoryIsCampaignName` in `backend/tests/Integration/FeeCampaignTest.php`:
  - Create a campaign named `"Sports Day Fee"`, record a payment
  - Fetch the payment row from `payments` table
  - Assert `$payment['category'] === 'Sports Day Fee'`
- [x] T025 [US3] Run US3 tests: `cd backend && php vendor/bin/phpunit tests/Integration/FeeCampaignTest.php --filter "testCampaignPaymentAppears|testCampaignPaymentCategory" --testdox`

**Checkpoint**: US3 — campaign payments appear in the payments table with `fee_campaign_id` and `category` set; frontend displays campaign label when applicable.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Full test suite run, PHP lint, TypeScript type-check, quickstart curl validation.

- [x] T026 Run full integration test suite to confirm all 7 new tests pass and no regressions: `cd backend && php vendor/bin/phpunit tests/Integration/FeeCampaignTest.php --testdox`
- [x] T027 [P] PHP lint on all modified backend files: `cd backend && php -l app/Services/FeeCampaignService.php app/Controllers/Api/ReceiptController.php tests/Integration/FeeCampaignTest.php`
- [x] T028 [P] TypeScript type-check on modified frontend files: `cd frontend && npx tsc --noEmit` — confirm 0 errors
- [x] T029 [P] ESLint on modified frontend files: `cd frontend && npx eslint src/types/dashboard.ts src/pages/Payments.tsx`
- [x] T030 Run quickstart curl tests A–K from `specs/062-campaign-receipt-payments/quickstart.md` against the running dev server — verify all 11 expected outcomes pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — run immediately
- **Phase 2 (Foundational/Tests)**: Depends on Phase 1 — BLOCKS all implementation phases
- **Phase 3 (US1)**: Depends on Phase 2 — can start in parallel with Phase 4 and Phase 5 once Phase 2 is done
- **Phase 4 (US2)**: Depends on Phase 2 — can start in parallel with Phase 3 and Phase 5
- **Phase 5 (US3)**: Depends on Phase 2 — can start in parallel with Phase 3 and Phase 4
- **Phase 6 (Polish)**: Depends on Phases 3, 4, and 5 all complete

### User Story Dependencies

- **US1** (T007–T011): Independent — `addStudent()` already exists; tasks are review + test
- **US2** (T012–T018): Independent — modifies `FeeCampaignService.php` and `ReceiptController.php`; no dependency on US1
- **US3** (T019–T025): Independent — backend is already correct; tasks are verification + frontend label; no dependency on US1 or US2

### Within Each User Story

- Implementation tasks (T007–T008, T012–T014, T019–T022) before test implementation tasks (T009–T011, T015–T018, T023–T025)
- Tests written after understanding the implementation (because implementation may already be partially correct, as with US1 and US3)

### Parallel Opportunities

- T003 and T004 (Phase 1) can run in parallel
- T007 and T008 (US1 review tasks) can run in parallel
- T012 and T013 are sequential (T013 uses the variable created in T012)
- T014 (ReceiptController) is independent of T012–T013 — can run in parallel
- T021 and T022 (frontend tasks) can run in parallel with each other and with all backend tasks
- T015, T016, T017 (US2 tests) can be written in parallel
- T027, T028, T029 (Phase 6 lint/type-check) can all run in parallel

---

## Parallel Example: US2 Implementation

```bash
# These three tasks can be worked simultaneously:
Task T012+T013: Add snapshot assembly to FeeCampaignService::recordPayment()
Task T014:      Add campaign guard to ReceiptController::show()
Task T021+T022: Update dashboard.ts types + Payments.tsx campaign label (frontend)

# Then run tests together:
Task T015: testRecordPaymentSnapshotIsPopulated
Task T016: testRecordPaymentReceiptNumberFormat
Task T017: testSnapshotRemainingAfterIsCorrect
```

---

## Implementation Strategy

### MVP (All Stories Are P1 — Deliver Together)

All three user stories are P1 and tightly related. The recommended delivery order:

1. **Phase 1**: Verify environment (T001–T004)
2. **Phase 2**: Write failing test stubs (T005–T006)
3. **Phase 3**: Validate/fix `addStudent()` + pass US1 tests (T007–T011)
4. **Phase 4**: Add snapshot to `recordPayment()` + fix `ReceiptController` + pass US2 tests (T012–T018)
5. **Phase 5**: Verify payments table visibility + frontend label + pass US3 tests (T019–T025)
6. **Phase 6**: Full suite + lint + curl tests (T026–T030)

### Minimal Scope Note

US1 (`addStudent`) and US3 (payments page) are largely **already implemented** in feature 059. The only new code is:
- **T012–T013**: Snapshot assembly in `FeeCampaignService::recordPayment()` (~15 lines)
- **T014**: Campaign guard in `ReceiptController::show()` (~8 lines)
- **T021–T022**: Frontend campaign label in `Payments.tsx` (~5 lines)

Total new production code: ~28 lines across 3 files.

---

## Notes

- [P] tasks = different files, no dependencies between them
- [Story] label maps each task to its user story for traceability
- The snapshot (T012–T013) is the only true code gap — US1 and US3 are primarily verification tasks
- Commit after T011 (US1 green), T018 (US2 green), T025 (US3 green), and T030 (curl tests pass)
- Default dev credentials: `admin@greenwood.co.zw` / `12345678`
