# Feature Specification: Redo Staff Module & Kiosk Attendance Mode

**Feature Branch**: `006-staff-kiosk-attendance`  
**Created**: 2026-04-06  
**Status**: Draft  
**Input**: Redo the staff module and staff attendance logic, fixing any existing bugs. For the staff attendance system, add a new feature where the admin can enable a "kiosk mode." When kiosk mode is enabled, staff should only be able to sign in and sign out from a separate page dedicated to kiosk use.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Kiosk Check-In / Check-Out (Priority: P1)

A school positions a shared tablet or computer near the entrance. When the admin has enabled kiosk mode, staff members arrive, open the dedicated kiosk page, locate their name from a searchable list, enter their employee ID to confirm identity, and tap "Sign In." At the end of the day they return to the same page, locate their name, confirm with their employee ID, and tap "Sign Out." The system records the time and updates their attendance status.

**Why this priority**: This is the core deliverable of the new feature. It directly replaces manual register signing and is the primary value add for schools.

**Independent Test**: Can be fully tested by navigating to the kiosk URL, selecting a staff member, entering a valid employee ID, tapping Sign In/Sign Out, and confirming the attendance record appears in the admin attendance records view.

**Acceptance Scenarios**:

1. **Given** kiosk mode is enabled by admin, **When** a staff member selects their name on the kiosk page and enters their correct employee ID, **Then** a check-in or check-out record is created with the current timestamp and their attendance status updates visibly on screen.
2. **Given** a staff member is already checked in today, **When** they visit the kiosk page, **Then** the system shows "Sign Out" as their only action and does not create a duplicate check-in.
3. **Given** a staff member enters an incorrect employee ID, **When** they attempt to sign in or out, **Then** the system displays an error and does not record attendance.
4. **Given** kiosk mode is disabled by admin, **When** someone navigates to the kiosk URL, **Then** the page displays a "Kiosk mode is not enabled" message and no attendance actions are possible.
5. **Given** a successful sign-in or sign-out, **When** the confirmation screen is shown, **Then** the kiosk automatically resets to the staff list after a short delay, ready for the next staff member.

---

### User Story 2 — Admin Enables / Disables Kiosk Mode (Priority: P1)

An admin navigates to the school settings panel, finds the "Kiosk Mode" toggle under attendance settings, and switches it on. From that point forward the kiosk page is live and staff can use it. The admin can turn it off at any time, immediately deactivating the kiosk page.

**Why this priority**: Without this control the kiosk feature cannot be activated or deactivated. It is foundational to the feature.

**Independent Test**: Can be fully tested by toggling kiosk mode in Settings and verifying the kiosk page responds accordingly (functional when on, blocked when off) without affecting any other system behaviour.

**Acceptance Scenarios**:

1. **Given** the admin is on the Settings page, **When** they toggle "Enable Kiosk Mode" to ON and save, **Then** the setting persists and the kiosk page becomes accessible and functional.
2. **Given** kiosk mode is ON, **When** the admin toggles it OFF and saves, **Then** the kiosk page immediately shows a disabled state and no attendance actions can be completed.
3. **Given** kiosk mode is ON, **When** a non-admin user (teacher, bursar) views the Settings page, **Then** the kiosk mode setting is read-only or not visible to them.

---

### User Story 3 — Admin Manages Staff Records (Priority: P2)

An admin adds a new staff member with complete details including employee ID, role, department, teaching flag, next-of-kin, and employment status. They can later update any field, view the staff member's full profile with attendance and leave history, and change employment status. The staff list is searchable and filterable.

**Why this priority**: The staff module is the foundation for attendance and leave. Correctness here prevents downstream data integrity bugs.

**Independent Test**: Can be fully tested by creating, editing, and viewing a staff member record without touching attendance or leave, and verifying all fields round-trip correctly.

**Acceptance Scenarios**:

1. **Given** admin creates a staff member with all required fields, **When** the record is saved, **Then** the staff member appears in the list with correct data and is available for attendance tracking.
2. **Given** a staff member's employment status is set to "resigned" or "retired," **When** viewing the staff list, **Then** they are filterable by that status and do not appear in kiosk sign-in lists or daily attendance tracking.
3. **Given** a staff member has attendance or leave records, **When** admin tries to hard-delete the staff record, **Then** the system blocks deletion with an explanatory message and suggests deactivating instead.
4. **Given** admin performs a search by name, email, or employee ID, **When** results are returned, **Then** only matching staff are shown and the list updates without a full page reload.

