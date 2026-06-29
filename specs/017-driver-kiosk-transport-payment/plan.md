# Implementation Plan: Driver Kiosk Toggle and Transport Payment Indicators

**Branch**: `017-driver-kiosk-transport-payment` | **Date**: 2026-04-07 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `specs/017-driver-kiosk-transport-payment/spec.md`

## Summary

Admins need two things: (1) a driver kiosk enable/disable toggle in Settings (with URL display), mirroring the existing staff and student kiosk cards in `GeneralSettingsTab.tsx`; and (2) a per-student transport payment status badge in the `RouteDetailModal`, derived at query time from the existing `charges` and `payments` tables for the current month. The backend gains one new `driverKioskModeEnabled` settings field, one enforcement check in `DriverKioskController`, and one new `GET /transport/routes/:id/payment-status` endpoint.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend) · PHP 8.1+ (backend)  
**Primary Dependencies**: React 18 + TanStack React Query + shadcn/ui (frontend) · CodeIgniter 4 (backend)  
**Storage**: MySQL — no new tables; `tenants.settings` JSON gains one new key  
**Testing**: Manual — no automated test suite in this repo  
**Target Platform**: Web (desktop-first admin UI; kiosk runs on shared tablet/desktop)  
**Project Type**: Web service (REST API) + SPA  
**Performance Goals**: Route detail modal loads payment status within 3 seconds  
**Constraints**: All DB queries must include `tenant_id`; balance computed from source records (Constitution Principle V); no frontend business logic (Principle II)  
**Scale/Scope**: Per-tenant settings JSON update; one new API endpoint; two UI component changes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked post-design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Multi-Tenant Data Isolation | ✅ Pass | All new queries filter by `tenant_id` sourced from JWT payload. New payment-status endpoint verified per `getTenantId()`. |
| II. API-First Separation | ✅ Pass | No DB access from frontend. Payment status computation lives entirely in `TransportController`. |
| III. JWT Auth & Role-Based Access | ✅ Pass | New `getRoutePaymentStatus` endpoint is JWT-gated via `JWTAuthFilter` and role-checked (`admin`, `super_admin`). Driver kiosk endpoints remain intentionally public (same justified exception as existing DriverKioskController — see Complexity Tracking). |
| IV. Immutable Migrations | ✅ Pass | No schema changes. `driverKioskModeEnabled` is a new key in the `settings` JSON blob; existing migration files untouched. |
| V. Financial Ledger Integrity | ✅ Pass | Payment status derived at query time via LEFT JOIN subquery. Follows the `getAllBalances()` bulk-subquery pattern. No mutable balance column introduced. |

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| DriverKioskController is exempt from JWTAuthFilter (Principle III) | Kiosk terminals have no login session; existing justified exception from specs/015 | Requiring JWT would prevent unauthenticated kiosk access, breaking the kiosk model entirely |

## Project Structure

### Documentation (this feature)

```text
specs/017-driver-kiosk-transport-payment/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   └── api-endpoints.md ← Phase 1 output
└── tasks.md             ← Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── Config/
│   │   └── Routes.php                          ← register new payment-status route
│   └── Controllers/Api/
│       ├── SettingsController.php              ← add driverKioskModeEnabled
│       ├── DriverKioskController.php           ← enforce enabled flag in resolveTenant()
│       └── TransportController.php             ← new getRoutePaymentStatus() method

frontend/
├── src/
│   ├── types/
│   │   └── dashboard.ts                        ← extend Settings + TransportStudent types
│   ├── api/
│   │   └── api.ts                              ← add getRoutePaymentStatus() + types
│   └── components/
│       ├── settings/
│       │   └── GeneralSettingsTab.tsx          ← add driver kiosk Card
│       └── modals/
│           └── RouteDetailModal.tsx            ← add payment status badges
```

**Structure Decision**: Web application layout (frontend + backend). All changes are additions to existing files — no new files required.

## Implementation Phases

### Phase A: Backend — Settings

1. **`SettingsController.php`** — `DEFAULT_SETTINGS`: add `'driverKioskModeEnabled' => false`
2. **`SettingsController.php`** — `index()`: read and return `driverKioskModeEnabled`
3. **`SettingsController.php`** — `update()`: accept and persist `driverKioskModeEnabled`

### Phase B: Backend — Driver Kiosk Enforcement

4. **`DriverKioskController.php`** — `resolveTenant()`: after resolving the tenant, decode `settings` JSON and return `null` (effectively 403/404) if `driverKioskModeEnabled` is falsy

### Phase C: Backend — Payment Status Endpoint

5. **`TransportController.php`** — add `getRoutePaymentStatus($routeId)`:
   - Role-gate: `admin`, `super_admin`
   - Validate `$routeId` belongs to `getTenantId()`
   - Accept `month` query param (default: current `date('Y-m')`); validate format `YYYY-MM`
   - Single LEFT JOIN subquery (see data-model.md for query design)
   - Return `{ routeId, month, students: [{ studentId, paymentStatus }] }`

6. **`Routes.php`** — add `$routes->get('transport/routes/(:segment)/payment-status', 'TransportController::getRoutePaymentStatus/$1');` **before** the existing `transport/routes/(:segment)` line to prevent route shadowing

### Phase D: Frontend — Types & API

7. **`src/types/dashboard.ts`** — add `driverKioskModeEnabled?: boolean` to `Settings`; add `paymentStatus?: 'paid' | 'unpaid' | 'no_charge' | 'unknown'` to `TransportStudent`
8. **`src/api/api.ts`** — add `RoutePaymentStatusResponse` interface and `getRoutePaymentStatus(routeId, month?)` function

### Phase E: Frontend — Settings UI

9. **`GeneralSettingsTab.tsx`** — add a third kiosk Card ("Driver Kiosk") after the "Student Attendance Kiosk" Card, following the exact same toggle + URL display + Save button pattern. URL: `${window.location.origin}/kiosk/${settings.kioskCode}/driver`

### Phase F: Frontend — Route Detail Modal

10. **`RouteDetailModal.tsx`** — add `useQuery` call for payment status when modal is open; merge by `studentId`; render `Badge` per student (`paid` → green, `unpaid` → destructive, `no_charge` → muted outline, `unknown` → muted outline); show a card-level loading skeleton while fetching; on fetch error, fall back to `unknown` state (no error display in modal)
