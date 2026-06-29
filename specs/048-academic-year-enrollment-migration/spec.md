# Feature Specification: Academic Year Class Migration via Enrollment History

**Feature Branch**: `048-academic-year-enrollment-migration`  
**Created**: 2026-04-27  
**Status**: Draft  
**Input**: User description: "class migration should be designed around academic years and enrollment history rather than directly updating student records. Instead of moving students from one class to another in place, each school should have a structure where classes are templates (like 'Grade 1' or 'Form 2') and each academic year generates specific class instances for those templates. Students are then linked to these class instances through an enrollment table, which becomes the source of truth for their academic history. When migrating classes at the end of an academic year, the system should create new enrollments for the next academic year rather than modifying existing ones, while marking the old enrollments as completed, promoted, repeated, or graduated depending on the student's outcome. Promotion logic can either be rule-based (such as moving to the next level order) or configurable through a progression mapping table to support different school structures. This approach ensures clean historical records, supports edge cases like repeats or transfers, and keeps each tenant's data isolated and consistent across academic years."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run Year-End Class Migration to Create Next-Year Enrollments (Priority: P1)

At the end of an academic year, a school administrator triggers the year-end migration. For every active enrollment in the current academic year, the system closes that enrollment with the appropriate outcome status (PROMOTED, REPEATED, GRADUATED, or TRANSFERRED) and creates a new enrollment for the next academic year, pointing to the correct class instance. No existing enrollment record is modified in place — only its terminal status and completion date are written, and a brand-new enrollment row is inserted for the next year.

**Why this priority**: This is the core behavioural change. The current system mutates student records directly during promotion; this story replaces that pattern with immutable append-only enrollment creation, which is the foundation everything else builds on.

**Independent Test**: Trigger a migration dry-run for a tenant with at least one active enrollment. Verify that: (1) no existing enrollment row is deleted or has its `class_id` or `student_id` changed; (2) a new enrollment row exists with `academic_year_id` pointing to the next year; (3) the old enrollment's `status` is set to PROMOTED/REPEATED/GRADUATED (not ACTIVE).

**Acceptance Scenarios**:

1. **Given** a student has an ACTIVE enrollment in class instance "Grade 1 – 2025/2026", **When** the year-end migration is run, **Then** that enrollment's `status` is set to PROMOTED and a new enrollment is created for "Grade 2 – 2026/2027" with status ACTIVE.
2. **Given** a student is flagged as repeating before migration runs, **When** the year-end migration is run, **Then** the old enrollment is marked REPEATED and a new enrollment is created for the **same class template** in the next academic year.
3. **Given** a student is enrolled in a final/graduation class instance, **When** the year-end migration is run, **Then** the enrollment is marked GRADUATED and no new enrollment is created.
4. **Given** the migration is triggered twice for the same academic year (idempotency), **Then** the second run detects that enrollments are already closed and creates no duplicates.
5. **Given** one student's progression target class instance does not yet exist for the next academic year, **Then** the migration creates the class instance first (from its template), then creates the enrollment.

---

### User Story 2 - Manage Class Templates (Grade/Level Definitions) (Priority: P1)

An administrator manages a library of class templates for their school (e.g., "Grade 1", "Form 2", "Year 10"). These templates define the permanent structure of the school's academic ladder. Templates are not academic-year-specific; they exist at the school level and are reused across years. Administrators can create, rename, reorder, and archive templates. Each template can optionally define its promotion target (which template to promote into) and whether it is a final/graduation class.

**Why this priority**: Without class templates as the stable backbone, the class-instance and enrollment model cannot be constructed. Templates replace the role of the current `classes` table entries as the reusable definition layer.

**Independent Test**: Create a template named "Form 3", set its promotion target to "Form 4", then retrieve it and verify both fields are correct and scoped to the tenant.

**Acceptance Scenarios**:

