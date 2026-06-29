# Data Model: Fee Structure Billing Cycle Configuration

**Branch**: `047-fee-billing-cycle` | **Date**: 2026-04-27

---

## Overview

This feature introduces no new database tables or columns. All state changes are confined to:
1. The `fee_structure` JSON field on the `tenants` table (adds `structureType` value `"monthly"` as an actively-used cycle)
2. The `charges` table (additional rows per term under monthly mode — same schema, more records)
3. The `billing_runs` table (unchanged schema — one run per term regardless of cycle)

---

## Entity: Fee Structure (stored in `tenants.fee_structure` JSON)

Persisted as JSON in `tenants.fee_structure`. No separate table.

| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| `structureType` | `string` | Yes | `"termly"` \| `"monthly"` | **Changed**: previously accepted `"annual"` too; now only two valid values. Controls charge generation behaviour. |
| `termsPerYear` | `integer` | Yes | 1–4 | Unchanged |
| `defaultFees` | `object` | Yes | Keys: fee name strings; Values: positive numbers | Unchanged |
| `classOverrides` | `object` | No | Keys: class IDs; Values: `{ feeName: amount }` | Unchanged |

**Example (monthly)**:
```json
{
  "structureType": "monthly",
  "termsPerYear": 3,
  "defaultFees": {
    "Tuition": 300,
    "Books": 60
  },
  "classOverrides": {
    "c_form6": { "Tuition": 420 }
  }
}
```

---

## Entity: Charge (table: `charges`)

Schema is **unchanged**. Monthly billing produces multiple rows per student per fee category per term — one row per calendar month.

### Existing columns used by this feature

| Column | Type | Notes for monthly charges |
|--------|------|--------------------------|
| `id` | `VARCHAR(50)` | Generated per charge row as before |
| `tenant_id` | `VARCHAR(50)` | JWT-sourced tenant — unchanged |
| `student_id` | `VARCHAR(50)` | Unchanged |
| `term_id` | `VARCHAR(50)` | Same term ID for all installments in a term |
| `billing_run_id` | `VARCHAR(50)` | Same billing run ID for all installments in a term |
| `category` | `VARCHAR(*)` | Fee name (e.g., `"Tuition"`) — unchanged |
| `charge_type` | `ENUM` | Always `"fee_structure"` — unchanged |
| `amount` | `DECIMAL(12,2)` | **Installment amount** (≠ full term fee). Computed per research item 3. |
| `date_generated` | `DATE` | Date charge was created — unchanged |
| `due_date` | `DATE` | **1st of the installment's calendar month** (research item 4) |
| `description` | `TEXT` | `"{FeeName} – {MonthName} {Year}"` e.g. `"Tuition – January 2026"` |
| `term` | `VARCHAR(50)` | Term name for reference (e.g., `"Term 1"`) — unchanged |
| `academic_session` | `VARCHAR(20)` | Academic year — unchanged |
| `academic_year` | `VARCHAR(20)` | Unchanged |
| `status` | `ENUM` | `"pending"` — unchanged |

### Installment calculation rules

Given:
- `termFee` = fee amount for this student/category (after bursary multiplier applied)
- `months` = count of distinct calendar months in the term (see research item 2)

```
baseAmount  = floor(termFee × 100 / months) / 100
lastAmount  = termFee − (baseAmount × (months − 1))
```

Installments 1 through N-1 use `baseAmount`; installment N uses `lastAmount`.

**Example**: Tuition = $300, bursary = 0%, term = January–March (3 months)
- Installments 1 & 2: $100.00
- Installment 3: $100.00 (exact, no remainder in this case)

**Example with remainder**: $100 fee, 3 months
- base = floor(10000 / 3) / 100 = $33.33
- last = $100.00 − ($33.33 × 2) = $33.34

---

## Entity: Billing Run (table: `billing_runs`)

Schema is **unchanged**. One billing run per term per tenant, regardless of whether monthly or termly billing is used.

| Column | Notes |
|--------|-------|
| `id` | Unchanged |
| `tenant_id` | Unchanged |
| `term_id` | Unchanged — identifies the term, not individual months |
| `status` | `pending` → `completed` on success; `voided` on void |
| `total_amount` | Sum of ALL charge rows (all installments across all students) |
| `total_students` | Count of active students at generation time |
| `fee_breakdown` | JSON breakdown by class/fee — extended to include per-installment detail for monthly mode |

---

## State Transitions

### Fee Structure Billing Cycle
```
[not configured] → "termly" (default on first load)
"termly"         → "monthly" (admin saves fee structure)
"monthly"        → "termly"  (admin saves fee structure)
```
Changing the cycle after charges have been generated for a term has **no effect on existing charges** — only future generation runs use the new value.

### Charge Lifecycle (unchanged)
```
pending → partial → paid
pending → waived
pending → cancelled
[any]   → voided_at set (via void billing run)
[any]   → deleted_at set (via undo charges)
```

---

## Validation Rules

| Rule | Location | Detail |
|------|----------|--------|
| `structureType` must be `termly` or `monthly` | `SettingsController::saveFeeStructure()` | Return HTTP 400 if invalid |
| Term must have valid `start` and `end` dates before monthly generation | `AcademicCalendarService::canGenerateCharges()` | Existing guard — unchanged |
| `months` derived from term dates must be ≥ 1 | `LedgerController::calculateMonthlyInstallments()` | Guaranteed by the month-counting algorithm |
| Bursary multiplier applied before installment split | `LedgerController::finalizeBilling()` | Preserves Principle V integrity |
| One billing run per term (idempotency) | `LedgerController::finalizeBilling()` | Existing guard — unchanged |

---

## No New Migrations Required

The `structureType` field is already persisted in the `fee_structure` JSON blob. The `charges` table already has all columns needed (`due_date`, `description`, `term`, `billing_run_id`). The `billing_runs` table is unchanged.

The only backend-visible change is: **`"monthly"` now causes different charge rows to be inserted** — a behavioural change, not a schema change.
