# Implementation Plan: Backend Payments Pagination

**Branch**: `073-backend-payments-pagination` | **Date**: 2026-05-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/073-backend-payments-pagination/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Move payments history data ownership to the backend for the main Payments table and related payment-history features. The backend will return bounded pages, normalized pagination metadata, filter-aligned summaries, and prepared student/class display fields. The frontend will keep only UI state and display formatting, consuming processed responses from the API instead of fetching full payment histories for client-side filtering, sorting, pagination, or authoritative calculations.

## Technical Context

**Language/Version**: PHP 8.1+ backend; TypeScript/React 18 frontend  
**Primary Dependencies**: CodeIgniter 4 REST API, MySQL, React Query, Axios API client, Vite frontend  
**Storage**: MySQL tables for payments, students, classes, payment categories, fee campaigns, ledger source records  
**Testing**: PHP lint, TypeScript `tsc --noEmit`, targeted ESLint, post-implementation curl endpoint validation  
**Target Platform**: Linux-hosted web application with REST API and browser SPA  
**Project Type**: Web application with separate backend and frontend  
**Performance Goals**: Payments page and filtered searches return first page plus summaries for 50,000+ payment records in under 3 seconds under normal operating conditions  
**Constraints**: Tenant isolation from JWT-sourced tenant id; no frontend full-history filtering/calculation; no N+1 payment/student/class/balance lookups; ledger balances remain source-derived  
**Scale/Scope**: Main Payments table, student payment history modal, receipt/detail support, and related payment-history consumers that currently depend on payment lists

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

1. **Multi-Tenant Data Isolation**: PASS — all payment row, count, summary, student-history, and detail queries must filter by JWT-sourced tenant id.
2. **API-First Separation of Concerns**: PASS — frontend consumes backend-prepared REST responses and removes payment-history business logic from UI code.
3. **JWT Authentication & Role-Based Access**: PASS — payment endpoints remain under `/api/*` filters and backend role checks.
4. **Immutable Migrations**: PASS — any new indexes must be added through new migrations only.
5. **Financial Ledger Integrity**: PASS — outstanding/balance metrics remain computed from source ledger records and preserve bulk/subquery patterns.
6. **REST API Standards & Consistent Responses**: PASS — revised endpoints use plural REST paths and standard success/error envelopes.
7. **Code Quality & Maintainability**: PASS — shared query normalization and condition helpers avoid duplicated filtering logic.
8. **Defensive Security**: PASS — query params are allowlisted, validated, sanitized, and parameterized through query builder/bound queries.
9. **Error Handling & Observability**: PASS — invalid filters and internal errors return standard messages without leaking internals.
10. **API Endpoint Testing via curl**: PASS — quickstart defines post-implementation curl tests for happy path, error path, auth, and tenant isolation.
11. **Performance Discipline**: PASS — optimizations are tied to query shape, index review, bounded pagination, and N+1 elimination.

## Project Structure

### Documentation (this feature)

```text
specs/073-backend-payments-pagination/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/
│   └── payments-history-api.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
```text
backend/
├── app/
│   ├── Config/
│   │   └── Routes.php
│   ├── Controllers/
│   │   └── Api/
│   │       └── PaymentController.php
│   ├── Database/
│   │   └── Migrations/
│   └── Models/
│       └── PaymentModel.php
└── tests/
    └── Integration/

frontend/
├── src/
│   ├── api/
│   │   └── api.ts
│   ├── components/
│   │   └── modals/
│   │       └── PaymentHistoryModal.tsx
│   ├── hooks/
│   ├── pages/
│   │   └── Payments.tsx
│   └── types/
│       └── dashboard.ts
```

**Structure Decision**: Use the existing separated CodeIgniter backend and React frontend structure. Backend query/summary behavior belongs in `PaymentModel.php` and `PaymentController.php`; frontend changes stay in the API client, Payments page, and payment-history modal.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |

## Phase 0: Research

Completed in [research.md](./research.md).

Key decisions:

- Keep payment history behind backend-prepared paginated endpoints.
- Centralize payment query rules in backend model/service logic.
- Use bounded aggregate queries for summaries.
- Add or verify supporting indexes via new migrations only when needed.
- Preserve the standard API envelope and frontend server-state patterns.
- Validate via curl after implementation.

## Phase 1: Design & Contracts

Completed artifacts:

- [data-model.md](./data-model.md)
- [contracts/payments-history-api.md](./contracts/payments-history-api.md)
- [quickstart.md](./quickstart.md)

## Post-Design Constitution Check

1. **Multi-Tenant Data Isolation**: PASS — contracts and data model require tenant-scoped row/count/summary/detail queries.
2. **API-First Separation of Concerns**: PASS — frontend displays processed responses and does not compute authoritative payment results.
3. **JWT Authentication & Role-Based Access**: PASS — API contracts include auth/role error paths.
4. **Immutable Migrations**: PASS — index work is documented as new-migration-only.
5. **Financial Ledger Integrity**: PASS — summary and balance rules preserve source-derived ledger calculations.
6. **REST API Standards & Consistent Responses**: PASS — contracts preserve `/api` REST paths and response envelope.
7. **Code Quality & Maintainability**: PASS — plan calls for shared backend query helpers.
8. **Defensive Security**: PASS — query input validation and allowlisted sorting are required.
9. **Error Handling & Observability**: PASS — quickstart covers invalid input and standard error envelopes.
10. **API Endpoint Testing via curl**: PASS — quickstart defines post-implementation curl coverage.
11. **Performance Discipline**: PASS — design focuses on bounded pages, aggregate queries, index review, and N+1 prevention.
