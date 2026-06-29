# Feature Specification: Student Management

**Feature Branch**: `001-student-management`
**Created**: 2026-04-03
**Status**: Draft
**Input**: User description: "redo the students features using the standard school management system standards."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enroll a New Student (Priority: P1)

An administrator or admissions officer registers a new student into the school. They capture the
student's personal details, academic placement (grade, class, stream), guardian/parent contact
information, and the student's admission number. On saving, the student becomes active in the
system and appears in the school directory immediately.

**Why this priority**: Enrollment is the entry point for every other student-related workflow —
billing, attendance, academic records. Without it, nothing else functions.

**Independent Test**: Register one student end-to-end with all mandatory fields, then confirm the
student appears in the directory with the correct grade assignment and guardian contacts.

**Acceptance Scenarios**:

1. **Given** the admin is on the enrollment form, **When** they submit valid student details
   (name, date of birth, gender, grade, admission number, at least one guardian), **Then** the
   student record is saved, assigned a unique admission number (or the provided one is
   accepted), and the student appears in the directory as "Active".

2. **Given** the admin submits the form with a duplicate admission number, **When** the system
   validates, **Then** an error is displayed and the record is not saved.

3. **Given** the admin omits a mandatory field (e.g., guardian phone number), **When** they
   attempt to submit, **Then** the form highlights the missing field and prevents submission.

4. **Given** a student is enrolled, **When** the bursar opens the fee billing section for that
   student, **Then** the student is already selectable for charge generation.

---

### User Story 2 - View and Update a Student Profile (Priority: P2)

A staff member (admin, teacher, or bursar) opens a student's profile to view their details —
personal information, guardian contacts, current grade/class, and enrollment status. Authorized
staff (admin only) can edit the profile to correct information or update the guardian contact.

**Why this priority**: Profiles are referenced constantly across attendance, billing, and
reporting. Stale or incorrect data causes errors downstream.

**Independent Test**: Open an existing student's profile, edit the guardian phone number, save,
and verify the change is reflected immediately without requiring a page reload.

**Acceptance Scenarios**:

1. **Given** a staff member searches for a student, **When** they open the profile, **Then**
   all personal details, guardian contacts, current grade, admission number, and enrollment
   status are visible in a single view.

2. **Given** an admin edits a student's guardian contact, **When** they save, **Then** the
   updated contact is reflected immediately and the previous value is no longer shown.

3. **Given** a teacher (non-admin) views a student profile, **When** they attempt to edit,
   **Then** the edit controls are not available and a read-only view is presented.

4. **Given** the admin updates the student's grade/class assignment, **When** the change is
   saved, **Then** the student appears under the new class in all class-based views.

---

### User Story 3 - Search and Browse the Student Directory (Priority: P3)

Any authenticated staff member can browse the full list of active students within their school.
They can filter by grade, class/stream, enrollment status, or search by name or admission
number to quickly locate a specific student.

**Why this priority**: The directory is the navigation hub — staff use it to reach individual
profiles, prepare class lists, and generate reports. Poor search makes the whole system slower.

**Independent Test**: With 50+ students enrolled across multiple grades, search by partial name
returns matching results; filter by a specific grade shows only students in that grade.

**Acceptance Scenarios**:

1. **Given** the staff member opens the student directory, **When** the page loads, **Then**
   all active students for the current school are listed with name, admission number, grade,
   and status visible at a glance.

2. **Given** the staff member types a partial name in the search box, **When** they pause
   typing, **Then** the list filters to show only students whose name contains the typed text.

3. **Given** the staff member selects a grade from the filter, **When** the filter is applied,
   **Then** only students in that grade are shown.

4. **Given** the staff member filters by status "Inactive" or "Transferred", **When** the
   filter is applied, **Then** only students with that status are shown (not mixed with Active).

---

### User Story 4 - Manage Student Status Lifecycle (Priority: P4)

An admin can change a student's enrollment status to reflect real-world events: marking a
student as transferred (out), withdrawn, or graduated at end of term/year. The system records
the effective date and reason. Inactive students are excluded from billing and attendance by
default but remain accessible for historical records.

**Why this priority**: Accurate status tracking prevents billing errors (charging a student who
has left) and keeps class lists and reports clean.

**Independent Test**: Mark one active student as "Transferred", provide an effective date and
reason, then verify: (a) the student no longer appears in the active directory by default, and
(b) the student's historical records (payments, charges) are still accessible.

**Acceptance Scenarios**:

1. **Given** an admin opens a student's profile, **When** they change status to "Transferred"
   and provide an effective date and receiving school, **Then** the student's status updates,
   they are excluded from the active directory, and a status history entry is recorded.

2. **Given** a transferred student, **When** the bursar views billing, **Then** the student
   does not appear in the active charge-generation list.

3. **Given** a transferred student, **When** an admin searches with status "Transferred",
   **Then** the student is found and their full history (payments, charges, attendance) is
   accessible.

4. **Given** year-end processing, **When** an admin graduates a cohort of students,
   **Then** all selected students move to "Graduated" status and are removed from active lists.

