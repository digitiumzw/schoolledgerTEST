# Implementation Plan: Ledger and Payment System Refactor

**Branch**: `020-ledger-payment-refactor` | **Date**: 2026-04-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/020-ledger-payment-refactor/spec.md`

---

## Summary

Refactor the SchoolLedger financial ledger system to fix identified consistency issues, complete the billing run workflow, and add missing payment reports. The primary technical approach is:

1. Extract a `LedgerService` class to be the single authoritative source of balance calculation.
2. Retire the dual `is_fee_structure`/`is_transport` boolean flags in favour of the existing `charge_type` ENUM via a backfill migration.
3. Implement the incomplete billing run lifecycle (`getBillingPreview`, `finalizeBilling`, `voidBilling`).
4. Add three new report endpoints (payment collection, aged balances, revenue by category).
5. Fix the hardcoded term-detection logic in `PaymentController::termTotal()`.

---

## Technical Context

**Language/Version**: PHP 8.1+ (backend) · TypeScript 5.x / React 18 (frontend)
**Primary Dependencies**: CodeIgniter 4 (backend) · TanStack React Query, shadcn/ui, Zod (frontend)
**Storage**: MySQL — tables: `charges`, `payments`, `billing_runs`, `ledger_adjustments`, `refunds`, `reconciliation_audit_log`
**Testing**: Manual via Postman (backend) · manual browser testing (frontend) — no automated test suite exists
**Target Platform**: Linux server (backend REST API) · Browser SPA (frontend)
**Project Type**: Web application (monorepo: separate `backend/` and `frontend/`)
**Performance Goals**: Report queries complete in < 5 seconds for up to 1,000 students; balance queries < 500ms
**Constraints**: All queries must include `tenant_id` filter; balance must be computed at query time (never stored)
**Scale/Scope**: Single-tenant deployments of up to ~1,000 students per school; multi-tenant SaaS product

---

## Constitution Check

### Pre-Design Gate (before Phase 0 research)

| Principle | Compliance | Notes |
|-----------|-----------|-------|
| I. Multi-Tenant Data Isolation | PASS | All new queries filter by `tenant_id` from JWT payload. LedgerService receives `tenantId` as parameter (sourced from JWT in controllers). |
| II. API-First Separation | PASS | LedgerService is a backend-only class. No business logic moves to frontend. |
| III. JWT Auth & Role-Based Access | PASS | New `/api/reports/*` endpoints will be protected by JWTAuthFilter. Role check (`bursar`/`admin`/`super_admin`) enforced in controller. |
| IV. Immutable Migrations | PASS | Six new migration files created. Zero existing migrations modified. |
| V. Financial Ledger Integrity | PASS | Balance formula unchanged and consolidated into single LedgerService method. `getAllBalances()` subquery pattern preserved. No stored balance column introduced. |

### Post-Design Re-Check

| Principle | Compliance | Notes |
|-----------|-----------|-------|
| I. Multi-Tenant Data Isolation | PASS | data-model.md confirms `tenant_id` on all tables and all new queries. |
| II. API-First Separation | PASS | api-contracts.md defines all new endpoints; frontend consumes via api.ts only. |
| III. JWT Auth & Role-Based Access | PASS | Report endpoints restricted to `bursar`/`admin`/`super_admin`; quickstart.md documents role guard requirement. |
| IV. Immutable Migrations | PASS | 6 new migrations in numbered sequence; no edits to existing files. |
| V. Financial Ledger Integrity | PASS | LedgerService::getAllBalances() preserves the existing optimized subquery pattern. Balance is always derived, never stored. |

**Result**: All gates PASS. No violations to justify.

---

## Project Structure

### Documentation (this feature)

```text
specs/020-ledger-payment-refactor/
├── plan.md              # This file
├── research.md          # Phase 0 output — decisions for 9 unknowns
├── data-model.md        # Phase 1 output — entity schemas, migration list, LedgerService API
├── quickstart.md        # Phase 1 output — implementation order and gotchas
├── contracts/
│   └── api-contracts.md # Phase 1 output — request/response shapes for new/changed endpoints
└── tasks.md             # Phase 2 output — created by /speckit.tasks (NOT this command)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── Config/
│   │   └── Routes.php                     # Add /api/reports/* routes
│   ├── Controllers/
│   │   └── Api/
│   │       ├── LedgerController.php       # Complete billing run methods; delegate balance to LedgerService
│   │       ├── PaymentController.php      # Fix term detection; delegate FIFO to LedgerService
│   │       └── ReconciliationController.php  # Delegate balance to LedgerService
│   ├── Database/
│   │   └── Migrations/
│   │       ├── 2026-04-08-000001_Backfill_charge_type_from_flags.php
│   │       ├── 2026-04-08-000002_Add_charge_type_indexes.php
│   │       ├── 2026-04-08-000003_Add_adjustment_indexes.php
│   │       ├── 2026-04-08-000004_Add_billing_run_status_index.php
│   │       ├── 2026-04-08-000005_Add_payment_date_index.php
│   │       └── 2026-04-08-000006_Add_billing_run_unique_constraint.php
│   ├── Models/
│   │   ├── ChargeModel.php                # Remove legacy boolean flag code; use charge_type
│   │   └── PaymentModel.php               # Minor cleanup (month field documentation)
│   └── Services/
│       └── LedgerService.php              # NEW — single balance/report service

frontend/
├── src/
│   ├── api/
│   │   └── api.ts                         # Add report API calls; update balance response type
│   ├── hooks/
│   │   ├── useStudentBalance.ts           # Add feeBalance, transportBalance to interface
│   │   └── useChargeGeneration.ts         # Use billing finalize flow
│   └── pages/
│       └── Payments.tsx                   # Minor updates for new balance sub-totals if displayed
```

**Structure Decision**: Web application layout (Option 2). Backend and frontend are independent apps in a monorepo. The new `Services/` directory follows the existing CodeIgniter 4 convention.

---

## Complexity Tracking

No Constitution violations requiring justification.

---

## Phase 0: Research — Completed

All unknowns resolved. See `research.md` for full decisions.

| Unknown | Decision | File |
|---------|---------|------|
| Charge-payment linkage strategy | Retain FIFO re-allocation; junction table is a future enhancement | research.md §1 |
| Legacy field retirement approach | Phase A (backfill + code update) now; Phase B (column drop) later | research.md §2 |
| Canonical balance formula and owner | Extract to LedgerService; formula confirmed identical across both controllers | research.md §3 |
| Billing run implementation gap | Implement all 6 billing endpoints with full preview → finalize → void lifecycle | research.md §4 |
| Hardcoded term detection | Replace with academic calendar lookup; accept explicit termId param | research.md §5 |
| Report endpoints: new vs. extend | New `/api/reports/*` route group | research.md §6 |
| Concurrent billing run protection | Application-level unique check (return 409) + DB unique constraint | research.md §7 |
| `month` field on payments | Virtual/derived field — no DB column; no change needed | research.md §8 |
| Role enforcement for reports | bursar + admin + super_admin; teacher excluded | research.md §9 |

---

## Phase 1: Design — Completed

### Artifacts Generated

| Artifact | Location | Contents |
|----------|----------|---------|
| Data Model | `data-model.md` | Entity schemas, migration list, LedgerService method signatures |
| API Contracts | `contracts/api-contracts.md` | Request/response shapes for 14 new/changed endpoints |
| Quickstart | `quickstart.md` | Implementation order, testing approach, common gotchas |

### Key Design Decisions

1. **LedgerService** — single PHP service class owns all balance calculation. Controllers call it; they do not compute balances directly.

2. **Billing Run Lifecycle** — `POST /billing/finalize` is the new charge generation trigger. It creates a `billing_runs` record, generates charges atomically (with `billing_run_id` set on each charge), and prevents duplicate runs via application-level conflict check.

3. **Six New Migrations** — data migration (backfill), then five schema/index additions. All reversible via `down()`.

4. **Three New Report Endpoints** — `/api/reports/payment-collection`, `/api/reports/aged-balances`, `/api/reports/revenue-by-category`. All read-only, all tenant-scoped, all role-gated.

5. **Balance Response Extended** — existing `/api/ledger/student/:id/balance` response gains `feeBalance` and `transportBalance` sub-totals for clearer UI display.

### What Is NOT Changing

- FIFO payment allocation algorithm (confirmed correct)
- Adjustment auto-approval flow (future enhancement)
- Reconciliation audit log structure
- Role definitions
- Frontend routing or auth flow
- Frontend form validation approach (React Hook Form + Zod)

---

## Implementation Sequence (for tasks.md)

The following is the recommended task order for `/speckit.tasks`:

**Group 1 — Backend Foundation**
1. Write the 6 migration files
2. Run migrations against local DB; verify `SELECT COUNT(*) FROM charges WHERE charge_type IS NULL` = 0
3. Create `LedgerService.php` with all 7 public methods (stubs first, then implement one by one)
4. Write `getStudentBalance()` — replace both controller implementations
5. Write `getAllBalances()` — preserve subquery pattern
6. Write `allocatePaymentToCharges()` — moved from PaymentController
7. Write `isBillingRunVoidable()` — check for payments before void
8. Write `getAgedBalances()` — new report
9. Write `getPaymentCollectionReport()` — new report

**Group 2 — Model Updates**
10. Update `ChargeModel::formatForApi()` — use `charge_type` only; remove boolean flag code
11. Update `ChargeModel::getTransportChargesByStudent()` — use `charge_type = 'transport'`
12. Update `ChargeModel` pending/partial queries — add `charge_type` filter where relevant

**Group 3 — Controller Updates**
13. Update `PaymentController::create()` — delegate `allocatePaymentToCharges` to LedgerService
14. Update `PaymentController::termTotal()` — use academic calendar; accept `termId` param
15. Update `LedgerController::getStudentBalance()` — delegate to LedgerService
16. Update `LedgerController::getAllBalances()` — delegate to LedgerService
17. Implement `LedgerController::getBillingPreview()` — read-only preview
18. Implement `LedgerController::getBillingStatus()` — query billing_runs
19. Implement `LedgerController::finalizeBilling()` — full billing run + charge generation
20. Implement `LedgerController::voidBilling()` — soft-delete charges + update billing run
21. Implement `LedgerController::getUnbilledStudents()` — students without charges in term
22. Implement `LedgerController::generateSupplementaryBilling()` — subset billing
23. Add report methods (or new ReportController) for 3 report endpoints
24. Update `ReconciliationController::calculateStudentBalance()` — delegate to LedgerService
25. Add new routes in `Routes.php` for `/api/reports/*`

**Group 4 — Frontend Updates**
26. Add 3 new report API methods to `api.ts`
27. Update `StudentBalance` TypeScript interface in `useStudentBalance.ts`
28. Update `useChargeGeneration.ts` to use billing finalize flow
29. Update `Payments.tsx` if balance sub-totals need display

**Group 5 — Verification**
30. Balance consistency check: compare LedgerController vs ReconciliationController balance for 10+ students
31. FIFO allocation test: multi-charge payment recording
32. Billing run lifecycle test: preview → finalize → void
33. Report accuracy test: cross-check report totals against raw SQL
34. Concurrent billing run test: double finalize returns 409
