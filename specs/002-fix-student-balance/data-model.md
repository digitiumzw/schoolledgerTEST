# Data Model: Fix Student Balance & KPI Accuracy

No schema migrations required. All changes are to query logic and API response shape only.

## Existing Entities Used

### `students`
Unchanged. Relevant fields:
- `id`, `tenant_id`, `status`, `bursary_status`, `bursary_percentage`

### `charges`
Unchanged. Relevant fields for balance:
- `student_id`, `tenant_id`, `amount`
- `is_fee_structure` (TINYINT 1) — 1 = school fee charge
- `is_transport` (BOOLEAN) — 1 = transport charge
- `deleted_at` (DATETIME, nullable) — soft-delete; NULL means active

### `payments`
Unchanged. Relevant fields for balance:
- `student_id`, `tenant_id`, `amount`
- `is_fee_structure` (TINYINT 1) — 1 = school fee payment
- `route_id` (VARCHAR 50, nullable) — non-NULL means transport payment

### `ledger_adjustments`
Unchanged. Relevant fields for balance:
- `student_id`, `tenant_id`, `amount`
- `adjustment_type` (ENUM: `credit` | `debit`) — credit reduces balance; debit increases it
- `status` (ENUM: `pending` | `approved` | `rejected` | `voided`) — only `approved` adjustments affect balance

## Balance Formula (authoritative)

```
balance = COALESCE(charges.total, 0)
        + COALESCE(debit_adjustments.total, 0)
        - COALESCE(payments.total, 0)
        - COALESCE(credit_adjustments.total, 0)
```

Where each component is a per-student subquery aggregating `SUM(amount)` filtered by `tenant_id`.

Charges subquery filter: `(is_fee_structure = 1 OR is_transport = 1) AND deleted_at IS NULL`  
Payments subquery filter: `(is_fee_structure = 1 OR route_id IS NOT NULL)`  
Debit adjustments filter: `adjustment_type = 'debit' AND status = 'approved'`  
Credit adjustments filter: `adjustment_type = 'credit' AND status = 'approved'`

## API Response Shape Change

### `GET /api/students-optimized` — `stats` field

**Before** (paginated, no count for financial aid):
```json
{
  "totalStudents": 50,
  "studentsWithOutstandingBalance": 12,
  "totalFeesOwed": 6000.00,
  "bursaryCoveragePercentage": 24.0,
  "statusCounts": {
    "active": 45,
    "inactive": 2,
    "graduated": 1,
    "transferred": 1,
    "dropped_out": 1
  }
}
```

**After** (full population, adds financial aid count):
```json
{
  "totalStudents": 200,
  "studentsWithOutstandingBalance": 60,
  "totalFeesOwed": 15000.00,
  "bursaryCoveragePercentage": 15.0,
  "studentsOnFinancialAid": 30,
  "statusCounts": {
    "active": 185,
    "inactive": 6,
    "graduated": 4,
    "transferred": 3,
    "dropped_out": 2
  }
}
```

Changes:
- All numeric fields now reflect the full tenant population (not the current page)
- `studentsOnFinancialAid` (integer) added — count of students where `bursary_status != 'none'`
- `bursaryCoveragePercentage` remains but is now computed from full population

## State Transitions

No new state transitions. The `status` and `bursary_status` fields on `students`, and the `status` field on `ledger_adjustments`, are unchanged.