---

### Edge Cases

- What happens when two students share the same full name? The system MUST distinguish them
  by admission number; name alone MUST NOT be treated as a unique identifier.
- What happens when a student's grade assignment changes mid-term? The change takes effect
  immediately for new records; historical records (attendance, charges already generated)
  retain the grade at time of creation.
- What happens if a guardian's contact number is invalid (wrong format)? The system MUST
  reject submission and prompt for a valid number.
- What happens when an admin attempts to delete a student who has payment or charge records?
  Deletion MUST be blocked; the admin MUST use status change (Withdrawn/Transferred) instead.
- What happens when the same admission number is entered for a student in a different school
  (different tenant)? Admission numbers are scoped per school; no conflict exists.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow authorized staff to enroll a new student with the following
  mandatory fields: full name, date of birth, gender, grade, at least one guardian name and
  contact phone number, and enrollment date.
- **FR-002**: System MUST auto-generate a unique admission number per school if one is not
  provided; if provided by the user, it MUST be validated for uniqueness within the school.
- **FR-003**: System MUST support optional fields during enrollment: student photo, national ID
  or birth certificate number, address, second guardian, stream/class section, and religion.
- **FR-004**: System MUST allow admin users to edit any student profile field after enrollment,
  with changes taking effect immediately.
- **FR-005**: System MUST restrict edit access to admin role only; teachers and bursars MUST
  have read-only access to student profiles.
- **FR-006**: System MUST display a student directory listing all students for the current
  school, filterable by grade, class/stream, and enrollment status.
- **FR-007**: System MUST support real-time search by student name (partial match) and exact
  search by admission number within the student directory.
- **FR-008**: System MUST support the following enrollment statuses: Active, Transferred,
  Withdrawn, Graduated. Default on enrollment is Active.
- **FR-009**: System MUST record a status change history entry whenever a student's enrollment
  status changes, capturing: new status, effective date, reason, and the staff member who
  made the change.
- **FR-010**: System MUST prevent hard deletion of any student who has associated financial
  records (charges or payments); status change MUST be used instead.
- **FR-011**: System MUST allow bulk status updates (e.g., graduating an entire cohort) for
  admin users.
- **FR-012**: System MUST scope all student data strictly to the school (tenant) of the logged-in
  user; no cross-school data MUST ever be accessible.
- **FR-013**: System MUST support pagination or virtual scrolling in the student directory to
  handle schools with 1,000+ students without degradation.

### Key Entities

- **Student**: The primary record. Holds personal details (name, DOB, gender, photo, national
  ID), academic placement (grade, class/stream, admission number, enrollment date), enrollment
  status, and links to guardian contacts. Scoped to one school (tenant).
- **Guardian**: A contact person linked to one or more students. Holds name, relationship
  (mother, father, uncle, etc.), primary phone, optional secondary phone, and optional email.
- **Grade**: An academic level offered by the school (e.g., Grade 1–7, Form 1–6). Students are
  assigned to one grade at a time.
- **Class / Stream**: An optional sub-grouping within a grade (e.g., "4A", "Form 3 Science").
  A student belongs to one class/stream at a time.
- **Status History Entry**: An immutable audit record of each status change — previous status,
  new status, effective date, reason, and acting staff member.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can complete the enrollment of a new student, including guardian details,
  in under 3 minutes from opening the form to confirmation.
- **SC-002**: The student directory loads the initial list in under 2 seconds for schools with
  up to 2,000 active students.
- **SC-003**: Search results appear within 1 second of the user finishing typing a name or
  admission number.
- **SC-004**: 100% of status changes are captured in a history log with date, reason, and
  acting user — zero untracked changes.
- **SC-005**: Attempting to enroll a student with a duplicate admission number within the same
  school results in a clear error message 100% of the time — no silent overwrites.
- **SC-006**: Financial records for transferred or withdrawn students remain fully accessible
  to bursars after the status change, with zero data loss.
- **SC-007**: Non-admin staff (teachers, bursars) cannot modify student profiles; 100% of edit
  attempts by non-admins are blocked with a clear permission message.

## Assumptions

- The school uses grade-based academic levels (e.g., Grade 1–7 or Form 1–6); the specific
  grade labels are configurable per school tenant and already exist in the system.
- A student belongs to exactly one school (tenant) and cannot be shared across tenants; school
  transfers are modelled as status change + re-enrollment at the new school.
- Admission numbers follow a free-text format; no national numbering standard is enforced by
  the system (schools define their own convention).
- Guardian contacts are stored per student enrollment, not as a shared system-wide parent
  account; the same parent with two children has their contact entered twice.
- Student photos are optional and, if supported, are stored as uploaded files scoped to the
  school; image size limits follow standard web-safe practices (max 2 MB).
- The "class/stream" grouping is optional — schools that do not use streams still function
  normally with grade-only placement.
- Bulk graduation is performed manually by an admin at end of year; automatic promotion based
  on results is out of scope for this feature.
- Mobile-optimized views are desirable but full mobile-native app support is out of scope for
  this version.
