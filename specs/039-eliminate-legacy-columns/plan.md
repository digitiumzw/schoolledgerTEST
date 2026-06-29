# Implementation Plan: Eliminate Legacy Columns

**Branch**: `039-eliminate-legacy-columns` | **Date**: 2026-04-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/039-eliminate-legacy-columns/spec.md`

## Summary

Remove deprecated database columns that have been superseded by newer schema designs, and update all backend/frontend code paths that still read or write them. The confirmed legacy columns are the `is_fee_structure` / `is_transport` boolean flags on `charges` (replaced by the `charge_type` ENUM in migration `2026-01-29-120000_Improve_charges_schema`) and `payments.is_fee_structure` (no longer needed — fee-structure context is derivable from `payments.category` and the matching charge's `charge_type`). A backfill migration (`2026-04-08-000001_Backfill_charge_type_from_flags`) already populated `charge_type` for all rows, so the flags are safe to drop. The refactor proceeds in three ordered waves: (1) stop writing the legacy columns in controllers/seeders/factories, (2) stop reading them (models, `formatForApi` outputs, API consumers in frontend), (3) drop the physical columns with reversible migrations. Scope is intentionally constrained to these confirmed columns; `research.md` documents additional candidates reviewed and deferred.

## Technical Context

**Language/Version**: PHP 8.1+ (backend) · TypeScript 5.x / React 18 (frontend)
**Primary Dependencies**: CodeIgniter 4, JWT, MySQL (backend) · Vite, TanStack React Query v5, shadcn/ui, React Hook Form + Zod, Axios (frontend)
**Storage**: MySQL — tables affected: `charges`, `payments`
**Testing**: PHPUnit (backend); manual smoke + existing Playwright suites (frontend). Verification is primarily migration-safety driven (run `php spark migrate` then `php spark migrate:rollback`) and grep-based reference sweeps.
**Target Platform**: Linux server (backend) · Modern browsers (frontend SPA)
**Project Type**: Web application (backend + frontend monorepo)
**Performance Goals**: No regression in ledger balance query latency. `getFilteredStudents` subquery pattern must remain intact.
**Constraints**:
- Migrations MUST be reversible (down() recreates the dropped columns; data in the dropped columns is considered discardable because it is fully derivable from `charges.charge_type` / `payments.category`).
- Zero downtime is NOT required — schema change runs during maintenance window.
- No data loss for active (non-legacy) fields.
**Scale/Scope**:
- 3 columns to drop (`charges.is_fee_structure`, `charges.is_transport`, `payments.is_fee_structure`)
- ~10 backend files touched (models, 3 controllers, 2 seeders/factories)
- ~1 frontend type file touched (`types/dashboard.ts`)
- 1 new migration file (drop columns; data-only, no FK implications)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Compliance | Notes |
|-----------|------------|-------|
| I. Multi-Tenant Data Isolation | PASS | Refactor does not introduce new queries; existing `tenant_id` filtering in touched code paths is preserved. |
| II. API-First Separation | PASS | API response shapes change only by removing optional `isFeeStructure` / `isTransport` fields (already marked deprecated in `frontend/src/types/dashboard.ts`). No business logic moved across the boundary. |
| III. JWT Authentication & Role-Based Access | PASS | No route or filter changes. |
| IV. Immutable Migrations | PASS | A new migration file is created; no existing migration is edited. The new migration's `down()` recreates the columns (without data) to preserve schema reversibility per the principle. |
| V. Financial Ledger Integrity | PASS | Balance is still `SUM(charges) - SUM(payments)` via `charge_type`-based subqueries (already the canonical path in `StudentModel::getFilteredStudents`). Removing the boolean flags does not alter the formula or the bulk subquery optimization. |

**Gate status**: PASS — proceed to Phase 0. Re-evaluated after Phase 1 below.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── Database/
│   │   ├── Migrations/
│   │   │   └── 2026-04-21-000000_Drop_legacy_charge_and_payment_flags.php   # NEW
│   │   └── Seeds/
│   │       ├── CompleteDatabaseSeeder.php                                    # edit
│   │       └── Factories/
│   │           ├── ChargeFactory.php                                         # edit
│   │           └── PaymentFactory.php                                        # edit
│   ├── Models/
│   │   ├── ChargeModel.php                                                   # edit (allowedFields)
│   │   └── PaymentModel.php                                                  # edit (allowedFields)
│   └── Controllers/Api/
│       ├── LedgerController.php                                              # edit (3 insert sites)
│       ├── StudentController.php                                             # edit (2 insert + 2 read sites)
│       └── TransportController.php                                           # edit (1 insert site)

frontend/
└── src/
    └── types/
        └── dashboard.ts                                                      # edit (remove deprecated fields)
```

**Structure Decision**: Standard monorepo layout (backend CodeIgniter + frontend React SPA) as established by the SchoolLedger constitution. No new directories are introduced.

## Post-Design Constitution Re-check

After drafting `research.md`, `data-model.md`, and `contracts/`, all five principles still pass. No new risks surfaced:

- No new queries or tables are introduced (Principle I, V).
- API contract changes are strictly subtractive (optional fields removed) and documented in `contracts/api-changes.md` (Principle II).
- No auth/role changes (Principle III).
- Single new migration, fully reversible on schema (Principle IV).

**Gate status**: PASS.

## Complexity Tracking

*No constitutional violations — this section is intentionally empty.*