1. **Given** an administrator creates a class template "Grade 1" with sort order 1, **When** it is saved, **Then** it is retrievable and tenant-scoped.
2. **Given** a template defines a `next_template_id` pointing to another template in the same tenant, **When** the template is retrieved, **Then** the linked promotion target name is included.
3. **Given** a template is set as `is_final_class = true`, **Then** the migration treats all students in instances of this template as graduating during year-end migration.
4. **Given** an administrator tries to set `next_template_id` creating a circular chain, **Then** the system rejects the update with a cycle-detection error.
5. **Given** an administrator archives a template, **Then** no new class instances can be created from it, but existing instances and their enrollment history remain accessible.

---

### User Story 3 - Generate Class Instances for a New Academic Year (Priority: P2)

Before the start of a new academic year, an administrator generates class instances for each active class template. Each instance ties a template to a specific academic year (e.g., "Grade 1 – 2026/2027"). Instances can be generated in bulk for all templates at once or individually. Generating instances does not yet enroll any students — it simply ensures the class "slots" exist for the new year so the migration engine has targets to write enrollments into.

**Why this priority**: Class instances are the FK targets for enrollment records. They must exist before migration can create new enrollments. This can be partially automated by the migration engine itself, but admin-controlled generation provides visibility and control.

**Independent Test**: Call the bulk instance-generation endpoint for academic year "2026/2027". Verify one instance is created per active template for that tenant and year, and that calling it again produces no duplicates.

**Acceptance Scenarios**:

1. **Given** a tenant has 5 active class templates and no instances for year "2026/2027", **When** bulk generation is triggered, **Then** exactly 5 class instances are created.
2. **Given** instances already exist for the target year, **When** bulk generation is triggered again, **Then** no new duplicates are created; existing instances are returned unchanged.
3. **Given** a class template is archived, **When** bulk generation is run, **Then** no instance is created for the archived template.
4. **Given** an instance is created, **Then** it inherits the template's `teacher_id`, `capacity`, and `is_final_class` values but can be overridden per-year.

---

### User Story 4 - View a Student's Full Academic History Across Years (Priority: P2)

An administrator or teacher can view a student's complete academic history — every class they were ever enrolled in, the academic year, enrollment outcome, and any remarks — in chronological order. The history is derived entirely from the enrollment table and class instances, with no dependency on mutable student record fields.

**Why this priority**: One of the primary benefits of the enrollment-history model is auditability. This story makes that benefit visible and testable.

**Independent Test**: For a student who has been through two migrations, call the history endpoint and verify all enrollment rows (PROMOTED, ACTIVE) appear in order with correct class instance names and academic years.

**Acceptance Scenarios**:

1. **Given** a student has enrollment records spanning 3 academic years, **When** the history endpoint is called, **Then** all 3 records are returned in ascending year order with class names, outcomes, and dates.
2. **Given** a student was held back (REPEATED) in year 2, **Then** the history shows two consecutive enrollments with the same class template but different academic years, with the first marked REPEATED.
3. **Given** a student transferred in mid-year, **Then** the history shows both the TRANSFERRED enrollment and the subsequent ACTIVE enrollment in the new class instance.

---

### User Story 5 - Configure Progression Mapping for Complex School Structures (Priority: P3)

For schools with non-linear or branching promotion paths (e.g., A-stream promotes to a different class than B-stream), an administrator can configure a **progression mapping** table that overrides the default `next_template_id` chain. Each mapping entry specifies a source template and an optional stream/track, and maps it to a destination template. The migration engine consults this table first; if no mapping applies, it falls back to the `next_template_id` field on the template.

**Why this priority**: Most schools will use the simple `next_template_id` chain. Progression mappings are an advanced feature needed only by schools with branching structures. It is P3 because the MVP works without it.

**Independent Test**: Create a mapping from template "Form 2 (Science)" to "Form 3 (Science)" and from "Form 2 (Arts)" to "Form 3 (Arts)". Trigger migration and verify students from each stream are placed in the correct destination.

**Acceptance Scenarios**:

1. **Given** a progression mapping exists for (source: "Form 2", stream: "Science") → "Form 3 Science", **When** migration runs for a student in "Form 2 Science", **Then** the new enrollment points to "Form 3 Science".
2. **Given** no progression mapping matches a student's class and the template has a `next_template_id`, **When** migration runs, **Then** the fallback `next_template_id` is used.
3. **Given** neither a mapping nor a `next_template_id` exists for a student's template, **Then** the student is skipped with a warning and their enrollment remains ACTIVE pending manual resolution.

