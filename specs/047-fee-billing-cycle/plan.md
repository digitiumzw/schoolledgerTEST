# Implementation Plan: Fee Structure Billing Cycle Configuration

**Branch**: `047-fee-billing-cycle` | **Date**: 2026-04-27 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/047-fee-billing-cycle/spec.md`

## Summary

Allow each school to choose between **termly** and **monthly** billing cycles as part of their fee structure configuration. When **monthly** is selected, the `finalizeBilling` charge-generation path splits each fee category into equal monthly installments derived from the term's start/end dates, with correct rounding. The setting is stored in the existing `fee_structure` JSON field on the `tenants` table (no schema change required). The frontend `FeeStructureTab` gains a billing cycle selector; the billing preview and charge generation confirmation modal surface the cycle and installment breakdown.

## Technical Context

**Language/Version**: PHP 8.1 (backend) · TypeScript / React 18 (frontend)  
**Primary Dependencies**: CodeIgniter 4 · MySQL · Vite · TailwindCSS · shadcn/ui · TanStack React Query  
**Storage**: MySQL — `tenants.fee_structure` (JSON column, schema-less, no migration needed for this feature); `charges` table receives additional rows per installment under monthly mode  
**Testing**: CodeIgniter 4 `CIUnitTestCase` + `FeatureTestTrait` (integration tests in `backend/tests/`)  
**Target Platform**: Linux web server (backend) · Browser SPA (frontend)  
**Project Type**: Multi-tenant web application (API + React SPA)  
**Performance Goals**: Charge generation for a 3-month term with 50 students and 2 fee categories produces 300 rows in under 15 seconds (SC-002). No N+1 query patterns introduced.  
**Constraints**: All queries must include `tenant_id` from JWT. Monthly installment totals must match term fee to the cent. No additional DB columns on `charges`; installment metadata via `description` and `due_date` fields.  
**Scale/Scope**: 2 new UI controls in `FeeStructureTab`; modifications to `finalizeBilling` and `getBillingPreview` methods; 1 new backend helper method for installment calculation; integration tests covering both billing cycles.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Multi-Tenant Data Isolation | ✅ PASS | `structureType` read from `fee_structure` fetched by JWT-sourced `tenant_id` only. No cross-tenant read. Monthly charge rows all carry `tenant_id`. |
| II. API-First Separation of Concerns | ✅ PASS | Billing cycle selector persisted via existing `PUT /api/settings/fee-structure`; generation via existing `POST /api/billing/finalize`. No business logic in frontend. |
| III. JWT Authentication & Role-Based Access | ✅ PASS | `saveFeeStructure` and `finalizeBilling` already behind `JWTAuthFilter`. FR-011 (admin-only) enforced at controller level. |
| IV. Immutable Migrations | ✅ PASS | No schema changes required. `structureType` already exists in the `fee_structure` JSON field. Existing migrations untouched. |
| V. Financial Ledger Integrity | ✅ PASS | Monthly charges are inserted as individual immutable rows. Balance = `SUM(charges) - SUM(payments)` formula unchanged. Rounding rule ensures zero net loss per student per fee category. |
| VI. REST API Standards | ✅ PASS | Reusing existing REST endpoints. `getBillingPreview` response extended with `billingCycle` and `installments` fields via `respondSuccess`. |
| VII. Code Quality & Maintainability | ✅ PASS | Installment calculation extracted to a dedicated private method `calculateMonthlyInstallments()` in `LedgerController`. No duplication. |
| VIII. Defensive Security | ✅ PASS | `structureType` validated as `termly`\|`monthly` in `saveFeeStructure`. Term dates validated via `AcademicCalendarService` before any charge insertion. |
| IX. Error Handling & Observability | ✅ PASS | All error paths return structured error envelope. Monthly generation failures roll back inside existing `transStart/transComplete` block. |
| X. Integration Testing | ✅ PASS | Integration tests required for: termly path (regression), monthly path (happy + edge), duplicate prevention under monthly, tenant isolation. |
| XI. Performance Discipline | ✅ PASS | Monthly installments generated inside the existing student loop — no extra DB queries per installment. `installmentMonths()` is a pure date calculation with O(n) complexity where n ≤ 4 months. |

**Post-Phase 1 re-check**: No new violations introduced. No Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/047-fee-billing-cycle/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── api-contracts.md # Phase 1 output
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (affected paths)

```text
backend/
├── app/
│   └── Controllers/
│       └── Api/
│           ├── LedgerController.php      # finalizeBilling + getBillingPreview modified;
│           │                             #   calculateMonthlyInstallments() added
│           └── SettingsController.php    # saveFeeStructure: allow 'monthly' structureType
└── tests/
    └── Controllers/
        └── Billing/
            └── BillingCycleTest.php      # New integration test class

frontend/
└── src/
    ├── components/
    │   └── settings/
    │       ├── FeeStructureTab.tsx        # Add billing cycle selector (UI only, delegates to hook)
    │       └── ChargeGenerationPanel.tsx  # Show billing cycle + installment count in preview
    ├── hooks/
    │   └── useFeeStructure.ts            # Add billingCycle field to state; expose updateBillingCycle
    └── types/
        └── dashboard.ts                  # FeeStructure.structureType already covers this;
                                          #   no new types needed
```

**Structure Decision**: Web application layout (Option 2). All backend changes are confined to existing controller files. No new controllers, models, or services — the feature is a focused enhancement to `LedgerController` and `SettingsController`. Frontend changes touch only the `FeeStructureTab` component, the `useFeeStructure` hook, and the `ChargeGenerationPanel`. This keeps the diff minimal and reviewable.

## Complexity Tracking

> No constitution violations to justify. All complexity fits within existing patterns.
