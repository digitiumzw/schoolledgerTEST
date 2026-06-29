# Research: Classes Module Redesign

**Branch**: `003-redo-classes-module` | **Date**: 2026-04-03

## Summary

All unknowns resolved through direct codebase inspection. No external dependencies or new technology required — the redesign extends existing patterns.

---

## Decision Log

### 1. Grade Level Storage Strategy

**Decision**: Dedicated `grade_levels` table (not a `level` column on `classes`).

**Rationale**: A dedicated table allows grade levels to have their own ordered sequence (`sort_order`), a human-readable name, and potential future metadata (e.g., syllabus type). A bare integer column on `classes` would require all grade-level metadata to live in application code and would not support ordering independently of class names.

**Alternatives considered**:
- Single `grade_level` VARCHAR column on `classes` — rejected because it cannot enforce ordering or uniqueness per tenant without application-level workarounds.
- Enum column — rejected because each tenant defines its own grade structure; a shared enum is not viable in a multi-tenant SaaS.

---

### 2. Stream Field Design

**Decision**: Free-text `stream` VARCHAR(50) nullable column on `classes`. Uniqueness enforced at the (`tenant_id`, `grade_level_id`, `stream`) composite level in the backend.

**Rationale**: The codebase's existing `name` field on classes is already free-text; the stream follows the same convention. Controlled-list streams (a separate `streams` table) are over-engineered for this release — schools use wildly different stream naming conventions.

**Alternatives considered**:
- Separate `streams` table — rejected as premature for v1; can be added later if demand arises.
- Computed display name (grade + stream concatenated at DB level) — rejected; computing the display name in the API layer (as done today for `formatForApi`) is the established pattern.

---

### 3. Capacity Enforcement Location

**Decision**: Enforce capacity server-side in `ClassController::assignStudents()`. Frontend shows a warning and requires explicit confirmation when the limit would be exceeded, but the server has the final say.

**Rationale**: Constitution Principle III requires backend enforcement. The frontend `AssignStudentsModal` already shows student counts; capacity enforcement adds a pre-check query before the transaction begins. The "override with confirmation" requirement (FR-009) maps to a `force` boolean flag in the request payload that the admin can set after acknowledging the warning.

**Alternatives considered**:
- Frontend-only enforcement — rejected (Constitution III violation; a direct API call could bypass it).
- Hard block with no override — rejected (spec FR-009 explicitly requires an admin override path).

---

### 4. Circular Promotion Chain Prevention

**Decision**: Add a graph-walk check in `ClassController::setNextClass()` before persisting the `next_class_id`. Walk the chain from the proposed `nextClassId` forward; if we encounter the current class's `id`, reject the update.

**Rationale**: The current code only prevents `A → A` (self-link). A → B → C → A is not caught. The chain depth is bounded by the number of classes per tenant (typically < 20), so an in-application walk is efficient enough without a recursive SQL CTE.

**Alternatives considered**:
- Database-level constraint — MySQL does not natively prevent cycles in self-referential FKs; would require a trigger, which is harder to maintain.
- Recursive CTE in MySQL 8+ — viable but introduces database-version dependency; application-level walk is clearer and testable.

---

### 5. Role-Scoped Visibility

**Decision**: 
- **Teachers**: `ClassController::index()` checks `userHasRole('teacher')`; if true, delegates to `ClassModel::getByTeacher()` using the teacher's staff ID from the JWT.
- **Bursars**: Returns full class list with enrollment counts but omits the `students` sub-resource in list responses.
- **Admins / Super Admins**: Full access, no restriction.

**Rationale**: `BaseApiController::userHasRole()` and `requireRole()` are already implemented. The teacher's staff record is linked to the user via `staff.user_id` — a lookup in `StaffModel` using the JWT `userId` gives the `staffId` needed for `getByTeacher()`.

**Alternatives considered**:
- Middleware-based scoping — over-engineered for per-action role logic; controller-level checks are the established pattern in this codebase.

---

### 6. Grade Level Display Ordering

**Decision**: `sort_order` INT column on `grade_levels`, administrator-settable, defaulting to insertion order. Classes within a grade level are sorted by `stream` (or `name` if no stream).

**Rationale**: Alphabetical ordering of grade level names is unreliable ("Form 1" vs. "Grade 1" vs. "ECD A"). A manual `sort_order` is the lowest-friction approach and matches the school management system convention.

**Alternatives considered**:
- Auto-increment sort order with drag-and-drop reordering — desirable UX but out of scope for this iteration; the column exists to support it later.

---

### 7. Migration Strategy

**Decision**: Two new migration files:
1. `2026-04-03-120000_Create_grade_levels_table.php` — creates `grade_levels` table.
2. `2026-04-03-130000_Add_grade_fields_to_classes.php` — adds nullable `grade_level_id` and `stream` columns to `classes`; adds FK to `grade_levels`; adds unique index on `(tenant_id, grade_level_id, stream)`.

**Rationale**: Constitution Principle IV — existing migrations are immutable. Two files keep concerns separated: table creation vs. column addition. Both have `down()` methods.

**Existing data**: After migration, `grade_level_id` and `stream` are nullable. Existing classes remain fully functional without a grade level assigned — administrators can organise them into grade levels post-migration. No data migration script is required.

---

### 8. No New Frontend Technology

**Decision**: No new frontend libraries. All additions use existing shadcn/ui components, React Query, React Hook Form + Zod.

**Rationale**: The existing component library covers all new UI needs (dropdowns for grade level, text input for stream, capacity progress bars are achievable with existing primitives). Adding a library for one feature violates the spec's simplicity principle.

---

## Resolved Unknowns

| Unknown | Resolution |
|---------|-----------|
| How to identify the teacher's staff record from JWT | JWT contains `userId`; look up `staff.user_id = userId` in `StaffModel` to get `staffId` |
| Whether streams need a controlled list | No — free-text VARCHAR, uniqueness enforced at (tenant + grade + stream) level |
| How to detect "Repeating Year" students | `students.status` field; value `'repeating'` excludes student from bulk promotion (already partially implemented in `getStudentsForPromotion`) |
| Backward compatibility for existing class API consumers | `grade_level_id` and `stream` are nullable; existing API responses gain two new optional fields — non-breaking additive change |
