# Feature Specification: Redo Classes Module

**Feature Branch**: `004-redo-classes-module`  
**Created**: 2026-04-06  
**Status**: Draft  
**Input**: User description: "i want you to redo the entire classes module logic, so that it can work efficient and without errors"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manage Classes (Create, Edit, Delete) (Priority: P1)

An administrator needs to create and maintain the school's class records. Each class belongs to a grade level and optionally has a stream (e.g., "Form 1A", "Form 1B"). Administrators can create new classes, update class details (name, grade level, stream, capacity), and delete classes that have no enrolled students.

**Why this priority**: Class records are the foundation of the entire module. Without reliable CRUD operations for classes, no downstream functionality (student assignment, teacher assignment, rosters) can work correctly.

**Independent Test**: Can be fully tested by navigating to the Classes management page, creating a class, editing it, and deleting it — delivering a working class directory with no student or teacher dependencies required.

**Acceptance Scenarios**:

1. **Given** the admin is on the Classes page, **When** they fill in class name, select a grade level, and submit, **Then** the new class appears in the class list with correct details.
2. **Given** an existing class, **When** the admin edits the class name or stream and saves, **Then** the updated details are reflected immediately in the class list.
3. **Given** an existing class with no enrolled students, **When** the admin deletes it, **Then** the class is removed and no longer appears in any list.
4. **Given** an existing class with enrolled students, **When** the admin attempts to delete it, **Then** the system prevents deletion and shows a clear explanation.
5. **Given** the admin submits an incomplete class form, **When** required fields are missing, **Then** the system shows field-level validation errors without submitting.

---

### User Story 2 - Grade Level Management (Priority: P2)

An administrator can define and manage the school's grade levels (e.g., Form 1, Form 2, Grade 3). Grade levels act as the parent category for all classes. Admins can create, rename, and remove grade levels. A grade level cannot be removed if it still has classes attached to it.

**Why this priority**: Grade levels provide the organizational hierarchy that classes depend on. Without them, class creation in Story 1 cannot associate classes to any school year structure.

**Independent Test**: Can be fully tested by creating, editing, and deleting grade levels through the Grade Levels management section, independent of any class or student data.

**Acceptance Scenarios**:

1. **Given** the admin is on the Grade Levels page, **When** they enter a grade level name and submit, **Then** the new grade level appears and is available as an option when creating a class.
2. **Given** a grade level with no classes, **When** the admin deletes it, **Then** the grade level is removed successfully.
3. **Given** a grade level that has one or more classes, **When** the admin tries to delete it, **Then** the system blocks the deletion and tells the admin to first remove or reassign the classes.
4. **Given** the admin renames a grade level, **When** they save, **Then** all classes linked to that grade level reflect the updated name.

---

### User Story 3 - View Class Roster (Priority: P3)

A teacher or administrator can open any class and see the list of students currently enrolled in it, including their name, admission number, and status. The roster must be accurate and load without errors even for large classes.

**Why this priority**: The roster is the primary daily-use view for teachers. It depends on class and student-class assignment data being correct.

**Independent Test**: Can be tested by navigating to any class detail page and verifying the student list matches the students assigned to that class.

**Acceptance Scenarios**:

1. **Given** a class with enrolled students, **When** a teacher opens the class detail view, **Then** the full student roster is displayed with names, admission numbers, and status.
2. **Given** a class with no students, **When** a teacher opens it, **Then** an empty-state message is shown (e.g., "No students enrolled yet").
3. **Given** a class roster, **When** an admin or teacher searches or filters by name, **Then** the list narrows to matching students in real time.

---

### User Story 4 - Assign Students to Classes (Priority: P4)

An administrator can assign one or more students to a class, or remove students from a class. A student can only be enrolled in one class at a time within the same academic term. The system prevents duplicate assignments.

**Why this priority**: Student-class assignments are required for rosters and downstream features like attendance and grading, but depend on classes and students already existing.

**Independent Test**: Can be tested by assigning an existing student to a class, verifying they appear on the roster, then removing them.

**Acceptance Scenarios**:

1. **Given** a class and an unassigned student, **When** the admin assigns the student to the class, **Then** the student appears on the class roster.
2. **Given** a student already assigned to a class, **When** the admin tries to assign them to the same class again, **Then** the system rejects the duplicate and shows an appropriate message.
3. **Given** a student assigned to one class, **When** the admin removes them, **Then** they no longer appear on the class roster and become available for reassignment.

---

### User Story 5 - Assign a Teacher to a Class (Priority: P5)

