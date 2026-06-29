# Implementation Plan: Student Identity Layer

**Branch**: `065-student-identity-layer` | **Date**: 2026-05-06 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/065-student-identity-layer/spec.md`

## Summary

Redesign the Students module as the stable identity boundary for academic, transport, and financial activity. The implementation will preserve the existing `students` record as the core profile, keep activity in related records (`enrollments`, `transport_student_allocations`, `charges`, `payments`, status history), add missing history coverage for mutable personal/contact details, and expose a consolidated student identity/timeline view through tenant-scoped REST contracts. Existing snapshot fields such as `students.class_id` and `students.current_enrollment_id` remain compatibility/read optimization fields derived from enrollment records rather than the source of truth for academic history.

## Technical Context

**Language/Version**: Backend PHP 8.1+; Frontend TypeScript with React 18  
**Primary Dependencies**: CodeIgniter 4, MySQL, React, Vite, TailwindCSS, shadcn/ui, TanStack React Query, React Hook Form, Zod  
**Storage**: MySQL tenant-scoped tables using immutable migrations  
**Testing**: Post-implementation curl endpoint validation, PHP lint, TypeScript type-check, targeted ESLint  
**Target Platform**: Linux-hosted REST API with browser-based React SPA  
**Project Type**: Web application with separate backend REST API and frontend SPA  
**Performance Goals**: Student consolidated history for a selected academic year retrievable fast enough for users to review in under 3 minutes; list/profile queries must avoid N+1 patterns and preserve existing bulk balance optimizations  
**Constraints**: JWT-sourced tenant isolation, REST JSON envelopes, role-based API enforcement, immutable migrations, ledger balances computed from charges/payments, no frontend business logic duplication  
**Scale/Scope**: Existing SchoolLedger Students module plus related class/enrollment, transport, billing/payment, and reporting integrations for a single feature branch

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Multi-Tenant Data Isolation**: PASS. All new queries and contracts will derive `tenant_id` from JWT context and reject cross-tenant student/activity references.
- **II. API-First Separation of Concerns**: PASS. Frontend will consume REST contracts only; identity/timeline assembly lives in backend services/controllers.
- **III. JWT Authentication & Role-Based Access**: PASS. New `/api/students/*` endpoints remain under existing JWT filters and enforce role checks for mutable actions.
- **IV. Immutable Migrations**: PASS. Profile-history/schema changes require new migration files only.
- **V. Financial Ledger Integrity**: PASS. Charges/payments remain source records; no mutable balance columns are introduced.
- **VI. REST API Standards & Consistent Responses**: PASS. New endpoints use plural resource paths and existing success/error envelopes.
- **VII. Code Quality & Maintainability**: PASS. Plan centralizes identity orchestration in focused service/model layers instead of expanding controller business logic.
- **VIII. Defensive Security**: PASS. All inputs for profile correction/history and date-period filters require validation and sanitization.
- **IX. Error Handling & Observability**: PASS. Conflict and missing-reference cases return explicit errors without internal details; audit/history records preserve context.
- **X. API Endpoint Testing (via curl)**: PASS. Quickstart defines curl validation after implementation for happy path, error path, and tenant isolation.
- **XI. Performance Discipline**: PASS. Timeline/profile aggregation will use bounded period filters, indexed lookup fields, and bulk/subquery patterns where appropriate.

## Project Structure

### Documentation (this feature)

```text
specs/065-student-identity-layer/
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
│   ├── Controllers/Api/StudentController.php
│   ├── Database/Migrations/
│   ├── Models/
│   │   ├── StudentModel.php
│   │   ├── EnrollmentModel.php
│   │   └── StudentProfileHistoryModel.php
│   └── Services/
│       ├── StudentIdentityService.php
│       ├── StudentSnapshotService.php
│       ├── StudentStatusService.php
│       └── TransportAssignmentService.php
└── tests/Integration/

frontend/
├── src/
│   ├── api/api.ts
│   ├── components/
│   ├── pages/
│   │   ├── StudentProfile.tsx
│   │   └── Students.tsx
│   └── types/dashboard.ts
└── public/
```

**Structure Decision**: Use the existing split web application structure. Backend REST endpoints and services own student identity/history assembly; frontend updates are limited to API types, data fetching, and presentation of current versus historical data.

## Complexity Tracking

No constitution violations identified.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | N/A | N/A |

## Phase 0: Research

Research output: [research.md](./research.md)

Key decisions:
- Keep `students` as the central identity record and treat class/transport/financial activity as related source records.
- Add profile history for mutable personal/contact fields because enrollment, status, transport, charges, and payments already have dedicated history/source tables.
- Preserve current snapshot columns for compatibility while making source-of-truth writes flow through enrollment/status/profile-history operations.
- Expose a consolidated student timeline API instead of duplicating timeline assembly in the frontend.

## Phase 1: Design & Contracts

Design outputs:
- [data-model.md](./data-model.md)
- [contracts/student-identity-api.md](./contracts/student-identity-api.md)
- [quickstart.md](./quickstart.md)

Post-design constitution re-check:
- **I. Multi-Tenant Data Isolation**: PASS. Data model includes `tenant_id` on new history records and contracts require JWT tenant scope.
- **II. API-First Separation of Concerns**: PASS. Contracts define REST access; frontend remains consumer only.
- **III. JWT Authentication & Role-Based Access**: PASS. Mutations are admin/super_admin scoped; read access follows existing protected student profile access.
- **IV. Immutable Migrations**: PASS. New `student_profile_history` table and indexes are additive.
- **V. Financial Ledger Integrity**: PASS. Timeline reads ledger source records without altering balance calculation rules.
- **VI. REST API Standards & Consistent Responses**: PASS. Contract paths use `/api/students/{id}/...` resources and standard envelopes.
- **VII. Code Quality & Maintainability**: PASS. `StudentIdentityService` and `StudentProfileHistoryModel` isolate responsibilities.
- **VIII. Defensive Security**: PASS. Contracts specify validation for profile change fields, dates, and conflict cases.
- **IX. Error Handling & Observability**: PASS. Contracts include 400/403/404/409 handling.
- **X. API Endpoint Testing (via curl)**: PASS. Quickstart includes post-implementation curl scenarios.
- **XI. Performance Discipline**: PASS. Design requires period filters and indexes for timeline/history lookups.
