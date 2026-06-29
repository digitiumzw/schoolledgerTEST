# Implementation Plan: Fix Class Promotion Logic to Use next_class_id

**Branch**: `005-fix-class-promotion` | **Date**: 2026-04-06 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `specs/005-fix-class-promotion/spec.md`

## Summary

The promotion pipeline (`POST /api/students/promote`) cannot differentiate between a class that is intentionally a graduation/final class and a class whose `next_class_id` has simply not been configured yet. Both states produce `next_class_id = NULL`, causing the system to graduate students from any unconfigured class instead of skipping them. The fix introduces a dedicated `is_final_class` boolean on the `classes` table (new migration), updates `ClassModel::isFinalClass()` to read the flag, and propagates the change through the controller, seeder, and frontend edit form.

## Technical Context

**Language/Version**: PHP 8.1+ (backend) · TypeScript + React 18 (frontend)  
**Primary Dependencies**: CodeIgniter 4 (backend) · TanStack React Query, React Hook Form + Zod, shadcn/ui (frontend)  
**Storage**: MySQL — `classes` table (schema change via new migration)  
**Testing**: Manual via `php spark db:seed CompleteDatabaseSeeder` + API calls  
**Target Platform**: Linux server (backend API) · Browser SPA (frontend)  
**Project Type**: Web service (REST API) + Web application (React SPA)  
**Performance Goals**: No new queries introduced; existing single-fetch patterns preserved  
**Constraints**: Multi-tenant isolation (Principle I) must be maintained in all new/changed queries; no edits to existing migration files (Principle IV)  
**Scale/Scope**: Single boolean column addition; touches ~5 files across backend + frontend

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Multi-Tenant Data Isolation | ✅ PASS | New `is_final_class` column is per-class record; all class queries already filter by `tenant_id`. No cross-tenant risk introduced. |
| II. API-First Separation | ✅ PASS | All changes flow through the REST API; no direct DB access from frontend. |
| III. JWT Auth & RBAC | ✅ PASS | No new routes; existing routes remain behind `JWTAuthFilter`. Role enforcement unchanged. |
| IV. Immutable Migrations | ✅ PASS | Schema change will be a **new** migration file. Existing migration `2025-12-28-102246_CreateDBSchemas.php` will NOT be edited. |
| V. Financial Ledger Integrity | ✅ PASS | Promotion logic does not touch the ledger; balance computation is unaffected. |

No violations. No Complexity Tracking entries needed.

## Project Structure

### Documentation (this feature)

```text
specs/005-fix-class-promotion/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── Database/
│   │   ├── Migrations/
│   │   │   └── 2026-04-06-100000_Add_is_final_class_to_classes.php   ← NEW
│   │   └── Seeds/
│   │       └── CompleteDatabaseSeeder.php                            ← UPDATE
│   ├── Models/
│   │   └── ClassModel.php                                            ← UPDATE
│   └── Controllers/Api/
│       ├── ClassController.php                                       ← UPDATE
│       └── StudentController.php                                     ← UPDATE (promoteStudentsFromClass, promoteStudent)

frontend/
├── src/
│   ├── api/
│   │   └── api.ts                                                    ← UPDATE (updateClass payload)
│   └── components/modals/
│       └── EditClassModal.tsx                                        ← UPDATE (isFinalClass checkbox)
```
