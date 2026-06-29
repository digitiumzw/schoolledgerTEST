# Data Model: Ledger and Payment System Refactor

**Branch**: `020-ledger-payment-refactor`
**Phase**: 1 — Design
**Date**: 2026-04-08

---

## Summary of Changes

This refactor makes targeted schema changes via new migrations. No existing migration files are modified (Constitution Principle IV).

### Changes Overview

| Change | Type | Migration Required |
|--------|------|--------------------|
| Backfill `charge_type` for NULL rows | Data migration | Yes — new migration |
| Add `billing_run_id` NOT NULL constraint after backfill | Schema alter | Yes — new migration |
| Remove `charge_generation_history` JSON field dependency | Code only | No |
| Add unique constraint on `billing_runs(tenant_id, term_id)` filtered | Schema alter | Yes — new migration |
| Add `(tenant_id, student_id, status)` index on `ledger_adjustments` | Schema alter | Yes — new migration |
| Add `(student_id, effective_date)` index on `ledger_adjustments` | Schema alter | Yes — new migration |
| Deprecate `is_fee_structure` / `is_transport` in queries (not schema drop) | Code only | No — schema drop is Phase B |

---

## Entities

### 1. Charge

**Table**: `charges`
**Purpose**: Represents a fee levied against a student for a specific term. Immutable after creation; corrections via `ledger_adjustments`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(100) PK | UUID |
| `tenant_id` | VARCHAR(50) FK | Required — multi-tenant isolation |
| `student_id` | VARCHAR(50) FK | Required |
| `charge_type` | ENUM('fee_structure','transport','other') | **Authoritative classifier** — all queries use this |
| `category` | VARCHAR(100) | Fee name (Tuition, Development, etc.) |
| `status` | ENUM('pending','partial','paid','waived','cancelled') | Updated by FIFO allocation on payment |
| `amount` | DECIMAL(10,2) | Original levied amount (after bursary reduction) |
| `due_date` | DATE | Default: date_generated + 30 days |
| `date_generated` | DATE | When charge was created |
| `term_id` | VARCHAR(50) | FK to terms — required for new charges |
| `academic_year` | VARCHAR(20) | e.g., "2025-2026" |
| `billing_run_id` | VARCHAR(50) FK | Links to billing_runs — required for bulk-generated charges |
| `description` | TEXT | Optional notes |
| `generation_batch_id` | VARCHAR(100) | Groups charges from same bulk generation event |
| `is_opening_balance` | TINYINT(1) | Prevents undo of historical opening entries |
| `created_by` | VARCHAR(50) | User who triggered generation |
| `deleted_at` | DATETIME NULL | Soft delete — used when billing run is undone |
| `deletion_reason` | TEXT NULL | Required when deleting |
| `voided_at` | DATETIME NULL | Reserved for charge-level voiding (future) |
| `voided_by` | VARCHAR(50) NULL | |
| `is_fee_structure` | TINYINT(1) NULL | **DEPRECATED** — kept for backward compat; will be dropped in Phase B |
| `is_transport` | TINYINT(1) NULL | **DEPRECATED** — kept for backward compat; will be dropped in Phase B |
| `route_id` | VARCHAR(50) NULL | Transport route reference |
| `created_at` | DATETIME | |
| `updated_at` | DATETIME | |

**State Transitions**:
```
pending → partial   (payment covers part of charge)
pending → paid      (payment covers full charge)
partial → paid      (subsequent payment covers remainder)
pending → waived    (manual adjustment marks charge waived)
pending → cancelled (billing run voided — future)
```

**Validation Rules**:
- `amount` must be > 0 (zero-amount charges are skipped during generation)
- `charge_type` must be set on all new inserts
- `billing_run_id` must be set when generated via billing run
- `deleted_at` and `deletion_reason` must be set together

