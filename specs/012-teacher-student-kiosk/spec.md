# Feature Specification: Teacher Student Attendance Kiosk

**Feature Branch**: `012-teacher-student-kiosk`  
**Created**: 2026-04-07  
**Status**: Draft  
**Input**: User description: "Create a kiosk system where a teacher can view the student attendance interface. The teacher should be able to select a class, see the list of students in that class, and mark each student's attendance. The system must not require a staff member to sign in. However, it should still record the teacher's employee ID for auditing and tracking purposes. and the kiosk use the same url pattern like for staff attendance"

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Teacher Takes Attendance for a Class (Priority: P1)

A teacher walks up to a shared kiosk device. They are presented with a list of active classes. They select their class (e.g., "Grade 7A — Mathematics"), then see a list of all enrolled students for that class on the current date. For each student the teacher marks attendance as Present, Absent, Late, or Excused. After reviewing the list the teacher enters their Employee ID to confirm and submit. The system records the attendance session, associating every student mark with that teacher's Employee ID for audit purposes, then resets to the class selection screen.

**Why this priority**: This is the entire purpose of the feature. Every student mark and teacher attribution depends on this flow being correct.

**Independent Test**: A teacher can open the kiosk URL, select a class, mark all students, enter a valid Employee ID, submit, and immediately see accurate attendance records appear in the admin student attendance view — without any other stories being implemented.

**Acceptance Scenarios**:

1. **Given** the student attendance kiosk is open and a class is selected, **When** the teacher views the student list, **Then** all active, enrolled students for that class are displayed with no sign-in required.
2. **Given** a student list is displayed, **When** the teacher marks individual students as Present, Absent, Late, or Excused, **Then** each mark is reflected visually before submission.
3. **Given** the teacher has marked at least one student, **When** they enter a valid Employee ID and submit, **Then** all student attendance records are saved with the current date, class, and the teacher's Employee ID as the recorder.
4. **Given** a teacher enters an unrecognised or inactive Employee ID at submission, **When** the submit action is triggered, **Then** the system rejects the submission and prompts the teacher to re-enter their ID without losing the marked attendance.
5. **Given** attendance has been successfully submitted, **When** the confirmation screen is shown, **Then** the kiosk automatically returns to the class selection screen after a short delay.

---

### User Story 2 — Admin Enables / Disables Student Kiosk Mode (Priority: P1)

An admin navigates to Settings and finds a "Student Attendance Kiosk" toggle alongside the existing staff kiosk toggle. When enabled, the student kiosk URL becomes active and accessible without a login session. When disabled, the URL shows a clear "Kiosk not active" message and no attendance actions can be performed.

**Why this priority**: Without an admin-controlled gate the kiosk cannot be safely activated or deactivated for each school. This is foundational for multi-tenant operation.

**Independent Test**: Toggle the student kiosk setting in Settings, navigate to the student kiosk URL, and verify it is fully functional when on and fully blocked when off — without affecting the staff kiosk or any other setting.

**Acceptance Scenarios**:

1. **Given** the admin toggles "Student Attendance Kiosk" to ON and saves, **Then** the student kiosk URL becomes accessible and functional immediately on the next page load.
2. **Given** the student kiosk is ON, **When** the admin disables it, **Then** the kiosk URL displays a "Kiosk not active" state and no attendance submissions are accepted.
3. **Given** a non-admin user views the Settings page, **Then** the student kiosk toggle is read-only or hidden.

---

### User Story 3 — Admin Reviews Student Attendance Records from Kiosk (Priority: P2)

An admin opens the student attendance records view and can see all records submitted via the kiosk. Each record shows the student, class, date, status, and the Employee ID of the teacher who submitted the session. The admin can filter by class, date range, and recording teacher. Manual corrections remain possible from the admin view.

**Why this priority**: Audit and correction capability is critical for school compliance and operational accuracy, but the kiosk can deliver value before the admin review view is polished.

**Independent Test**: Submit a kiosk attendance session as a teacher, then open the admin student attendance view and verify the records appear with the correct teacher Employee ID, date, class, and status for each student.

