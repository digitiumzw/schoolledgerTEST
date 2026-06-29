# Implementation Plan: Backend Data Optimization

**Branch**: `074-backend-data-optimization` | **Date**: 2026-05-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/074-backend-data-optimization/spec.md`

## Summary

Convert the Student, Staff Attendance, Classes, Class Attendance, related summaries/history, and related payment-history workflows to backend-prepared data views. The frontend must render bounded backend responses directly and must not perform authoritative filtering, sorting, pagination, or business computations for in-scope datasets. The technical approach extends existing CodeIgniter REST endpoints where backend pagination already exists, adds/hardens backend-prepared class and attendance contracts where gaps remain, and validates performance using bounded responses, batched aggregation, tenant-scoped queries, and targeted database indexes where measurement supports them.

## Technical Context

**Language/Version**: PHP 8.1+ backend; TypeScript with React 18 frontend  
**Primary Dependencies**: CodeIgniter 4 REST API, MySQL, Axios API client, TanStack React Query, Vite, TailwindCSS, shadcn/ui  
**Storage**: MySQL tenant-scoped operational data for students, classes, enrollments, staff attendance, student class attendance, charges, payments, and ledger adjustments  
**Testing**: PHP lint, TypeScript `tsc --noEmit`, targeted ESLint, `git diff --check`, and post-implementation curl endpoint validation  
**Target Platform**: Linux-hosted web application with React SPA consuming `/api` backend  
**Project Type**: Web application with separate `backend/` and `frontend/` directories  
**Performance Goals**: In-scope page open/filter/sort/page requests complete within 3 seconds for at least 50,000 relevant records; browser receives only requested page rows plus explicit detail data; no repeated per-row lookup patterns for summaries or related display fields  
**Constraints**: Preserve tenant isolation, role authorization, ledger source-of-truth rules, consistent API envelopes, bounded page sizes, and current user-visible behavior unless required by backend-driven processing  
**Scale/Scope**: Student page, Staff Attendance records/reports, Classes directory/rosters, Class Attendance registers/summaries, related history/summary features, and related payment history

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

1. **Multi-Tenant Data Isolation**: PASS — All planned backend view queries must source `tenant_id` from JWT and filter detailed rows plus summaries by tenant.
2. **API-First Separation of Concerns**: PASS — Feature explicitly removes frontend business calculations and routes all data through REST API contracts.
3. **JWT Authentication & Role-Based Access**: PASS — All new/changed `/api/*` endpoints remain protected by existing JWT filters and controller role checks.
4. **Immutable Migrations**: PASS — Any new indexes will be added through new migration files only.
5. **Financial Ledger Integrity**: PASS — Payment history and student financial summaries must use source-record ledger calculations and existing bulk/subquery patterns.
6. **REST API Standards & Consistent Responses**: PASS — Contracts preserve REST resources and use standard success/error envelopes.
7. **Code Quality & Maintainability**: PASS — Plan favors domain-specific model/service methods and removes duplicated frontend derivations.
8. **Defensive Security**: PASS — All filter/search/sort/page/date parameters require validation and sanitization.
9. **Error Handling & Observability**: PASS — Invalid filters and server errors use consistent API errors without internal details.
10. **API Endpoint Testing via curl**: PASS — Quickstart defines post-implementation curl validation for happy, error, unauthorized, and tenant isolation paths.
11. **Performance Discipline**: PASS — Optimization must be measurement-backed and focus on bounded responses, batching, aggregation, and justified indexes.

## Project Structure

### Documentation (this feature)

```text
specs/074-backend-data-optimization/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── backend-data-api.md
└── tasks.md
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── Config/
│   │   └── Routes.php
│   ├── Controllers/Api/
│   │   ├── StudentController.php
│   │   ├── StudentsOptimizedController.php
│   │   ├── AttendanceController.php
│   │   ├── ClassController.php
│   │   ├── StudentClassAttendanceController.php
│   │   └── PaymentController.php
│   ├── Database/Migrations/
│   │   └── [new performance index migration if measurement supports it]
│   ├── Models/
│   │   ├── StudentModel.php
│   │   ├── ClassModel.php
│   │   ├── AttendanceModel.php
│   │   ├── StudentClassAttendanceModel.php
│   │   └── PaymentModel.php
│   └── Services/
│       ├── LedgerService.php
│       ├── StaffAttendanceService.php
│       └── StudentClassAttendanceService.php
└── tests/

frontend/
├── src/
│   ├── api/api.ts
│   ├── pages/
│   │   ├── Students.tsx
│   │   ├── StaffAttendance.tsx
│   │   └── Classes.tsx
│   ├── components/
│   │   ├── attendance/
│   │   ├── modals/PaymentHistoryModal.tsx
│   │   └── staff-attendance/
│   ├── hooks/
│   │   ├── useClassAttendance.ts
│   │   └── useStaffAttendanceData.ts
│   └── types/dashboard.ts
```

**Structure Decision**: Use the existing backend/frontend web application structure. Backend controllers/models/services own all filtering, pagination, sorting, and computations. Frontend pages/components consume typed API responses and retain only UI state such as selected filter inputs and dialog state.

## Complexity Tracking

No constitution violations or exceptional complexity are planned.

## Phase 0: Research

Research output is captured in [research.md](./research.md). All technical unknowns are resolved with decisions covering response shape, endpoint extension strategy, classes gaps, domain computation ownership, input validation, performance/indexing strategy, frontend date-preset boundaries, and curl validation.

## Phase 1: Design & Contracts

Design output:

- [data-model.md](./data-model.md)
- [contracts/backend-data-api.md](./contracts/backend-data-api.md)
- [quickstart.md](./quickstart.md)

## Constitution Check — Post-Design

1. **Multi-Tenant Data Isolation**: PASS — Contracts require tenant-scoped rows and summaries.
2. **API-First Separation of Concerns**: PASS — Data model defines backend-prepared views consumed directly by frontend.
3. **JWT Authentication & Role-Based Access**: PASS — Contracts require protected `/api/*` access and role-compatible data.
4. **Immutable Migrations**: PASS — Optional indexes are documented as new migrations only.
5. **Financial Ledger Integrity**: PASS — Payment History View and Student Directory View preserve source-derived ledger rules.
6. **REST API Standards & Consistent Responses**: PASS — Contract examples use REST paths and standard response envelopes.
7. **Code Quality & Maintainability**: PASS — Design centralizes view preparation by domain and removes duplicated frontend computations.
8. **Defensive Security**: PASS — Data model and contracts specify validation for filters, sort fields, dates, and page bounds.
9. **Error Handling & Observability**: PASS — Quickstart includes invalid input checks; implementation must log server errors without leaking details.
10. **API Endpoint Testing via curl**: PASS — Quickstart defines post-implementation curl scenarios.
11. **Performance Discipline**: PASS — Quickstart requires response-size and query-efficiency evidence.
