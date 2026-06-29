# Research: Non-Ledger General Payments

**Branch**: `061-non-ledger-general-payments`
**Date**: 2026-05-04

## D1 — How should non-ledger payments be excluded from balance calculations?

**Decision**: Add an `is_general_payment` boolean column (DEFAULT 0) to the `payments` table via migration. Both `LedgerService::getStudentBalance` and `LedgerService::getAllBalances` add a `WHERE is_general_payment = 0` (or `IS NULL` for backward compatibility) filter to all payment pool subqueries. `allocatePaymentToCharges` skips general payments in the same way.

**Rationale**: A dedicated boolean flag is explicit, auditable, and index-friendly. It does not require parsing or string-matching the `category` field at query time. It cleanly separates the classification concern from the routing concern (which uses `route_id` + `category` name today).

**Alternatives considered**:
- Rely solely on category string matching at query time — rejected: string-matching the category name across 4+ ledger queries is fragile and duplicates logic each time a category changes name.
- Store in a separate `general_payments` table — rejected: over-engineers the model; a flag on the existing table is sufficient.
- Use `fee_campaign_id IS NOT NULL` as a proxy — rejected: conflates two unrelated features; campaigns have their own semantics.

---

## D2 — Multi-category payment storage: one row vs. multiple rows

**Decision**: Store each category allocation as a **separate `payments` row**, linked by a shared `payment_group_id` UUID. The `PaymentController::create` endpoint accepts either a single-category payload (existing shape, backward-compatible) or a new multi-category array payload that the controller fans out into N individual rows inside one transaction.

**Rationale**:
- The existing `payments` schema is category-per-row. Keeping that shape avoids a schema rewrite and keeps `LedgerService` unchanged except for the `is_general_payment` filter.
- A `payment_group_id` groups the rows for receipt generation: the receipt controller fetches all rows with the same group ID and renders them as one document.
- Each row retains its own `amount` (the per-category allocation), its own `is_general_payment` flag, and the same `receipt_number`.
- The total-amount / per-category split is validated server-side: `SUM(allocations) == total` checked in `PaymentController` before inserting.
- Backward compatibility: existing single-category calls omit `payment_group_id`; the field is nullable.

**Alternatives considered**:
- JSON line-items column on a single row — rejected: makes per-category querying and ledger filtering awkward; breaks the `getAllBalances` subquery pattern.
- Entirely new `payment_lines` table — rejected: requires foreign key plumbing and adds complexity without benefit over the multi-row approach.

---

## D3 — Category system-flag lookup at payment recording time

**Decision**: `PaymentController::create` (for multi-category) calls `\Config\PaymentCategories::isSystemName()` to determine `is_general_payment` for **each** category allocation. If the category name matches a system name → `is_general_payment = 0`. If it does not match → `is_general_payment = 1`. The mixed-category guard fires first: if the payload contains both system and user-defined categories, return HTTP 422 before any insert.

**Rationale**: Re-using `PaymentCategories::isSystemName()` (already present from feature 057) avoids duplication and keeps the classification logic in one canonical place. Checking by name (rather than by ID) is consistent with how `SettingsController` and `LedgerService` already identify category type.

**Alternatives considered**:
- Pass `is_general_payment` from the frontend — rejected: client-supplied flags are not trustworthy (Constitution Principle VIII).
- Persist `is_general_payment` into category settings — rejected: the flag is deterministic from the `system` attribute; storing it redundantly would create a sync risk.

---

## D4 — Receipt rendering for non-ledger payments

**Decision**: `ReceiptDocument.tsx` already conditionally renders the balance block based on `payment.balanceAfterPayment !== null`. For non-ledger payments, `PaymentController` does NOT call `LedgerService::getStudentBalance` or `allocatePaymentToCharges`, and does NOT set `balance_after_payment`. This means `balanceAfterPayment` remains `null` on the payment row → the receipt balance block is naturally suppressed.

For multi-category payments, all rows in the group share the same `receipt_number` and the receipt controller returns a combined receipt aggregating all category lines. The `snapshot.amount` on the receipt reflects the combined total; individual category lines are listed in the payment details section.

**Rationale**: Minimal change to `ReceiptDocument.tsx` — the null-guard for `balance` already exists. Only the snapshot assembly and category-lines display need updating.

**Alternatives considered**:
- Add an explicit `isGeneralPayment` field to the receipt data shape — rejected: not needed because the `balanceAfterPayment === null` signal already achieves the same effect.

---

## D5 — Ledger query impact analysis (LedgerService)

The following queries in `LedgerService` currently include ALL payments in the fee/general pool (which includes user-defined categories today):

| Query | Location | Fix |
|-------|----------|-----|
| Fee payments pool (getStudentBalance) | Lines 78–88 | Add `WHERE is_general_payment = 0` |
| Transport payments pool (getStudentBalance) | Lines 91–106 | Add `WHERE is_general_payment = 0` (transport pool already scoped by route_id/category='Transport') |
| getAllBalances fp subquery | Line 208 | Add `AND is_general_payment = 0` |
| getAllBalances tp subquery | Line 217 | Add `AND is_general_payment = 0` |
| allocatePaymentToCharges fee pool | LedgerService line ~300 | Add `AND is_general_payment = 0` |
| allocatePaymentToCharges transport pool | LedgerService lines ~344–359 | Add `AND is_general_payment = 0` |
| PaymentController snapshot `balanceBefore` | Computed inside transaction | Skip balance snapshot for general payments entirely |

`getTotalPaymentsByStudent` and `getRevenueByCategory` are NOT ledger queries; they are reporting methods and intentionally include all payments for revenue reporting purposes (no change required).

---

## D6 — Frontend multi-category UX

**Decision**: `RecordPaymentModal.tsx` is refactored to support multi-category mode. When the user selects more than one category, the single `amount` field becomes a "Total" field and per-category split `Input` fields appear below it. A live running sum validates splits === total. The existing single-category path remains unchanged for backward compatibility.

Mixed-category guard is enforced in the UI: if any selected category is system and any other is user-defined, a warning banner appears and the Submit button is disabled (mirrors the server-side guard).

The "New Balance" preview in the modal is hidden when all selected categories are user-defined (non-ledger), since the balance will not change.

**Rationale**: Provides clear UX feedback before submission, reducing round-trips. Server-side remains authoritative.