---

### Edge Cases

- What happens when a class instance for the next year is missing at migration time? The system auto-creates the missing instance from its template before creating the enrollment, rather than failing the entire batch.
- What happens when a student has no active enrollment at migration time (they were manually closed earlier)? That student is skipped silently — no duplicate closure or new enrollment is created.
- What happens when two migration runs overlap concurrently for the same tenant? The migration must use a transaction-level lock per tenant to prevent race conditions and duplicate enrollments.
- What happens when the school's academic year calendar has not yet been created for the next year? Migration is blocked with a clear error: "Next academic year not configured. Please create the academic year record before running migration."
- What happens when a student is transferred to another school mid-year, and a year-end migration is then triggered? The TRANSFERRED enrollment is skipped during migration — only ACTIVE enrollments are processed.
- What if a student's template's `next_template_id` points to an archived template? The migration flags this student as requiring manual intervention and skips them rather than enrolling them into an archived template's instance.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST introduce a `class_templates` entity to represent school-level reusable class definitions (e.g., "Grade 1", "Form 2"), scoped per tenant.
- **FR-002**: Each `class_template` MUST support: `name`, `sort_order`, `is_final_class`, `next_template_id` (nullable FK to self), and `archived_at`. All records must be tenant-scoped with no cross-tenant access.
- **FR-003**: The system MUST introduce a `class_instances` entity linking a `class_template` to a specific `academic_year`, representing the concrete class for that year. Each tenant + template + academic year combination must be unique.
- **FR-004**: The `enrollments` table MUST reference `class_instance_id` (not `class_id` directly) as its primary class linkage, so each enrollment record is anchored to a specific year's class instance.
- **FR-005**: The year-end migration operation MUST: (a) iterate all ACTIVE enrollments for the current academic year under the tenant; (b) set each enrollment's `status` and `completion_date` based on the student's outcome (PROMOTED / REPEATED / GRADUATED); (c) create a new enrollment row for the next academic year without modifying the closed enrollment's `class_instance_id` or `student_id`.
- **FR-006**: The migration engine MUST auto-create a missing `class_instance` for the next academic year from the template, if one does not already exist, rather than failing the student's migration.
- **FR-007**: Idempotency MUST be enforced: running migration twice for the same academic year MUST produce no duplicate enrollment records and MUST not alter already-closed enrollments.
- **FR-008**: The migration engine MUST support a **dry-run mode** that returns a preview of all planned outcomes (promote/repeat/graduate/skip) without committing any changes to the database.
- **FR-009**: The promotion resolution order MUST be: (1) check `class_progression_mappings` for a matching (source_template_id, optional stream) entry; (2) fall back to `class_template.next_template_id`; (3) if neither exists, skip and flag.
- **FR-010**: Setting `next_template_id` on a class template MUST be rejected if the resulting chain would contain a cycle (cycle detection required before commit).
- **FR-011**: `next_template_id` MUST only reference class templates belonging to the same tenant.
- **FR-012**: The migration response MUST include a summary: total students processed, count by outcome (PROMOTED, REPEATED, GRADUATED, SKIPPED), and a per-student detail list for SKIPPED outcomes with reasons.
- **FR-013**: A student enrollment with status TRANSFERRED, GRADUATED, DROPPED_OUT, or any non-ACTIVE status MUST be excluded from year-end migration processing.
- **FR-014**: Bulk class instance generation MUST be idempotent — generating instances for a year that already has instances for all active templates produces no new rows.
- **FR-015**: All migration and class-instance operations MUST run within a database transaction scoped to the tenant, with a rollback on any failure.
- **FR-016**: The student's `class_id` and `current_enrollment_id` convenience fields on the `students` table MUST be updated to reflect the new active enrollment after migration, maintaining backward compatibility with existing reads.
- **FR-017**: The enrollment history endpoint for a student MUST return all enrollment records across all academic years in chronological order, including the class template name and academic year label for each entry.

### Key Entities

