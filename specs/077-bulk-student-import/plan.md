# Implementation Plan: Bulk Student Import

**Branch**: `077-bulk-student-import` | **Date**: 2026-05-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/077-bulk-student-import/spec.md`

## Summary

Add a "Bulk Import Students" feature allowing admins to download a CSV template, fill in student records offline, upload the completed file, validate all rows server-side with per-row error reporting, and import up to 5 000 students in a single operation using batched inserts. No schema changes are needed — students are inserted into the existing `students` table. The feature adds two backend endpoints (`/api/students/import/validate` and `/api/students/import/execute`) and a new frontend page (`/students/import`) accessible from the Students section.

## Technical Context

**Language/Version**: PHP 8.1 (backend) · TypeScript 5 / React 18 (frontend)  
**Primary Dependencies**: CodeIgniter 4 · MySQL (backend); TanStack React Query · React Hook Form · shadcn/ui · TailwindCSS (frontend)  
**Storage**: MySQL — existing `students` table; no new tables  
**Testing**: curl endpoint tests (Constitution Principle X)  
**Target Platform**: Linux server (backend); desktop browser / Vite SPA (frontend)  
**Project Type**: Web service (REST API) + React SPA  
**Performance Goals**: Validate + import 2 000 rows in under 60 seconds; single-row import in under 2 seconds  
**Constraints**: File upload max 10 MB; batch insert size 250 rows per batch; no background queues  
**Scale/Scope**: Up to 5 000 rows per import file; admin + super_admin roles only

## Constitution Check

*Pre-design gate — all 11 principles evaluated.*

| # | Principle | Status | Notes |
|---|---|---|---|
| I | Multi-Tenant Data Isolation | PASS | `tenant_id` sourced from JWT only; all student inserts include JWT-derived tenant_id; duplicate detection query scoped to tenant |
| II | API-First Separation | PASS | All CSV processing on backend; frontend only uploads file and renders response |
| III | JWT Auth & RBAC | PASS | All three new routes require JWTAuthFilter; role guard: admin/super_admin only; 403 for bursar/teacher |
| IV | Immutable Migrations | PASS | No migration needed; existing students table used as-is |
| V | Financial Ledger Integrity | PASS | Feature does not touch ledger; no balance columns affected |
| VI | REST Standards & Consistent Responses | PASS | Routes use kebab-case sub-paths; all responses via `respondSuccess`/`respondError` helpers |
| VII | Code Quality | PASS | New `StudentImportController` (thin) + `StudentImportService` (all logic); DRY reuse of `StudentModel::formatFromApi` and `generateId` |
| VIII | Defensive Security | PASS | File type validated (MIME + extension); file size capped; all row fields sanitized; no secrets introduced |
| IX | Error Handling | PASS | Per-row errors returned in structured JSON; internal errors logged; no stack traces exposed |
| X | API Endpoint Testing | PASS | 10 curl tests defined in quickstart.md; run after implementation |
| XI | Performance Discipline | PASS | `insertBatch(250)` bulk inserts; single bulk SELECT for duplicate detection (no N+1); streaming `fgetcsv()` parse |

*Post-design re-check*: All 11 principles PASS. No violations.

## Project Structure

### Documentation (this feature)

```text
specs/077-bulk-student-import/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   └── bulk-import-api.md   ← Phase 1 output
└── tasks.md             ← Phase 2 output (/speckit.tasks — not yet created)
```

### Source Code

```text
backend/
├── app/
│   ├── Config/
│   │   └── Routes.php                  (modified — add 3 import routes before wildcard)
│   ├── Controllers/
│   │   └── Api/
│   │       └── StudentImportController.php    (NEW)
│   └── Services/
│       └── StudentImportService.php           (NEW)

frontend/
├── src/
│   ├── api/
│   │   └── api.ts                      (modified — add validateImport, executeImport, downloadTemplate)
│   ├── types/
│   │   └── dashboard.ts                (modified — add ImportValidationResult, ImportExecuteResult)
│   ├── hooks/
│   │   └── useStudentImport.ts         (NEW)
│   ├── pages/
│   │   └── StudentBulkImportPage.tsx   (NEW)
│   └── App.tsx                         (modified — add /students/import route)
```

**Structure Decision**: Web application (Option 2). Thin controller delegates to service. No model extension needed — `StudentModel::insertBatch()` and `generateId()` used directly from the service via the existing model instance.

## Complexity Tracking

*No constitution violations — table not required.*
