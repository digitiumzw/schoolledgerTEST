# Research: Receipt Search and Cancel

**Date**: 2026-05-30
**Feature**: 085-receipt-search-cancel

## Decisions

### 1. No New Database Schema

**Decision**: Re-use existing `receipt_number`, `voided_at`, `void_reason`, and `voided_by` columns on the `payments` table.

**Rationale**: These fields were introduced by prior migrations:
- `2026-05-04-000001_Add_receipt_number_and_snapshot_to_payments.php` — added `receipt_number` VARCHAR(25)
- `2026-05-04-200003_Relax_receipt_number_uniqueness.php` — changed to non-unique index to support grouped payments
- `2026-05-28-000001_AddPaymentVoidFieldsForCampaignReconciliation.php` — added `voided_at`, `void_reason`, `voided_by`
- `2026-05-13-000001_AddPaymentHistoryPerformanceIndexes.php` — added `idx_payments_tenant_receipt`

Indexes already exist for receipt number lookup. No migration needed.

**Alternatives considered**: Creating a separate `receipts` table — rejected because it introduces a new entity and complicates the existing payment-centric architecture. The existing pattern treats receipt as a view over payment data.

### 2. Soft Void (Not Hard Delete)

**Decision**: Set `voided_at` to current timestamp when canceling; never delete payment rows.

**Rationale**: Preserves full audit history. Aligns with existing campaign payment voiding pattern in `FeeCampaignController::voidCampaignPayment()` and `FeeCampaignService::voidCampaignPayment()`.

**Alternatives considered**: Physical DELETE — rejected because it breaks ledger audit trails and contradicts Constitution Principle V (balance computed from source records).

### 3. Ledger Recalculation After Void

**Decision**: After setting `voided_at`, trigger `LedgerService::getStudentBalance()` and `allocatePaymentToCharges()` for the affected student.

**Rationale**: Constitution Principle V requires balance always be derived at query time. However, existing `LedgerService` payment subqueries do NOT yet filter `voided_at IS NULL`. This feature must add that filter to both `getStudentBalance()` and `getAllBalances()` so voided payments are excluded from all balance calculations.

**Alternatives considered**: Updating a cached balance column — rejected by Constitution Principle V.

### 4. Receipt Search Implementation

**Decision**: Use the existing `GET /api/payments/with-students?search={receiptNumber}` endpoint. The `PaymentModel::applyFilteredPaymentConditions()` already LIKE-matches `p.receipt_number`. Add a dedicated receipt search input field on the frontend that populates the same `search` parameter.

**Rationale**: No backend changes needed for search. The existing endpoint is already paginated, filtered, and returns student-joined data.

**Alternatives considered**: New dedicated endpoint `GET /api/payments/search-by-receipt` — rejected because it duplicates existing functionality and violates DRY.

### 5. Void Authorization

**Decision**: Restrict void action to `admin` and `bursar` roles only, enforced at the API controller layer.

**Rationale**: Financial mutation requires elevated privileges. Teachers and other roles should not be able to void payments.

**Alternatives considered**: Allow any authenticated user to void with approval workflow — rejected as over-engineering for v1.

### 6. Atomic Void for Grouped Payments

**Decision**: When voiding a payment that belongs to a group (shared `payment_group_id` and `receipt_number`), void ALL sibling rows atomically.

**Rationale**: A receipt represents a single transaction. If a parent paid $100 split across Fees ($70) and Transport ($30), canceling the receipt must void both rows to maintain financial consistency.

**Alternatives considered**: Per-row voiding — rejected because it would leave a partially valid receipt, which violates the user's mental model of a receipt as a single document.

## Open Questions Resolved

- **Q**: Should voided payments appear in the default payment list?  
  **A**: Yes, but visually distinguished (grayed out, "Voided" badge). This supports audit transparency. The summary/stats endpoints should exclude voided payments from financial totals.

- **Q**: What happens to charge allocation after a void?  
  **A**: `allocatePaymentToCharges()` is re-run for the student. Any charges that were marked `paid` or `partially_paid` by the voided payment will revert to `pending` if no other payments cover them.
