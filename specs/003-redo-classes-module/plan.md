# Implementation Plan: Classes Module Redesign

**Branch**: `003-redo-classes-module` | **Date**: 2026-04-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-redo-classes-module/spec.md`

## Summary

Redesign the Classes module to add a formal grade-level hierarchy above individual classes, stream labels, enforced capacity limits, role-scoped visibility, and circular-chain prevention. The existing flat class list, enrollment history, and promotion logic are retained and extended — no historical data is lost. New schema objects (a `grade_levels` table and two new columns on `classes`) are introduced via new migration files; all existing API routes are backward-extended and new grade-level routes are added.

## Technical Context

**Language/Version**: PHP 8.1+ (backend) · TypeScript + React 18 (frontend)
**Primary Dependencies**: CodeIgniter 4 (backend) · TanStack React Query, React Hook Form + Zod, shadcn/ui (frontend)
**Storage**: MySQL — new `grade_levels` table; `grade_level_id` + `stream` columns added to `classes` table
**Testing**: Manual integration via `php spark db:seed` + browser; no automated test framework in repo
**Target Platform**: Web — Vite SPA (frontend) + CodeIgniter 4 REST API (backend)
**Project Type**: Multi-tenant web application (monorepo: frontend/ + backend/)
**Performance Goals**: Class list page loads under 2 s for up to 50 classes; promotion of 500 students completes under 30 s
**Constraints**: All queries must include `tenant_id` filter (Constitution I); capacity enforcement must be server-side (Constitution III); schema changes via new migrations only (Constitution IV)
**Scale/Scope**: Up to ~50 classes, ~500 students per tenant; 4 role types (super_admin, admin, teacher, bursar)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Multi-Tenant Data Isolation | ✅ PASS | All new `grade_levels` queries will filter by `tenant_id` sourced from JWT; classes queries already compliant and will remain so |
| II. API-First Separation | ✅ PASS | New grade-level management exposed only through REST endpoints; no business logic in frontend |
| III. JWT Auth & Role-Based Access | ✅ PASS | All new `/api/grade-levels/*` routes placed inside the JWT-filtered route group; teacher/bursar visibility restrictions enforced in controllers using `requireRole()`/`userHasRole()` |
| IV. Immutable Migrations | ✅ PASS | New columns and `grade_levels` table added via new migration files; existing migrations untouched |
| V. Financial Ledger Integrity | ✅ PASS | No ledger queries modified; the `getAllBalances()` subquery pattern is unaffected |

## Project Structure

### Documentation (this feature)

```text
specs/003-redo-classes-module/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── grade-levels.md
│   └── classes.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── Controllers/Api/
│   │   ├── ClassController.php        # Extended: grade_level_id, stream, capacity enforcement, role scoping
│   │   └── GradeLevelController.php   # New: CRUD for grade levels
│   ├── Models/
│   │   ├── ClassModel.php             # Extended: grade_level_id, stream fields; circular-chain check
│   │   └── GradeLevelModel.php        # New: grade level management
│   ├── Database/Migrations/
│   │   ├── 2026-04-03-120000_Create_grade_levels_table.php    # New table
│   │   └── 2026-04-03-130000_Add_grade_fields_to_classes.php  # grade_level_id + stream columns
│   └── Config/
│       └── Routes.php                 # New grade-level routes added
└── ...

frontend/
├── src/
│   ├── pages/
│   │   └── Classes.tsx                # Refactored: grouped-by-grade display, capacity UI
│   ├── components/
│   │   └── modals/
│   │       ├── AddClassModal.tsx       # Extended: grade level + stream fields, capacity enforcement
│   │       ├── EditClassModal.tsx      # Extended: grade level + stream fields
│   │       ├── AddGradeLevelModal.tsx  # New: create/edit grade levels
│   │       └── AssignStudentsModal.tsx # Extended: capacity warning + override
│   ├── api/
│   │   └── api.ts                     # Extended: grade level API calls; updated class payloads
│   └── hooks/
│       └── useGradeLevels.ts          # New: grade level query hook
└── ...
```

**Structure Decision**: Option 2 (web application, existing monorepo). Backend controllers and models follow the established pattern of one controller + one model per resource. Frontend follows the existing pages/ + modals/ + hooks/ pattern.

## Complexity Tracking

No Constitution violations. No exceptional complexity required for this feature.
