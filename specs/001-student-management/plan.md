# Implementation Plan: Student Management (Standard SMS Redesign)

**Branch**: `001-student-management` | **Date**: 2026-04-03 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/001-student-management/spec.md`

## Summary

Redesign the student management module to meet standard school management system (SMS)
requirements. The existing implementation is functionally solid but is missing critical fields
(admission number, gender, second guardian, photo, national ID), has no status change audit
trail, and allows hard-deletion of students with financial records. This plan adds those
missing pieces via two new migrations and targeted changes to the backend controller/model and
frontend pages, without breaking any existing billing, attendance, or transport integrations.

## Technical Context

**Language/Version**: PHP 8.1 (backend) · TypeScript / React 18 (frontend)
**Primary Dependencies**: CodeIgniter 4 (backend) · Vite + TanStack React Query + shadcn/ui (frontend)
**Storage**: MySQL — `students` table (extended) + new `student_status_history` table
**Testing**: Manual validation via `quickstart.md`; no automated test suite in scope
**Target Platform**: Web application (Linux server backend + browser SPA)
**Project Type**: Full-stack web application (monorepo: `backend/` + `frontend/`)
**Performance Goals**: Directory load ≤ 2 s for 2,000 students; search results ≤ 1 s
**Constraints**: Zero breaking changes to existing billing, attendance, and transport APIs;
  all queries MUST preserve tenant_id scoping; balance calculation pattern MUST NOT change
**Scale/Scope**: Up to 2,000 students per school tenant; multi-tenant SaaS

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Multi-Tenant Data Isolation** | ✅ PASS | All new queries include `tenant_id`. New `student_status_history` table includes `tenant_id` column. Admission number uniqueness enforced per `(tenant_id, admission_number)` index. |
| **II. API-First Separation** | ✅ PASS | All frontend changes go through `src/api/api.ts`. No direct DB access from frontend. |
| **III. JWT Auth & RBAC** | ✅ PASS | Edit (`PUT /api/students/:id`) restricted to `admin` role at controller level. Status change requires auth. Bulk status update requires `admin`. |
| **IV. Immutable Migrations** | ✅ PASS | Two new migration files created. No existing migration files modified. |
| **V. Financial Ledger Integrity** | ✅ PASS | `getAllBalances()` subquery pattern preserved exactly. Balance calculation code is unchanged. Hard-delete now blocked for students with financial records. |

**Gate result: ALL PRINCIPLES PASS. Proceed.**

## Project Structure

### Documentation (this feature)

```text
specs/001-student-management/
├── plan.md                    # This file
├── research.md                # Phase 0 — gap analysis and decisions
├── data-model.md              # Phase 1 — schema, entity shapes, validation rules
├── quickstart.md              # Phase 1 — manual validation walkthrough
├── contracts/
│   └── students-api.md        # Phase 1 — full REST API contract
└── tasks.md                   # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code

```text
backend/
├── app/
│   ├── Controllers/Api/
│   │   └── StudentController.php         # modify: RBAC on update, hard-delete guard,
│   │                                     #   admission number generation, status history,
│   │                                     #   bulk-status endpoint
│   ├── Models/
│   │   └── StudentModel.php              # modify: allowedFields, formatForApi,
│   │                                     #   formatFromApi, search(), delete() guard
│   └── Database/Migrations/
│       ├── 2026-04-03-100000_Add_student_standard_fields.php   # NEW
│       └── 2026-04-03-110000_Add_student_status_history.php    # NEW

frontend/
└── src/
    ├── api/
    │   └── api.ts                        # modify: student API calls, new fields,
    │                                     #   bulk-status + status-history endpoints
    ├── types/
    │   └── dashboard.ts                  # modify: Student, Guardian, StudentFormData types
    ├── pages/
    │   ├── Students.tsx                  # modify: show admissionNumber, bulk status action
    │   └── StudentProfile.tsx            # modify: show new fields, Status History tab
    └── components/modals/
        ├── StudentFormModal.tsx           # modify: add new form fields (consolidated)
        ├── AddStudentModal.tsx            # REMOVE: consolidate into StudentFormModal
        └── StatusChangeModal.tsx         # modify: require effectiveDate + reason
```

**Structure Decision**: Web application (Option 2). Backend in `backend/`, frontend in
`frontend/`. No new top-level directories required.

## Complexity Tracking

> No constitution violations — table not required.
