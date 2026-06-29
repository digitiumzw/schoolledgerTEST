# Feature Specification: Fix Class Promotion Logic to Use next_class_id

**Feature Branch**: `005-fix-class-promotion`  
**Created**: 2026-04-06  
**Status**: Draft  
**Input**: User description: "fix the class promotion logic and make it use the next class id, when doing the migrations."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Promote All Students Using Configured Progression Chain (Priority: P1)

An admin runs the bulk year-end promotion, and every student moves to the class pointed to by their current class's `next_class_id`. Students in classes with NULL `next_class_id` (final/graduation classes) are graduated rather than promoted. Students in classes where `next_class_id` has not been configured are skipped with a clear error message so the admin knows which classes need to be configured first.

**Why this priority**: This is the core break — promotion must read and follow the configured `next_class_id` chain, not fall back to any other ordering or skip silently.

**Independent Test**: Call the bulk promotion endpoint and verify that each promoted student's new enrollment references the class matching their previous class's `next_class_id`.

**Acceptance Scenarios**:

1. **Given** a class has a valid `next_class_id` configured and contains active students, **When** bulk promotion runs, **Then** each active student is enrolled in the class identified by `next_class_id` and their previous enrollment is marked as promoted.
2. **Given** a class has `next_class_id` set to NULL (final class), **When** bulk promotion runs, **Then** active students in that class are graduated, not skipped.
3. **Given** a class has no `next_class_id` configured, **When** bulk promotion runs, **Then** students in that class are skipped and the response includes a descriptive error identifying the unconfigured class.
4. **Given** a class's `next_class_id` points to a class belonging to a different tenant, **When** bulk promotion runs, **Then** the promotion is rejected and students are skipped.

---

### User Story 2 - Admin Configures the Class Progression Chain Before Promotion (Priority: P2)

Before running promotions, an admin sets `next_class_id` on each class to define the year-on-year progression path (e.g., Grade 1 → Grade 2 → … → Grade 12, where Grade 12 has no next class). The system validates that the chain contains no cycles and that all referenced classes belong to the same tenant.

**Why this priority**: Without a correct chain configured, the P1 promotion scenario cannot succeed. Chain setup is a prerequisite.

**Independent Test**: Set `next_class_id` on a class via the API, then retrieve the class and confirm the field is persisted correctly.

**Acceptance Scenarios**:

1. **Given** an admin sets `next_class_id` to a valid class in the same tenant, **When** the update is saved, **Then** the field is persisted and readable.
2. **Given** an admin tries to create a circular chain (e.g., A → B → A), **When** the update is attempted, **Then** the system rejects it with a cycle-detection error.
3. **Given** an admin sets `next_class_id` to NULL, **When** the update is saved, **Then** the class is treated as a final/graduation class.

---

### User Story 3 - Promotion Preview Reflects next_class_id Chain (Priority: P3)

Before committing the bulk promotion, an admin views a preview that accurately shows which class each group of students will move to based on the configured `next_class_id`. The preview distinguishes between promotions, graduations, and skips.

**Why this priority**: The preview is a safety gate — it must accurately represent what the promotion will do so admins can catch misconfigured chains before running the actual migration.

**Independent Test**: Call the promotion-preview endpoint and confirm each class's listed destination matches the class's `next_class_id` value.

**Acceptance Scenarios**:

1. **Given** all classes have valid `next_class_id` chains configured, **When** the preview is requested, **Then** each class shows the correct destination class name and student count.
2. **Given** one class has no `next_class_id`, **When** the preview is requested, **Then** that class is flagged as "unconfigured" with zero promotions and a warning.
3. **Given** a class is a final class (NULL `next_class_id`), **When** the preview is requested, **Then** that class's students are shown as graduating.

---

### Edge Cases

- What happens when a student is already enrolled in the target class for the new session (duplicate enrollment)?
- What happens when `next_class_id` referenced a class that has since been deleted (dangling FK)?
- How does the system handle a promotion run where some classes succeed and others fail — partial completion?
- What happens if the same promotion is triggered twice in the same academic session (idempotency)?
- What happens when a class chain has a gap (one class has no `next_class_id` set mid-chain)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The bulk promotion operation MUST resolve each student's destination class by reading the `next_class_id` field of the student's current class, not by any other ordering or naming convention.
- **FR-002**: Students enrolled in a class with a non-NULL `next_class_id` MUST be enrolled in that destination class after promotion, with their previous enrollment marked as promoted.
- **FR-003**: Students enrolled in a class with NULL `next_class_id` (final class) MUST be graduated during promotion, not skipped.
- **FR-004**: If a class has `next_class_id` not configured (unconfigured, not explicitly NULL), promotion MUST skip those students and return a descriptive error identifying the affected class by name.
- **FR-005**: The promotion operation MUST prevent a student from being promoted more than once per academic session (pre-loop snapshot mechanism must be preserved).
- **FR-006**: Setting `next_class_id` on a class MUST be rejected if it would create a circular reference in the progression chain.
- **FR-007**: The `next_class_id` on any class MUST only reference a class belonging to the same tenant.
- **FR-008**: The promotion preview endpoint MUST use the same `next_class_id` resolution logic as the actual promotion operation, returning identical destination classes.
- **FR-009**: The bulk promotion response MUST include counts of promoted students, graduated students, and skipped students, along with per-class reasons for skips.
- **FR-010**: Single-student promotion MUST also resolve the destination class via `next_class_id` when no explicit target class is provided.

### Key Entities

- **Class**: Represents an academic class/grade; has a `next_class_id` self-referencing field defining where students move at year-end; NULL means final/graduation class.
- **Enrollment**: Records a student's membership in a class for a given academic session; statuses include ACTIVE, PROMOTED, GRADUATED, REPEATED, TRANSFERRED, DROPPED_OUT.
- **Student**: Has a `class_id` reflecting current class and a `current_enrollment_id` pointing to the active enrollment record.
- **Academic Session**: Year-based identifier (e.g., "2025/2026") used to namespace enrollments and prevent duplicate promotions within a session.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After a bulk promotion run, 100% of active students in classes with a configured `next_class_id` have a new enrollment in the correct destination class and their previous enrollment is marked as promoted.
- **SC-002**: After a bulk promotion run, 100% of active students in final classes (NULL `next_class_id`) have their enrollment status set to GRADUATED.
- **SC-003**: No student has a duplicate active enrollment in the same academic session after a promotion run.
- **SC-004**: The promotion preview and the actual promotion produce identical class destination and student counts for every class.
- **SC-005**: Any class with a missing `next_class_id` configuration is surfaced in the promotion response with enough detail for the admin to identify and fix it.
- **SC-006**: Every attempt to create a circular `next_class_id` chain is rejected by the system without persisting the change.

## Assumptions

- The `next_class_id` field already exists on the `classes` table in the database schema; this fix addresses logic that was not correctly reading or enforcing it during promotion.
- Each tenant is responsible for configuring the progression chain for their classes before running a promotion; the system warns but does not block the run for correctly configured classes.
- Academic session is determined server-side based on the current calendar year; no session override is required for this fix.
- Only students with status `active` and an active enrollment are eligible for promotion; students marked `repeating`, `graduated`, etc., are excluded.
- The fix scope covers the backend promotion logic and preview endpoints; UI changes are limited to correctly surfacing error/warning messages returned by the updated API.
- Final classes (graduation classes) are identified by NULL `next_class_id`, not by a separate flag or naming convention.
