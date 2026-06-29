# Feature Specification: Classes Module Redesign

**Feature Branch**: `003-redo-classes-module`
**Created**: 2026-04-03
**Status**: Draft
**Input**: User description: "Redo the Classes module feature using the structure and standards of a typical school management system"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Set Up the School's Class Structure (Priority: P1)

An administrator sets up the school's academic hierarchy by creating grade levels (e.g., Grade 1 through Grade 7, or Form 1 through Form 6) and then creating individual classes under each grade. Each class can optionally belong to a stream (e.g., "3A", "3B", "3 Science", "3 Humanities") and is assigned a homeroom teacher. The administrator can view all classes grouped by grade level and immediately understand the school's structure.

**Why this priority**: A school cannot place students, assign teachers, or generate fees without a defined class structure. This is the foundation for all other academic functions.

**Independent Test**: Can be fully tested by creating two grade levels with two classes each, viewing the resulting grouped list, and verifying the hierarchy is accurate — this alone delivers a workable academic structure.

**Acceptance Scenarios**:

1. **Given** I am an administrator, **When** I create a grade level "Grade 7" and add two classes "7A" and "7B" under it, **Then** the class list shows "Grade 7" as a grouping header with both classes listed beneath it.
2. **Given** a class exists, **When** I edit it to assign a homeroom teacher, **Then** the teacher's name appears on the class card/row.
3. **Given** I set a class capacity of 35, **When** I view the class, **Then** I see "0 / 35 students" (or equivalent) reflecting available space.
4. **Given** I try to create a class with a name already used within the same grade level, **Then** the system prevents it and shows an error.

---

### User Story 2 — Manage Student Placement in Classes (Priority: P2)

An administrator or bursar assigns students to classes at the start of a term or academic year. They can search for unassigned students, filter by name, and assign them to a specific class. The system warns them if adding a student would exceed the class's capacity limit. Students can be moved between classes with the transfer logged for the record.

**Why this priority**: Correct class placement is required before attendance, fee generation, and academic records can function properly.

**Independent Test**: Can be fully tested by assigning 5 students to a class with capacity 4, verifying the capacity warning appears, completing 4 assignments, and confirming the 5th is blocked or warned.

**Acceptance Scenarios**:

1. **Given** a class has capacity 30 and 28 students enrolled, **When** I try to assign 3 more students, **Then** the system warns that only 2 spaces remain and requires confirmation to proceed.
2. **Given** a class is at full capacity, **When** I attempt to assign another student, **Then** the system blocks the assignment and displays a clear "Class is full" message.
3. **Given** a student is currently in Class 3A, **When** I move them to Class 3B, **Then** their enrollment in 3A is closed, a new enrollment in 3B is opened, and the transfer is logged with a date.
4. **Given** I search for students to assign, **When** I filter by name "John", **Then** only students with "John" in their name appear in the results.

---

### User Story 3 — End-of-Year Class Progression (Priority: P3)

At the end of an academic year, an administrator promotes the entire school (or individual classes) to the next grade level. The system shows a preview of which class each student will move to, allows the administrator to review and confirm, and then executes the promotion. Students who are graduating (final grade) are marked as graduated rather than promoted. Any exceptions (e.g., students who are repeating) can be excluded from bulk promotion.

**Why this priority**: This is a critical annual workflow that currently exists but lacks grade-level context and graduation handling aligned with the school's formal structure.

**Independent Test**: Can be fully tested by running a promotion preview for one class, verifying the destination class is correct, excluding one student, and completing the promotion — then checking that included students appear in the new class.

**Acceptance Scenarios**:

1. **Given** Class 6B is linked to Class 7B as its progression target, **When** I run end-of-year promotion for Class 6B, **Then** all active students in 6B are moved to 7B and their 6B enrollment is marked "Promoted".
2. **Given** a student is flagged as "Repeating Year", **When** I run bulk promotion for their class, **Then** they are automatically excluded from the promotion batch and remain in the current class.
3. **Given** Class 7B is the final grade, **When** promotion runs for Class 7B, **Then** students are marked "Graduated" and exit the active class roster.
4. **Given** I run a promotion preview, **When** I review it, **Then** I see each student's name, current class, and destination class before confirming.

