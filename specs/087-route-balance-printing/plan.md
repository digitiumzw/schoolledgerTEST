# Implementation Plan: Route Balance and Printable Student List

**Branch**: `087-route-balance-printing` | **Date**: 2026-06-09 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/087-route-balance-printing/spec.md`

## Summary

Enrich the existing transport route detail endpoint to return each active student's outstanding ledger balance (`totalBalance` from `LedgerService`) alongside the existing allocation data. Add route-level balance aggregates (totalStudents, studentsWithBalance, totalOutstandingBalance). Update the frontend `RouteDetailPage` to display balances per student, show a route summary card, and add a browser-native print button with a print-optimized stylesheet.

No schema migrations, no new API routes, no new tables. Pure enrichment of existing `GET /transport/routes/:id` response and UI enhancements.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: PHP 8.1+ · CodeIgniter 4 · MySQL  
**Primary Dependencies**: React 18 · TypeScript · Vite · TailwindCSS · shadcn/ui · TanStack React Query  
**Storage**: MySQL (existing schema; no migrations required)  
**Testing**: php -l (backend lint), tsc --noEmit (frontend type-check), ESLint, curl end-to-end  
**Target Platform**: Web (desktop primary for printing)  
**Project Type**: Web application (backend + frontend)  
**Performance Goals**: `GET /transport/routes/:id` response < 500ms for routes with up to 100 students (SC-003)  
**Constraints**: Browser-native print only (no PDF service); balances computed server-side per Constitution Principle XI  
**Scale/Scope**: Single tenant route, up to ~100 active students per route

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Notes |
|-----------|-------|-------|
| I. Multi-Tenant Data Isolation | PASS | Existing `getRoute()` already filters by `tenant_id` sourced from JWT. Balance lookup will use the same tenant scope. |
| II. API-First Separation of Concerns | PASS | Frontend consumes enriched API response; no direct DB access. No business logic added to frontend. |
| III. JWT Authentication & Role-Based Access | PASS | Existing route uses `requireRole('super_admin', 'admin', 'bursar')`. No new roles. |
| IV. Immutable Migrations | PASS | No schema changes required. |
| V. Financial Ledger Integrity | PASS | Balances computed using existing `LedgerService` subquery pattern. A new bulk-targeted method `getBalancesForStudentIds()` will reuse the same SQL subqueries as `getAllBalances()` to avoid N+1. |
| VI. REST API Standards & Consistent Responses | PASS | Existing `GET /transport/routes/:id` response envelope preserved; only additive fields added inside `students[]` and a new `balanceSummary` object. |
| VII. Code Quality & Maintainability | PASS | Small, focused changes to existing controller and page. Reusable print component extracted if complex. |
| VIII. Defensive Security | PASS | No new user inputs. Student IDs come from existing tenant-scoped query. |
| IX. Error Handling & Observability | PASS | Ledger balance errors caught and gracefully degraded to "—" per edge-case spec. |
| X. API Endpoint Testing | PASS | curl tests will cover happy path, zero-balance route, and unauthorized access. |
| XI. Backend-Driven Data & Performance Discipline | PASS | All balance computations happen in backend `LedgerService`. Frontend only renders prepared data. Bulk subquery pattern avoids N+1. |
| XII. Mutation Loading States & Stale-Data Prevention | PASS | Only existing mutations on this page are "Remove Student" and "Allocate Student" — both already show loading states and invalidate queries. No new mutations introduced. |
| XIII. Email Design System Consistency | N/A | No email communications involved. |

## Project Structure

### Documentation (this feature)

```text
specs/087-route-balance-printing/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
backend/
├── app/
│   ├── Controllers/Api/TransportController.php   # Enrich getRoute() with balances + aggregates
│   └── Services/LedgerService.php                # Add getBalancesForStudentIds() bulk method

frontend/
├── src/
│   ├── api/api.ts                                # Add balance field to TransportAllocationStudent type
│   ├── types/dashboard.ts                        # Extend TransportAllocationStudent + add RouteBalanceSummary
│   ├── pages/RouteDetailPage.tsx                 # Display balances, summary card, print button + print stylesheet
│   └── index.css                                 # Add @media print rules (or scoped print CSS)
```

**Structure Decision**: The project follows the existing backend/frontend split. All changes are additive to existing files. No new directories needed.

## Complexity Tracking

No constitution violations. All principles pass cleanly.
