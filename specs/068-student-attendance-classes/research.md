# Research: Student Attendance – Class-Linked Event Tracking

**Branch**: `068-student-attendance-classes`  
**Date**: 2026-05-08  
**Purpose**: Resolve unknowns for planning

---

## Decision 1: Relationship to the Existing `student_attendance` Table

**Question**: Does this feature replace, extend, or supplement the existing `student_attendance` table?

**Decision**: Extend with a new `student_attendance_events` table. The existing `student_attendance` table only stores `class_id` (not `class_instance_id`), has no audit trail support, and does not have an `is_effective` flag. The new table is additive and purpose-built for the immutable event model. The existing table and endpoints remain untouched for backward compatibility with the kiosk flow.

**Rationale**: Reusing the old table would require a destructive schema change (ENUM expansion, new FK columns) and would silently break the kiosk submit endpoint which does an upsert pattern. A new table keeps both concerns isolated and the migration is clean.

**Alternatives considered**:
- Alter existing `student_attendance` in-place — rejected because the upsert-based kiosk model is incompatible with the immutable event model.
- Soft-drop and recreate — rejected as a destructive migration that breaks the existing audit history.

---

## Decision 2: `class_instance_id` vs `class_id` as the Core Link

**Question**: Should each attendance event be linked to `class_instances.id` (the class × academic_year intersection) or to `classes.id` (the class template)?

**Decision**: Link to `class_instances.id` as the primary contextual FK. The `class_id` (template) is stored as a denormalized convenience for queries that need to filter by class template without a JOIN, consistent with how `enrollments` carries both.

**Rationale**: The spec mandates that attendance data is contextual to the academic year. `class_instances` is exactly the `class × academic_year` entity created in feature 048. Linking to it ensures that a "Grade 5 – 2025" attendance record cannot be confused with a "Grade 5 – 2026" record.

**Alternatives considered**:
- Link only to `class_id` (template) — rejected; would lose academic-year context.
- Store `academic_year` as a raw string — rejected; duplicates meaning already captured in `class_instances.academic_year` and would allow inconsistency.

---

## Decision 3: Immutable Log + Effective Flag Strategy

**Question**: How should corrections be modelled without modifying existing rows?

**Decision**: Every INSERT to `student_attendance_events` creates a new immutable row. An application-layer service sets `is_effective = 0` on all prior rows for the same `(tenant_id, student_id, class_instance_id, date, period_key)` tuple before inserting the new row as `is_effective = 1`. A composite index on these five columns ensures fast lookups.

**Rationale**: Database-level immutability (no UPDATE/DELETE after creation) is enforced by application policy — no controller method mutates a row after insert. The `is_effective` flag allows aggregation queries to use `WHERE is_effective = 1` for current-state reads while still preserving all prior rows for audit.

**Alternatives considered**:
- Use a separate `audit_log` table alongside a mutable main table — rejected; creates two sources of truth and complicates reporting.
- Use database triggers to prevent updates — considered, but the service-layer pattern already used throughout the codebase (no trigger infrastructure) is preferred for consistency.

---

## Decision 4: Per-Period vs Per-Day Mode

**Question**: How should per-period mode be enforced without creating incompatible schema for per-day mode?

**Decision**: The `period_key` column is `VARCHAR(50) NULL`. In per-day mode, `period_key` is always `NULL`. In per-period mode, it holds a caller-supplied label (e.g., `"P1"`, `"P2"`). The uniqueness constraint for deduplication uses `(tenant_id, student_id, class_instance_id, date, COALESCE(period_key, '__day__'))` expressed at the application layer, not as a DB unique constraint (since `NULL ≠ NULL` in MySQL UNIQUE indexes).

The tenant `settings` table already stores arbitrary JSON configuration. A new `studentAttendanceMode` key (`"per_day"` | `"per_period"`, default `"per_day"`) is added to the existing settings tenant config.

**Rationale**: Single table, nullable column. The existing settings JSON config pattern (already used for `chargeProrationEnabled`, `workHoursConfig`, etc.) is the right pattern for this toggle.

**Alternatives considered**:
- Two separate tables for per-period and per-day records — rejected; unnecessary complexity.
- Separate ENUM `mode` column per row — rejected; mode is a tenant-level setting, not a per-row attribute.

---

## Decision 5: New Controller vs Extending Existing `AttendanceController`

**Question**: Should the new endpoints be added to `AttendanceController` or placed in a new `StudentClassAttendanceController`?

**Decision**: Create a new `StudentClassAttendanceController`. The existing `AttendanceController` already mixes staff and student concerns and is growing large. A dedicated controller for the new class-linked event model avoids further coupling and keeps the file sizes manageable.

**Rationale**: Principle VII (single clear purpose per file) and the existing pattern of dedicated controllers (`FeeRuleController`, `FeeCampaignController`, etc.) support a separate controller. The existing `AttendanceController` student methods remain untouched.

**Alternatives considered**:
- Extend existing `AttendanceController` — rejected; the file already handles staff check-in/check-out/reports/leave sync. Adding a third concern would violate single-responsibility.

---

## Decision 6: Service Layer for Aggregation

**Question**: Should aggregation queries be inline in the controller or extracted to a service?

**Decision**: Create a `StudentClassAttendanceService` that handles:
1. Submitting a batch (enrollment validation, future-date guard, effective-flag cascade, batch insert).
2. Aggregation queries (per-student summary, class summary, term summary).
3. Audit log fetch.

**Rationale**: Consistent with `StaffAttendanceService`, `FeeRuleBillingService`, `FeeCampaignService` — all use the thin-controller → service pattern mandated by Principle VII.

---

## Decision 7: Enrollment Guard on Submission

**Question**: How should the system verify that a student is actively enrolled in the class instance before allowing attendance submission?

**Decision**: The service queries `enrollments` where `class_instance_id = :classInstanceId AND student_id = :studentId AND status = 'ACTIVE'`. If no active enrollment exists, the student is skipped with an error code in the batch response rather than rejecting the whole batch. This allows partial-success batch responses.

**Rationale**: A teacher may be submitting attendance for a class where one student was just transferred mid-day. Rejecting the whole batch would block marking all other students. Per-student validation with partial-error responses is more operationally useful.

---

## Decision 8: `academic_session` Denormalization

**Question**: Should `academic_session` be stored redundantly on the event given that `class_instances.academic_year` already encodes the year?

**Decision**: Store `academic_session` as a `VARCHAR(20)` column on `student_attendance_events` as a denormalized convenience column. It mirrors the pattern on `enrollments` (`academic_session` + `class_instance_id` both present).

**Rationale**: Avoids a JOIN to `class_instances` for every aggregation query that groups by session. The value is always derived from the class instance at insert time so there is no inconsistency risk.

---

## Decision 9: Frontend — New Hook & Extended Attendance Page

**Question**: Where should the new class-attendance UI live?

**Decision**: The existing `Attendance.tsx` page already has tabs for "Student" and "Staff" attendance. A new "Class Attendance" tab is added alongside the existing student/staff tabs. New custom hook `useClassAttendance.ts` handles all React Query state for the new endpoints. The existing `getStudentAttendance` / `saveStudentAttendance` API methods are unchanged.

**Rationale**: Keeps attendance UI in one place and avoids adding a new top-level nav item for a feature that naturally belongs in the attendance workspace.
