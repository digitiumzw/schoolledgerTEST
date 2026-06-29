# Data Model: Fix Ledger Balance Filtering

No schema changes are planned. This feature changes balance eligibility and aggregation semantics over existing records.

## Existing Entities

### Student

Represents the learner whose balance is being calculated.

Relevant fields:

- `id`: Student identifier
- `tenant_id`: Tenant ownership boundary
- `status`: Used by list/report filters

Validation rules:

- Every balance calculation must be scoped to one student or grouped by students within one tenant.
- Records from another student or tenant must never contribute to the calculated balance.

### Charge

Represents a debit-side financial obligation for a student.

Relevant fields:

- `student_id`: Student receiving the charge
- `tenant_id`: Tenant ownership boundary
- `amount`: Charge amount
- `charge_type`: Charge classification
- `deleted_at`: Soft-delete marker
- `voided_at`: Void marker
- `is_opening_balance`: Existing marker for opening-balance charge rows

Eligibility rules:

- Include only charges where `charge_type` is `fee_structure` or `transport`.
- Exclude charges where `deleted_at` is not null.
- Exclude charges where `voided_at` is not null.
- Opening-balance charges are included only when they also satisfy the eligible charge-type rule.

### Payment

Represents a credit-side payment made for a student.

Relevant fields:

- `student_id`: Student receiving the payment
- `tenant_id`: Tenant ownership boundary
- `amount`: Payment amount
- `category`: Payment category name
- `fee_campaign_id`: Campaign-payment marker used by existing non-ledger/campaign features
- `is_general_payment`: General-payment marker used by existing non-ledger features

Eligibility rules:

- Include only payments where `category` is exactly one of: `Fees`, `Transport + Fees`, `Transport Fee`.
- Exclude payments with any other category, even if they are system categories or contain similar wording.
- Payment rows must belong to the selected student and tenant.
- Existing non-ledger or campaign exclusions must not be weakened; if a row is outside the official ledger scope, it must remain excluded from student balance.

### Ledger Adjustment

Represents an approved manual correction to a student's eligible ledger balance.

Relevant fields:

- `student_id`: Student receiving the adjustment
- `tenant_id`: Tenant ownership boundary
- `amount`: Adjustment amount
- `adjustment_type`: `debit` or `credit`
- `status`: Approval lifecycle state

Eligibility rules:

- Include only adjustments where `status = 'approved'`.
- Debit adjustments increase the balance.
- Credit adjustments decrease the balance.
- Adjustments must belong to the selected student and tenant.

### Student Balance

Represents the current calculated financial position for one student.

Authoritative formula:

```text
Current Balance = (Total Charges + Debit Adjustments + Opening Balance) - (Total Payments + Credit Adjustments)
```

Implementation-level aggregation semantics:

```text
eligible_charge_total = SUM(charges.amount)
  where charge belongs to student and tenant
  and charge_type in ('fee_structure', 'transport')
  and deleted_at is null
  and voided_at is null

eligible_payment_total = SUM(payments.amount)
  where payment belongs to student and tenant
  and category in ('Fees', 'Transport + Fees', 'Transport Fee')
  and existing non-ledger/campaign exclusions still apply

approved_debit_adjustment_total = SUM(ledger_adjustments.amount)
  where adjustment belongs to student and tenant
  and adjustment_type = 'debit'
  and status = 'approved'

approved_credit_adjustment_total = SUM(ledger_adjustments.amount)
  where adjustment belongs to student and tenant
  and adjustment_type = 'credit'
  and status = 'approved'

current_balance = eligible_charge_total
  + approved_debit_adjustment_total
  - eligible_payment_total
  - approved_credit_adjustment_total
```

Opening balance is not a separate table in the current model. Existing opening-balance rows are represented as charges and therefore contribute through `eligible_charge_total` when their `charge_type` is eligible.

## Relationships

- Student 1-to-many Charge
- Student 1-to-many Payment
- Student 1-to-many Ledger Adjustment
- Student Balance is derived from related Charges, Payments, and Ledger Adjustments at query time

## State Transitions

No new state transitions are introduced.

Existing states that affect eligibility:

- Charge becomes ineligible when soft-deleted or voided.
- Ledger adjustment becomes eligible only when approved.
- Payment eligibility changes only if its category or existing ledger-scope markers change through existing workflows.

## Derived API Fields

Balance response fields remain derived values:

- `totalCharges`: Sum of eligible charges, including eligible opening-balance charge rows
- `totalPayments`: Sum of eligible payment categories
- `debitAdjustments`: Sum of approved debit adjustments
- `creditAdjustments`: Sum of approved credit adjustments
- `balance`: Derived current balance
- `feeBalance` and `transportBalance`: May remain for compatibility, but must not contradict the authoritative total balance semantics
