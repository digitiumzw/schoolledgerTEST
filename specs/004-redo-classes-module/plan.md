# Implementation Plan: Redo Classes Module

**Branch**: `004-redo-classes-module` | **Date**: 2026-04-06 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/004-redo-classes-module/spec.md`

## Summary

Targeted rewrite of the classes module to fix identified bugs and enforce consistent patterns.
The overall architecture (controllers, models, REST routes) is sound and will be preserved. Work
focuses on: fixing the ArchiveClassModal direct `fetch()` call (Constitution II violation), adding
Zod + RHF form validation to class modals, enforcing class name uniqueness validation server-side,
replacing hardcoded `'ACTIVE'` strings with `EnrollmentModel::STATUS_ACTIVE`, and removing debug
logging from production code.

## Technical Context

**Language/Version**: PHP 8.1+ (backend) · TypeScript + React 18 (frontend)  
**Primary Dependencies**: CodeIgniter 4 (backend) · TanStack React Query · React Hook Form + Zod · shadcn/ui (frontend)  
**Storage**: MySQL — existing schema; no new migrations required  
**Testing**: Manual integration testing via dev server; seeded via `CompleteDatabaseSeeder`  
**Target Platform**: Linux server (backend) · Web browser SPA (frontend)  
**Project Type**: Full-stack web-service (REST API + React SPA)  
**Performance Goals**: Class list with 200 classes loads in < 2s; roster for 100-student class loads in < 2s  
**Constraints**: All queries must include tenant_id from JWT; no direct DB access from frontend  
**Scale/Scope**: Up to 200 classes per tenant; up to 100 students per class

## Constitution Check

| Principle | Pre-Design | Post-Design | Notes |
|-----------|-----------|-------------|-------|
| I. Multi-Tenant Isolation | PASS | PASS | All controller queries filter by JWT tenant_id |
| II. API-First Separation | **FAIL** | PASS (after fix) | ArchiveClassModal hard-codes fetch URL; must use api.ts |
| III. JWT Auth & RBAC | PASS | PASS | JWTAuthFilter on all routes; role checks in controllers |
| IV. Immutable Migrations | PASS | PASS | No schema changes; existing migrations untouched |
| V. Financial Ledger Integrity | N/A | N/A | Classes module does not touch ledger |

**Gate result**: One active violation (Principle II). Fix is captured as Task B1 and is a hard
prerequisite before this feature can merge.

## Project Structure

### Documentation (this feature)

```text
specs/004-redo-classes-module/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── contracts/
│   └── api-contracts.md # Phase 1 output
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── Config/
│   │   └── Routes.php                         # (read) verify all class routes present
│   ├── Controllers/Api/
│   │   └── ClassController.php                # MODIFY: uniqueness check, debug log removal
│   ├── Models/
│   │   └── ClassModel.php                     # MODIFY: replace 'ACTIVE' string with constant
│   └── Database/
│       ├── Migrations/                        # READ ONLY — no new migrations
│       └── Seeds/
│           └── CompleteDatabaseSeeder.php     # (read) verify seeded data correct

frontend/
├── src/
│   ├── api/
│   │   └── api.ts                             # MODIFY: add getClassEnrollmentHistory() method
│   ├── components/modals/
│   │   ├── AddClassModal.tsx                  # MODIFY: add RHF + Zod validation
│   │   ├── EditClassModal.tsx                 # MODIFY: add RHF + Zod validation
│   │   └── ArchiveClassModal.tsx              # MODIFY: replace fetch() with api.ts method
│   └── hooks/
│       └── useGradeLevels.ts                  # (read) verify correct implementation
```

## Complexity Tracking

No complexity violations requiring justification. All changes are fixes within existing patterns.

## Implementation Tasks (summary — detail in tasks.md)

### Group A: Backend fixes

| ID | Task | File | Priority |
|----|------|------|----------|
| A1 | Replace hardcoded `'ACTIVE'` string with `EnrollmentModel::STATUS_ACTIVE` in ClassModel | `ClassModel.php` | P2 |
| A2 | Remove debug `log_message()` from `getEnrollmentHistory()` | `ClassController.php` | P3 |
| A3 | Add class name uniqueness validation: (tenant_id, grade_level_id, name, stream) in `create()` and `update()` | `ClassController.php` | P2 |

### Group B: Frontend fixes

| ID | Task | File | Priority |
|----|------|------|----------|
| B1 | Add `getClassEnrollmentHistory(id)` to `api.ts`; replace hard-coded `fetch()` in ArchiveClassModal | `api.ts`, `ArchiveClassModal.tsx` | P1 |
| B2 | Refactor `AddClassModal` to use React Hook Form + Zod validation | `AddClassModal.tsx` | P2 |
| B3 | Refactor `EditClassModal` to use React Hook Form + Zod validation | `EditClassModal.tsx` | P2 |

### Dependency order

```
B1 (constitution blocker — fix first)
A1, A2, A3 (backend, parallelizable)
B2, B3 (frontend modals, can be done after B1 is merged)
```
