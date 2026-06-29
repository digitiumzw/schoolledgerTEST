# Data Model: Parent Receipt List

**Feature**: 092-parent-receipt-list
**Date**: 2026-06-25

## Entities

### Payment Receipt (existing — no schema changes)

The `payments` table already exists with all required fields. No migrations are needed.

**Key fields used by this feature**:
- `id` (VARCHAR, PK) — globally unique payment ID
- `student_id` (VARCHAR, FK → students.id) — scopes receipts to a student
- `tenant_id` (VARCHAR, FK → tenants.id) — tenant isolation
- `amount` (DECIMAL) — payment amount
- `date` (DATE) — payment date (used for sorting, descending)
- `method` (VARCHAR) — payment method (Cash, Bank Transfer, etc.)
- `category` (VARCHAR) — payment category (Fees, Transport, etc.)
- `description` (VARCHAR) — payment description/notes
- `receipt_number` (VARCHAR, nullable) — human-readable receipt number
- `payment_group_id` (VARCHAR, nullable) — groups multi-category payment rows
- `is_general_payment` (TINYINT) — non-ledger payment flag
- `fee_campaign_id` (VARCHAR, nullable) — fee campaign reference
- `voided_at` (DATETIME, nullable) — void timestamp (null = active)
- `void_reason` (VARCHAR, nullable) — reason for voiding
- `created_at` (DATETIME) — creation timestamp (secondary sort)

### Student (existing — no schema changes)

**Key fields used by this feature**:
- `id` (VARCHAR, PK) — globally unique student ID (public scope key)
- `tenant_id` (VARCHAR, FK) — tenant isolation
- `first_name` (VARCHAR) — student first name
- `last_name` (VARCHAR) — student last name
- `admission_number` (VARCHAR, nullable) — admission number
- `class_id` (VARCHAR, nullable, FK → classes.id) — current class

### Class (existing — no schema changes)

**Key fields used by this feature**:
- `id` (VARCHAR, PK)
- `name` (VARCHAR) — class name
- `tenant_id` (VARCHAR, FK)

## API Response Shape

### Receipt List Entry (per item in the `data` array)

```json
{
  "id": "pay_1234567890_abcdef12",
  "amount": 150.00,
  "date": "2026-06-15",
  "method": "Cash",
  "category": "Fees",
  "description": "Term 2 fees",
  "receiptNumber": "2026.06.15.143022.K",
  "isGeneralPayment": false,
  "paymentGroupId": null,
  "isVoided": false,
  "voidedAt": null,
  "voidReason": null
}
```

For multi-category grouped payments, `amount` is the combined total and `category` is a comma-separated list of categories (e.g., "Fees, Transport Fee").

### Student Summary (in response, not paginated)

```json
{
  "id": "s1782381468_62ac4e51",
  "firstName": "John",
  "lastName": "Doe",
  "admissionNumber": "ADM001",
  "className": "Grade 10A"
}
```

### Full Response Envelope

```json
{
  "status": true,
  "message": "Success",
  "data": {
    "receipts": [ ...array of receipt list entries... ],
    "student": { ...student summary... },
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 47,
      "totalPages": 3,
      "last_page": 3
    }
  }
}
```

## Query Strategy

The list query reuses `PaymentModel::basePaymentHistoryBuilder()` which:
1. Joins `payments` → `students` → `classes` in a single query
2. Uses a correlated subquery to compute combined `amount` for grouped payments
3. Uses `GROUP_CONCAT` to combine `category` labels for grouped payments
4. Applies `applyPaymentTransactionDisplayCondition` to show only the MIN(id) row per group

The count query uses `COUNT(DISTINCT COALESCE(p.payment_group_id, p.id))` to count unique transactions, matching the display deduplication.

**Indexes used**: The query filters by `student_id` and `tenant_id` on the `payments` table. The existing index on `(tenant_id, student_id)` covers this scan efficiently. Sort by `date DESC, created_at DESC, id DESC` is handled by the existing index on `(tenant_id, student_id, date)` or a filesort for small result sets (bounded by pagination LIMIT).

No new indexes or migrations are required.
