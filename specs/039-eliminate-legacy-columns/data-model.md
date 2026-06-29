# Phase 1 Data Model: Eliminate Legacy Columns

**Feature**: 039-eliminate-legacy-columns
**Date**: 2026-04-20

This refactor is **subtractive**: no new tables, columns, indexes, or relationships are introduced. The document below describes the `charges` and `payments` tables before and after the change and enumerates the invariants that must still hold.

## Entity: `charges` (modified)

| Column | Before | After | Notes |
|--------|--------|-------|-------|
| `id` | VARCHAR(100) PK | unchanged | |
| `tenant_id` | VARCHAR(50) | unchanged | Mandatory tenant scope (Principle I) |
| `student_id` | VARCHAR(50) FK → `students.id` | unchanged | |
| `category` | VARCHAR(100) | unchanged | Free-text label, kept |
| `charge_type` | ENUM(`fee_structure`, `transport`, `other`), default `other`, indexed | unchanged | **Canonical replacement** for the dropped flags |
| `status` | ENUM(`pending`, `partial`, `paid`, `waived`, `cancelled`) | unchanged | |
| `amount` | DECIMAL(10,2) | unchanged | |
| `date_generated` | DATE | unchanged | |
| `due_date` | DATE NULL | unchanged | |
| `academic_session` | VARCHAR(20) NULL | unchanged | Deferred from this change |
| `term` | VARCHAR(50) NULL | unchanged | Deferred |
| `term_id` | VARCHAR(50) NULL FK | unchanged | |
| `description` | TEXT NULL | unchanged | |
| `generation_batch_id` | VARCHAR(100) NULL | unchanged | |
| `billing_run_id` | VARCHAR(100) NULL FK → `billing_runs.id` | unchanged | Still actively used |
| `academic_year` | VARCHAR(10) NULL | unchanged | Deferred |
| `is_late_enrollment` | TINYINT NULL | unchanged | Distinct feature, unrelated |
| `student_enrollment_date` | DATE NULL | unchanged | |
| `is_opening_balance` | TINYINT NULL | unchanged | Still in active use |
| `route_id` | VARCHAR(50) NULL FK → `transport_routes.id` | unchanged | |
| `deleted_at` | DATETIME NULL | unchanged | Soft-delete marker |
| `deletion_reason` | TEXT NULL | unchanged | |
| `created_at` / `updated_at` | DATETIME NULL | unchanged | |
| **`is_fee_structure`** | TINYINT(1) NULL | **DROPPED** | Superseded by `charge_type = 'fee_structure'` |
| **`is_transport`** | BOOLEAN DEFAULT 0 | **DROPPED** | Superseded by `charge_type = 'transport'` |

### Indexes on `charges` (unchanged)

- PK: `id`
- Composite: `(tenant_id, student_id)`
- `idx_charges_charge_type` on `charge_type`
- `idx_charges_status`, `idx_charges_date_generated`, `idx_charges_due_date`, `idx_charges_deleted_at`, `idx_charges_academic_session`
- FK indexes on `billing_run_id`, `route_id`, `created_by`, `term_id`

No indexes reference the dropped columns, so no index cleanup is required.

### Derivation mapping (for any consumer that still needs the legacy semantics)

```sql
-- Former: WHERE is_fee_structure = 1
-- Now:    WHERE charge_type = 'fee_structure'

-- Former: WHERE is_transport = 1
-- Now:    WHERE charge_type = 'transport'

-- Former SELECT is_fee_structure, is_transport FROM charges;
-- Now:
SELECT
  (charge_type = 'fee_structure') AS is_fee_structure,
  (charge_type = 'transport')     AS is_transport
FROM charges;
```

## Entity: `payments` (modified)

| Column | Before | After | Notes |
|--------|--------|-------|-------|
| `id` | VARCHAR(50) PK | unchanged | |
| `student_id` | VARCHAR(50) FK | unchanged | |
| `tenant_id` | VARCHAR(50) | unchanged | |
| `amount` | DECIMAL(10,2) | unchanged | |
| `date` | DATE | unchanged | |
| `method` | VARCHAR(50) | unchanged | |
| `description` | TEXT NULL | unchanged | |
| `category` | VARCHAR(50) | unchanged | Free-text, kept |
| `route_id` | VARCHAR(50) NULL | unchanged | |
| `month` | (exists in some envs) | unchanged | Deferred |
| `created_at` / `updated_at` | DATETIME NULL | unchanged | |
| **`is_fee_structure`** | TINYINT(1) NULL | **DROPPED** | No indexed use; fee-structure context derivable from `category` or from the charges being applied to. |

### Indexes on `payments` (unchanged)

- PK: `id`
- Composite: `(tenant_id, student_id)`
- FK to `students.id`

No indexes reference `is_fee_structure`.

### Derivation mapping

```sql
-- Former: WHERE is_fee_structure = 1
-- Now (approximate, when needed): WHERE category IN (<fee-structure categories>)
--   or JOIN charges c ON c.student_id = payments.student_id
--              AND c.category = payments.category
--              AND c.charge_type = 'fee_structure'
```

The `StudentController` API formatters currently expose `isFeeStructure` as a boolean derived from the column; after this change that boolean is removed from the API output entirely (see `contracts/api-changes.md`).

## Invariants preserved

1. **Financial ledger integrity (Principle V)**: Student balance remains `SUM(charges.amount) - SUM(payments.amount)` filtered by `tenant_id` and `charges.deleted_at IS NULL`. The bulk subquery pattern in `StudentModel::getFilteredStudents` is unaffected — it already uses `charge_type IN ('fee_structure', 'transport')` and not the legacy flags.
2. **Multi-tenant isolation (Principle I)**: Every query in touched code paths continues to filter on `tenant_id`.
3. **Soft-delete semantics**: `charges.deleted_at` remains the only soft-delete signal; the drop does not interact with soft deletes.
4. **Referential integrity**: No FKs reference the dropped columns; no cascade behavior is affected.

## State transitions

Not applicable — no new states, workflows, or lifecycle stages.

## Validation rules (from requirements)

| FR | Applied to |
|----|------------|
| FR-001 | Inventory in `research.md` §Decision 2 |
| FR-002 | `2026-04-21-000000_Drop_legacy_charge_and_payment_flags.php` (Phase 2 output) |
| FR-003 | `ChargeModel.php`, `PaymentModel.php` edits listed in plan §Source Code |
| FR-004 | `LedgerController`, `StudentController`, `TransportController` edits |
| FR-005 | `StudentController` API formatter edits + `frontend/src/types/dashboard.ts` |
| FR-006 | `frontend/src/types/dashboard.ts` sweep (only file referencing the fields) |
| FR-007 | Migration `down()` recreates columns with original type (no data) |
| FR-008 | Quickstart verification steps in `quickstart.md` |
