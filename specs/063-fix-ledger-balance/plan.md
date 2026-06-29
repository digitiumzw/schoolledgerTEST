# Implementation Plan: Fix Ledger Balance Filtering

**Branch**: `063-fix-ledger-balance` | **Date**: 2026-05-05 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/063-fix-ledger-balance/spec.md`

## Summary

Student balances must be calculated only from the approved ledger scope: charges with type `fee_structure` or `transport`, payments with category `Fees`, `Transport + Fees`, or `Transport Fee`, plus approved debit/credit adjustments and opening balance for the same student. The implementation approach is to make `LedgerService` expose one reusable eligibility definition, apply that definition consistently in single-student and bulk balance calculations, align remaining student-list balance SQL paths, and validate the existing balance endpoints through curl after implementation.

## Technical Context

**Language/Version**: PHP 8.1+ backend · TypeScript + React 18 frontend  
**Primary Dependencies**: CodeIgniter 4 · MySQL · Firebase PHP JWT · React Query/Axios for frontend API consumption  
**Storage**: MySQL tables: `charges`, `payments`, `ledger_adjustments`, `students`  
**Testing**: Post-implementation endpoint verification via curl URL requests only, plus PHP lint and frontend type/lint checks where files are touched  
**Target Platform**: Linux-hosted backend REST API and browser SPA  
**Project Type**: Multi-tenant SaaS web application monorepo (`backend/` + `frontend/`)  
**Performance Goals**: Preserve single-query/subquery pattern for bulk balance listings; no per-student N+1 balance queries  
**Constraints**: Tenant-owned data must always be scoped by JWT-derived `tenant_id`; balances must be derived at query time from source records; no schema migration unless implementation proves existing fields cannot express the required filters  
**Scale/Scope**: All current student balance display, summary, and account-status consumers within this application

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Plan Compliance |
|-----------|--------|-----------------|
| I. Multi-Tenant Data Isolation | PASS | Every charge, payment, adjustment, and student query will include `tenant_id`; controllers continue sourcing tenant from JWT. |
| II. API-First Separation of Concerns | PASS | Balance rules remain backend-owned; frontend consumes existing API values only. |
| III. JWT Authentication & Role-Based Access | PASS | No public routes added; existing `/api/*` routes remain protected by filters. |
| IV. Immutable Migrations | PASS | No schema changes planned; if required later, add a new migration only. |
| V. Financial Ledger Integrity | PASS | Balance remains query-time derived from source rows; bulk queries preserve subquery pattern. |
| VI. REST API Standards & Consistent Responses | PASS | Existing REST endpoints and response envelopes remain unchanged. |
| VII. Code Quality & Maintainability | PASS | Centralize eligibility constants/helpers to avoid duplicated category/type logic. |
| VIII. Defensive Security | PASS | No new client-supplied trust boundary; category/type filters use server-defined allowlists. |
| IX. Error Handling & Observability | PASS | Existing controller error paths remain; no internal details exposed. |
| X. API Endpoint Testing (via curl) | PASS | Quickstart defines post-implementation curl checks for happy path, edge path, and tenant isolation. |
| XI. Performance Discipline | PASS | No speculative frontend optimization; backend bulk balance remains set-based. |

**Initial Gate Result**: PASS — no constitution violations require justification.

## Project Structure

### Documentation (this feature)

```text
specs/063-fix-ledger-balance/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ledger-balance-api.md
├── checklists/
│   └── requirements.md
└── tasks.md              # Created later by /speckit.tasks
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── Config/
│   │   └── PaymentCategories.php        # Existing source of system payment names
│   ├── Controllers/
│   │   └── Api/
│   │       ├── LedgerController.php      # Existing student/all balance endpoints
│   │       ├── StudentController.php     # Existing student balance endpoint
│   │       └── ReconciliationController.php
│   ├── Models/
│   │   └── StudentModel.php              # Student-list balance paths to align
│   └── Services/
│       └── LedgerService.php             # Authoritative balance/filter logic
└── tests/
    └── Integration/                      # Optional implementation-level fixtures; curl remains required after implementation

frontend/
└── src/
    ├── api/
    │   └── api.ts                        # Existing consumers, if response types need clarification
    ├── pages/
    └── components/
```

**Structure Decision**: Web application structure. The feature is backend-led and should avoid frontend business-logic changes unless response typing or display labels need to reflect existing API fields.

## Phase 0: Research Summary

Research completed in [research.md](research.md). Key decisions:

- Use exact allowlists for eligible charge types and payment categories.
- Treat opening balance as an eligible `fee_structure` charge because existing opening-balance creation stores it in `charges` with `charge_type = 'fee_structure'` and `is_opening_balance = 1`.
- Keep approved adjustments in the balance formula, scoped by student and tenant; no additional adjustment category field is currently required.
- Align `LedgerService` and `StudentModel` query paths rather than adding stored balance columns.

## Phase 1: Design Summary

Design artifacts generated:

- [data-model.md](data-model.md) defines existing entities and eligibility rules.
- [contracts/ledger-balance-api.md](contracts/ledger-balance-api.md) documents affected API responses.
- [quickstart.md](quickstart.md) documents implementation validation.

## Post-Design Constitution Check

| Principle | Status | Design Compliance |
|-----------|--------|-------------------|
| I. Multi-Tenant Data Isolation | PASS | Contracts require tenant-scoped outputs; design keeps `tenant_id` in all source-table filters. |
| II. API-First Separation of Concerns | PASS | No frontend-side recalculation; API remains source of truth. |
| III. JWT Authentication & Role-Based Access | PASS | Existing protected routes only. |
| IV. Immutable Migrations | PASS | No migration required by design. |
| V. Financial Ledger Integrity | PASS | Formula is query-time: eligible charges + debit adjustments - eligible payments - credit adjustments. |
| VI. REST API Standards & Consistent Responses | PASS | Existing endpoint paths and envelopes retained. |
| VII. Code Quality & Maintainability | PASS | Plan recommends centralized filter helpers/constants. |
| VIII. Defensive Security | PASS | Server-defined allowlists, no secrets, no raw client category trust. |
| IX. Error Handling & Observability | PASS | Existing endpoint behavior preserved. |
| X. API Endpoint Testing (via curl) | PASS | Quickstart includes required curl checks after implementation. |
| XI. Performance Discipline | PASS | Bulk balance remains subquery-based. |

**Post-Design Gate Result**: PASS — ready for `/speckit.tasks`.

## Complexity Tracking

No constitution violations or complexity exceptions.
