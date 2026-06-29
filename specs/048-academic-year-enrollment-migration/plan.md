# Implementation Plan: Academic Year Class Migration via Enrollment History

**Branch**: `048-academic-year-enrollment-migration` | **Date**: 2026-04-27 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/048-academic-year-enrollment-migration/spec.md`

---

## Summary

Introduce a structured year-end academic migration system where **class templates** (`classes` table — unchanged) generate **class instances** (`class_instances` — new table) per academic year, and student **enrollments** are the immutable source of academic history. At year-end, a migration engine closes ACTIVE enrollments with terminal statuses (PROMOTED / REPEATED / GRADUATED) and creates new ACTIVE enrollments for the next year — without modifying existing records in place.

The existing `POST /api/students/promote` endpoint is preserved for mid-year individual promotions. The new `ClassMigrationController` handles the structured year-end bulk flow. Four new DB migrations are introduced (three new tables + one FK column), all immutable and additive.

---

## Technical Context

**Language/Version**: PHP 8.1 (backend) · TypeScript / React 18 (frontend)  
**Primary Dependencies**: CodeIgniter 4 · MySQL · Vite · TailwindCSS · shadcn/ui · TanStack React Query  
**Storage**: MySQL — 2 new tables (`class_instances`, `class_progression_mappings`); 1 new column on `enrollments` (`class_instance_id`); 1 one-time data backfill migration  
**Testing**: CodeIgniter 4 `CIUnitTestCase` + `FeatureTestTrait` (integration tests in `backend/tests/`)  
**Target Platform**: Linux web server (backend) · Browser SPA (frontend)  
**Project Type**: Multi-tenant web application (API + React SPA)  
**Performance Goals**: Year-end migration for 500 students completes in under 30 seconds; dry-run matches actual outcome 100%; enrollment history endpoint responds in under 500ms for 15 years of history.  
**Constraints**: All queries must carry `tenant_id` from JWT. No existing enrollment, class, or student rows may be deleted or have their primary data fields mutated during migration. `confirm: true` guard required on run endpoint. Existing `POST /api/students/promote` continues to work unchanged.  
**Scale/Scope**: 4 new backend migrations; 2 new backend models; 1 new service class; 1 new controller with 8 endpoints; 3 new frontend components; 1 new frontend hook; 4 integration test classes.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Multi-Tenant Data Isolation | ✅ PASS | Every new table carries `tenant_id`. Migration engine scopes all queries to `$this->getTenantId()` from JWT. The backfill migration joins via existing `tenant_id` on `enrollments`. UNIQUE constraint on `(tenant_id, class_id, academic_year)` prevents cross-tenant collisions at DB level. |
| II. API-First Separation of Concerns | ✅ PASS | All migration logic in `ClassMigrationService` (service layer). `ClassMigrationController` is thin HTTP adapter. `ClassInstanceModel` and `ClassProgressionMappingModel` are dedicated models. No business logic in frontend. |
| III. JWT Authentication & Role-Based Access | ✅ PASS | All new endpoints require `JWTAuthFilter`. Migration run/preview and instance generation require `admin` or `super_admin` role. Teacher read-access to class instance student lists is scoped to their own assigned instances. |
| IV. Immutable Migrations | ✅ PASS | Four new migrations are net-additive: two new tables, one new nullable column, one data backfill. No existing migration files are modified. Backfill uses `INSERT IGNORE` (idempotent). Each migration has a proper `down()` method. |
| V. Financial Ledger Integrity | ✅ PASS | No changes to `charges`, `payments`, or balance calculation. Migration operates on `enrollments` and `students` only. Charge generation modules read `students.class_id` which is updated post-migration — no regression. |
| VI. REST API Standards | ✅ PASS | All new endpoints follow existing `respondSuccess`/`respondError` envelope. Correct HTTP verbs (GET list, POST create/action, DELETE). `confirm: true` guard on destructive run. 409 for idempotency violations. |
| VII. Code Quality & Maintainability | ✅ PASS | Migration logic extracted to `ClassMigrationService` — not in controller. Each new model has `formatForApi()` and `formatFromApi()`. Cycle detection reused from existing `ClassController::setNextClass` pattern. No duplication of promotion logic. |
| VIII. Defensive Security | ✅ PASS | Academic year format validated (regex `^\d{4}\/\d{4}$`, years consecutive). `confirm: true` required for destructive run. `next_class_id` cross-tenant FK validation enforced. Archived templates cannot generate instances (guard in service). |
| IX. Error Handling & Observability | ✅ PASS | Migration run wraps entire operation in one tenant-scoped DB transaction. Any exception triggers full rollback with descriptive 500 response. Skipped students returned in response with per-student reasons. Dry-run is non-destructive and always safe to call. |
| X. Integration Testing | ✅ PASS | Integration tests required for: happy path (promote/repeat/graduate mix), idempotency (double-run), dry-run accuracy, skipped unconfigured classes, tenant isolation (migration must not touch other tenants), transaction rollback on failure, progression mapping override, backfill migration verification. |
| XI. Performance Discipline | ✅ PASS | Migration iterates enrollments in a single query (no N+1 per student). Class instance auto-creation uses batch INSERT IGNORE. `class_instances` has a composite index on `(tenant_id, academic_year)` for fast year-scoped lookups. Enrollment history join uses indexed `class_instance_id`. |

**Post-Phase 1 re-check**: Data model additive-only; API contracts follow existing patterns; service layer extraction eliminates controller bloat. No new constitution violations. No Complexity Tracking entries required.

---

## Project Structure

### Documentation (this feature)

```text
specs/048-academic-year-enrollment-migration/
├── plan.md                  # This file
├── research.md              # Phase 0 — all unknowns resolved
├── data-model.md            # Phase 1 — schema changes
├── quickstart.md            # Phase 1 — dev setup
├── contracts/
│   └── api-contracts.md     # Phase 1 — full endpoint contracts
├── checklists/
│   └── requirements.md      # Spec quality checklist (all pass)
└── tasks.md                 # Phase 2 output (via /speckit.tasks)
```

### Source Code (affected paths)

```text
backend/
├── app/
│   ├── Controllers/
│   │   └── Api/
│   │       └── ClassMigrationController.php     # NEW — preview, run, instance CRUD, mapping CRUD
│   ├── Models/
│   │   ├── ClassInstanceModel.php               # NEW — CRUD + formatForApi/formatFromApi
│   │   ├── ClassProgressionMappingModel.php     # NEW — CRUD + formatForApi/formatFromApi
│   │   └── EnrollmentModel.php                  # MODIFIED — add class_instance_id to allowedFields;
│   │                                            #   update getStudentHistory() join; add getActiveByInstanceId()
│   ├── Services/
│   │   └── ClassMigrationService.php            # NEW — previewMigration(), runMigration(), generateInstances(),
│   │                                            #   resolveNextClass(), buildMigrationPlan()
│   ├── Config/
│   │   └── Routes.php                           # MODIFIED — add 8 new routes under class-instances/
│   │                                            #   and class-migration/ and class-progression-mappings/
│   └── Database/
│       └── Migrations/
│           ├── 2026-04-27-090000_Create_class_instances_table.php
│           ├── 2026-04-27-100000_Add_class_instance_id_to_enrollments.php
│           ├── 2026-04-27-100001_Create_class_progression_mappings_table.php
│           └── 2026-04-27-100002_Backfill_class_instances_from_enrollments.php
└── tests/
    └── Controllers/
        └── ClassMigration/
            ├── ClassMigrationPreviewTest.php    # dry-run accuracy, year validation, no-data guard
            ├── ClassMigrationRunTest.php        # happy path, idempotency, rollback, tenant isolation
            ├── ClassInstanceTest.php            # generate idempotency, archived template guard, overrides
            └── ClassProgressionMappingTest.php  # CRUD, duplicate guard, migration resolution order

