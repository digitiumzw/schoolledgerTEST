# Research: Campaign Receipt & Payments Integration

**Feature**: 062-campaign-receipt-payments  
**Date**: 2026-05-05

---

## D1 — Do campaign payments already surface on the main payments page?

**Decision**: Yes — no code change needed for basic visibility.

**Rationale**: `PaymentModel::getByTenant()` queries `WHERE tenant_id = ?` with no filter on `fee_campaign_id`. Because `FeeCampaignService::recordPayment()` inserts into the `payments` table with `tenant_id` set correctly, those rows are already returned by `GET /api/payments` and `GET /api/payments/with-students`. The `formatForApi()` method already serialises `feeCampaignId` in the response payload.

**What is missing**: The frontend `Payments.tsx` does not currently display a "Campaign" source label when `feeCampaignId` is non-null. The `payment.category` field is set to the campaign name at insert time (line 162: `'category' => $campaign['name']`), so the category column already shows the campaign name. No additional backend change is required for FR-011 through FR-013.

**Alternatives considered**:
- Adding a dedicated `GET /api/payments?type=campaign` filter — rejected; unnecessary complexity since the rows are already present.
- A separate `/api/campaign-payments` listing endpoint — rejected; violates DRY and creates duplication with the existing payments list.

---

## D2 — Is the snapshot currently populated for campaign payments?

**Decision**: No — snapshot is not populated. This is the primary gap this feature closes.

**Rationale**: `FeeCampaignService::recordPayment()` (lines 154–167 of `FeeCampaignService.php`) inserts the payment row with `receipt_number` but does **not** write a `snapshot` column. The `snapshot` column exists on the table (added by feature 057 migration `2026-05-04-000001_Add_receipt_number_and_snapshot_to_payments.php`) and is in `PaymentModel::$allowedFields`. The fix is to build the snapshot JSON and add it to the insert in `recordPayment()`.

**Snapshot shape for campaign payments** (mirrors the standard payment snapshot, adapted for campaign context):

```json
{
  "studentName":      "Jane Doe",
  "className":        "Grade 7A",
  "campaignName":     "Grade 7 Exam Fee",
  "expectedAmount":   50.00,
  "paidBefore":       0.00,
  "amountPaid":       30.00,
  "remainingAfter":   20.00,
  "paymentMethod":    "Cash",
  "paymentDate":      "2026-05-05"
}
```

`balanceAfterPayment` on the payment row is left `NULL` for campaign payments (matching the existing pattern — campaign balance is campaign-specific, not a ledger balance).

**Alternatives considered**:
- Storing campaign balance in `balance_after_payment` — rejected; this column is consumed by `ReceiptController` to display the student's general ledger balance. Using it for campaign remaining balance would mislead the receipt renderer and break the general balance display for students who also have standard payments.
- Not storing a snapshot at all and computing values at receipt render time — rejected; violates FR-007 (immutable audit record) and breaks receipt accuracy if campaign data is later edited.

---

## D3 — Does `ReceiptController` need changes for campaign payments?

**Decision**: Minor extension needed to suppress general ledger balance and display campaign remaining balance.

**Rationale**: `ReceiptController::show()` currently:
1. Reads `balance_after_payment` from the payment row.
2. If null **and** `is_general_payment = 0`, it approximates the balance via `LedgerService`.
3. Renders `balanceAfterPayment` in the receipt response.

For campaign payments: `fee_campaign_id IS NOT NULL`, `balance_after_payment IS NULL`, and `is_general_payment` is not set (it's `NULL` / `0`). Without a guard, the receipt controller will run the ledger approximation and show the student's general fee balance — which is wrong (FR-010).

**Fix**: In `ReceiptController::show()`, detect `fee_campaign_id IS NOT NULL` and skip the ledger approximation. Instead, read the campaign remaining balance from the snapshot (`remainingAfter` field). The `balanceAfterPayment` returned on the receipt will be the campaign-specific remaining balance.

**Alternatives considered**:
- Setting `is_general_payment = 1` on campaign payments to bypass the ledger approximation — rejected; `is_general_payment` signals "non-ledger general payment" in the UI and affects how the receipt renders (balance suppression). Campaign payments have a balance (the campaign remaining balance), so they should not be treated as balance-free general payments.
- Adding a new `payment_type` column — rejected; over-engineering. The `fee_campaign_id IS NOT NULL` check is sufficient to distinguish campaign payments.

---

## D4 — Receipt number format: `FeeCampaignService` vs `BaseApiController`

**Decision**: Harmonise to use `BaseApiController::generateReceiptNumber()` format.

**Rationale**: `FeeCampaignService::recordPayment()` (line 149) generates the receipt number inline:

```php
$receiptNo = date('Y.m.d.His') . '.' . chr(random_int(65, 90));
```

This is functionally identical to `BaseApiController::generateReceiptNumber()` (format `YYYY.MM.DD.HHmmss.X`). The service cannot call `BaseApiController` methods directly (it's not a controller), so the inline generation is correct and should be kept as-is. The format is already identical — no change needed.

**Alternatives considered**:
- Extracting `generateReceiptNumber()` to a shared utility class — valid but out of scope for this feature; no functional difference.

---

## D5 — Does `addStudent` require any changes?

**Decision**: No — the existing implementation already satisfies FR-001 through FR-004.

**Rationale**: `FeeCampaignService::addStudent()` already:
- Validates campaign exists and belongs to tenant (FR-004)
- Rejects closed campaigns with 409 (FR-003)
- Verifies student belongs to the same tenant (FR-004)
- Checks for duplicate enrollment with 400 (FR-002)
- Creates the tracking record with `expected = campaign.amount`, `paid = 0`, `status = 'unpaid'` (FR-001)

The controller `FeeCampaignController::addStudent()` already enforces `requireRole('super_admin', 'admin', 'bursar')`.

---

## D6 — Testing strategy: integration tests + curl

**Decision**: Extend `FeeCampaignTest.php` with 7 new test cases. Provide curl commands in `quickstart.md` as a runnable manual test suite.

**Rationale**: Constitution Principle X mandates integration tests covering happy path, error/edge cases, and tenant isolation. The existing `FeeCampaignTest.php` uses `DatabaseTestTrait` for real DB testing against the service layer. New cases extend this file rather than creating a new file to keep campaign-related tests co-located.

**Curl tests** provide a complementary HTTP-layer verification that exercises the full controller → service → DB stack including JWT auth. They are documented in `quickstart.md` as step-by-step commands the developer runs manually after migrations.

**New test cases** (7 total):

| Case | Story | Path |
|------|-------|------|
| `testRecordPaymentSnapshotIsPopulated` | US2 | Happy: snapshot JSON contains all required fields |
| `testRecordPaymentReceiptNumberIsGenerated` | US2 | Happy: receipt_number is not null and matches expected format |
| `testCampaignPaymentAppearsInPaymentsTable` | US3 | Happy: payment row queryable from general payments table |
| `testCampaignPaymentHasCorrectCategory` | US3 | Happy: category = campaign name for payments-page display |
| `testSnapshotRemainingAfterIsCorrect` | US2 | Happy: remainingAfter in snapshot = expected - paid |
| `testAddStudentToCampaignTenantIsolation` | US1 | Error: cross-tenant student addition returns 404 |
| `testRecordPaymentSnapshotSurvivesRollback` | US2 | Error: if DB fails, neither payment nor snapshot is committed |