**Indexes** (existing + new):
- `(tenant_id, student_id)` — existing
- `idx_charges_term_id` — existing
- `idx_charges_tenant_term` on `(tenant_id, term_id)` — existing
- `idx_charges_billing_run` on `billing_run_id` — existing
- `idx_charges_charge_type` on `(tenant_id, charge_type, status)` — **NEW** (supports FIFO allocation)

---

### 2. Payment

**Table**: `payments`
**Purpose**: Records a financial transaction where money is received from or on behalf of a student.

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(50) PK | UUID |
| `tenant_id` | VARCHAR(50) FK | Required |
| `student_id` | VARCHAR(50) FK | Required |
| `amount` | DECIMAL(10,2) | Must be > 0 |
| `date` | DATE | Payment date |
| `method` | VARCHAR(50) | One of: Cash, EcoCash, Bank Transfer, ZIPIT, Swipe, Cheque, Other |
| `category` | VARCHAR(100) | Fee category paid |
| `description` | TEXT NULL | Optional notes |
| `is_fee_structure` | TINYINT(1) NULL | **DEPRECATED** — derived from `category`; queries will use category/charge_type instead |
| `route_id` | VARCHAR(50) NULL | Set for transport payments |
| `created_at` | DATETIME | |
| `updated_at` | DATETIME | |

**Virtual/Derived Fields** (API response only, not stored):
- `month` — derived from `date` via `date('n', strtotime($date))`

**Validation Rules**:
- `amount` must be > 0 and ≤ 1,000,000
- `method` must be in the VALID_METHODS whitelist
- `date` must be YYYY-MM-DD format
- `student_id` must belong to the same `tenant_id`

**Indexes** (existing):
- `(tenant_id, student_id)`
- `(tenant_id, date DESC)` — **NEW** (supports date-range report queries)

---

### 3. Billing Run

**Table**: `billing_runs`
**Purpose**: Records each bulk charge generation event. Enables preview → finalize → optionally void workflow.

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(50) PK | UUID |
| `tenant_id` | VARCHAR(50) FK | Required |
| `term_id` | VARCHAR(50) | Required |
| `academic_year` | VARCHAR(20) | e.g., "2025-2026" |
| `status` | ENUM('pending','completed','voided') | `completed` = charges generated; `voided` = undone |
| `total_students` | INT | Count of students charged |
| `excluded_students` | INT | Count skipped (0-amount, inactive, etc.) |
| `total_amount` | DECIMAL(12,2) | Sum of all generated charge amounts |
| `fee_breakdown` | JSON | Per-category and per-class breakdown |
| `confirmation_notes` | TEXT NULL | Optional bursar notes at finalize |
| `confirmed_by` | VARCHAR(50) NULL | User ID who finalized |
| `confirmed_at` | DATETIME NULL | |
| `voided_by` | VARCHAR(50) NULL | User ID who voided |
| `voided_at` | DATETIME NULL | |
| `void_reason` | TEXT NULL | Required when voiding |
| `created_at` | DATETIME | |
| `updated_at` | DATETIME | |

**State Transitions**:
```
[none] → pending    (preview created — optional intermediate state)
pending → completed (finalize called; charges generated)
completed → voided  (void called; charges soft-deleted IF no payments)
```

**Validation Rules**:
- Only one non-voided billing run per `(tenant_id, term_id)` — enforced by unique constraint
- Voiding requires `void_reason`
- Cannot void if any charge in the run has a payment allocated against it

**Indexes** (existing + new):
- `(tenant_id, term_id)` — existing
- `(tenant_id, academic_year)` — existing
- `idx_billing_runs_status` on `(tenant_id, status)` — **NEW** (for active-run lookup)

---

### 4. Ledger Adjustment

