# Research: Student Management

**Phase 0 output for**: `001-student-management`
**Date**: 2026-04-03

## Current State Analysis

The existing student implementation covers the core data flow (create, list, profile view, status
change, balance calculation) but is missing several fields and behaviours that are standard in
school management systems. The table below documents each gap.

| Gap | Current State | Standard SMS Requirement |
|-----|--------------|--------------------------|
| Admission number | Not stored | MUST be unique per school; auto-generated or manually entered |
| Gender | Not stored | MUST be captured (Male / Female / Other) |
| Second guardian | Not stored | SHOULD support a second emergency contact |
| Student photo | Not stored | SHOULD allow optional photo upload |
| National ID / birth cert | Not stored | SHOULD capture for official record-keeping |
| Status change audit trail | No history table | MUST record every status change with date, reason, actor |
| Hard-delete with financial records | Cascades and deletes payments/charges | MUST block deletion; redirect to status change |
| Search by admission number | Not supported | MUST support exact search by admission number |
| Bulk status update | Promote exists; generic bulk status absent | MUST support bulk graduation / bulk withdrawal |

---

## Decision Log

### D-001 Admission Number Format

**Decision**: System auto-generates an admission number in the format `{YEAR}/{SEQ}` (e.g.,
`2026/001`) per school. The admin may override with a custom value. The school prefix is NOT
embedded by the system — each school tenant manages their own sequence.

**Rationale**: Schools in Zimbabwe use varying formats; forcing a rigid format would break
existing schools. Auto-generation covers the common case; override covers edge cases.

**Alternatives considered**:
- Enforce a tenant-prefix format (e.g., `GWD/2026/001`): rejected — too opinionated about
  school naming conventions.
- UUID only: rejected — not human-readable; admission numbers are printed on documents.

### D-002 Second Guardian Storage

**Decision**: Add `guardian2_name`, `guardian2_phone`, `guardian2_relationship` columns to the
`students` table (nullable). No separate `guardians` table.

**Rationale**: A separate `guardians` table is the normalized ideal but adds join complexity
for a feature that is used read-mostly. The flat approach is consistent with how the first
guardian is stored today and avoids a migration that changes foreign key relationships.

**Alternatives considered**:
- Separate `guardians` table linked by FK: rejected for this phase — over-engineering; can be
  refactored later if guardians need to be shared across siblings.

### D-003 Status History Table

**Decision**: Create a new `student_status_history` table with columns: `id`, `tenant_id`,
`student_id`, `previous_status`, `new_status`, `effective_date`, `reason`, `changed_by_user_id`,
`created_at`.

**Rationale**: An immutable append-only history table is the correct audit pattern. Storing
history as a JSON blob on the student record would be harder to query and violates
single-responsibility.

**Alternatives considered**:
- JSON blob on students table: rejected — not queryable; hard to report on.
- Generic audit log table: over-engineered for this scope; dedicated table is clearer.

### D-004 Hard-Delete Protection

**Decision**: `StudentController::delete()` MUST check for the existence of any `charges` or
`payments` records linked to the student before deleting. If any exist, return HTTP 422 with a
message directing the admin to use status change instead.

**Rationale**: Deleting a student with financial records would leave dangling references in
ledger reports and break financial audit trails. The spec (FR-010) is explicit about this.

**Alternatives considered**:
- Soft-delete flag on students: would require filtering soft-deleted students out of all
  queries — high blast radius change. Status change already fulfils the same need.

### D-005 Schema Migration Strategy

**Decision**: Two new migration files:
1. `2026-04-03-100000_Add_student_standard_fields.php` — ALTER TABLE to add new columns to
   `students` (admission_number, gender, photo_url, guardian2_name, guardian2_phone,
   guardian2_relationship, national_id).
2. `2026-04-03-110000_Add_student_status_history.php` — CREATE TABLE `student_status_history`.

No existing migrations are modified.

**Rationale**: Constitution Principle IV mandates new migration files for all schema changes.

### D-006 Frontend Form Consolidation

**Decision**: Consolidate `AddStudentModal.tsx` and `StudentFormModal.tsx` into a single
`StudentFormModal.tsx`. The current duplication causes drift between add and edit flows.

**Rationale**: Both modals render the same form fields. Maintaining two files means field
additions must be made twice. Consolidating eliminates this risk.

### D-007 Balance Calculation — No Change

**Decision**: The existing `getAllBalances()` subquery pattern in `StudentModel.php` is
preserved exactly. No changes to balance calculation logic.

**Rationale**: Constitution Principle V protects the ledger integrity pattern. The existing
implementation is correct and performant.
