# Implementation Plan: Fix Dashboard KPIs & Layout

**Branch**: `070-fix-dashboard-kpis` | **Date**: 2026-05-11 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/070-fix-dashboard-kpis/spec.md`

## Summary

Correct and align all dashboard KPI computations to match the exact definitions in the spec: term-scoped financial metrics, active-only student/class counts, bursary lookup by `students.bursary_status`, leave-excluded staff attendance rate, removal of two KPI cards (High Overdue Balances, Teaching w/ Active Classes), removal of the Refresh KPIs button, tooltips on every card, and compact Quick Actions. The dashboard already uses the pre-aggregated `/dashboard` snapshot backed by `DashboardAggregationService`; this plan updates that service's computations and the frontend section components to match. No new tables are required.

## Technical Context

**Language/Version**: PHP 8.1+ (backend) · TypeScript / React 18 (frontend)  
**Primary Dependencies**: CodeIgniter 4 · MySQL · TanStack React Query · TailwindCSS · shadcn/ui  
**Storage**: MySQL — existing tables: `students`, `charges`, `payments`, `classes`, `staff`, `staff_attendance`, `leave_requests`, `transport_routes`, `transport_student_allocations`, `enrollments`, `ledger_adjustments`, `tenants`  
**Testing**: curl-based integration tests (Constitution Principle X) run after implementation  
**Target Platform**: Web SPA (admin/bursar roles)  
**Project Type**: Full-stack web service  
**Performance Goals**: Dashboard snapshot renders within 3 seconds; aggregation query set runs within 5 seconds on typical tenant data  
**Constraints**: No new migrations required; no new tables; all financial queries must continue to use `LedgerService::ELIGIBLE_CHARGE_TYPES` and `ELIGIBLE_PAYMENT_CATEGORIES` filters (Constitution Principle V)  
**Scale/Scope**: Single-tenant aggregation query set; ~10 SQL changes in `DashboardAggregationService`; ~5 frontend component files modified

## Constitution Check

*Pre-design gate — all 11 principles evaluated:*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Multi-Tenant Data Isolation | ✅ PASS | All new queries parameterised by `tenant_id` from JWT — no change to auth flow |
| II | API-First Separation of Concerns | ✅ PASS | All computation stays in `DashboardAggregationService`; frontend reads only from `/dashboard` endpoint |
| III | JWT Authentication & Role-Based Access | ✅ PASS | No new routes; existing `/api/dashboard` route already behind `JWTAuthFilter` |
| IV | Immutable Migrations | ✅ PASS | No schema changes required |
| V | Financial Ledger Integrity | ✅ PASS | All financial KPIs continue to use `LedgerService` eligible charge/payment filters and subquery pattern |
| VI | REST API Standards | ✅ PASS | No new endpoints; existing `respondSuccess`/`respondError` envelope unchanged |
| VII | Code Quality | ✅ PASS | Service method updates are small and focused; dead metric keys (`high_overdue_balances`, `teaching_staff_with_classes`) removed from snapshot list |
| VIII | Defensive Security | ✅ PASS | No new user inputs; parameterised queries throughout |
| IX | Error Handling | ✅ PASS | Division-by-zero guards added to collection rate and attendance rate methods |
| X | Integration Testing | ✅ PASS | curl validation tests required post-implementation per checklist |
| XI | Performance Discipline | ✅ PASS | Existing subquery patterns preserved; new term-scoped queries add ≤2 date-range filters to existing queries |

*Post-design re-check*: All 11 principles pass. No Complexity Tracking violations.

## Project Structure

### Documentation (this feature)

```text
specs/070-fix-dashboard-kpis/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (files touched by this feature)

```text
backend/
└── app/
    └── Services/
        └── DashboardAggregationService.php   # All KPI computation fixes

frontend/
└── src/
    ├── pages/
    │   └── Dashboard.tsx                      # Remove Refresh KPIs button; compact Quick Actions wrapper
    └── components/
        └── dashboard/
            ├── FinancialSection.tsx           # No-active-term guard display
            ├── EnrolmentSection.tsx           # No changes needed (already correct)
            ├── StudentsAlertsSection.tsx      # Remove High Overdue Balances card; add tooltips
            ├── StaffOverviewSection.tsx       # Remove Teaching w/ Active Classes; add tooltips; leave-excluded rate
            ├── TransportOverviewSection.tsx   # Add tooltips
            ├── QuickActions.tsx               # Compact size (sm buttons)
            └── MetricTile.tsx                 # Already supports tooltip prop — no changes needed
```

**Structure Decision**: Web application (Option 2). Backend changes are entirely within `DashboardAggregationService.php`. Frontend changes are entirely within existing dashboard section components and `Dashboard.tsx`. No new files required.
