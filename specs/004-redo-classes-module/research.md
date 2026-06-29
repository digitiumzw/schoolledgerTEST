# Research: Redo Classes Module

**Branch**: `004-redo-classes-module` | **Date**: 2026-04-06

## Codebase Findings

### Current State Summary

The classes module already has a substantial implementation across backend and frontend. The redo is
targeting correctness, consistency, and reliability rather than a from-scratch build.

---

## Decision Log

### Decision 1: Scope of "redo" — fix bugs vs full rewrite

**Decision**: Targeted rewrite — keep the overall architecture (controllers, models, API surface)
but fix all identified bugs, add missing validation, and clean up inconsistencies.

**Rationale**: The existing architecture correctly follows SchoolLedger's constitution (tenant
isolation, JWT auth, API-first separation). A full rewrite of working, well-structured code would
add risk without proportional benefit. The bugs are localized and fixable.

**Alternatives considered**: Full rewrite from scratch — rejected because it risks introducing new
bugs and discarding correct business logic (promotion chains, cycle detection, capacity enforcement).

---

### Decision 2: Frontend API calls — centralize through api.ts

**Decision**: All API calls in the frontend MUST go through the Axios instance in `src/api/api.ts`.
The hard-coded `fetch()` call in `ArchiveClassModal` (line 45) must be replaced with a proper
`api.getClassEnrollmentHistory(id)` method.

**Rationale**: The SchoolLedger Constitution (Principle II) and the constitution's Technology Stack
convention explicitly state: "All API calls MUST go through the Axios instance in `src/api/api.ts`;
no ad-hoc fetch calls." The existing violation bypasses token management and error handling.

**Alternatives considered**: Keeping the fetch call and just fixing the URL — rejected because it
still bypasses centralized error handling, auth token injection, and response normalization.

---

### Decision 3: Class name uniqueness validation

**Decision**: Add server-side uniqueness validation for class names scoped to (tenant_id,
grade_level_id, stream) — the combination that uniquely identifies a class. A bare name check
per tenant is too restrictive (two grades can have an "A" stream). The meaningful unique key is
name + grade_level_id + stream (all three) per tenant.

**Rationale**: The grade level controller already enforces (tenant_id, name) uniqueness for grade
levels. Classes need the same treatment at the correct granularity. Without this, duplicate classes
can be created silently.

**Alternatives considered**:
- Unique on (tenant_id, name) only — rejected as too restrictive; "Form 1A" and "Form 2A" share
  the name "A" as stream but are different classes.
- No uniqueness enforcement — rejected as it causes data integrity issues.

---

### Decision 4: EnrollmentModel constant consistency

**Decision**: Replace all hardcoded `'ACTIVE'` strings in `ClassModel` and `ClassController` with
the `EnrollmentModel::STATUS_ACTIVE` constant.

**Rationale**: Constants exist to prevent typos and make refactoring safe. Bypassing them with
string literals creates silent divergence risk.

**Alternatives considered**: Leaving strings in place — rejected because it makes future changes
to status values fragile.

---

### Decision 5: Debug logging removal

**Decision**: Remove the debug `log_message()` call in `ClassController::getEnrollmentHistory()`
(line 632). If structured logging is needed, it should be conditional on `CI_ENVIRONMENT` or
removed entirely.

**Rationale**: Debug logs in production generate noise, can expose internal data, and indicate
incomplete cleanup. Not a security issue here but a code quality issue.

---

### Decision 6: Schema — no new migrations needed

**Decision**: No new migration files are required. The existing schema (`grade_levels` table,
`grade_level_id` + `stream` columns on `classes`, `archived_at` on `classes`) is correct. The
rewrite is purely code-level.

**Rationale**: Constitution Principle IV (Immutable Migrations) means we only create migrations for
schema changes. Since no schema changes are needed, creating a migration would be incorrect.

---

### Decision 7: Frontend forms — React Hook Form + Zod validation

**Decision**: Add Zod schema validation to `AddClassModal` and `EditClassModal`. Currently they
rely on simple required checks. The modals need proper Zod schemas for all fields with appropriate
error messages.

**Rationale**: Constitution Technology Stack conventions require: "Forms MUST use React Hook Form +
Zod for validation." The current modals use simple controlled state with ad-hoc validation, not
the required RHF+Zod pattern.

---

## Known Issues to Fix (Prioritized)

| Priority | Location | Issue |
|----------|----------|-------|
| P1 | `ArchiveClassModal.tsx:45` | Hard-coded `http://localhost:8080/api` fetch call — constitution violation |
| P1 | `ArchiveClassModal.tsx:62-68` | Response format mismatch — `data.data?.count` vs standard response shape |
| P2 | `ClassController.php` | Missing class name uniqueness validation (per tenant+grade_level+stream) |
| P2 | `ClassModel.php:128` | Hardcoded `'ACTIVE'` string — use `EnrollmentModel::STATUS_ACTIVE` |
| P2 | `AddClassModal.tsx` | Missing RHF + Zod validation — use ad-hoc state instead of form library |
| P2 | `EditClassModal.tsx` | Missing RHF + Zod validation — same issue |
| P3 | `ClassController.php:632` | Debug `log_message()` left in `getEnrollmentHistory()` |
| P3 | `ClassModel.php:109` | Defensive `IS NULL OR next_class_id = ""` — clean up empty string check |

## Constitution Compliance Pre-Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Multi-Tenant Isolation | PASS | All queries filter by tenant_id from JWT |
| II. API-First Separation | FAIL → must fix | ArchiveClassModal uses direct fetch, not api.ts |
| III. JWT Auth & RBAC | PASS | All routes under JWTAuthFilter; role checks in controllers |
| IV. Immutable Migrations | PASS | No schema changes required |
| V. Financial Ledger Integrity | N/A | Classes module does not touch ledger queries |