**Acceptance Scenarios**:

1. **Given** a kiosk attendance session is submitted, **When** an admin opens the student attendance records view, **Then** each student record from that session is visible with the correct date, class, status, and the submitting teacher's Employee ID.
2. **Given** attendance records exist from the kiosk, **When** an admin filters by teacher Employee ID, **Then** only records attributed to that teacher are shown.
3. **Given** an admin views a kiosk-submitted record, **When** they edit the status, **Then** the updated status is saved and the teacher attribution field remains unchanged.

---

### User Story 4 — Kiosk Displays Pre-Selected Status for Already-Submitted Sessions (Priority: P2)

If attendance has already been submitted for a class on the current date, the teacher opening that class on the kiosk sees the existing marks pre-populated. They can review and re-submit to update, which overwrites the existing session rather than creating duplicates.

**Why this priority**: Duplicate records corrupt attendance statistics. Pre-population also prevents confusion when a teacher accidentally opens a session that already exists.

**Independent Test**: Submit attendance for a class, reopen that class on the kiosk on the same day, and confirm the previously saved marks are displayed. Re-submit with changes and verify the records are updated, not duplicated.

**Acceptance Scenarios**:

1. **Given** attendance has already been submitted for a class today, **When** a teacher opens that class on the kiosk, **Then** the existing attendance marks are pre-populated for review.
2. **Given** pre-populated marks are displayed, **When** the teacher changes some marks and re-submits with a valid Employee ID, **Then** the existing records are updated and no duplicate records are created.
3. **Given** a class has no attendance submitted today, **When** a teacher opens that class on the kiosk, **Then** all students default to an unmarked state.

---

### Edge Cases

- What happens when a class has no enrolled students? (The kiosk should show an empty state with a helpful message, not an error.)
- What happens when the teacher enters their Employee ID but is inactive or suspended? (Submission must be rejected; the system must not attribute records to deactivated staff.)
- What happens if two teachers simultaneously open the same class on different kiosk devices and submit attendance? (The last submission should win, or the system should lock the class session; the spec does not prescribe implementation — only that no silent data loss occurs.)
- What happens when a student is enrolled in a class but has been transferred or deactivated today? (The student should not appear in the kiosk list for that class on that date.)
- What happens when a teacher partially marks attendance and the session times out? (Unsaved marks are lost; the teacher must restart. No partial records should be persisted unless the teacher explicitly submits.)
- What if kiosk mode is disabled between the teacher selecting a class and submitting? (The submission must be rejected with a clear message.)

---

## Requirements *(mandatory)*

### Functional Requirements

#### Student Kiosk Access

- **FR-001**: The system MUST provide an admin-controlled toggle to enable or disable the student attendance kiosk per tenant, accessible from the Settings page alongside the existing staff kiosk toggle.
- **FR-002**: When the student attendance kiosk is enabled, a dedicated kiosk page MUST be accessible at a stable URL matching the same URL pattern used by the staff kiosk (i.e., `/student-kiosk/{kiosk-code}`), without requiring any login session.
- **FR-003**: When the student attendance kiosk is disabled, the kiosk URL MUST display a "Kiosk not active" message and prevent any attendance actions.
- **FR-004**: The student kiosk MUST share the same opaque kiosk code mechanism used by the staff kiosk so that the Tenant ID is never exposed in the URL.

#### Class Selection

- **FR-005**: The kiosk MUST display a list of all active classes for the tenant on the class selection screen, with the class name and grade level visible.
- **FR-006**: A teacher MUST be able to search or scroll the class list to locate their class without signing in.
- **FR-007**: The class list MUST exclude archived or inactive classes.

#### Student List & Attendance Marking

- **FR-008**: After a class is selected, the kiosk MUST display all active, enrolled students for that class on the current date in a clear, scrollable list.
- **FR-009**: The kiosk MUST allow the teacher to set each student's attendance status to one of: Present, Absent, Late, or Excused.
- **FR-010**: If attendance has already been submitted for that class on the current date, the existing marks MUST be pre-populated when the class is opened on the kiosk.