---

### User Story 4 — Admin Records and Manages Attendance Manually (Priority: P2)

An admin can open the attendance records view, see historical records with filters (staff member, date range, status), manually create or edit an attendance entry for any staff member, and delete incorrect records. Monthly summaries per staff member are accurate and reflect manual edits.

**Why this priority**: Manual corrections are necessary for cases where a staff member forgot to use the kiosk or the kiosk was unavailable.

**Independent Test**: Can be fully tested by creating a manual attendance record for a past date, editing it, and verifying the monthly summary updates accordingly.

**Acceptance Scenarios**:

1. **Given** admin creates a manual attendance record with a custom check-in, check-out, and status, **When** the record is saved, **Then** it appears in the records list and is reflected in the monthly summary.
2. **Given** a record with check-in and check-out times, **When** work hours are computed, **Then** the result matches the actual elapsed time and is stored correctly.
3. **Given** admin updates an existing attendance record's status, **When** saved, **Then** the status is updated and the change is immediately visible in the records list.

---

### User Story 5 — Staff Leave Request Workflow (Priority: P3)

A staff member (via admin entry on their behalf) submits a leave request with type, dates, and reason. The admin reviews the request, approves or rejects it with optional notes. Approved leave automatically appears in the attendance view as "On Leave" for the covered dates. Only pending requests can be edited or withdrawn.

**Why this priority**: Leave management is important but not blocking. Kiosk mode and core attendance are higher value.

**Independent Test**: Can be fully tested by creating a leave request, approving it, and verifying the relevant dates show "On Leave" status in attendance records.

**Acceptance Scenarios**:

1. **Given** a leave request is submitted for a date range, **When** the admin approves it, **Then** attendance records for those dates are created or updated with "on_leave" status.
2. **Given** a leave request has been approved, **When** admin or staff tries to edit or delete it, **Then** the system prevents the action and shows an appropriate message.
3. **Given** a leave request is in "pending" state, **When** admin edits the dates or type and saves, **Then** the updated details are stored and the status remains "pending."

---

### Edge Cases

- What happens when a staff member attempts to sign in on the kiosk after already being manually marked "absent" or "on_leave" for today by the admin? (System should still allow check-in and override or flag the discrepancy.)
- How does the system handle kiosk sign-in if the staff member has no employee ID set? (Staff member should not appear on kiosk list or show as "cannot use kiosk — contact admin.")
- What happens if a staff member checks in on the kiosk but the admin has already recorded manual attendance for that day? (Kiosk action should update the existing record.)
- What happens when check-out time is earlier than check-in time? (System should reject the record with a validation error.)
- What happens when a staff member in "suspended," "resigned," or "retired" status is selected on the kiosk? (System must reject the action and display an appropriate message.)
- What if no staff members have employee IDs set when kiosk mode is first enabled? (Kiosk page should show a helpful message telling admin to configure employee IDs.)

---

## Requirements *(mandatory)*

### Functional Requirements

#### Staff Module

- **FR-001**: System MUST enforce a unique employee ID per staff member within a tenant; employee ID is required to use the kiosk and SHOULD be set at or shortly after staff creation.
- **FR-002**: System MUST support employment status values: active, on_leave, suspended, resigned, retired. Only "active" staff appear in kiosk staff lists and daily attendance tracking.
- **FR-003**: System MUST prevent hard deletion of any staff member who has linked attendance or leave records, and MUST present deactivation (status change) as an alternative.
- **FR-004**: System MUST allow admins to search staff by name, email, or employee ID, and filter by department, teaching type, and employment status.
- **FR-005**: Staff records MUST capture: first name, last name, email, phone, date of birth, address, position, department, is_teaching flag, hire date, employment status, employee ID, and optional next-of-kin details (name, relationship, phone, email, address).

#### Staff Attendance

- **FR-006**: System MUST calculate work hours as the elapsed time between check-in and check-out, stored in decimal hours, when both values are present.
- **FR-007**: System MUST automatically assign "late" status when a staff member's check-in time exceeds the tenant-configured work start time.
- **FR-008**: System MUST allow only one attendance record per staff member per date. A second check-in or manual entry for the same staff-day MUST update the existing record rather than creating a duplicate.
- **FR-009**: Admins MUST be able to create, edit, and delete any attendance record for any staff member on any date from the admin attendance management view.
- **FR-010**: Leave type values MUST be consistent between the database and the application interface; the supported leave types are: annual, sick, maternity, paternity, study, unpaid, compassionate.

