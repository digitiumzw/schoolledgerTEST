# Implementation Plan: Staff Attendance Filtering and Alerts

**Branch**: `035-staff-attendance-filters` | **Date**: April 16, 2026 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/035-staff-attendance-filters/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Add month-based filtering to the Staff Attendance summary page and implement an alert system on the Today's Attendance page for staff who haven't checked in, allowing administrators to mark them as absent/excused with optional comments. This feature requires backend API extensions for filtered queries and attendance status updates, plus frontend UI components for month selection and alert management.

## Technical Context

**Language/Version**: PHP 8.1+ (backend), TypeScript/React 18 (frontend)  
**Primary Dependencies**: CodeIgniter 4 (backend), TanStack React Query, React Hook Form, Zod, shadcn/ui (frontend)  
**Storage**: MySQL with CodeIgniter 4 ORM  
**Testing**: PHPUnit (backend), manual testing workflow (frontend)  
**Target Platform**: Linux server (backend), Modern browsers (frontend SPA)
**Project Type**: Web application (API + React SPA)  
**Performance Goals**: <2 second filter response, real-time alert display  
**Constraints**: Must comply with SchoolLedger Constitution principles (multi-tenant isolation, JWT auth, immutable migrations)  
**Scale/Scope**: Support for schools with up to 500 staff members

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Principle I - Multi-Tenant Data Isolation
**Status**: ⚠️ ATTENTION REQUIRED  
All attendance queries MUST filter by `tenant_id` from JWT payload. New endpoints for filtered attendance and status updates require explicit `tenant_id` filtering.

### Principle II - API-First Separation
**Status**: ✅ PASS  
Frontend will communicate via REST API at `/api`. No direct DB access from frontend.

### Principle III - JWT Authentication & Role-Based Access
**Status**: ⚠️ ATTENTION REQUIRED  
New endpoints MUST be protected by `JWTAuthFilter` and enforce `admin` role checks.

### Principle IV - Immutable Migrations
**Status**: ✅ PASS  
Schema changes for comment field will require new migration file.

### Principle V - Financial Ledger Integrity
**Status**: N/A  
This feature does not involve financial ledger data.

### Pre-Planning Gate Result
**PROCEED with research** - Constitution requirements are clear and can be addressed in design phase.

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
backend/
├── app/
│   ├── Config/
│   │   └── Routes.php              # New API routes for attendance endpoints
│   ├── Controllers/
│   │   └── Api/
│   │       └── AttendanceController.php   # New: Filtered queries, status updates
│   ├── Database/
│   │   └── Migrations/
│   │       └── 2026-04-16-AddAttendanceComment.php  # New: comment column
│   └── Models/
│       └── AttendanceModel.php     # Extend: Add comment support, month queries
├── public/
└── tests/

frontend/
├── src/
│   ├── api/
│   │   └── attendance.ts           # New: API client for attendance endpoints
│   ├── components/
│   │   ├── MonthFilter.tsx         # New: Month selector component
│   │   ├── AttendanceAlert.tsx     # New: Alert for unchecked staff
│   │   └── AttendanceStatusModal.tsx # New: Absent/Excused + comment modal
│   ├── hooks/
│   │   ├── useAttendance.ts        # New: React Query hooks for attendance
│   │   └── useAttendanceFilter.ts  # New: Filter state management
│   └── pages/
│       ├── StaffAttendance.tsx     # Modify: Add month filter
│       └── TodaysAttendance.tsx      # Modify: Add alert system
└── tests/
```

**Structure Decision**: Web application (Option 2) matching existing SchoolLedger architecture. Backend extends existing AttendanceController and Model. Frontend adds new components and hooks while modifying existing attendance pages.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
