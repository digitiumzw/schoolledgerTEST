# Implementation Plan: Transport Student Assignment Constraints & History

**Branch**: `054-transport-constraints` | **Date**: 2026-04-30 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification enforcing single route per student, mandatory stop assignment, automatic deallocation on status change, transport history, and missing charge alerts.

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

This feature implements core constraints and audit capabilities for the Transport module:

1. **Single Route Enforcement**: Database-level unique constraint on `(student_id, status='active')` prevents students from being assigned to multiple routes simultaneously. API-level validation provides clear error messages with current route information.

2. **Mandatory Stop Assignment**: All transport allocations require a valid `stop_id` belonging to the assigned route. Routes without stops cannot accept student assignments.

3. **Automatic Deallocation**: Database trigger on student status changes automatically terminates active transport assignments when status moves from 'active' to non-active states (withdrawn, suspended, graduated, transferred).

4. **Transport History**: Historical assignment records preserved via soft-delete pattern (status='inactive' with end_date). Student profile API extended to include chronological transport history.

5. **Missing Charge Alerts**: Computed view identifies students with active assignments but no current-month transport charges. Dashboard component displays aggregated alert counts and per-student badges.

## Technical Context

**Language/Version**: PHP 8.1+ (Backend), TypeScript/React 18 (Frontend)
**Primary Dependencies**: CodeIgniter 4, MySQL, TanStack React Query, React Hook Form + Zod
**Storage**: MySQL with InnoDB (ACID transactions required for reassignment atomicity)
**Testing**: PHPUnit integration tests in `backend/tests/`
**Target Platform**: Linux server (backend), Modern browsers (frontend)
**Project Type**: Web application (backend + frontend SPA)
**Performance Goals**: <100ms for route assignment API, <2s for student history load, <1s for dashboard alert generation
**Constraints**: Must maintain multi-tenant isolation (tenant_id filtering on all queries), database constraints for race condition prevention
**Scale/Scope**: Up to 10,000 students per tenant, concurrent admin operations supported

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Verification

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Multi-Tenant Data Isolation | PASS | All transport queries already include `tenant_id` filtering. Migration will maintain this pattern. |
| II. API-First Separation | PASS | Frontend will use existing API patterns. No business logic in frontend layer. |
| III. JWT Authentication | PASS | All new endpoints under `/api/transport/*` will use `JWTAuthFilter` and role checks. |
| IV. Immutable Migrations | PASS | Schema changes will be new migration files, not edits to existing. |
| V. Financial Ledger Integrity | PASS | Missing charge alerts are computed views, not stored; no balance caching issues. |
| VI. REST API Standards | PASS | Endpoints will use `BaseApiController::respondSuccess/Error` helpers. |
| VII. Code Quality | PASS | Logic will be extracted to service classes; controllers remain thin. |
| VIII. Defensive Security | PASS | Input validation via CI4 validation; parameterized queries throughout. |
| IX. Error Handling | PASS | Explicit error handling with consistent JSON envelopes. |
| X. Integration Testing | PASS | Integration tests required for all new endpoints (happy path, error path, tenant isolation). |
| XI. Performance Discipline | PASS | Database indexes will be added for query optimization; no speculative optimization. |

**Gate Result**: PASS - All principles can be satisfied. Proceeding to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/054-transport-constraints/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output - Reassignment billing decision
├── data-model.md        # Phase 1 output - Schema changes and constraints
├── quickstart.md        # Phase 1 output - Local development setup
├── contracts/           # Phase 1 output - API endpoint contracts
│   ├── transport-assignments.md
│   └── student-transport-history.md
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

This is a web application with backend API and frontend SPA. Files will be created/modified in the following locations:

```text
backend/
├── app/
│   ├── Config/Routes.php                    # Add new API routes
│   ├── Controllers/Api/
│   │   ├── TransportController.php          # Modify: add reassignment endpoint, validation
│   │   └── StudentController.php            # Modify: add transport-history endpoint
│   ├── Database/
│   │   └── Migrations/
│   │       └── 2026-04-30-XXX_Add_transport_constraints.php  # New: constraints, trigger
│   ├── Models/
│   │   ├── TransportStudentAllocationModel.php  # New: with validation hooks
│   │   └── StudentModel.php                 # Modify: add status change hook
│   └── Services/
│       ├── TransportAssignmentService.php   # New: business logic, reassignment
│       └── StudentStatusService.php         # Modify: transport deallocation hook
└── tests/
    └── integration/
        ├── TransportAssignmentTest.php      # New: constraint tests
        ├── TransportReassignmentTest.php      # New: atomic reassignment tests
        └── StudentTransportHistoryTest.php  # New: history endpoint tests

frontend/
├── src/
│   ├── api/
│   │   └── api.ts                          # Modify: add transport history, missing charges endpoints
│   ├── hooks/
│   │   ├── useTransportAssignments.ts      # New: assignment operations with validation
│   │   ├── useTransportHistory.ts            # New: student transport history
│   │   └── useMissingChargeAlerts.ts         # New: missing charge queries
│   ├── components/
│   │   ├── transport/
│   │   │   ├── StudentAssignmentModal.tsx    # New: with stop selection validation
│   │   │   ├── ReassignStudentModal.tsx      # New: route reassignment UI
│   │   │   └── MissingChargeAlert.tsx        # New: dashboard alert component
│   │   └── students/
│   │       └── TransportHistorySection.tsx   # New: student profile history
│   └── pages/
│       ├── TransportRoutes.tsx             # Modify: add missing charge badges
│       └── StudentProfile.tsx              # Modify: add transport history tab
└── tests/
    └── integration/
        └── transport.spec.ts               # New: component integration tests
```

**Structure Decision**: Web application (backend + frontend). Backend uses CodeIgniter 4 MVC pattern with thin controllers and service layer for business logic. Frontend uses React with custom hooks for data fetching and business logic separation.

## Phase 1 Completion Summary

### Generated Artifacts

| Artifact | File | Status |
|----------|------|--------|
| Research Document | `research.md` | Complete - Reassignment billing decision documented |
| Data Model | `data-model.md` | Complete - Schema changes, indexes, validation rules |
| API Contracts | `contracts/transport-assignments.md` | Complete - Assignment, reassignment, missing charges |
| API Contracts | `contracts/student-transport-history.md` | Complete - History endpoint |
| Quickstart Guide | `quickstart.md` | Complete - Development setup and testing |
| Agent Context | `.windsurf/rules/specify-rules.md` | Updated - Technology stack added |

### Post-Design Constitution Re-check

| Principle | Status | Implementation Notes |
|-----------|--------|---------------------|
| I. Multi-Tenant Isolation | PASS | All queries in services use `tenant_id` from JWT; unique index includes tenant_id |
| II. API-First | PASS | Controllers thin, all business logic in Services; frontend uses hooks |
| III. JWT Authentication | PASS | New endpoints use `requireRole()`; routes protected by JWTAuthFilter |
| IV. Immutable Migrations | PASS | Single new migration file created; no existing migrations modified |
| V. Ledger Integrity | PASS | Missing charges computed view; no balance caching introduced |
| VI. REST Standards | PASS | Controllers use `respondSuccess/Error` helpers; consistent envelopes |
| VII. Code Quality | PASS | Services extracted; controllers <50 lines each; DRY validation |
| VIII. Security | PASS | Input sanitized via CI4 validation; parameterized queries only |
| IX. Error Handling | PASS | Explicit try/catch in services; no stack traces to API consumers |
| X. Integration Testing | PASS | 3 test files specified covering happy path, errors, tenant isolation |
| XI. Performance | PASS | Database indexes added; no N+1 patterns; query optimization documented |

**Phase 1 Result**: PASS - All artifacts generated, all constitution principles satisfied.

### Next Step

Run `/speckit.tasks` to generate the actionable task list for implementation.

## Complexity Tracking

No constitution violations required. All patterns align with existing project conventions.