- **Class Template**: A reusable, academic-year-agnostic definition of a class level within a school (e.g., "Grade 1"). Fields: `id`, `tenant_id`, `name`, `sort_order`, `is_final_class`, `next_template_id`, `archived_at`. Replaces the current `classes` table as the canonical definition layer.
- **Academic Year**: A named period (e.g., "2025/2026") with `start_date` and `end_date`, scoped per tenant. Already exists; acts as the temporal anchor for class instances.
- **Class Instance**: The intersection of a Class Template and an Academic Year for a specific tenant. Fields: `id`, `tenant_id`, `template_id`, `academic_year_id`, `teacher_id`, `capacity`, `is_final_class` (inheritable from template, overridable). Becomes the FK target for enrollments.
- **Enrollment**: A record of a student's membership in a Class Instance for an Academic Year. Fields: `id`, `tenant_id`, `student_id`, `class_instance_id`, `academic_year_id`, `status` (ACTIVE / PROMOTED / REPEATED / GRADUATED / TRANSFERRED / DROPPED_OUT), `enrollment_date`, `completion_date`, `remarks`. The sole source of truth for academic history.
- **Class Progression Mapping**: An optional per-tenant override table for non-linear promotion paths. Fields: `id`, `tenant_id`, `source_template_id`, `stream` (nullable), `destination_template_id`. Consulted first during migration before falling back to `next_template_id`.
- **Student**: Retains `class_id` (convenience FK → current class instance) and `current_enrollment_id` (FK → current active enrollment) for backward-compatible reads; these are updated as a side-effect of migration, not the primary mutation target.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After a year-end migration, 100% of previously ACTIVE enrollment records have a non-ACTIVE terminal status (PROMOTED, REPEATED, GRADUATED) and a non-null `completion_date` — zero records remain ACTIVE from the previous year.
- **SC-002**: After migration, every PROMOTED or REPEATED student has exactly one new ACTIVE enrollment in the correct class instance for the next academic year — zero duplicate active enrollments per student.
- **SC-003**: Running the migration operation twice produces identical row counts in the `enrollments` table on both runs — second run inserts zero new rows.
- **SC-004**: The migration dry-run returns an accurate preview (promote/repeat/graduate/skip counts and per-student outcomes) that matches the actual migration result 100% of the time.
- **SC-005**: A student's enrollment history endpoint returns all historical enrollment records in ascending academic-year order, with correct class template names and outcome statuses, within 500 ms for a student with up to 15 years of history.
- **SC-006**: Bulk class instance generation for 50 templates completes in under 5 seconds.
- **SC-007**: All migration operations for a tenant complete within a single database transaction; a failure at any point results in zero partial writes.
- **SC-008**: Cross-tenant isolation is enforced: no enrollment, class instance, or template created during migration references records belonging to a different tenant.

## Assumptions

- The current `classes` table will be treated as the initial source for class templates during migration of the data model. Existing `classes` records are mapped 1:1 to `class_templates`; existing `enrollments.class_id` values are remapped to `class_instance_id` values via a migration script that creates a "legacy" class instance per class per academic session already stored in the enrollments table.
- `academic_year` records per tenant are already managed through the existing settings/calendar infrastructure; this feature does not redesign academic year management, only consumes it.
- The existing `enrollments.academic_session` string field (e.g., "2025/2026") will be superseded by `academic_year_id` as a FK. Both fields coexist during a transition period; reads prefer `academic_year_id` when present.
- The `grade_levels` table continues to serve as the display-grouping layer (e.g., "Junior Secondary") and is not replaced by class templates, which operate at a finer granularity.
- Schools that do not use the progression mapping feature continue to use `next_template_id` on the template as the sole promotion chain — the mapping table is additive and optional.
- The frontend UI changes needed to expose template management and the migration trigger are in scope for this feature; however, the UI for viewing individual class instances per year is considered a separate concern and may be deferred.
- Only users with administrator-level or higher access for a school tenant can trigger migrations, create/modify templates, and generate class instances.
- The existing `students.class_id` and `students.current_enrollment_id` fields are retained for backward compatibility with the kiosk, attendance, and ledger modules, which read class membership from the student record directly.
