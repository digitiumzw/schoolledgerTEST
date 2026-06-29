# Implementation Plan: Finance Control Center

**Branch**: `[080-finance-control-center]` | **Date**: 2026-05-21 | **Spec**: `/specs/080-finance-control-center/spec.md`
**Input**: Feature specification from `/specs/080-finance-control-center/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Refresh the finance page into a finance control center that surfaces actionable KPIs, trend signals, operational alerts, cleaner charts, filtered reporting, and exportable outputs while keeping the backend authoritative for financial calculations and report preparation.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: PHP 8.1+ backend, TypeScript/React 18 frontend  
**Primary Dependencies**: CodeIgniter 4, React Query, Recharts, shadcn/ui, TailwindCSS  
**Storage**: MySQL  
**Testing**: PHP lint, TypeScript type-check, targeted ESLint, curl endpoint validation, browser verification  
**Target Platform**: Web application  
**Project Type**: web application  
**Performance Goals**: Finance summary and KPI views should render quickly enough for interactive review; filtered list and export actions should remain responsive for typical platform finance volumes  
**Constraints**: Backend must remain the source of truth for finance metrics, filters, trend values, and export payloads; the frontend must render backend-prepared results rather than recomputing finance data  
**Scale/Scope**: Single finance workspace covering invoices, payment activity, revenue trends, operational alerts, and downloadable reports for the platform admin area

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

[Pass]

- **Principle I — Multi-Tenant Data Isolation**: Pass. Finance queries remain tenant-scoped where tenant data is involved.
- **Principle II — API-First Separation of Concerns**: Pass. The frontend will consume API responses and avoid finance calculations.
- **Principle III — JWT Authentication & Role-Based Access**: Pass. Finance routes remain behind existing platform access checks.
- **Principle IV — Immutable Migrations**: Pass. No schema changes are required for this feature.
- **Principle V — Financial Ledger Integrity**: Pass. Financial values remain sourced from authoritative backend data.
- **Principle VI — REST API Standards & Consistent Responses**: Pass. Existing response envelopes and route naming will be preserved.
- **Principle VII — Code Quality & Maintainability**: Pass. The redesign should prefer focused helpers and shared UI primitives.
- **Principle VIII — Defensive Security**: Pass. Filter, export, and download inputs must be validated and sanitized.
- **Principle IX — Error Handling & Observability**: Pass. Empty, error, and export failure states must be explicit.
- **Principle X — API Endpoint Testing (via curl)**: Pass. The feature will require endpoint-level validation after implementation.
- **Principle XI — Backend-Driven Data & Performance Discipline**: Pass. Sorting, filtering, trend values, summaries, and exports must come from backend APIs.
- **Principle XII — Mutation Loading States & Stale-Data Prevention**: Pass. Filter, refresh, and export actions must show loading states and avoid stale flashes.
- **Principle XIII — Email Design System Consistency**: N/A. This feature does not involve email templates or views.

## Project Structure

### Documentation (this feature)

```text
specs/080-finance-control-center/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Generated later by /speckit.tasks
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── Controllers/Platform/FinanceController.php
│   └── Services/
└── public/

frontend/
├── src/
│   ├── admin/
│   │   ├── pages/Finance.tsx
│   │   ├── hooks/useFinance.ts
│   │   └── components/admin/StatCard.tsx
│   └── api/platform.ts

specs/080-finance-control-center/
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
```

**Structure Decision**: This is a web application feature with a React admin frontend and a PHP/CodeIgniter backend. The implementation will update the existing platform finance controller, finance hook, finance page, and shared stat card/chart primitives rather than creating a separate application boundary.

## Complexity Tracking

No constitutional violations require justification at this stage.
