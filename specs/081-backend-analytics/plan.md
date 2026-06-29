# Implementation Plan: Backend-Driven Admin Analytics

**Branch**: `[081-backend-analytics]` | **Date**: 2026-05-22 | **Spec**: `/specs/081-backend-analytics/spec.md`
**Input**: Feature specification from `/specs/081-backend-analytics/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Move the admin Analytics page and connected payment/reporting views to backend-prepared responses so the frontend only renders authoritative data. The implementation will extend the existing platform analytics and payments history patterns, keep pagination/search/filtering/summaries on the server, and optimize high-volume endpoints with bounded queries, shared aggregates, and minimal payloads.

## Technical Context

**Language/Version**: PHP 8.1+ backend, TypeScript/React 18 frontend  
**Primary Dependencies**: CodeIgniter 4, MySQL, React Query, Vite, shadcn/ui, Recharts  
**Storage**: MySQL  
**Testing**: PHP lint, frontend TypeScript type-check, targeted ESLint, curl endpoint validation  
**Target Platform**: Linux web application stack  
**Project Type**: web application  
**Performance Goals**: Serve analytics and payment-history pages with bounded backend queries and page-level responses suitable for large tenant datasets  
**Constraints**: Backend must own filtering/search/pagination/aggregation; frontend must only render backend-prepared payloads; tenant isolation and role checks remain mandatory; mutation actions must preserve loading-state discipline  
**Scale/Scope**: Admin Analytics page plus related payment history and reporting drill-down surfaces for multi-tenant school data

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Principle I - Multi-Tenant Data Isolation**: Pass. All analytics and payment-history queries must remain tenant-scoped and role-aware.
- **Principle II - API-First Separation of Concerns**: Pass. The frontend will consume backend-prepared analytics and payment-history payloads only.
- **Principle III - JWT Authentication & Role-Based Access**: Pass. Existing API auth and role enforcement remain in force for analytics endpoints.
- **Principle IV - Immutable Migrations**: Pass. This feature plan does not require editing applied migrations.
- **Principle V - Financial Ledger Integrity**: Pass. Payment-related summaries must continue to use authoritative backend ledger/payment rules.
- **Principle VI - REST API Standards & Consistent Responses**: Pass. Any endpoint adjustments must preserve the existing JSON envelope and REST naming.
- **Principle VII - Code Quality & Maintainability**: Pass. The design emphasizes clear contracts, bounded query paths, and reusable backend helpers.
- **Principle VIII - Defensive Security**: Pass. Inputs must be validated and scoped through authenticated tenant context.
- **Principle IX - Error Handling & Observability**: Pass. Invalid filters, paging, or unsupported sorts must return explicit backend errors.
- **Principle X - API Endpoint Testing (via curl)**: Pass. The implementation plan will require curl validation for happy, error, and tenant-isolation paths.
- **Principle XI - Backend-Driven Data & Performance Discipline**: Pass. This is the core principle for the feature; all data preparation must move to backend APIs and avoid N+1 patterns.
- **Principle XII - Mutation Loading States & Stale-Data Prevention**: Pass. Any affected data-changing actions must preserve loading states and cache invalidation discipline.
- **Principle XIII - Email Design System Consistency**: Not applicable. The feature does not introduce or modify email content.

## Project Structure

### Documentation (this feature)

```text
specs/081-backend-analytics/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── analytics-api.md
│   └── payments-history-api.md
└── tasks.md
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── Controllers/
│   │   ├── Platform/
│   │   │   └── AnalyticsController.php
│   │   └── Api/
│   │       ├── PaymentController.php
│   │       └── ReceiptController.php
│   ├── Models/
│   │   └── PaymentModel.php
│   └── Services/
│       └── DashboardAggregationService.php
└── tests/
    └── Integration/

frontend/
├── src/
│   ├── admin/
│   │   └── pages/
│   │       └── Analytics.tsx
│   ├── api/
│   │   ├── api.ts
│   │   └── platform.ts
│   ├── components/
│   │   └── modals/
│   │       └── PaymentHistoryModal.tsx
│   └── pages/
│       └── Payments.tsx
└── tests/
```

**Structure Decision**: This is a web application with separate backend and frontend codebases. The feature will primarily touch `backend/app/Controllers/Platform/AnalyticsController.php`, `backend/app/Controllers/Api/PaymentController.php`, `backend/app/Models/PaymentModel.php`, `frontend/src/admin/pages/Analytics.tsx`, `frontend/src/pages/Payments.tsx`, `frontend/src/components/modals/PaymentHistoryModal.tsx`, and the API wrappers in `frontend/src/api/platform.ts` and `frontend/src/api/api.ts`.

## Complexity Tracking

No constitution violations require justification at this time.