#### Teacher Identity & Submission

- **FR-011**: Before submitting attendance, the teacher MUST enter their Employee ID. No sign-in session is required at any point.
- **FR-012**: The system MUST validate the entered Employee ID against active staff records. Submission MUST be rejected if the Employee ID is unrecognised or belongs to an inactive staff member.
- **FR-013**: Every attendance record created or updated via the student kiosk MUST store the submitting teacher's Employee ID as the `recorded_by` attribute for full auditability.
- **FR-014**: Submitting attendance for a class that already has records for the current date MUST overwrite the existing records for that class-date, not create duplicates.
- **FR-015**: After a successful submission, the kiosk MUST display a confirmation and automatically return to the class selection screen within 10 seconds.

#### Admin Records

- **FR-016**: All student attendance records created via the kiosk MUST appear in the admin student attendance records view with the same structure as manually entered records, including the teacher's Employee ID in the `recorded_by` field.
- **FR-017**: Admins MUST be able to filter student attendance records by class, date range, and recorded-by teacher Employee ID.
- **FR-018**: Admins MUST be able to manually edit or delete any student attendance record regardless of whether it was created via the kiosk or manually.

### Key Entities

- **StudentAttendanceRecord**: Represents a single student's attendance on a given date for a given class. Attributes: student, class, date, status (present, absent, late, excused), recorded_by (teacher Employee ID), source (kiosk or manual), recorded_at timestamp. One record per student per class per date enforced.
- **StudentKioskSession**: Represents a teacher's submission event. Attributes: class, date, teacher Employee ID, submitted_at timestamp, number of students marked. Used for audit trail purposes.
- **TenantSettings** (extended): Gains a `student_kiosk_enabled` flag alongside the existing `kiosk_enabled` (staff) flag. Both flags are independently controlled.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A teacher can open the kiosk, select a class, mark attendance for all students, and submit within 3 minutes for a class of up to 40 students.
- **SC-002**: Zero duplicate student attendance records exist for any student-class-date combination after a kiosk submission.
- **SC-003**: Every kiosk-submitted record has a non-null `recorded_by` field containing a valid teacher Employee ID — zero anonymous submissions are accepted.
- **SC-004**: Admin can retrieve all attendance records attributed to a specific teacher by filtering on their Employee ID within 2 seconds of applying the filter.
- **SC-005**: Enabling or disabling the student attendance kiosk in Settings takes effect within one page load on the kiosk URL.
- **SC-006**: The student kiosk URL contains no internal Tenant ID or UUID in the address bar, matching the same URL opaqueness as the staff kiosk.
- **SC-007**: Pre-populated marks are displayed correctly when a class session already exists for the current date, with zero data-loss on re-submission.

---

## Assumptions

- The student kiosk shares the same opaque kiosk-code URL mechanism introduced in spec `010-kiosk-employee-id`; no second code type is introduced — the existing tenant kiosk code is reused for both staff and student kiosk URLs.
- The student kiosk URL follows the pattern `/student-kiosk/{kiosk-code}`, mirroring the staff kiosk pattern `/kiosk/{kiosk-code}`.
- Classes and student enrolment already exist in the system; this feature does not introduce class or enrolment management.
- Only active (non-archived) classes and active (non-deactivated) students appear in the kiosk interface.
- The four attendance statuses for students are: Present, Absent, Late, and Excused. Additional statuses are out of scope for this version.
- The kiosk runs on a shared school device (tablet or desktop) on the school's internal network; no offline or PWA capability is required.
- The kiosk does not time out or auto-lock mid-session; teachers are expected to complete and submit before stepping away.
- Teacher identity is confirmed solely by Employee ID at submission time; no photo, PIN, or second factor is required in this version.
- The `recorded_by` field stores the Employee ID string (not the staff record foreign key) so the audit trail remains readable even if a staff record is later deactivated.
- The student kiosk mode toggle is independent of the staff kiosk mode toggle; enabling one does not affect the other.
