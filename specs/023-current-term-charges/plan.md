# Implementation Plan: Current Term Charge Generation with Academic Calendar Validation

**Branch**: `023-current-term-charges` | **Date**: 2026-04-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/023-current-term-charges/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Implement validation logic to restrict charge generation to the current academic term only, based on date range checks against the configured academic calendar. The system will automatically determine the current term, validate calendar completeness, enforce term sequence constraints, detect new academic year transitions, and block charge generation with clear error messages when constraints are violated.

## Technical Context

**Language/Version**: PHP 8.1+, React 18 + TypeScript
**Primary Dependencies**: CodeIgniter 4, MySQL, TanStack React Query, React Hook Form + Zod
**Storage**: MySQL (existing `tenants.academic_calendar` JSON column, `charges` table)
**Testing**: Jest (frontend), PHPUnit (backend)
**Target Platform**: Web application (SPA + REST API)
**Project Type**: Web application with frontend/backend separation
**Performance Goals**: Charge generation validation <100ms, calendar validation <50ms
**Constraints**: Must maintain multi-tenant isolation, JWT-based auth, immutable migrations
**Scale/Scope**: Single tenant, 3-term academic year system

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Multi-Tenant Data Isolation** | ✅ PASS | All queries will filter by `tenant_id` from JWT. Calendar reads and charge generation will use `tenant_id` from `BaseApiController::getTenantId()`. |
| **II. API-First Separation of Concerns** | ✅ PASS | Validation logic resides in backend API (`LedgerController`, `SettingsController`). Frontend displays error messages returned from API. |
| **III. JWT Authentication & Role-Based Access** | ✅ PASS | New validation endpoints protected by `JWTAuthFilter`. Role checks for `admin`/`bursar` enforced in controllers. |
| **IV. Immutable Migrations** | ✅ PASS | No schema changes required - existing `academic_calendar` JSON column and `charges` table sufficient. |
| **V. Financial Ledger Integrity** | ✅ PASS | No balance caching changes. Feature only adds validation gates before charge creation; existing ledger computation patterns preserved. |

**All gates pass** - proceeding with planning.

## Project Structure

### Documentation (this feature)

```text
specs/023-current-term-charges/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (minimal - no significant unknowns)
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API contracts)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── Controllers/Api/
│   │   ├── LedgerController.php      # MODIFY - Add validation before generateTermCharges()
│   │   └── SettingsController.php    # MODIFY - Add term sequence validation in saveCalendar()
│   ├── Services/
│   │   └── AcademicCalendarService.php  # CREATE - Validation and current term detection logic
│   └── Models/
│       └── (existing - no changes)
└── tests/
    └── (existing patterns)

frontend/
├── src/
│   ├── api/
│   │   └── ledger.ts                 # MODIFY - Handle validation error responses
│   ├── hooks/
│   │   └── useChargeGeneration.ts    # MODIFY - Add error handling for blocked attempts
│   └── components/
│       └── ledger/
│           └── ChargeGenerationDialog.tsx  # MODIFY - Display validation errors/prompts
└── tests/
    └── (existing patterns)
```

**Structure Decision**: Using existing backend/frontend split as defined in constitution. Feature requires modifications to existing controllers and addition of a service class for validation logic.

## Complexity Tracking

> **No violations** - All constitution principles satisfied with standard patterns.

## Phase Completion

### Phase 0: Research ✅ COMPLETE
- **research.md**: Created - No significant unknowns identified
- Key finding: Existing infrastructure sufficient; no external dependencies needed
- Design decision: Service class pattern for validation logic

### Phase 1: Design ✅ COMPLETE
- **data-model.md**: Created - Documented existing entities and validation logic
- **contracts/api-contracts.md**: Created - Defined error responses and new endpoint
- **quickstart.md**: Created - Testing scenarios and verification checklist
- Agent context updated via `update-agent-context.sh`

### Phase 2: Task Generation ✅ COMPLETE
- **tasks.md**: Created - 38 tasks organized by user story
- Task breakdown: 8 foundational, 9 US1, 6 US2, 6 US3, 3 term sequence, 6 polish
- All tasks follow checklist format with IDs, story labels, and file paths
- Parallel execution opportunities identified

---

## Next Steps

1. **Implement**: Follow tasks in `tasks.md`
   - Start with Phase 1: Foundational (AcademicCalendarService)
   - Then implement User Story 1 (MVP) → test → deploy
   - Add User Stories 2 and 3 incrementally
2. **Verify**: Use `quickstart.md` testing scenarios for each story
3. **Deploy**: Each user story is independently deployable

## Key Implementation Files

| File | Action | Purpose |
|------|--------|---------|
| `AcademicCalendarService.php` | **CREATE** | Current term detection, validation logic |
| `LedgerController.php` | **MODIFY** | Add validation gates before charge generation |
| `SettingsController.php` | **MODIFY** | Add term sequence validation |
| `ChargeGenerationDialog.tsx` | **MODIFY** | Display validation errors |
| `useChargeGeneration.ts` | **MODIFY** | Handle new error types |
| `ledger.ts` | **MODIFY** | Add error code types |
