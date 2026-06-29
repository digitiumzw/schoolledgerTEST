# Implementation Plan: Promote Student – Session-Scoped Preview & Filtering

**Branch**: `053-promote-student-session-filter` | **Date**: 2026-04-29 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/053-promote-student-session-filter/spec.md`

## Summary

The bulk Promote Students flow currently fetches all active students regardless of which academic session their enrollment belongs to. This plan scopes the eligibility query to the current academic session (`enrollments.academic_session = currentSession`) in `ClassModel::getStudentsForPromotion`, threads the session value through all four callers, and adds a session scope banner to `MigrationPreviewModal`. No schema changes are needed. Total surface area: one model method, three backend controller methods, one React component, one new test class.

## Technical Context

**Language/Version**: PHP 8.1 (backend) · TypeScript / React 18 (frontend)  
**Primary Dependencies**: CodeIgniter 4 · MySQL · Vite · shadcn/ui · TailwindCSS  
**Storage**: MySQL — `enrollments` table (`academic_session` column already exists)  
**Testing**: CodeIgniter 4 test runner (`php spark test`) · PHPUnit  
**Target Platform**: Linux server (backend API) · Browser SPA (frontend)  
**Project Type**: Web service (REST API) + React SPA  
**Performance Goals**: Preview endpoint ≤ 200 ms additional latency vs. baseline (one extra indexed WHERE clause)  
**Constraints**: No schema migrations; no new dependencies; changes must be backward-compatible  
**Scale/Scope**: Single-method backend change covers all promotion paths; one UI component updated

## Constitution Check

*Pre-design gate — all items pass:*

| # | Principle | Status | Notes |
|---|---|---|---|
| I | Multi-tenant isolation | ✅ PASS | All queries retain `tenant_id` filter; session param sourced server-side |
| II | API-first separation | ✅ PASS | Session filter is backend-only; frontend only adds a display banner |
| III | JWT auth | ✅ PASS | No route changes; `JWTAuthFilter` already covers all affected routes |
| IV | Immutable migrations | ✅ PASS | No DDL changes needed |
| V | Financial ledger integrity | ✅ PASS | Ledger not touched |
| VI | REST standards | ✅ PASS | No new routes; response envelope unchanged |
| VII | DRY / maintainability | ✅ PASS | One model method change; optional param avoids duplication across callers |
| VIII | Defensive security | ✅ PASS | Session value resolved from `AcademicSessionService`, never from raw request params |
| IX | Error handling | ✅ PASS | No new error paths; existing handlers cover all cases |
| X | Integration tests | ✅ PASS | `PromotionSessionFilterTest` planned (mixed session + empty session) |
| XI | Performance | ✅ PASS | Single extra indexed WHERE clause; no N+1 introduced |

*Post-design re-check: all items still pass. No complexity violations.*

## Project Structure

### Documentation (this feature)

```text
specs/053-promote-student-session-filter/
├── plan.md              ← this file
├── research.md          ← Phase 0 decisions
├── data-model.md        ← entity analysis and query change
├── quickstart.md        ← dev guide and test instructions
├── contracts/
│   └── api.md           ← endpoint contract changes
├── checklists/
│   └── requirements.md  ← spec quality checklist
└── tasks.md             ← Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── Models/
│   │   └── ClassModel.php               ← add ?string $academicSession param
│   └── Controllers/Api/
│       ├── StudentController.php         ← thread session into getStudentsForPromotion calls
│       └── ClassController.php          ← thread session into getStudentsForPromotion call
└── tests/
    └── PromotionSessionFilterTest.php    ← new integration test

frontend/
└── src/
    └── components/
        └── modals/
            └── MigrationPreviewModal.tsx ← add session scope Alert banner
```

**Structure Decision**: Option 2 (Web application). Backend and frontend live in separate top-level directories. No new files except the test class; all other changes are edits to existing files.

## Complexity Tracking

> No constitution violations. Table left intentionally empty.
