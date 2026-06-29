# Data Model: Non-Ledger General Payments

**Branch**: `061-non-ledger-general-payments`
**Date**: 2026-05-04

---

## Schema Changes

### Migration 1 — Add `is_general_payment` to `payments`

**File**: `YYYY-MM-DD-XXXXXX_Add_is_general_payment_to_payments.php`

```sql
ALTER TABLE payments
  ADD COLUMN is_general_payment TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1 = user-defined category (non-ledger); 0 = system category (ledger)';

CREATE INDEX idx_payments_is_general ON payments (tenant_id, is_general_payment);
```

`down()`: `DROP INDEX idx_payments_is_general ON payments; ALTER TABLE payments DROP COLUMN is_general_payment;`

### Migration 2 — Add `payment_group_id` to `payments`

**File**: `YYYY-MM-DD-XXXXXX_Add_payment_group_id_to_payments.php`

```sql
ALTER TABLE payments
  ADD COLUMN payment_group_id VARCHAR(36) NULL DEFAULT NULL
    COMMENT 'Groups rows belonging to the same multi-category transaction. NULL for single-category payments.';

CREATE INDEX idx_payments_group ON payments (tenant_id, payment_group_id);
```

`down()`: `DROP INDEX idx_payments_group ON payments; ALTER TABLE payments DROP COLUMN payment_group_id;`

---

## Updated Entity: `payments`

| Column | Type | Notes |
|--------|------|-------|
| id | VARCHAR(36) PK | Existing |
| tenant_id | VARCHAR(36) | Existing — all queries scoped by this |
| student_id | VARCHAR(36) | Existing |
| amount | DECIMAL(10,2) | Existing — per-category allocation for multi-category rows |
| date | DATE | Existing |
| method | VARCHAR(50) | Existing |
| description | TEXT | Existing |
| category | VARCHAR(100) | Existing — category name tag |
| route_id | VARCHAR(36) NULL | Existing — transport assignments |
| fee_campaign_id | VARCHAR(36) NULL | Existing |
| balance_after_payment | DECIMAL(10,2) NULL | Existing — NULL for non-ledger payments |
| receipt_number | VARCHAR(25) NULL | Existing — shared across all rows in a group |
| snapshot | JSON NULL | Existing — NULL or omits balance fields for non-ledger |
| **is_general_payment** | TINYINT(1) DEFAULT 0 | **NEW** — 1 = non-ledger general payment |
| **payment_group_id** | VARCHAR(36) NULL | **NEW** — groups multi-category transaction rows |
| created_at | TIMESTAMP | Existing |
| updated_at | TIMESTAMP | Existing |

---

## Classification Logic

```
is_general_payment = 0  ←→  category ∈ { "Fees", "Transport", "Transport + Fees" }
                             (system categories — affect ledger, reduce balance)

is_general_payment = 1  ←→  all other categories
                             (user-defined — stored only, never affect balance)
```

The flag is set by `PaymentController` at insert time by calling `PaymentCategories::isSystemName($category)`.
It is **never** accepted from client input.

---

## LedgerService Query Changes

All six payment-pool queries in `LedgerService` gain `AND is_general_payment = 0`:

```
getStudentBalance()     → fee pool:        WHERE ... AND is_general_payment = 0
getStudentBalance()     → transport pool:  WHERE ... AND is_general_payment = 0
getAllBalances()         → fp subquery:     AND is_general_payment = 0
getAllBalances()         → tp subquery:     AND is_general_payment = 0
allocatePaymentToCharges() → fee pool:     AND is_general_payment = 0
allocatePaymentToCharges() → transport pool: AND is_general_payment = 0
```

---

## Multi-Category Transaction Model

A multi-category payment (e.g., two user-defined categories) creates **N rows** in `payments`, one per category:

```
payments row 1:
  id              = "p_abc"
  payment_group_id = "grp_xyz"
  amount          = 30.00        ← allocation for category A
  category        = "Stationery"
  is_general_payment = 1
  receipt_number  = "2026.05.04.143000.1"   ← same across all rows in group

payments row 2:
  id              = "p_def"
  payment_group_id = "grp_xyz"
  amount          = 20.00        ← allocation for category B
  category        = "School Trip"
  is_general_payment = 1
  receipt_number  = "2026.05.04.143000.1"   ← same
```

**Total amount invariant** (enforced server-side):
`SUM(allocations) == total` must hold before any row is inserted.

---

## Receipt Data Shape (Updated)

For multi-category transactions, `ReceiptController` fetches all rows with `payment_group_id = X` and returns an augmented receipt shape:

```json
{
  "payment": {
    "id": "p_abc",
    "receiptNumber": "2026.05.04.143000.1",
    "amount": 50.00,
    "date": "2026-05-04",
    "method": "Cash",
    "category": "Stationery",
    "balanceAfterPayment": null,
    "snapshot": null,
    "categoryLines": [
      { "category": "Stationery", "amount": 30.00 },
      { "category": "School Trip", "amount": 20.00 }
    ],
    "isGeneralPayment": true
  },
  "student": { ... },
  "school": { ... }
}
```

`categoryLines` is populated only when `payment_group_id IS NOT NULL`. The receipt renders each line in the payment details section. The balance block is omitted when `balanceAfterPayment === null`.

---

## Backward Compatibility

- All existing single-category payments: `is_general_payment = 0`, `payment_group_id = NULL` (both new columns default cleanly).
- Existing `LedgerService` behaviour is preserved for the system-category payment path.
- `PaymentModel::formatForApi` gains `isGeneralPayment` and `paymentGroupId` fields.
- `createPayment` API gains an optional `categories` array parameter; when absent, the existing single-category flow runs unchanged.