frontend/
└── src/
    ├── components/
    │   └── classes/
    │       ├── YearEndMigrationPanel.tsx        # NEW — trigger panel with preview + confirm flow
    │       └── MigrationPreviewTable.tsx        # NEW — table of per-class outcomes before confirming
    ├── hooks/
    │   └── useClassMigration.ts                 # NEW — preview(), run(), generateInstances()
    └── pages/
        └── Classes.tsx                          # MODIFIED — add YearEndMigrationPanel trigger
```

**Structure Decision**: Web application layout. Backend introduces one new service class to isolate migration logic from controllers, following the same separation pattern established by `LedgerController` → billing service. Frontend changes are confined to the `Classes` page and one new hook + two new components. No new pages or routes needed.

---

## Complexity Tracking

> No constitution violations to justify. All new complexity is encapsulated in `ClassMigrationService` and covered by integration tests.

---

## Key Design Decisions (summary from research.md)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| `classes` table rename | **No rename** — use as-is as template layer | Blast radius too large; table already fits template role |
| Class instances | **New `class_instances` table** | Required intersection entity; additive |
| Enrollment FK | **Additive `class_instance_id` column** | Backward-compat; legacy rows keep `class_id` |
| Academic year type | **Retain VARCHAR string** ("2025/2026") | No `academic_years` table exists; out of scope |
| Repeating students | **`students.status = 'repeating'`** signal | Already used in existing promotion logic |
| Migration engine | **New `ClassMigrationService`** | Keep controllers thin; independently testable |
| Progression mapping | **New `class_progression_mappings` table** (P3) | Optional override; additive |
| Idempotency | **DB UNIQUE constraint + run guard** | Strongest guarantee; checked at DB and service layers |

---

## Phase Delivery Order

### Phase A — Database Layer (P0)
1. Migration: `Create_class_instances_table`
2. Migration: `Add_class_instance_id_to_enrollments`
3. Migration: `Create_class_progression_mappings_table`
4. Migration: `Backfill_class_instances_from_enrollments`

### Phase B — Backend Models & Service (P1)
5. `ClassInstanceModel` (CRUD, formatForApi, getByTenantAndYear, getActiveByInstanceId)
6. `ClassProgressionMappingModel` (CRUD, formatForApi, resolveForSource)
7. `EnrollmentModel` updates (`class_instance_id` in allowedFields, history join update, new query method)
8. `ClassMigrationService` (buildMigrationPlan, previewMigration, runMigration, generateInstances, resolveNextClass, cycle-safe progression lookup)

### Phase C — API Layer (P1)
9. `ClassMigrationController` (8 endpoints per contracts)
10. `Routes.php` updates

### Phase D — Integration Tests (P1)
11. `ClassMigrationPreviewTest`, `ClassMigrationRunTest`, `ClassInstanceTest`, `ClassProgressionMappingTest`

### Phase E — Frontend (P2)
12. `useClassMigration` hook
13. `MigrationPreviewTable` component
14. `YearEndMigrationPanel` component
15. `Classes.tsx` integration

### Phase F — Progression Mappings UI (P3 — deferred)
16. Mapping CRUD UI in settings or classes page
