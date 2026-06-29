# Implementation Plan: Admin Platform Console

**Branch**: `040-admin-console` | **Date**: 2026-04-21 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/040-admin-console/spec.md`

## Summary

The Admin Platform Console is a React 18 + TypeScript SPA that provides a platform-admin interface for managing SchoolLedger's multi-tenant SaaS fleet. It introduces a new `platform_users` identity store and platform-scoped JWTs, adds cross-tenant aggregation endpoints to the existing CodeIgniter 4 backend, and implements role-based access control (Owner/Admin/Finance/Support). The console surfaces real-time KPIs, tenant lifecycle management, subscription/plan administration, finance analytics, platform analytics, and global settings. All platform-scoped endpoints enforce platform-admin authorization and are isolated from tenant-scoped JWTs. Impersonation is supported for tenant admins with audit logging. No mock data is shipped; all views consume live backend data via authenticated HTTP calls.

## Technical Context

**Language/Version**: PHP 8.1+ (backend), TypeScript 5 (frontend)
**Primary Dependencies**: CodeIgniter 4, MySQL, JWT (backend); React 18, Vite, TanStack React Query, shadcn/ui, TailwindCSS (frontend)
**Storage**: MySQL (new tables: platform_users, platform_settings, platform_api_keys, platform_audit)
**Testing**: PHPUnit (backend), Vitest + React Testing Library (frontend)
**Target Platform**: Linux server (backend), modern browsers (frontend)
**Project Type**: web-service (multi-tenant SaaS admin console)
**Performance Goals**: Dashboard KPIs <2s load; CSV export up to 10k rows <5s; all pages interactive <2s on mid-range laptop
**Constraints**: <200ms p95 for read APIs; <100MB memory per admin session; JWT expiry with refresh flow
**Scale/Scope**: Up to 10k tenants, 100k invoices; platform admin team <50 users

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Multi-Tenant Data Isolation
- **Compliance**: Platform-scoped endpoints MUST NOT filter by tenant_id; they operate across all tenants. Tenant-scoped JWTs MUST be rejected. This is an intentional, justified exception for platform admin operations.
- **Implementation**: New platform endpoints use a separate JWTAuthFilter variant that validates `scope: "platform"` and does NOT require `tenant_id`. All existing tenant endpoints remain unchanged.

### II. API-First Separation of Concerns
- **Compliance**: The admin-frontend communicates exclusively via new `/api/platform/*` endpoints. No direct DB access. The backend serves only JSON; no frontend assets.
- **Implementation**: Add platform routes under a distinct group prefix to enforce separation.

### III. JWT Authentication & Role-Based Access
- **Compliance**: New platform JWTs include `scope: "platform"` and `platform_role`. Platform endpoints validate both. Tenant JWTs cannot access platform routes.
- **Implementation**: Extend JWT middleware to recognize platform scope; add role checks for Owner/Admin/Finance/Support.

### IV. Immutable Migrations
- **Compliance**: All new tables (platform_users, platform_settings, platform_api_keys, platform_audit) are added via new migration files. No existing migrations edited.
- **Implementation**: Standard CodeIgniter migration workflow; reversible where possible.

### V. Financial Ledger Integrity
- **Compliance**: No changes to tenant ledger logic. Finance page aggregates existing invoices; does not alter balance computation.
- **Implementation**: Use existing invoice/subscription tables; add only cross-tenant aggregation queries.

## Project Structure

### Documentation (this feature)

```text
specs/040-admin-console/
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
│   ├── Controllers/
│   │   ├── Platform/          # New: Platform-scoped API controllers
│   │   │   ├── AuthController.php
│   │   │   ├── TenantsController.php
│   │   │   ├── PlansController.php
│   │   │   ├── SubscriptionsController.php
│   │   │   ├── FinanceController.php
│   │   │   ├── AnalyticsController.php
│   │   │   └── SettingsController.php
│   ├── Database/
│   │   └── Migrations/        # New: platform_* tables
│   ├── Models/               # New: PlatformUser, PlatformSetting, etc.
│   └── Filters/              # New: PlatformJWTAuthFilter
└── tests/
    └── Platform/             # New: platform endpoint tests

admin-frontend/               # Existing: React SPA for platform console
├── src/
│   ├── components/
│   │   └── admin/            # Existing: admin UI components
│   ├── pages/                # Existing: Dashboard, Schools, Subscriptions, etc.
│   ├── hooks/                # New: platform-specific hooks
│   └── api/                  # New: platform API client
└── tests/
    └── platform/             # New: admin console tests
```

**Structure Decision**: We use the existing admin-frontend SPA and extend the backend with a new Platform controller namespace and platform-scoped JWT middleware. This keeps the console isolated from tenant code while reusing the same stack and deployment model.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Platform endpoints bypass tenant_id filtering (Principle I) | Platform admin requires cross-tenant visibility and actions; filtering would prevent aggregation and fleet management. | Using per-tenant admin accounts would require logging into each tenant and cannot provide cross-tenant views or bulk operations. |
| New platform_users table (Principle III scope extension) | Tenant roles are tenant-scoped; platform roles (Owner/Admin/Finance/Support) are distinct and must not be confused with tenant super_admin. | Reusing tenant users with a flag would conflate scopes and risk privilege escalation via JWT tambling. |
| New JWT scope field (Principle III) | Existing JWTs include tenant_id; platform JWTs must not. Adding `scope` cleanly separates the two auth realms without breaking existing tenant tokens. | Using a separate issuer or secret would duplicate infrastructure and increase operational overhead. |
