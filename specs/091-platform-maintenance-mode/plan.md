# Implementation Plan: Platform Maintenance Mode

**Branch**: `091-platform-maintenance-mode` | **Date**: 2026-06-22 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/091-platform-maintenance-mode/spec.md`

## Summary

Add a platform-wide maintenance mode toggle in the Platform Control Panel settings. When enabled, all non-admin tenant users see a maintenance notice instead of the normal application UI. Platform admins and tenant admins retain full access. The toggle state and customizable headline/message are persisted in the existing `platform_settings` table. A public unauthenticated endpoint (`GET /api/maintenance-status`) allows the tenant frontend to check maintenance state without a session. The `JWTAuthFilter` is extended to return a 503 maintenance response for authenticated non-admin tenant API calls when maintenance mode is on.

## Technical Context

**Language/Version**: PHP 8.1+ (backend), TypeScript / React 18 (frontend)
**Primary Dependencies**: CodeIgniter 4, MySQL, React Router, TanStack React Query, TailwindCSS, shadcn/ui
**Storage**: MySQL — `platform_settings` table (existing key-value store with JSON value column and type ENUM)
**Testing**: curl-based endpoint tests (per Constitution Principle X)
**Target Platform**: Linux server (backend), modern web browsers (frontend)
**Project Type**: Web service (multi-tenant SaaS)
**Performance Goals**: Public maintenance-status endpoint < 500ms p95; filter check adds < 5ms per API request
**Constraints**: Maintenance mode must not block platform admin API routes (`/api/platform/*`); must not block public kiosk/receipt/demo-request endpoints; must not block tenant admin or super_admin role users
**Scale/Scope**: 1 new migration (seed defaults), 1 modified filter, 1 new public controller, 1 modified platform settings controller, 1 new frontend maintenance notice component, 1 new frontend hook, modifications to tenant App.tsx and platform Settings.tsx

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Multi-Tenant Data Isolation | ✅ PASS | Maintenance mode is a platform-level setting stored in `platform_settings` (no `tenant_id`). The public status endpoint returns no tenant data. The filter check runs before tenant-scoped controller logic. |
| II | API-First Separation of Concerns | ✅ PASS | Maintenance state is read via API endpoint; frontend renders the notice based on the API response. No direct DB access from frontend. |
| III | JWT Authentication & Role-Based Access | ✅ PASS | The `JWTAuthFilter` already decodes JWT and attaches `request->user` with `role`. Maintenance check reads `role` from the decoded token to bypass admin/super_admin users. Platform routes use separate `PlatformJWTAuthFilter` — unaffected. |
| IV | Immutable Migrations | ✅ PASS | New migration file only seeds default settings rows into `platform_settings`. No schema changes needed — the table already exists with a flexible key-value structure. |
| V | Financial Ledger Integrity | ✅ PASS | No ledger queries involved. Maintenance mode blocks API access for non-admins but does not modify any financial data. |
| VI | REST API Standards & Consistent Responses | ✅ PASS | New endpoint `GET /api/maintenance-status` follows REST naming. Uses `BaseApiController::success` / `error` helpers. 503 maintenance response uses the standard error envelope. |
| VII | Code Quality & Maintainability | ✅ PASS | Maintenance check logic is centralized in the `JWTAuthFilter` and a small `MaintenanceService`. No duplication. |
| VIII | Defensive Security | ✅ PASS | Public endpoint returns only maintenance state + message text (no sensitive data). Setting updates require platform admin auth via existing `canManageSettings` policy. |
| IX | Error Handling & Observability | ✅ PASS | Filter logs maintenance mode interception. Setting update failures return standard error responses. Audit log entries record toggle and message changes. |
| X | API Endpoint Testing (via curl) | ✅ PASS | curl tests will cover: public status endpoint, toggle on/off, message update, 503 response for non-admin API calls, admin bypass, platform route unaffected. |
| XI | Backend-Driven Data & Performance | ✅ PASS | Maintenance state is server-side. The filter reads from `PlatformSetting` model with in-process static cache (already implemented). No N+1 — single cached key lookup per request. Public endpoint returns a minimal 3-field JSON payload. |
| XII | Mutation Loading States & Stale-Data Prevention | ✅ PASS | Toggle save uses `useMutation` with `isPending` → button shows loading state and is disabled during save. React Query cache for `platform-settings` is invalidated on success. Maintenance status query is polled by the tenant frontend with `refetchInterval` so the notice appears/disappears within 30 seconds. |
| XIII | Email Design System Consistency | ✅ N/A | No email communications involved in this feature. |

**Backend-driven data confirmation**: The maintenance state is determined entirely by the backend. The frontend only reads the API response and renders the notice. No client-side filtering or business logic.

**Query-efficiency strategy**: `PlatformSetting::get('maintenance_mode')` uses a static in-process cache (`self::$cache`). The filter performs a single cached lookup. The public endpoint performs the same cached lookup. No indexes needed beyond the existing unique key on `platform_settings.key`.

**Mutation loading confirmation**: The toggle save mutation exposes `isPending`, disables the save button during in-flight, and invalidates `['platform', 'settings']` query key on success. No stale data flashes.

## Project Structure

### Documentation (this feature)

```text
specs/091-platform-maintenance-mode/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── maintenance-api.md
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── Config/
│   │   └── Routes.php                          # ADD: GET /api/maintenance-status (public)
│   ├── Controllers/
│   │   ├── Api/
│   │   │   └── MaintenanceController.php       # NEW: public status endpoint
│   │   └── Platform/
│   │       └── SettingsController.php           # MODIFY: add maintenance-specific update endpoint
│   ├── Filters/
│   │   └── JWTAuthFilter.php                    # MODIFY: add maintenance mode check after auth
│   ├── Database/
│   │   └── Migrations/
│   │       └── 2026-06-22-000001_SeedMaintenanceDefaults.php  # NEW: seed default settings
│   └── Database/
│       └── Seeds/
│           └── PlatformSeeder.php              # MODIFY: add maintenance defaults to seed array

frontend/
├── src/
│   ├── api/
│   │   └── api.ts                               # ADD: getMaintenanceStatus() function
│   ├── components/
│   │   └── MaintenanceNotice.tsx                # NEW: full-screen maintenance notice
│   ├── hooks/
│   │   └── useMaintenanceStatus.ts             # NEW: polling hook for maintenance state
│   ├── App.tsx                                  # MODIFY: wrap AppLayout with maintenance check
│   └── admin/
│       ├── api/
│       │   └── platform.ts                      # ADD: updateMaintenanceMode() function
│       ├── hooks/
│       │   └── useSettings.ts                   # MODIFY: add maintenance-specific mutation
│       └── pages/
│           └── Settings.tsx                     # MODIFY: add Maintenance tab with toggle + message editor
```

**Structure Decision**: Web application structure (backend + frontend) matching the existing project layout. Backend changes follow the existing CodeIgniter 4 conventions (Controllers, Filters, Migrations, Seeds). Frontend changes follow the existing React SPA conventions (api.ts, hooks, components, admin pages).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
