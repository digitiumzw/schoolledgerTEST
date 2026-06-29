# Implementation Plan: Dashboard School Overview

**Branch**: `021-dashboard-school-overview` | **Date**: 2026-04-08 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/021-dashboard-school-overview/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Redesign the dashboard to provide a comprehensive school overview with financial, enrolment, staff, transport, and alert metrics. The implementation will extend the existing `/api/dashboard/stats` endpoint to return all required metrics, create a responsive tile-based layout, and maintain role-based visibility while ensuring real-time data updates through React Query.

## Technical Context

**Language/Version**: PHP 8.1+ (backend), TypeScript 5+ (frontend) 
**Primary Dependencies**: CodeIgniter 4, MySQL (backend); React 18, Vite, TanStack Query, shadcn/ui (frontend) 
**Storage**: MySQL database with tenant isolation 
**Testing**: PHPUnit (backend), Jest + React Testing Library (frontend) 
**Target Platform**: Web application (desktop-first responsive design) 
**Project Type**: Web application with REST API 
**Performance Goals**: Dashboard loads within 3 seconds, skeleton loaders appear within 300ms 
**Constraints**: Multi-tenant data isolation, role-based access control, API-first architecture 
**Scale/Scope**: Single school instance with up to 1000 students

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Gate 1: Multi-Tenant Data Isolation (Principle I)
- **Requirement**: All dashboard stats queries MUST include `tenant_id` filtering
- **Implementation Plan**: Extend existing `DashboardController::stats()` to include `tenant_id` in all aggregation queries
- **Status**: ✅ PASS (existing endpoint already follows this pattern)

### Gate 2: API-First Separation (Principle II)
- **Requirement**: Frontend must only use REST API endpoints
- **Implementation Plan**: All dashboard data will come from `/api/dashboard/stats` and `/api/dashboard/activity`
- **Status**: ✅ PASS (maintains existing architecture)

### Gate 3: JWT Authentication & Role-Based Access (Principle III)
- **Requirement**: API routes must be protected and enforce role checks
- **Implementation Plan**: Backend will filter data based on role; frontend will conditionally render sections
- **Status**: ✅ PASS (leverages existing JWT middleware and role system)

### Gate 4: Immutable Migrations (Principle IV)
- **Requirement**: No schema changes planned for this feature
- **Implementation Plan**: Using existing tables only
- **Status**: ✅ PASS (no database schema changes needed)

### Gate 5: Financial Ledger Integrity (Principle V)
- **Requirement**: Balance calculations must use subquery pattern
- **Implementation Plan**: Use existing `LedgerService::getAllBalances()` method for financial aggregates
- **Status**: ✅ PASS (reuses optimized ledger queries)

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# Web application structure
backend/
├── app/
│   ├── Controllers/
│   │   └── API/
│   │       └── DashboardController.php      # Extend stats() method
│   ├── Models/
│   │   └── existing models only
│   └── Services/
│       └── LedgerService.php                # Reuse getAllBalances()
└── tests/

frontend/
├── src/
│   ├── pages/
│   │   └── Dashboard.tsx                    # Complete rewrite
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── MetricTile.tsx               # New component
│   │   │   ├── FinancialSection.tsx         # New component
│   │   │   ├── EnrolmentSection.tsx         # New component
│   │   │   ├── StaffSection.tsx             # New component
│   │   │   ├── TransportSection.tsx         # New component
│   │   │   ├── ActivityFeed.tsx             # New component
│   │   │   └── QuickActions.tsx             # New component
│   │   └── ui/                              # Existing shadcn/ui
│   ├── hooks/
│   │   └── useDashboardStats.ts             # New hook
│   └── api/
│       └── api.ts                           # Existing, no changes
└── tests/
    └── components/
        └── dashboard/
```

**Structure Decision**: Using the existing web application structure. The backend changes are minimal (extending one controller). The frontend will be restructured with a component-based approach for better maintainability and testability.

## Complexity Tracking

> No Constitution violations identified. All gates passed successfully.

## Phase 0 Complete: Research Summary

✅ **Research completed** - All technical unknowns resolved:
- Responsive layout patterns using shadcn/ui CSS Grid
- TanStack Query for real-time updates with 30s polling
- Single-query aggregation pattern using LedgerService subqueries
- Component composition with self-contained sections

## Phase 1 Complete: Design & Contracts

✅ **Design artifacts created**:
- `data-model.md` - Entity definitions and relationships
- `contracts/api.md` - Extended API specifications
- `quickstart.md` - Developer onboarding guide
- Agent context updated with new technologies

## Next Steps

The planning phase is complete. To proceed with implementation:

1. Run `/speckit.tasks` to generate actionable implementation tasks
2. Execute tasks with `/speckit.implement`
3. All Constitution gates have passed - no violations identified

## Generated Files

- `/specs/021-dashboard-school-overview/plan.md` - This file
- `/specs/021-dashboard-school-overview/research.md` - Technical research
- `/specs/021-dashboard-school-overview/data-model.md` - Data model
- `/specs/021-dashboard-school-overview/contracts/api.md` - API contracts
- `/specs/021-dashboard-school-overview/quickstart.md` - Quick start guide
