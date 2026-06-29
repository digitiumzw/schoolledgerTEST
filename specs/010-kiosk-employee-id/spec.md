# Feature Specification: Kiosk Employee ID & Redesign

**Feature Branch**: `010-kiosk-employee-id`  
**Created**: 2026-04-06  
**Status**: Draft  
**Input**: User description: "When staff use the attendance kiosk, they must log in using their Employee ID. The Employee ID should be automatically generated whenever a new staff member is added to the system. On the Staff Profile page, there should be a clearly visible section that displays the Employee ID of that staff member. Please redesign the attendance kiosk interface to make it more user-friendly and intuitive. The attendance system should also use the Work Hours Configuration settings to determine attendance behavior. Additionally, the kiosk URL should not display the Tenant ID in the address. The Tenant ID should be hidden from the URL."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Staff Member Checks In via Kiosk (Priority: P1)

A staff member walks up to the shared kiosk device. They are presented with a clean, welcoming interface that shows the school name and current time. They type their Employee ID into a prominent input field and tap "Check In". The system greets them by name, confirms the action, and shows their recorded check-in time. If they are late relative to the configured work start time, the system notes this without shaming language.

**Why this priority**: This is the core daily workflow. Every other story depends on this working correctly and feeling natural.

**Independent Test**: A staff member with a known Employee ID can approach the kiosk, enter their ID, check in, and receive a clear confirmation screen — without any other stories being implemented.

**Acceptance Scenarios**:

1. **Given** a staff member with an assigned Employee ID approaches the kiosk, **When** they enter their Employee ID and confirm check-in, **Then** the system records the check-in time, shows a personalized welcome message with their name, and displays whether they are on time or late based on the configured work start time.
2. **Given** a staff member has already checked in today, **When** they enter their Employee ID again, **Then** the system presents a check-out option (not a duplicate check-in).
3. **Given** a staff member enters an incorrect or unrecognized Employee ID, **When** they attempt to check in, **Then** the system shows a clear, friendly error message and returns to the entry screen without logging any record.
4. **Given** the configured work start time is 08:30, **When** a staff member checks in at 08:45, **Then** their attendance status is recorded as "late".
5. **Given** the configured work start time is 08:30, **When** a staff member checks in at 08:20, **Then** their attendance status is recorded as "present".

---

### User Story 2 - Employee ID Automatically Assigned on Staff Creation (Priority: P1)

An administrator adds a new staff member through the staff management interface. Upon saving, the new staff member is automatically assigned a unique Employee ID (e.g., EMP0042) without the administrator needing to enter one manually. The ID appears immediately in the staff record and on the staff profile.

**Why this priority**: Kiosk login depends entirely on Employee IDs existing. Without auto-generation, new staff cannot use the kiosk until an admin manually assigns an ID — a friction point that risks operational failures.

**Independent Test**: Create a new staff member through the admin interface and verify that the resulting staff record includes a non-empty, unique Employee ID in a consistent format (e.g., "EMP" followed by a zero-padded number).

**Acceptance Scenarios**:

1. **Given** an administrator completes and saves a new staff member form, **When** the record is created, **Then** the system automatically assigns a unique Employee ID in the format `EMP` followed by a zero-padded sequential number (e.g., EMP0042).
2. **Given** multiple staff members are created in rapid succession, **When** each record is saved, **Then** each receives a distinct Employee ID with no collisions.
3. **Given** a staff member already exists with Employee ID EMP0041, **When** a new staff member is added, **Then** the new member receives EMP0042 (or the next available number), not a duplicate.
4. **Given** a staff member already has an Employee ID, **When** their profile is edited, **Then** the Employee ID remains unchanged (it is not regenerated or editable by the admin).

---

### User Story 3 - Employee ID Displayed Prominently on Staff Profile (Priority: P2)

An administrator or HR manager views a staff member's profile page. Near the top of the profile — alongside the staff member's name and role — there is a clearly labelled "Employee ID" section that shows the ID in a visually distinct style, making it easy to communicate to the staff member or reference in print.

**Why this priority**: Staff need to know their Employee ID to use the kiosk. The profile page is the canonical place to find it. Without this, staff must contact admin every time they forget their ID.

**Independent Test**: Navigate to any staff profile and confirm the Employee ID appears in a dedicated, clearly labelled section that is visible without scrolling.

**Acceptance Scenarios**:

