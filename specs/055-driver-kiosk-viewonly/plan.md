# Implementation Plan: Driver Kiosk View-Only Access

**Branch**: `055-driver-kiosk-viewonly` | **Date**: 2026-04-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/055-driver-kiosk-viewonly/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Enhance the existing driver kiosk to provide comprehensive view-only access to assigned bus information, route stops in sequence, and student details including pickup/drop-off stops. Add a "Paid Only" filter to help drivers identify eligible students for transport. The kiosk uses Employee ID authentication and operates in a view-only mode to ensure data integrity.

**Key Enhancements to Existing System:**
- Extend `/api/kiosk/driver/validate` to return assigned bus/vehicle details
- Extend `/api/kiosk/driver/routes/:code` to include stops in sequence order
- Add stop information to student roster (pickup/drop-off points)
- Add payment status filter to show only paid students per route
- Maintain strict view-only access (no write operations permitted)

## Technical Context

**Language/Version**: PHP 8.1+ (backend), TypeScript/React 18 (frontend)  
**Primary Dependencies**: CodeIgniter 4 (backend), TanStack Query, React Hook Form, Zod, shadcn/ui (frontend)  
**Storage**: MySQL with existing transport schema (transport_vehicles, transport_routes, transport_stops, transport_route_periods, transport_student_allocations)  
**Testing**: PHPUnit (backend), TypeScript type-check + ESLint (frontend)  
**Target Platform**: Web kiosk (tablets 10"+, Chrome/Safari/Edge)  
**Project Type**: Web application (full-stack)  
**Performance Goals**: <2 second page loads, <500ms API response times  
**Constraints**: View-only access enforcement, no JWT (kiosk uses kiosk_code + employee_id), tenant isolation via kiosk_code resolution  
**Scale/Scope**: Single tenant per kiosk session, routes with up to 50 stops, 100 students per route

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Multi-Tenant Data Isolation | ⚠️ REVIEW | Kiosk uses kiosk_code to resolve tenant, then all queries filter by tenant_id. Need to verify all new queries include tenant_id. |
| II. API-First Separation | ✅ PASS | Frontend already communicates via API exclusively. |
| III. JWT Authentication | ⚠️ JUSTIFIED | Kiosk endpoints intentionally exempt from JWTAuthFilter (same pattern as StudentKioskController, KioskController). Uses kiosk_code + employee_id instead. |
| IV. Immutable Migrations | ✅ PASS | No schema changes required - using existing tables. |
| V. Financial Ledger Integrity | ✅ PASS | Payment check queries use existing charge/payment tables with computed balances. |
| VI. REST API Standards | ✅ PASS | Extending existing endpoints with consistent JSON envelopes. |
| VII. Code Quality | ✅ PASS | Following existing controller patterns. |
| VIII. Defensive Security | ✅ PASS | Kiosk uses opaque kiosk_code, unified 403 responses to prevent enumeration. |
| IX. Error Handling | ✅ PASS | Using BaseApiController helpers for consistent error responses. |
| X. Integration Testing | ✅ PASS | Will add integration tests for new endpoint behaviors. |
| XI. Performance Discipline | ✅ PASS | Queries optimized with proper indexes (existing route_id, tenant_id indexes). |

### Post-Design Re-Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Multi-Tenant Data Isolation | ✅ PASS | All queries include tenant_id filtering via resolved tenant. |
| III. JWT Authentication | ✅ JUSTIFIED | Constitution III exception documented - kiosk mode requires public endpoints. |
| X. Integration Testing | ✅ PASS | Integration tests cover happy path, error cases, and tenant isolation. |

## Project Structure

### Documentation (this feature)

```text
specs/055-driver-kiosk-viewonly/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (no clarifications needed - SKIP)
├── data-model.md        # Phase 1 output (using existing schema)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── driver-kiosk.md  # API contract for driver kiosk endpoints
│   └── payment-status.md # Payment check contract
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

**Structure Decision**: Web application with existing backend/frontend separation.

```text
backend/
├── app/
│   ├── Controllers/Api/
│   │   └── DriverKioskController.php      # EXTEND: Add bus, stops, payment filter
│   ├── Models/
│   │   ├── TransportVehicleModel.php      # NEW: Vehicle query helpers
│   │   └── TransportStopModel.php         # NEW: Stop query helpers
│   └── Services/
│       └── DriverKioskService.php         # NEW: Business logic for kiosk data
└── tests/
    └── integration/
        └── DriverKioskTest.php            # NEW: Integration tests

frontend/
├── src/
│   ├── api/
│   │   └── api.ts                         # EXTEND: Update kioskDriverApi interfaces
│   ├── pages/
│   │   └── DriverKioskPage.tsx            # EXTEND: Add bus info, stops, paid filter
│   └── components/driver-kiosk/
│       ├── BusInfoCard.tsx                # NEW: Display assigned bus
│       ├── RouteStopsList.tsx             # NEW: Show stops in sequence
│       ├── StudentRosterItem.tsx          # NEW: Student with stop info
│       └── PaidOnlyFilter.tsx             # NEW: Toggle for paid students
└── tests/
```

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Constitution III JWT Exception | Kiosk is accessed on shared terminals without authenticated user sessions. Kiosk uses kiosk_code (tenant identifier) + employee_id (driver identifier) for authentication. | JWT requires user login with email/password - not practical for quick kiosk access. Same pattern used in StudentKioskController and KioskController. |
