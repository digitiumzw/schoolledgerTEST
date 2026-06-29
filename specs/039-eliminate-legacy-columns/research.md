# Phase 0 Research: Eliminate Legacy Columns

**Feature**: 039-eliminate-legacy-columns
**Date**: 2026-04-20

This document identifies the concrete set of legacy columns to remove, establishes the evidence that each is safe to drop, and records candidates that were reviewed and **deferred** to keep the change scope tight and low-risk.

## Decision 1 — Scope: drop three flag columns

**Decision**: Drop the following physical columns in a single new migration:

| Table | Column | Type | Superseded by |
|-------|--------|------|---------------|
| `charges` | `is_fee_structure` | TINYINT(1) NULL | `charges.charge_type` ENUM (`'fee_structure'`, `'transport'`, `'other'`) |
| `charges` | `is_transport` | BOOLEAN | `charges.charge_type` ENUM (value `'transport'`) |
| `payments` | `is_fee_structure` | TINYINT(1) NULL | Derivable at query time via join to `charges.charge_type` or by inspecting `payments.category` |

**Rationale**:

- Migration `2026-01-29-120000_Improve_charges_schema.php` explicitly states the `charge_type` ENUM was added to **replace** the two boolean flags, and performs data migration in its `up()`.
- Migration `2026-04-08-000001_Backfill_charge_type_from_flags.php` is titled *"Backfill charge_type ENUM from legacy boolean flag columns"* and its docblock states: *"The boolean flag columns (is_fee_structure, is_transport) are NOT dropped here — they are deprecated and will be removed in a future Phase B migration."* This feature is that "Phase B".
- `frontend/src/types/dashboard.ts` already labels `isFeeStructure` and `isTransport` with the comment `// Deprecated: use chargeType === 'fee_structure'` / `=== 'transport'`.
- `StudentModel.php` line 470 contains the comment *"Get total charges using charge_type ENUM (retiring is_fee_structure/is_transport columns)"*, confirming intent.
- `payments.is_fee_structure` has no active read path that is not also available via `category` / charge-type correlation (see "Reference audit" below). The column was a convenience flag only.

**Alternatives considered**:

- *Keep the flags as redundant indexes for query convenience* — rejected: they are unindexed TINYINTs and `charge_type` already has an index (`idx_charges_charge_type`). No performance motivation to keep them.
- *Drop in two separate migrations (one per table)* — rejected: the refactor is atomic from an application-code perspective; splitting the migration adds no safety and complicates rollback.

## Decision 2 — Reference audit (what must change before the drop)

A ripgrep pass over `backend/app` and `frontend/src` identified the complete dependency surface:

**Backend writes to `charges.is_fee_structure` / `charges.is_transport`**:

- `app/Database/Seeds/Factories/ChargeFactory.php` — lines 86–87
- `app/Database/Seeds/CompleteDatabaseSeeder.php` — lines 395–396 (fee charges), 429–430 (transport charges)
- `app/Controllers/Api/LedgerController.php` — line 222 (`generateCharges`), line 774 (`createBillingRun`), line 1294 (late-enrollment supplementary billing)
- `app/Controllers/Api/StudentController.php` — line 479 (opening balance insert)

**Backend writes to `payments.is_fee_structure`**:

- `app/Database/Seeds/Factories/PaymentFactory.php` — line 64
- `app/Database/Seeds/CompleteDatabaseSeeder.php` — lines 451–453 (payment insertBatch)
- `app/Controllers/Api/TransportController.php` — line 964 (transport payment insert)

**Backend reads `payments.is_fee_structure`** (for API output):

- `app/Controllers/Api/StudentController.php` — line 290 (payment formatting in getStudent), line 1675 (charge formatting), line 1686 (payment formatting in ledger view)

**Backend reads `charges.is_fee_structure`** (for API output):

- `app/Controllers/Api/StudentController.php` — line 1675 (formatted as `isFeeStructure`)

**Model `allowedFields` that still list the legacy columns**:

- `app/Models/ChargeModel.php` — line 24 (`'is_fee_structure', 'is_transport', 'billing_run_id', 'academic_year'`)
- `app/Models/PaymentModel.php` — line 15 (`'is_fee_structure'`)

**Frontend**:

- `frontend/src/types/dashboard.ts` — lines 95–97 (`isFeeStructure?`, `isTransport?` already commented as deprecated).