---

### User Story 4 — Class Overview and Reporting (Priority: P4)

Any authorized staff member (admin, teacher, bursar) can view a class's details: enrollment count, capacity usage, homeroom teacher, grade level, stream, and a list of enrolled students. Teachers can view only the classes they are assigned to. Bursars can see enrollment counts across all classes to help with fee generation. The view is accessible on both desktop and mobile.

**Why this priority**: Visibility into class composition enables informed decisions across all school departments.

**Independent Test**: Can be fully tested by logging in as a teacher who is assigned to one class and verifying they can view that class's student list but not another teacher's class.

**Acceptance Scenarios**:

1. **Given** I am a teacher, **When** I navigate to Classes, **Then** I only see the classes I am the homeroom teacher of.
2. **Given** I am an admin, **When** I view a class, **Then** I see the student list, total enrolled, capacity, grade level, stream, and homeroom teacher.
3. **Given** I am a bursar, **When** I view the class list, **Then** I see enrollment counts for all classes but not student personal details.
4. **Given** I am on a mobile device, **When** I view the class list, **Then** each class is shown as a readable card with key details visible without horizontal scrolling.

---

### User Story 5 — Archive and Remove Classes (Priority: P5)

An administrator can archive a class that is no longer active (e.g., a class removed due to low enrollment). Archiving is blocked if the class still has active students. Archived classes can be restored. A class can only be permanently deleted if it has no enrollment history. The system distinguishes clearly between "active", "archived", and "graduated" classes.

**Why this priority**: Lifecycle management keeps the class list clean without destroying historical data.

**Independent Test**: Can be fully tested by creating a class, assigning a student, attempting to archive it (should fail), removing the student, archiving it successfully, and then restoring it.

**Acceptance Scenarios**:

1. **Given** a class has 3 active students, **When** I try to archive it, **Then** the system blocks the action and shows "Remove all students before archiving".
2. **Given** a class has no active students, **When** I archive it, **Then** it disappears from the main class list but appears under an "Archived" filter.
3. **Given** an archived class, **When** I restore it, **Then** it returns to the active class list.
4. **Given** a class with historical enrollment records, **When** I try to permanently delete it, **Then** the system blocks deletion and explains that enrollment history exists.

---

### Edge Cases

- What happens when a homeroom teacher is removed from staff while still assigned to a class?
- How does the system handle a class with a promotion target that has been archived?
- What if two grade levels have classes with the same stream label (e.g., "A" in Grade 5 and "A" in Grade 6 — these should be allowed)?
- What happens if a student's enrollment is manually removed and they end up with no active class?
- How does the system handle promotion when a class has no defined "next class"?

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST support grade levels as a formal organizational unit above individual classes (e.g., Grade 1, Form 3), allowing classes to be grouped and displayed by grade.
- **FR-002**: Each class MUST belong to exactly one grade level.
- **FR-003**: Each class MAY have a stream label (e.g., "A", "B", "Science", "Humanities") that, combined with the grade level, forms the class's full display name (e.g., "Grade 7A").
- **FR-004**: Each class MUST support a capacity limit, and the system MUST enforce this limit during student assignment by blocking or warning when the limit is reached.
- **FR-005**: Each class MUST support the assignment of a single homeroom teacher from the school's staff roster.
- **FR-006**: Class stream names within the same grade level MUST be unique per school (tenant).
- **FR-007**: The class list MUST display classes grouped by grade level, with each grade's classes listed together in order.
- **FR-008**: Administrators MUST be able to assign multiple students to a class in a single operation, with the system creating individual enrollment records for each.
- **FR-009**: The system MUST prevent assigning a student to a class at or above its capacity limit; an override requiring explicit confirmation MUST be available to administrators.
- **FR-010**: Administrators MUST be able to transfer a student from one class to another, with the system automatically closing the old enrollment and opening a new one, recording the date of transfer.
- **FR-011**: Students flagged with a "Repeating Year" status MUST be automatically excluded from bulk end-of-year promotion.
- **FR-012**: The system MUST support end-of-year class progression where all active (non-repeating) students in a class move to the designated next class upon administrator confirmation.
- **FR-013**: A promotion preview MUST be available before any promotion is executed, showing each student's name, current class, and destination class.
- **FR-014**: Students in a final grade (no next class defined) MUST be marked "Graduated" when promotion is run, removing them from the active class roster.
- **FR-015**: The system MUST prevent archiving a class that has active student enrollments.
- **FR-016**: Archived classes MUST be restorable to active status by an administrator.
- **FR-017**: Permanent class deletion MUST be blocked if any enrollment history exists for that class.
- **FR-018**: Teachers MUST only be able to view the classes they are assigned to as homeroom teacher.
- **FR-019**: Bursars MUST be able to view all class enrollment counts across the school without access to individual student personal details.
- **FR-020**: Administrators MUST be able to set the next class (progression target) for any class, and this mapping drives end-of-year promotion logic.
- **FR-021**: Grade levels MUST support a manually set sort order so they display in the correct academic sequence regardless of creation order.
- **FR-022**: The system MUST prevent circular progression chains (e.g., Class A → Class B → Class A).