**Table**: `ledger_adjustments`
**Purpose**: Manual correction to a student's balance without mutating charges or payments. Immutable audit record.

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(100) PK | UUID |
| `tenant_id` | VARCHAR(50) FK | Required |
| `student_id` | VARCHAR(50) FK | Required |
| `adjustment_type` | ENUM('credit','debit') | `credit` reduces balance; `debit` increases balance |
| `category` | ENUM('correction','refund','write_off','fee_waiver','late_fee','penalty','discount','other') | Required |
| `amount` | DECIMAL(10,2) | Must be > 0 |
| `reason` | TEXT | Required — audit record |
| `reference_type` | ENUM('charge','payment','none') | What the adjustment references |
| `reference_id` | VARCHAR(100) NULL | ID of referenced charge or payment |
| `term_id` | VARCHAR(50) NULL | Optional term association |
| `effective_date` | DATE | Date adjustment takes effect |
| `status` | ENUM('pending','approved','rejected','voided') | Currently auto-approved |
| `approved_by` | VARCHAR(50) NULL | |
| `approved_at` | DATETIME NULL | |
| `voided_at` | DATETIME NULL | |
| `voided_by` | VARCHAR(50) NULL | |
| `void_reason` | TEXT NULL | Required when voiding |
| `created_by` | VARCHAR(50) | User who created |
| `created_at` | DATETIME | |
| `updated_at` | DATETIME | |

**Validation Rules**:
- `amount` must be > 0
- `reason` is required (cannot be empty)
- `voided_at` and `void_reason` must be set together
- Voided adjustments have zero effect on balance

**Indexes** (existing + new):
- `(tenant_id, student_id)` — existing
- `(tenant_id, created_at)` — existing
- `idx_adj_status` on `(tenant_id, student_id, status)` — **NEW** (balance query filter)
- `idx_adj_effective_date` on `(student_id, effective_date)` — **NEW** (audit queries)

---

### 5. Refund

**Table**: `refunds`
**Purpose**: Tracks structured refund of overpaid or incorrect charges. Always linked to a credit adjustment.

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(100) PK | UUID |
| `tenant_id` | VARCHAR(50) FK | Required |
| `student_id` | VARCHAR(50) FK | Required |
| `refund_type` | ENUM('full','partial') | Required |
| `amount` | DECIMAL(10,2) | Must be > 0 |
| `original_payment_id` | VARCHAR(50) NULL | Payment being refunded |
| `original_charge_id` | VARCHAR(100) NULL | Charge being refunded |
| `reason` | TEXT | Required |
| `refund_method` | ENUM('cash','bank_transfer','check','credit_note','other') | Default: credit_note |
| `reference_number` | VARCHAR(100) NULL | Check #, transfer ID, etc. |
| `status` | ENUM('pending','processed','completed','cancelled') | Default: pending |
| `processed_at` | DATETIME NULL | |
| `processed_by` | VARCHAR(50) NULL | |
| `adjustment_id` | VARCHAR(100) FK | **Required** — links to auto-created credit adjustment |
| `created_by` | VARCHAR(50) | |
| `created_at` | DATETIME | |
| `updated_at` | DATETIME | |

**State Transitions**:
```
pending → processed  (processRefund called; reference number required)
pending/processed → completed (completeRefund called)
pending/processed → cancelled (cancelRefund called; associated adjustment voided)
completed → [terminal] (cannot cancel; use reversal adjustment)
```

**Validation Rules**:
- `amount` must be ≤ remaining refundable on `original_payment_id` (if linked)
- `adjustment_id` must be set at creation time (atomic with adjustment insert)

---

### 6. Reconciliation Audit Log

**Table**: `reconciliation_audit_log`
**Purpose**: Append-only log of all financial events. Never updated or deleted.

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(100) PK | UUID |
| `tenant_id` | VARCHAR(50) FK | Required |
| `action_type` | ENUM(...) | See action types below |
| `entity_type` | ENUM('adjustment','refund','charge','payment','student') | |
| `entity_id` | VARCHAR(100) | ID of the affected record |
| `student_id` | VARCHAR(50) NULL | Denormalized for fast lookup |
| `amount` | DECIMAL(10,2) NULL | Amount involved in the event |
| `balance_before` | DECIMAL(10,2) NULL | Balance before the event |
| `balance_after` | DECIMAL(10,2) NULL | Balance after the event |
| `details` | JSON | Full context (actor, reason, related IDs) |
| `ip_address` | VARCHAR(45) NULL | |
| `user_agent` | TEXT NULL | |
| `performed_by` | VARCHAR(50) | User or system that triggered the action |
| `performed_at` | DATETIME | When the event occurred |

