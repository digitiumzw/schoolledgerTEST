# Feature Specification: Driver Kiosk Toggle and Transport Payment Indicators

**Feature Branch**: `017-driver-kiosk-transport-payment`  
**Created**: 2026-04-07  
**Status**: Draft  
**Input**: User description: "as an admin i want to be able to turn on the kiosk mode for drivers in the settings and view the url. and when i view the route students i want the system to mark students who have not paid for the transport."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin enables driver kiosk and retrieves its URL (Priority: P1)

An administrator navigates to Settings and finds a dedicated kiosk management section. They can toggle the driver kiosk on or off per school. When the kiosk is enabled, the full shareable URL for the driver kiosk is displayed so the admin can copy and distribute it to drivers.

**Why this priority**: Without the ability to enable/disable the driver kiosk from settings, the admin has no central control point over kiosk access. This is the foundational control needed before any driver can use the kiosk.

**Independent Test**: An admin goes to Settings → Kiosks, enables the driver kiosk, and sees the kiosk URL displayed. Navigating to that URL in an unauthenticated browser tab loads the driver kiosk login screen.

**Acceptance Scenarios**:

1. **Given** an admin is on the Settings page, **When** they navigate to the Kiosks section, **Then** they see a driver kiosk toggle (enabled/disabled) and the school's kiosk code.
2. **Given** the driver kiosk is disabled, **When** the admin enables it and saves, **Then** the full driver kiosk URL is displayed and is copyable.
3. **Given** the driver kiosk is enabled, **When** the admin disables it and saves, **Then** the URL is hidden and the driver kiosk page shows an "unavailable" message to anyone who visits it.
4. **Given** the kiosk URL is displayed, **When** the admin copies it, **Then** the URL follows the format `/kiosk/:code/driver` consistent with existing kiosk URL patterns.

---

### User Story 2 - Admin views route students with transport payment status (Priority: P2)

When an admin opens a transport route to view its assigned students, each student in the list is visually marked to indicate whether they have an outstanding (unpaid) transport fee for the current month. This helps the admin and drivers quickly identify which students are not up to date with transport payments.

**Why this priority**: Without payment indicators, the route roster is purely a headcount list. Payment status visibility allows administrators to enforce payment policies before students board the bus, which is a core financial management need.

**Independent Test**: Open any route detail view that has at least one student with an unpaid transport charge and one with a paid charge. The unpaid student shows a clear visual indicator (e.g., a warning badge or icon); the paid student shows a paid/clear indicator or no indicator.

**Acceptance Scenarios**:

1. **Given** a route has assigned students, **When** the admin views the route detail, **Then** each student row shows their transport payment status for the current billing period.
2. **Given** a student has an outstanding transport charge, **When** their row is displayed, **Then** a "Unpaid" or warning indicator is clearly visible next to their name.
3. **Given** a student has fully paid their transport charge, **When** their row is displayed, **Then** a "Paid" or clear indicator is shown, or no warning is shown.
4. **Given** a student has no transport charge generated yet for the current period, **When** their row is displayed, **Then** the system shows a "No charge" or neutral state, distinct from paid and unpaid.
5. **Given** the route has many students, **When** the admin views the list, **Then** the payment status does not significantly delay the modal from loading (within 3 seconds on a standard connection).

---

### Edge Cases

- What happens when the kiosk code has not been generated yet for the tenant? The settings page must show a "Generate kiosk code" action before displaying the toggle.
- What happens when the admin enables the driver kiosk but no driver staff records exist? The kiosk URL is still shown; accessing it will prompt for an employee ID (the driver record lookup happens at kiosk login time, not at enable time).
- What happens when a student is assigned to a route but no transport charges have been generated for the current month? This must be shown as a distinct "No charge" state, not as "Paid."
- What happens when the route detail is viewed mid-month after some payments have been partially made? The system shows the net balance state: if any balance remains, it is "Unpaid."
- What happens if the payment status fetch fails? The route detail modal should still render the student list, but show a neutral placeholder for each student's payment status rather than blocking the entire view.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Settings page MUST include a Kiosks section accessible to admins and super admins.
- **FR-002**: The Kiosks settings section MUST display a driver kiosk enable/disable toggle that persists its state per tenant.
- **FR-003**: When the driver kiosk is enabled, the system MUST display the full, copyable driver kiosk URL using the `/kiosk/:code/driver` format.
- **FR-004**: When the driver kiosk is disabled, navigating to the driver kiosk URL MUST result in a clear "kiosk unavailable" message — the kiosk login screen MUST NOT be shown.
- **FR-005**: The kiosk URL displayed in settings MUST automatically reflect the correct kiosk code for the tenant without requiring manual entry by the admin.
- **FR-006**: The route detail view MUST display a transport payment status indicator for each assigned student.
- **FR-007**: The payment status indicator MUST distinguish between three states: Paid, Unpaid (balance outstanding), and No Charge (no transport charge generated for the current period).
- **FR-008**: The "Unpaid" state MUST be visually distinct and prominent enough to be recognisable at a glance without reading text (e.g., colour or icon differentiation).
- **FR-009**: If the payment status data cannot be fetched, the route detail view MUST still render with the student list, showing a neutral/unknown indicator per student rather than an error screen.
- **FR-010**: The payment status shown in the route detail view MUST reflect the current billing period (current month), not historical periods.

### Key Entities

- **Kiosk Settings**: Per-tenant configuration record that stores the kiosk code and enabled/disabled state for each kiosk type (driver, student attendance).
- **Transport Charge**: A charge levied against a student for the current month on a specific route. Used to derive the payment status (paid / unpaid / no charge).
- **Route Student Roster**: The list of students assigned to a transport route, enriched with payment status for display in the route detail view.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can enable the driver kiosk and obtain a shareable URL in under 30 seconds without leaving the Settings page.
- **SC-002**: The driver kiosk URL displayed in settings successfully loads the driver kiosk when opened in a browser — verified for 100% of tenants with the kiosk enabled.
- **SC-003**: When a driver kiosk is disabled, 100% of attempts to access the kiosk URL result in an "unavailable" message rather than the kiosk login screen.
- **SC-004**: The route detail modal displays payment status for all assigned students within 3 seconds of opening on a standard school network connection.
- **SC-005**: An admin can visually identify all unpaid students on a route without reading every row's text — differentiated by colour or icon — confirmed by usability review.
- **SC-006**: Zero instances of the payment status display blocking or crashing the route detail view when payment data is unavailable.

## Assumptions

- The tenant already has a kiosk code stored in the backend (established in the existing kiosk implementation). If not, the settings UI will surface a way to generate one rather than assume one exists.
- Transport payment status is derived from the existing charges and payments tables — specifically, for each student, whether the sum of payments covering their current-month transport charge equals or exceeds the charge amount.
- "Current billing period" means the current calendar month, consistent with how transport charges are generated via the existing monthly charge generation feature.
- The route detail modal already exists (`RouteDetailModal`) and shows assigned students; this feature enriches that view rather than replacing it.
- The driver kiosk enable/disable state is stored server-side per tenant and enforced by the backend kiosk validation endpoint — the frontend toggle is not purely cosmetic.
- Mobile-specific layout optimisation for the kiosk settings section is out of scope; the existing Settings page responsive layout is sufficient.
