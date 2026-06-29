# Implementation Plan: Staff Attendance Tracking

**Branch**: `067-staff-attendance-tracking` | **Date**: 2026-05-08 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/067-staff-attendance-tracking/spec.md`

## Summary

Extend the existing staff attendance module — which already tracks check-in/check-out, daily status, and leave requests at a basic level — to fully support the spec: automated `early_departure` status classification, overtime calculation against configurable standard hours, leave-approval → attendance auto-creation (and auto-void on cancellation), and aggregated period/department reporting. The `staff`, `staff_attendance`, and `leave_requests` tables already exist and carry tenant isolation; all new work is additive: one migration, one new service, targeted controller additions, one new frontend page section, and one new API hook.

## Technical Context

**Language/Version**: PHP 8.1+ · CodeIgniter 4 (backend) / TypeScript · React 18 · Vite (frontend)  
**Primary Dependencies**: CodeIgniter 4 ORM / TanStack React Query · shadcn/ui · TailwindCSS  
**Storage**: MySQL — existing `staff`, `staff_attendance`, `leave_requests` tables; `tenants.settings` JSON for work-hours config  
**Testing**: curl-only integration tests per Constitution Principle X, run after full implementation  
**Target Platform**: Linux server (backend) / browser SPA (frontend)  
**Project Type**: Web application — REST API + React SPA  
**Performance Goals**: Department attendance report for 100 staff over 1 month < 3 s (SC-003); single-row attendance writes < 200 ms  
**Constraints**: All queries must include `tenant_id`; no business logic in frontend; standard hours config sourced from `tenants.settings` JSON; leave auto-sync must be transactional  
**Scale/Scope**: Per-tenant staff counts typically 20–150; date range reports spanning up to 12 months

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|-----------|------------|--------|
| I. Multi-Tenant Data Isolation | All new queries against `staff_attendance` and `leave_requests` include `tenant_id` scoping from JWT | ✅ PASS |
| II. API-First Separation | Business logic (overtime calc, leave sync, period aggregation) in `StaffAttendanceService`; frontend reads via REST | ✅ PASS |
| III. JWT Auth & RBAC | All new routes under `/api/*` protected by `JWTAuthFilter`; admin/super_admin role required for mutations | ✅ PASS |
| IV. Immutable Migrations | Schema changes delivered as a new dated migration file; no edits to existing migrations | ✅ PASS |
| V. Financial Ledger Integrity | No ledger impact — attendance data is HR-only, no charge/payment records touched | ✅ N/A |
| VI. REST Standards | New endpoints use plural nouns, lowercase kebab-case, `respondSuccess`/`respondError` envelopes | ✅ PASS |
| VII. Code Quality | Business logic extracted to `StaffAttendanceService`; controllers remain thin; no duplication | ✅ PASS |
| VIII. Defensive Security | All timestamps/dates validated server-side; check-out < check-in rejected with 400; deactivated staff blocked | ✅ PASS |
| IX. Error Handling | All error paths return structured error envelope; no internal detail leakage; DB errors caught in service | ✅ PASS |
| X. Integration Testing | curl tests written after implementation: happy paths, error paths, tenant isolation | ✅ PASS |
| XI. Performance Discipline | Period report uses single SQL aggregate query (no N+1); bulk leave sync uses `insertBatch` | ✅ PASS |

**Post-design re-check**: All 11 principles PASS. No Complexity Tracking violations.

## Project Structure

### Documentation (this feature)

```text
specs/067-staff-attendance-tracking/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── staff-attendance-api.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (affected paths)

```text
backend/
├── app/
│   ├── Database/Migrations/
│   │   └── 2026-05-08-000001_ExtendStaffAttendanceForTracking.php   [NEW]
│   ├── Models/
│   │   └── AttendanceModel.php              [MODIFY — add period aggregation query]
│   ├── Services/
│   │   └── StaffAttendanceService.php       [NEW — overtime, leave sync, reporting]
│   ├── Controllers/Api/
│   │   ├── AttendanceController.php         [MODIFY — add early_departure, overtime, report endpoints]
│   │   └── LeaveController.php              [MODIFY — trigger leave sync on approve/cancel]
│   └── Config/
│       └── Routes.php                       [MODIFY — add report + period summary routes]
└── tests/
    └── Integration/
        └── StaffAttendanceTest.php          [NEW — curl-based integration tests]

frontend/
└── src/
    ├── api/
    │   └── api.ts                           [MODIFY — add overtime, period report, department report types/methods]
    ├── hooks/
    │   └── useStaffAttendanceReport.ts      [NEW — React Query hook for period/dept reports]
    ├── pages/
    │   └── StaffAttendance.tsx              [MODIFY — add overtime column, leave conflict warning, period report tab]
    └── components/
        └── staff-attendance/
            └── AttendancePeriodReport.tsx   [NEW — department/period aggregation view]
```

**Structure Decision**: Web application (Option 2). All new backend files follow the existing `backend/app/` structure. Frontend follows the `pages/` + `hooks/` + `components/` convention established across the codebase.

## Complexity Tracking

> No Constitution violations — table not required.
