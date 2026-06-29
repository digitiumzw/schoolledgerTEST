# Implementation Plan: Roll Back or Void Generated Charges

**Branch**: `064-rollback-void-charges` | **Date**: 2026-05-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/064-rollback-void-charges/spec.md`

## Summary

Add a safe, tenant-scoped rollback/void workflow for the most recent generated charge batch, independently for fee rule charges and transport charges. The implementation will reuse existing ledger conventions (`charge_type`, `voided_at`, `voided_by`, `billing_run_id`) and introduce or complete batch metadata where current generation flows do not consistently create it. Fee rule and transport charge generation will also produce standardized descriptions: `TERM-{termNumber}-{year} Fee Rules Charges` and `TERM-{termNumber}-{monthName}-{year} Transport Charges`.

## Technical Context

**Language/Version**: Backend PHP 8.1+; frontend TypeScript 5.8+ with React 18  
**Primary Dependencies**: CodeIgniter 4, MySQL, firebase/php-jwt, React, Vite, TailwindCSS, shadcn/ui, TanStack React Query, Axios wrapper in `frontend/src/api/api.ts`  
**Storage**: MySQL tables including `charges`, `billing_runs`, `payments`, `students`, `tenants`, transport allocation tables, and optional reconciliation/audit tables  
**Testing**: Backend endpoint verification via curl after implementation; frontend build/lint where changed  
**Target Platform**: Linux-hosted CodeIgniter REST API plus browser-based React SPA  
**Project Type**: Web application with separate backend API and frontend SPA  
**Performance Goals**: Rollback summary and execution should complete in under 60 seconds for typical school charge batches; ledger balance queries must continue using query-time source aggregation and avoid N+1 regressions  
**Constraints**: Tenant isolation via JWT-sourced `tenant_id`; role-based API authorization; no stored mutable balance column; all API responses via `BaseApiController`; immutable migrations only  
**Scale/Scope**: School-tenant financial billing operations for fee rule and transport charge batches; limited to latest non-reversed batch per charge type

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Multi-Tenant Data Isolation**: PASS. All rollback, summary, generation, and lookup operations must filter by JWT-derived `tenant_id`; contracts do not accept tenant ID from the client.
- **II. API-First Separation of Concerns**: PASS. Frontend consumes REST endpoints only; rollback and charge-label business rules remain backend-owned.
- **III. JWT Authentication & Role-Based Access**: PASS. New endpoints live under `/api/*` and require `admin`, `bursar`, or `super_admin` as specified.
- **IV. Immutable Migrations**: PASS. Any schema changes will be implemented through new migrations only.
- **V. Financial Ledger Integrity**: PASS. Voided charges are excluded via existing `voided_at IS NULL` conventions; balances remain query-time calculations from charges/payments.
- **VI. REST API Standards & Consistent Responses**: PASS. Planned endpoints use lowercase kebab-case and `respondSuccess` / `respondError` envelopes.
- **VII. Code Quality & Maintainability**: PASS. Shared rollback behavior should be centralized in a backend service rather than duplicated across controllers.
- **VIII. Defensive Security**: PASS. Inputs are limited to enumerated charge type and optional reason; no secrets involved.
- **IX. Error Handling & Observability**: PASS. Missing batch, already reversed batch, and concurrent reversal cases require explicit error responses and logs.
- **X. API Endpoint Testing (via curl)**: PASS. Quickstart defines post-implementation curl checks for happy path, error path, and tenant isolation.
- **XI. Performance Discipline**: PASS. Latest-batch summary should use aggregate queries and bulk update by batch/type rather than per-charge loops.

## Project Structure

### Documentation (this feature)

```text
specs/064-rollback-void-charges/
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
│   ├── Config/Routes.php
│   ├── Controllers/Api/
│   │   ├── FeeRuleController.php
│   │   └── TransportController.php
│   ├── Database/Migrations/
│   ├── Models/
│   │   └── ChargeModel.php
│   └── Services/
│       ├── FeeRuleBillingService.php
│       ├── LedgerService.php
│       └── ChargeBatchRollbackService.php
└── tests/

frontend/
├── src/
│   ├── api/api.ts
│   ├── components/settings/FeeRuleGenerationPanel.tsx
│   ├── hooks/useFeeRules.ts
│   └── pages/Transport.tsx
└── package.json
```

**Structure Decision**: Use the existing backend/frontend web application structure. Backend owns generation labels, latest-batch discovery, voiding, and audit behavior; frontend adds confirmation and actions through the API wrapper and existing settings/transport surfaces.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

## Phase 0 Research Summary

Research decisions are documented in [research.md](./research.md). Key decisions: use soft voiding rather than hard deletion, track/reuse generated batch metadata per charge type, and expose separate latest/void endpoints for fee rule and transport batches.

## Phase 1 Design Summary

Design artifacts are documented in [data-model.md](./data-model.md), [contracts/charge-batch-rollback-api.md](./contracts/charge-batch-rollback-api.md), and [quickstart.md](./quickstart.md).

## Constitution Check - Post-Design

- **I. Multi-Tenant Data Isolation**: PASS. Contracts explicitly avoid tenant input and require tenant filtering server-side.
- **II. API-First Separation of Concerns**: PASS. UI consumes documented backend API contracts only.
- **III. JWT Authentication & Role-Based Access**: PASS. Contracts define authorized roles for all endpoints.
- **IV. Immutable Migrations**: PASS. Data model requires new migrations for any missing batch/reversal fields.
- **V. Financial Ledger Integrity**: PASS. Data model retains query-time balance calculation and excludes voided charges.
- **VI. REST API Standards & Consistent Responses**: PASS. Contract paths and response envelopes follow project standards.
- **VII. Code Quality & Maintainability**: PASS. Shared rollback service is planned for batch discovery and void execution.
- **VIII. Defensive Security**: PASS. Contracts constrain inputs and preserve payment records.
- **IX. Error Handling & Observability**: PASS. Contracts define explicit 400/403/404/409/422 cases.
- **X. API Endpoint Testing (via curl)**: PASS. Quickstart includes curl-only validation steps after implementation.
- **XI. Performance Discipline**: PASS. Bulk update and aggregate summary design avoids per-student recalculation loops.
