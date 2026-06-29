# Implementation Plan: Subscriptions Operations Dashboard

**Branch**: `079-subscriptions-ops-dashboard` | **Date**: 2026-05-21 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/079-subscriptions-ops-dashboard/spec.md`

## Summary

Transform the platform Subscriptions page from a basic CRUD list into an operations dashboard. The primary requirement is threefold: (1) enrich the `GET /api/platform/finance/summary` endpoint and the `GET /api/platform/subscriptions` endpoint with operational KPI fields and richer per-row data; (2) add server-side search and multi-filter support to the subscriptions list; (3) redesign `Subscriptions.tsx` to render the new data — operational KPI cards, enriched table columns, multi-filter bar, per-row action menus on all statuses, semantic status badges, clean price formatting, improved visual rhythm, and a more prominent sidebar active state.

No new database migrations are required. All new fields are computed from existing tables (`school_subscriptions`, `subscription_plans`, `subscription_payment_transactions`, `subscription_invoices`).

## Technical Context

**Language/Version**: PHP 8.1+ (backend) · TypeScript / React 18 (frontend)  
**Primary Dependencies**: CodeIgniter 4 (backend) · TanStack React Query · shadcn/ui · TailwindCSS · Lucide icons  
**Storage**: MySQL — tables: `school_subscriptions`, `subscription_plans`, `subscription_payment_transactions`, `subscription_invoices`, `tenants`  
**Testing**: curl HTTP validation (Principle X)  
**Target Platform**: Web — platform admin panel at `/platform-control-panel/subscriptions`  
**Project Type**: Web application (backend API + React SPA)  
**Performance Goals**: Subscriptions list endpoint < 300 ms at expected platform scale (hundreds of tenants, not millions)  
**Constraints**: No new migrations; no client-side aggregation or filtering (Principle XI); all mutations must show loading states (Principle XII)  
**Scale/Scope**: Platform-level; expected ~10–500 tenant subscriptions total

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Multi-Tenant Isolation | ✅ PASS | Platform endpoints are not tenant-scoped; they operate across all tenants by design. The platform JWT filter (`platform-jwt-auth`) enforces platform-user authentication. No tenant-owned data is being queried by tenant_id — the platform user sees all tenants. |
| II. API-First Separation | ✅ PASS | All new KPI fields are computed server-side in `FinanceController::summary()` and `SubscriptionsController::index()`. Frontend only passes query params and renders responses. |
| III. JWT Auth & RBAC | ✅ PASS | All platform routes are protected by `platform-jwt-auth` filter. `canViewFinance()` and `canManageSubscriptions()` role guards are already in place. No changes to auth layer. |
| IV. Immutable Migrations | ✅ PASS | No schema changes required. All new fields are computed at query time from existing tables. |
| V. Financial Ledger Integrity | ✅ N/A | This feature does not touch tenant-side ledger balances. MRR computation is a platform-side read-only aggregate. |
| VI. REST Standards | ✅ PASS | Existing routes extended in-place. No new routes for filtering — query params added to existing `GET /subscriptions`. All responses use `respondSuccess`/`respondError` via `BasePlatformController`. |
| VII. Code Quality | ✅ PASS | Filter logic extracted to focused builder methods. Frontend filter state extracted to local state. No duplication with existing `TenantsController` search pattern. |
| VIII. Defensive Security | ✅ PASS | All `getGet()` inputs are validated/cast before use in queries. Search term uses `like()` (parameterized). No raw query string interpolation. |
| IX. Error Handling | ✅ PASS | All query errors handled via CI4's exception chain; frontend handles `isError` state on queries. |
| X. curl Validation | ✅ PLANNED | Quickstart.md will document curl test cases for new KPI fields, search, and filter params. |
| XI. Backend-Driven Data | ✅ PASS | Search, plan filter, billing cycle filter, payment status filter, expiring-soon filter all applied server-side in `SubscriptionsController::index()`. New KPI counts computed in SQL, not JS. Frontend receives view-ready rows and metadata. |
| XII. Mutation Loading States | ✅ PASS | Existing `cancelMut`, `assignMut`, `updateMut` all already expose `isPending`. Action menus will be disabled while mutations are in-flight. Post-mutation cache invalidation already implemented. |
| XIII. Email Design | ✅ N/A | No email communication involved in this feature. |

**Post-design re-check**: All principles remain PASS. No violations require justification.

## Project Structure

### Documentation (this feature)

```text
specs/079-subscriptions-ops-dashboard/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── subscriptions-ops-api.md   # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code

```text
backend/
└── app/
    └── Controllers/
        └── Platform/
            ├── FinanceController.php        # Extend summary() with 3 new KPI fields
            └── SubscriptionsController.php  # Extend index() with search + 4 filter params + richer row data

frontend/
└── src/
    └── admin/
        ├── pages/
        │   └── Subscriptions.tsx            # Full page redesign
        ├── components/
        │   └── admin/
        │       ├── AppSidebar.tsx           # Active-state visual prominence
        │       └── StatusBadge.tsx          # Already has correct semantic colors — verify/confirm
        └── api/
            └── platform.ts                  # Extend getSubscriptions params + getFinanceSummary return type
```

**Structure Decision**: Web application (backend + frontend). All changes are additive to existing files; no new files required for the MVP scope.

## Complexity Tracking

> No Constitution violations requiring justification.