1. **Given** a staff member has an assigned Employee ID, **When** an authorized user views their profile page, **Then** the Employee ID is displayed in a prominent, clearly labelled section near the top of the profile (above the tab navigation).
2. **Given** the Employee ID section is visible, **When** a user looks at the profile, **Then** the ID is styled distinctly (e.g., badge or highlighted card element) to differentiate it from regular text fields.
3. **Given** a staff member's profile is open, **When** the user wants to share the Employee ID, **Then** the ID can be copied to clipboard via a copy action or is easily selectable.

---

### User Story 4 - Kiosk URL Hides Tenant ID (Priority: P2)

A school administrator shares the kiosk URL with IT staff to set up on a shared tablet. The URL they share (and that appears in the browser address bar) does not reveal the internal Tenant ID. Instead, it uses a human-readable or opaque short code that the system resolves internally.

**Why this priority**: Exposing the internal Tenant ID in URLs is a security and privacy concern. Multi-tenant systems should not leak internal identifiers. This also improves URL aesthetics for sharing.

**Independent Test**: Open the kiosk URL and confirm the browser address bar does not show a `tenant_id` query parameter. The kiosk still loads and functions correctly for the correct tenant.

**Acceptance Scenarios**:

1. **Given** an administrator opens the Settings page, **When** they view the kiosk URL, **Then** the displayed URL uses a short opaque code (e.g., `/kiosk/abc123`) instead of `?tenant_id=uuid`.
2. **Given** a kiosk URL with the opaque code is opened in a browser, **When** the page loads, **Then** the correct tenant's kiosk is displayed without the Tenant ID appearing anywhere in the address bar.
3. **Given** an invalid or non-existent kiosk code is entered in the URL, **When** the page loads, **Then** the system shows a friendly "Kiosk not found" message rather than exposing error details.
4. **Given** an existing kiosk URL with `?tenant_id=` (legacy format), **When** it is accessed, **Then** the system handles it gracefully without breaking existing setups.

---

### User Story 5 - Kiosk Uses Work Hours Settings for Attendance Behavior (Priority: P2)

The school configures work start time as 07:45 and end time as 16:30 in Settings. When staff check in at the kiosk, their punctuality is evaluated against 07:45. The kiosk also displays the configured shift hours so staff can see the expected schedule at a glance.

**Why this priority**: Attendance status is only meaningful when evaluated against the actual configured schedule. Without this integration, the system may use incorrect default times that do not match the school's actual operating hours.

**Independent Test**: Change work start time in Settings to 07:00, then check in a staff member at 07:30 and verify they are marked "present". Change start time to 09:00 and repeat — the same 07:30 check-in should now appear on a different day with a different evaluation.

**Acceptance Scenarios**:

1. **Given** the work start time is configured as 07:45, **When** a staff member checks in at 07:50, **Then** their status is recorded as "late".
2. **Given** the work start time is configured as 07:45, **When** a staff member checks in at 07:40, **Then** their status is recorded as "present".
3. **Given** work end time is configured as 16:30, **When** a staff member checks out at 15:00, **Then** the system records the actual checkout time and flags it as an early departure.
4. **Given** the kiosk page is open, **When** a staff member looks at the kiosk display, **Then** the configured shift start and end times are shown on the kiosk interface.
5. **Given** work hours settings are updated by an admin, **When** the next kiosk check-in occurs, **Then** the updated times are used (not the previous values).

---

### Edge Cases