No other references exist in controllers, models, views, or frontend hooks/pages.

## Decision 3 — Migration strategy

**Decision**: Create one forward-dated migration `2026-04-21-000000_Drop_legacy_charge_and_payment_flags.php` that:

- `up()`:
  1. Guards with `$this->db->fieldExists()` to remain idempotent across environments.
  2. Calls `$this->forge->dropColumn('charges', ['is_fee_structure', 'is_transport'])`.
  3. Calls `$this->forge->dropColumn('payments', 'is_fee_structure')`.
- `down()`:
  1. Re-adds the three columns with their original types and NULL-ability (data is **not** restored — documented in the class docblock as an acceptable loss because the data is fully recoverable from `charge_type` / `category`).

**Rationale**: Matches the established pattern in the codebase (see `2026-01-04-122000_RemoveWorkHoursFromTenants.php` and `2025-12-30-120500_Drop_status_column_from_staff.php` for precedent). Per Principle IV, the `down()` is schema-reversible; irreversibility is limited to the row-level legacy values and is acknowledged in the docblock.

**Alternatives considered**:

- *Mark the columns NULL and leave them as tombstones* — rejected: does not satisfy the spec's FR-001/FR-002 (columns must be removed from the schema).
- *Use raw SQL `ALTER TABLE … DROP COLUMN`* — rejected: the codebase consistently uses `$this->forge->dropColumn(...)`; staying consistent eases review.

## Decision 4 — Ordering of changes (deploy safety)

**Decision**: Land code changes **before** the migration, in two commits on the same branch:

1. **Commit A — "Stop writing and reading legacy flags"**: Remove insert-site writes in controllers/seeders/factories, remove reads in `StudentController` API formatters, remove fields from model `allowedFields`, drop deprecated fields from `frontend/src/types/dashboard.ts`. After this commit the columns exist in the DB but are untouched by the application.
2. **Commit B — "Drop legacy columns"**: Add the new migration file. Run `php spark migrate` during the deploy window.

**Rationale**: This ordering means that if Commit B's migration is temporarily reverted in an emergency, Commit A's code continues to work (it never needed the columns). It also means that in mixed-version deployment windows (old app container against newly-migrated DB) the legacy reads/writes in the old container would fail — so Commit A must be deployed and verified stable before Commit B's migration runs. This is standard expand/contract practice.

**Alternatives considered**:

- *Single combined commit* — rejected: loses the safety property above.
- *Three commits (one per column)* — rejected: no incremental value; the columns are logically a single deprecation group.

## Decision 5 — Out-of-scope columns (deferred)

The following columns were inspected during the audit and **deliberately deferred** to a future change:

| Column | Status | Why deferred |
|--------|--------|--------------|
| `charges.academic_year` | Likely legacy (duplicates `academic_session` and also exists on `billing_runs`) | `LedgerController.php` still writes and reads it from `billing_runs.academic_year`. Untangling requires a separate design decision about the canonical source of academic-year metadata. |
| `charges.academic_session`, `charges.term` | Possibly derivable from `term_id` | Still used by `ChargeModel::getByAcademicSession` and in API responses. Requires a separate spec to define the canonical term metadata model. |
| `charges.category` (VARCHAR) | Possibly redundant with `charge_type` ENUM | Currently used as a free-text label (e.g., `"Tuition"`, `"Development Levy"`); `charge_type` is coarser. They are **not equivalent** — category is kept. |
| `payments.month` | Derived at write time but stored | `PaymentModel::formatForApi` already *derives* `month` from `date`; the stored column may be unused on read. Deferred pending a targeted audit of direct-SQL consumers. |
| `charges.billing_run_id` | Still actively used | `LedgerController` uses it to group and void charges per billing run. **Keep**. |

**Rationale**: Keeping scope to the three proven-legacy flag columns maximizes the probability of a clean, reversible deploy. The deferred columns warrant their own specs because each has non-trivial read paths that would broaden the change surface.

## Consolidated outputs

- Columns to drop: 3 (`charges.is_fee_structure`, `charges.is_transport`, `payments.is_fee_structure`)
- Backend files to edit: 8 (2 models, 3 controllers, 1 seeder, 2 factories)
- Frontend files to edit: 1 (`types/dashboard.ts`)
- New migration files: 1
- Unresolved `NEEDS CLARIFICATION` items: **0**