**Action Types** (ENUM):
`adjustment_created`, `adjustment_approved`, `adjustment_rejected`, `adjustment_voided`,
`refund_initiated`, `refund_processed`, `refund_completed`, `refund_cancelled`,
`balance_recalculated`, `charge_voided`, `payment_voided`, `manual_override`,
`charge_generated`, `billing_run_finalized`, `billing_run_voided`, `payment_recorded`

---

## Balance Formula (Canonical)

The authoritative balance formula is:

```
balance = SUM(active_charges.amount)
        + SUM(approved_debit_adjustments.amount)
        - SUM(payments.amount)
        - SUM(approved_credit_adjustments.amount)
```

Where:
- **Active charges**: `deleted_at IS NULL AND voided_at IS NULL`
- **Payments**: All payments for the student (no filter — see separation below)
- **Approved adjustments**: `status = 'approved'`

**Fee vs. Transport Separation**:
The system tracks two separate balance dimensions:
- **Fee balance**: charges with `charge_type = 'fee_structure'` vs. payments where `route_id IS NULL`
- **Transport balance**: charges with `charge_type = 'transport'` vs. payments where `route_id IS NOT NULL`
- **Total balance**: sum of both (what is displayed to user)

---

## New Migrations Required

| # | Migration Name | Change |
|---|---------------|--------|
| 1 | `2026-04-08-000001_Backfill_charge_type_from_flags.php` | UPDATE charges SET charge_type based on is_fee_structure/is_transport for NULL rows |
| 2 | `2026-04-08-000002_Add_charge_type_indexes.php` | Add `idx_charges_charge_type` on `(tenant_id, charge_type, status)` |
| 3 | `2026-04-08-000003_Add_adjustment_indexes.php` | Add `idx_adj_status` and `idx_adj_effective_date` to `ledger_adjustments` |
| 4 | `2026-04-08-000004_Add_billing_run_status_index.php` | Add `idx_billing_runs_status` on `(tenant_id, status)` |
| 5 | `2026-04-08-000005_Add_payment_date_index.php` | Add `(tenant_id, date DESC)` index on `payments` |
| 6 | `2026-04-08-000006_Add_billing_run_unique_constraint.php` | Add unique constraint on `billing_runs(tenant_id, term_id)` where status != 'voided' (application-level check) |

---

## New Service Class: LedgerService

**Location**: `backend/app/Services/LedgerService.php`
**Purpose**: Centralizes all balance calculation logic to eliminate the duplicate implementations in `LedgerController` and `ReconciliationController`.

**Public Methods**:

```php
class LedgerService {
    // Single authoritative balance calculation
    public function getStudentBalance(string $studentId, string $tenantId): array
    // Returns: {studentId, totalCharges, totalPayments, creditAdjustments, debitAdjustments, balance, feeBalance, transportBalance}

    // Optimized bulk balance for all students (avoids N+1)
    public function getAllBalances(string $tenantId): array
    // Returns: [{studentId, balance, feeBalance, transportBalance}, ...]

    // FIFO charge allocation — called atomically with payment insert
    public function allocatePaymentToCharges(string $studentId, string $tenantId, object $db): void

    // Check if a billing run is safe to void (no payments against its charges)
    public function isBillingRunVoidable(string $billingRunId, string $tenantId): bool

    // Calculate aged balances for report
    public function getAgedBalances(string $tenantId, string $termId): array
    // Returns: [{student, current, 1_30, 31_60, 61_90, 90plus}, ...]

    // Payment collection report data
    public function getPaymentCollectionReport(string $tenantId, string $termId): array
    // Returns: {totalCharged, totalCollected, collectionRate, byStudent[...]}
}
```