#### Kiosk Mode

- **FR-011**: System MUST provide an admin-controlled toggle to enable or disable kiosk mode per tenant, accessible from the Settings page.
- **FR-012**: When kiosk mode is enabled, a dedicated kiosk page MUST be accessible at a stable URL without requiring a staff login session.
- **FR-013**: The kiosk page MUST display only active staff members who have an employee ID set, in a searchable or scrollable list showing their name.
- **FR-014**: Staff MUST confirm their identity on the kiosk by entering their employee ID before any sign-in or sign-out action is recorded.
- **FR-015**: The kiosk page MUST show the contextually correct action per staff member: "Sign In" if not checked in today, "Sign Out" if checked in but not checked out, or a "Completed" state if both are recorded.
- **FR-016**: When kiosk mode is disabled, the kiosk page MUST be inaccessible and display a clear message indicating that kiosk mode is not active.
- **FR-017**: Attendance records created via the kiosk MUST be visible and editable through the admin attendance management view, identical in structure to manually entered records.
- **FR-018**: After a successful kiosk sign-in or sign-out, the page MUST display a brief confirmation and then automatically return to the staff list, ready for the next user.
- **FR-019**: Staff members with employment status other than "active," or without an employee ID, MUST NOT appear in the kiosk staff list.

### Key Entities

- **Staff**: Represents an employee of the school. Key attributes: unique employee ID, first and last name, email, department, position, employment status, teaching flag, hire date, next-of-kin. Scoped to a tenant.
- **StaffAttendanceRecord**: Represents a single day's attendance for one staff member. Attributes: date, check-in time, check-out time, status (present, absent, late, half_day, on_leave), computed work hours, remarks, and source (manual vs kiosk). One record per staff per date enforced.
- **LeaveRequest**: Represents a formal leave application. Attributes: leave type, start date, end date, number of days, reason, status (pending, approved, rejected), reviewer, review date, review notes. Linked to a staff member and tenant.
- **TenantSettings**: Tenant-level configuration. Includes: work start time, work end time, kiosk mode enabled flag. Drives attendance logic and feature gating.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Staff members can complete a kiosk sign-in or sign-out in under 30 seconds from arriving at the screen to seeing a confirmation.
- **SC-002**: All attendance records created via the kiosk are immediately visible in the admin attendance records view with no manual refresh required.
- **SC-003**: Zero duplicate attendance records exist for any staff member on any given date after the redo is complete.
- **SC-004**: Leave type values displayed in the admin interface exactly match the values accepted and stored by the system, with no mismatches.
- **SC-005**: Admin can enable or disable kiosk mode and the kiosk page reflects the change within one page load.
- **SC-006**: Inactive, suspended, resigned, and retired staff never appear in the kiosk staff list or active daily attendance tracking.
- **SC-007**: Attendance records with both check-in and check-out display correct work hours, with no rounding errors greater than 1 minute.
- **SC-008**: Admin can successfully find any staff member using name, email, or employee ID search within 2 seconds of typing.

---

## Assumptions

- The kiosk page runs on a shared, trusted device managed by the school (not a personal device); therefore, employee ID confirmation alone is sufficient identity verification, and the page is accessible without a full login session.
- Only one kiosk mode setting exists per tenant (all-or-nothing); there is no per-department or per-location kiosk configuration in this version.
- The kiosk page does not require offline/network-resilience support; it assumes stable connectivity on the school's internal network.
- Leave types are standardised to: annual, sick, maternity, paternity, study, unpaid, compassionate. The database will be migrated to align with these values (replacing the old set: sick, vacation, personal, maternity, paternity, unpaid).
- Work start time defaults to 08:30 if not configured in tenant settings; this threshold determines "late" vs "present."
- The kiosk page is a dedicated route that does not share the authenticated admin layout; it reads the kiosk-enabled status from a public or minimally-authenticated API endpoint.
- Staff members without an employee ID set cannot use the kiosk and are excluded from the kiosk staff list; admins will be able to set employee IDs from the staff management screen.
- The existing mobile-responsive admin views for staff management and attendance are retained and must remain fully functional after the redo.