- What happens when a staff member tries to check in but the kiosk mode is disabled in settings?
- What happens when two staff members attempt to use the kiosk at the same moment?
- How does the system handle a staff member who checks out before ever checking in on that day?
- What if the Employee ID format changes in the future — do existing IDs remain valid?
- What happens if work hours settings are not yet configured (first-time tenant setup)?
- How does the kiosk behave on a slow or intermittent network connection?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST automatically generate a unique Employee ID for every new staff member at the moment their record is created.
- **FR-002**: Employee IDs MUST follow the format `EMP` followed by a zero-padded sequential number (e.g., EMP0001, EMP0042).
- **FR-003**: Employee IDs MUST be immutable after generation — they cannot be edited by administrators or regenerated.
- **FR-004**: The staff profile page MUST display the Employee ID in a clearly labelled, visually prominent section visible without scrolling (in the profile header area, above tabs).
- **FR-005**: Staff members MUST be able to log in to the attendance kiosk using only their Employee ID (no password required).
- **FR-006**: The kiosk interface MUST display the school name, current date and time, and the configured shift hours (start and end times from Work Hours Configuration).
- **FR-007**: The kiosk MUST evaluate check-in punctuality against the Work Hours Configuration start time and record status as "present" (on time) or "late" accordingly.
- **FR-008**: The kiosk MUST evaluate check-out time against the Work Hours Configuration end time and flag early departures for checkout occurring more than 30 minutes before the configured end time.
- **FR-009**: The kiosk URL MUST use an opaque, non-guessable short code instead of exposing the internal Tenant ID as a query parameter.
- **FR-010**: The kiosk short code MUST be tenant-specific and persistently stored; it MUST be accessible from the Settings page for copying and sharing.
- **FR-011**: The kiosk interface MUST follow a clear, single-step interaction flow: idle screen → ID entry → confirmation → auto-return to idle.
- **FR-012**: The confirmation screen MUST display the staff member's name, the recorded time, and their punctuality status (on time / late / early departure).
- **FR-013**: The kiosk idle screen MUST return automatically after a fixed period (10 seconds) following a successful check-in or check-out.
- **FR-014**: The system MUST show a clear, friendly error when an unknown Employee ID is entered at the kiosk, without revealing information about other staff IDs.
- **FR-015**: If work hours settings have not been configured, the kiosk MUST use system defaults (08:30 start, 17:00 end) and still function without errors.
- **FR-016**: Existing staff without an Employee ID MUST have IDs backfilled automatically so they can use the kiosk without manual admin intervention.

### Key Entities

- **Employee ID**: A unique, system-generated identifier (format: `EMP` + zero-padded number) assigned to each staff member at creation. Immutable after assignment. Used as the primary login credential at the kiosk.
- **Kiosk Access Code**: A short, opaque, tenant-specific code used in the kiosk URL instead of the Tenant ID. Generated once per tenant, stored in tenant settings, and shared with IT/staff via the Settings page.
- **Work Hours Configuration**: A tenant-level setting defining the expected shift start time and end time. Used to evaluate attendance status (on time, late, early departure) at kiosk check-in and check-out.
- **Staff Attendance Record**: A daily record per staff member capturing check-in time, check-out time, computed status (present/late/absent/on leave/early departure), work hours duration, and the source (kiosk or manual).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of newly created staff members receive a unique Employee ID automatically — zero manual ID assignment steps required by administrators.
- **SC-002**: Staff can complete a kiosk check-in in under 20 seconds from screen wake to confirmation display.
- **SC-003**: The kiosk URL displayed in Settings contains no internal identifier (tenant UUID or numeric ID) visible in the address bar.
- **SC-004**: Attendance punctuality status (present/late) reflects the live Work Hours Configuration — a change to the start time in Settings is applied to the next check-in without any additional steps.
- **SC-005**: The Employee ID is visible on every staff profile page without requiring scrolling or tab navigation.
- **SC-006**: 95% of kiosk interactions (check-in/check-out) complete without error when a valid Employee ID is entered.
- **SC-007**: All existing staff with no Employee ID have IDs backfilled without data loss or manual intervention.

## Assumptions

- The `employee_id` column already exists on the `staff` table; this feature ensures it is always populated at creation time and treated as non-nullable for new records going forward.
- Existing staff without an Employee ID will have IDs backfilled via a database migration using the same sequential `EMP` format.
- The kiosk short code will be an alphanumeric token (e.g., 8–12 characters) stored in tenant settings; the kiosk URL format will change from `/kiosk?tenant_id=uuid` to `/kiosk/{code}`.
- The kiosk interface redesign targets devices with a screen width of 768px or wider (tablet or desktop), as kiosks are shared devices rather than personal phones.
- "Prominent placement" of the Employee ID on the staff profile means it appears in the header card area alongside name and role — immediately visible on page load without scrolling.
- Work hours settings already exist in the system (`staffWorkHours.startTime` and `staffWorkHours.endTime` in tenant settings); this feature uses them as the authoritative source for attendance evaluation rather than any hardcoded defaults.
- Kiosk mode must still be explicitly enabled by an administrator in Settings before the kiosk URL becomes active.
- The legacy `?tenant_id=` URL format will be supported during a transitional period to avoid breaking existing kiosk tablet setups.
- The kiosk does not require a staff member to enter a password — Employee ID alone is sufficient for kiosk access (lower-security shared device context).
