# Implementation Plan: School Fee Structure & Billing Engine

**Branch**: `056-fee-structure-billing` | **Date**: 2026-05-01 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/056-fee-structure-billing/spec.md`

## Summary

Introduce a dedicated `fee_rules` table that replaces the existing ad-hoc JSON fee blob in `tenants.fee_structure.defaultFees` as the authoritative source of billing policy. A new `FeeRuleBillingService` runs a manual, admin/bursar-initiated billing engine that reads active fee rules, resolves eligible students per rule (school-wide, class, category, or service scope), and inserts one charge record per student per rule per billing period — all inside a single DB transaction. Duplicate prevention is enforced at the DB level via a new UNIQUE constraint on `(student_id, fee_rule_id, billing_period)` in the `charges` table. The billing tab gains a period selector driven exclusively by the school's configured billing cycle (`feeStructure.structureType`) and an unbilled-student alert derived from the active academic term or current calendar month.

## Technical Context

**Language/Version**: PHP 8.1+ (backend), TypeScript / React 18 (frontend)  
**Primary Dependencies**: CodeIgniter 4 (backend MVC + ORM), React Query / TanStack Query (frontend data fetching), shadcn/ui + TailwindCSS (frontend UI)  
**Storage**: MySQL — new `fee_rules` table; additive columns `fee_rule_id` + `billing_period` on existing `charges` table; UNIQUE index for deduplication  
**Target Platform**: Linux server (backend API), browser SPA (frontend)  
**Project Type**: Web service + SPA  
**Performance Goals**: Generate charges for 500 students × 5 fee rules in < 20 s (SC-002); unbilled alert within 3 s of page load (SC-006)  
**Constraints**: Single DB transaction per generation run (FR-014); no automatic triggering by any scheduled process (FR-010); billing period type locked to school's `structureType` setting (FR-009)  
**Scale/Scope**: Multi-tenant; ~500 students per tenant per generation run; up to 20 fee rules per tenant

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Multi-Tenant Data Isolation | ✅ PASS | `fee_rules.tenant_id` on every query; generation scoped to `getTenantId()`; unique constraint includes tenant scope via `student_id` (already tenant-scoped) |
| II | API-First Separation of Concerns | ✅ PASS | Thin `FeeRuleController` calls `FeeRuleBillingService`; no DB logic in controller |
| III | JWT Authentication & Role-Based Access | ✅ PASS | Fee rule CRUD: `admin` only; charge generation: `admin` + `bursar`; enforced at route middleware and controller level |
| IV | Immutable Migrations | ✅ PASS | Two new migrations (fee_rules table, charges additive columns) — immutable, never edit existing migrations |
| V | Financial Ledger Integrity | ✅ PASS | Entire generation run in one `transBegin/transCommit`; rollback on any exception; UNIQUE constraint prevents duplicate charges |
| VI | REST API Standards | ✅ PASS | RESTful routes for fee rules; generation endpoint returns structured summary; errors use existing `error()` helper |
| VII | Code Quality & Maintainability | ✅ PASS | Service layer encapsulates billing engine; controller < 50 lines; all methods < 30 lines |
| VIII | Defensive Security | ✅ PASS | Amount validated > 0 at API level; period type validated against school setting; tenant isolation enforced at DB query level |
| IX | Error Handling & Observability | ✅ PASS | `log_message('error', ...)` on catch; generation summary includes skipped count + reasons; rollback logged |
| X | Integration Testing | ✅ PASS | Integration tests required per constitution: CRUD, generation happy path, duplicate skip, role enforcement, tenant isolation |
| XI | Performance Discipline | ✅ PASS | Batch student lookup per rule (no N+1); UNIQUE index on `(student_id, fee_rule_id, billing_period)`; index on `fee_rules(tenant_id, is_active)` |

**Post-design re-check**: All 11 principles PASS — see research.md for architectural decisions that preserve each gate.

## Project Structure

### Documentation (this feature)

```text
specs/056-fee-structure-billing/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── fee-rules.md     # Fee rule CRUD API contract
│   └── charge-generation.md  # Billing engine + alert API contract
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── Controllers/Api/
│   │   └── FeeRuleController.php          # NEW — CRUD + generate + alert
│   ├── Models/
│   │   └── FeeRuleModel.php               # NEW — fee_rules table model
│   ├── Services/
│   │   └── FeeRuleBillingService.php      # NEW — billing engine
│   └── Database/Migrations/
│       ├── YYYY-MM-DD-XXXXXX_Create_fee_rules_table.php        # NEW
│       └── YYYY-MM-DD-XXXXXX_Add_fee_rule_id_to_charges.php    # NEW
└── tests/Integration/
    └── FeeRuleBillingTest.php             # NEW — integration tests

frontend/src/
├── api/
│   └── api.ts                            # MODIFIED — new interfaces + API fns
├── components/settings/
│   ├── FeeRulesPanel.tsx                 # NEW — fee rule list + CRUD UI
│   ├── FeeRuleModal.tsx                  # NEW — create/edit modal
│   └── FeeStructureTab.tsx               # MODIFIED — integrate FeeRulesPanel
├── components/billing/
│   └── FeeRuleGenerationPanel.tsx        # NEW — period selector + generate btn + summary
└── hooks/
    └── useFeeRules.ts                    # NEW — React Query hook for fee rules
```

**Structure Decision**: Web application layout (Option 2). Backend: thin controller + service layer + model. Frontend: new components in existing `settings/` and `billing/` directories.