An administrator can designate one teacher as the class teacher for a given class. This assignment is optional but visible on the class detail page and useful for reporting.

**Why this priority**: Teacher assignment is supplementary information that adds context to class management but is not blocking for core functionality.

**Independent Test**: Can be tested by assigning a teacher to a class and confirming the teacher's name appears on the class detail view.

**Acceptance Scenarios**:

1. **Given** a class with no assigned class teacher, **When** the admin selects a teacher and saves, **Then** the teacher's name is displayed on the class detail page.
2. **Given** a class with an existing class teacher, **When** the admin reassigns to a different teacher, **Then** the new teacher is shown and the previous assignment is replaced.

---

### Edge Cases

- What happens when an admin creates two classes with the same name in the same grade level? The system must either block duplicates or clearly disambiguate by stream.
- What happens if a student is deleted while still assigned to a class? The class roster must not break; the student entry should either be removed or flagged.
- What happens when the class list is very large (100+ classes)? The list must paginate or filter without performance degradation.
- How does the system behave if a grade level's classes are viewed by a user from a different tenant? The data must be scoped to the authenticated user's school only.
- What happens when two admins simultaneously attempt to enroll the same student in different classes? The system should enforce uniqueness and surface a conflict message.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow administrators to create a class by providing a name, grade level, and optional stream identifier.
- **FR-002**: System MUST allow administrators to update the name, grade level, stream, and capacity of an existing class.
- **FR-003**: System MUST prevent deletion of a class that has one or more students currently enrolled.
- **FR-004**: System MUST allow administrators to create, rename, and delete grade levels.
- **FR-005**: System MUST prevent deletion of a grade level that still has classes assigned to it.
- **FR-006**: System MUST allow administrators to assign a student to a class, with enforcement that a student belongs to only one class at a time per academic context.
- **FR-007**: System MUST allow administrators to remove a student from a class.
- **FR-008**: System MUST allow administrators to designate a teacher as the class teacher for a given class.
- **FR-009**: System MUST display the full student roster for any selected class, including each student's name, admission number, and current status.
- **FR-010**: System MUST scope all class and grade level data to the authenticated user's school (tenant); no cross-school data must be accessible.
- **FR-011**: System MUST provide clear, field-level validation messages when form submissions are incomplete or invalid.
- **FR-012**: System MUST reject duplicate class enrollments for the same student in the same class.
- **FR-013**: System MUST surface meaningful error messages when operations fail, rather than silently failing or displaying raw error codes.

### Key Entities

- **Grade Level**: Represents a school year tier (e.g., Form 1, Grade 3). Has a name and belongs to a specific school tenant. Parent of one or more classes.
- **Class**: Represents a section within a grade level (e.g., "Form 1A"). Has a name, stream, optional capacity, and belongs to one grade level and one tenant.
- **Student-Class Assignment**: The enrollment record linking a student to a class. Enforces uniqueness per student within an academic context.
- **Class Teacher Assignment**: Links one teacher to one class as the designated class teacher. Optional per class.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Administrators can create, edit, and delete a class in under 60 seconds with no errors.
- **SC-002**: The class roster for any class loads and displays in under 2 seconds regardless of the number of enrolled students (up to 100 per class).
- **SC-003**: 100% of operations that violate constraints (e.g., duplicate enrollment, deletion of a class with students) are blocked and result in a user-facing explanation — zero silent failures.
- **SC-004**: All class and grade level data is scoped to the authenticated school, verified by testing that a user from one school cannot retrieve data from another school.
- **SC-005**: The class list with up to 200 classes loads and filters in under 2 seconds.
- **SC-006**: After implementing this module, zero class-module-related bug reports attributable to data inconsistency or unhandled errors arise in the first 30 days of use.

## Assumptions

- Each class belongs to exactly one grade level; a class cannot span multiple grade levels.
- A student can only be enrolled in one class at a time (the academic term or year context is managed externally by the existing term system).
- The module covers management of classes, grade levels, student-class assignments, and class teacher assignments; timetabling, subjects, and grading are out of scope for this feature.
- The existing student and staff (teacher) records are already managed in other modules; this feature only creates the assignment relationship.
- Multi-tenancy isolation is already provided by the authentication system; this module must consistently apply tenant scoping to every data operation.
- All users accessing the classes module are authenticated; the system does not expose class data publicly.
- Roles with access to the classes module include: `admin` (full CRUD), `teacher` (read-only roster view). The `bursar` role does not require access to class management.