### Key Entities

- **Grade Level**: Represents a formal academic year or grade in the school (e.g., "Grade 7", "Form 3"). Has an ordered sequence for display and progression purposes. A school may have between 1 and 13 grade levels.
- **Class**: A specific group of students taught together. Belongs to one grade level, has an optional stream label, a homeroom teacher, a capacity limit, and an optional next-class link for progression. Can be active or archived.
- **Stream**: An informal label within a grade level distinguishing parallel classes (e.g., "A", "B", "Science"). Optional — schools that do not use streams omit it.
- **Enrollment**: A record of a student's membership in a class for a period of time. Has a status (Active, Promoted, Graduated, Transferred, Withdrawn). Enrollment history is preserved permanently for reporting and auditing.
- **Student**: Belongs to one active class at a time. May be flagged as "Repeating Year" to exclude from bulk promotion.
- **Homeroom Teacher**: A staff member designated as the primary teacher for a class. One per class.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An administrator can fully set up the school's grade structure (create grade levels and all classes) in under 15 minutes for a school with up to 20 classes.
- **SC-002**: Assigning 30 students to a class takes no more than 2 minutes end-to-end, including search, selection, and confirmation.
- **SC-003**: The end-of-year promotion process for an entire school of up to 500 students completes in under 30 seconds from the moment the administrator confirms.
- **SC-004**: 100% of capacity limit violations are caught by the system — no student is placed in a full class without an explicit override confirmation from an administrator.
- **SC-005**: Teachers can view their assigned class rosters within 2 clicks from the main navigation, with no access to unassigned classes.
- **SC-006**: Zero enrollment records are lost or corrupted during class promotion, transfer, or archiving operations.
- **SC-007**: The class list page loads in under 2 seconds for a school with up to 50 classes.
- **SC-008**: 90% of first-time administrators can complete the initial class setup (grade levels + classes) without needing external support, based on usability review.

---

## Assumptions

- Each school (tenant) defines its own grade levels; there is no shared or system-wide grade level list. A primary school might use "Grade 1–7" while a secondary school uses "Form 1–6".
- A student belongs to exactly one active class at any given time; concurrent enrollment in multiple classes is out of scope.
- The "Repeating Year" flag is managed on the student profile and is readable by the classes module but not set within it.
- Stream labels are free-text (e.g., "A", "East", "Science") rather than a controlled list; schools define their own naming conventions.
- Subject assignments and timetabling are separate future features; this spec covers only the structural class hierarchy, enrollment, and progression.
- All existing enrollment history data is preserved and migrated forward; no historical records will be deleted as part of this redesign.
- Grade level ordering is determined by a manually set sort order, not inferred from the grade name or number.
- The "homeroom teacher" role on a class is distinct from "subject teachers" who will be managed through a future timetable module.
- Multi-tenant isolation remains enforced — all grade levels, classes, and enrollments are scoped per school.
- The school's academic calendar (terms, academic sessions) is an existing system concept that enrollment records reference; this module does not redefine it.
