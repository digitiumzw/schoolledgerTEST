# Feature Specification: Fix Driver Kiosk Bugs and URI Format

**Feature Branch**: `016-fix-driver-kiosk`  
**Created**: 2026-04-07  
**Status**: Draft  
**Input**: User description: "fix the bugs in the driver kiosk, and the driver kiosk should use the same uri format like the students attendence"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Driver accesses kiosk via consistent URL format (Priority: P1)

An administrator shares a driver kiosk URL with drivers. Today the URL is `/kiosk/driver/:code`, while the student attendance kiosk uses `/kiosk/:code/students`. The driver kiosk URL must be changed to `/kiosk/:code/driver` so all kiosks follow the same pattern: kiosk code first, then kiosk type as a suffix.

**Why this priority**: Consistency in URL structure makes it easier for administrators to manage and share kiosk links. It also aligns with the established pattern for the student attendance kiosk.

**Independent Test**: Navigate to `/kiosk/ABC123/driver` — the driver kiosk should load. Navigate to the old `/kiosk/driver/ABC123` — it should show a 404 Not Found page.

**Acceptance Scenarios**:

1. **Given** a valid kiosk code `ABC123`, **When** a driver navigates to `/kiosk/ABC123/driver`, **Then** the Driver Kiosk idle/login screen is shown.
2. **Given** the old URL format `/kiosk/driver/ABC123`, **When** a user navigates to it, **Then** the 404 Not Found page is displayed.
3. **Given** both `/kiosk/:code/students` and `/kiosk/:code/driver` routes exist, **When** both are accessed with valid codes, **Then** each shows the correct kiosk without conflict.

---

### User Story 2 - Driver sees errors when route roster fails to load (Priority: P2)

When a driver selects a route from the routes list and the roster fails to load (e.g. network error), the error message must be displayed visibly within the routes view. Currently, the error is stored in state (`idError`) that is only rendered in the idle/login view, so the error is never visible to the driver.

**Why this priority**: Silent errors cause confusion — drivers cannot tell whether the kiosk is broken or loading. Visible error feedback is essential for a self-service terminal.

**Independent Test**: Simulate a network failure when a driver selects a route. A clear error message must appear on the routes screen. The driver can dismiss it and try again.

**Acceptance Scenarios**:

1. **Given** a driver is on the routes screen, **When** they tap a route and the server returns an error, **Then** an error message is displayed within the routes screen (not silently lost).
2. **Given** an error message is displayed on the routes screen, **When** the driver taps the back button or retries, **Then** the error message is cleared.

---

### User Story 3 - Invalid kiosk code shows an error at page load (Priority: P3)

When someone navigates to `/kiosk/BADCODE/driver` with an invalid kiosk code, the page should immediately validate the code and display an error, the same way the student attendance kiosk does. Currently the driver kiosk skips this initial check and only fails when the driver tries to submit their employee ID.

**Why this priority**: Immediate feedback prevents drivers from wasting time entering their employee ID when the kiosk itself is misconfigured or the URL is wrong.

**Independent Test**: Navigate to `/kiosk/INVALIDCODE/driver`. Without any further user interaction, the page must show a "Kiosk Unavailable" error explaining the code is invalid.

**Acceptance Scenarios**:

1. **Given** an invalid kiosk code in the URL, **When** the page loads, **Then** the error screen is displayed with a descriptive message — no employee ID prompt is shown.
2. **Given** a valid kiosk code, **When** the page loads, **Then** the idle/employee ID entry screen is displayed normally.
3. **Given** a network failure on page load, **When** the kiosk status check cannot complete, **Then** a network error screen is shown with a Retry button.

---

### Edge Cases

- What happens when `/kiosk/:code` matches both the staff attendance kiosk and could ambiguously match `/kiosk/:code/driver` child patterns? The route ordering in the router must place `/kiosk/:code/driver` before `/kiosk/:code` so the more specific path wins.
- What happens when the kiosk code is valid but the driver has no assigned routes? The routes view should display an empty state message, not an error.
- What happens when the driver's employee ID is valid but they have been deactivated since last use? The backend must reject with a 403 and the idle view must display the error inline.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The driver kiosk page MUST be accessible at the URL `/kiosk/:code/driver`, where `:code` is the opaque kiosk code — matching the pattern used by the student attendance kiosk (`/kiosk/:code/students`).
- **FR-002**: The old driver kiosk URL format `/kiosk/driver/:code` MUST no longer be a registered route — any access to that path MUST result in the 404 Not Found page.
- **FR-003**: On page load, the driver kiosk MUST validate the kiosk code against the backend before showing the employee ID entry screen. If the code is invalid or the request fails, an error screen MUST be displayed.
- **FR-004**: When a driver selects a route and the roster fails to load, the error message MUST be displayed within the routes view, visible to the driver without any view transition.
- **FR-005**: When a roster load error is shown in the routes view, the driver MUST be able to dismiss or retry without returning to the employee ID entry screen.
- **FR-006**: Route ordering in the frontend router MUST ensure `/kiosk/:code/driver` is registered before `/kiosk/:code` to prevent route shadowing.

### Key Entities

- **Kiosk Code**: An opaque identifier (stored in tenant settings) that scopes all kiosk operations to a specific school tenant. It appears as the `:code` segment in the URL.
- **Driver Kiosk Session**: A transient, unauthenticated session started when a driver enters their employee ID. It holds driver identity and routes list until reset by idle timeout or explicit logout.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Navigating to `/kiosk/VALIDCODE/driver` loads the driver kiosk in under 3 seconds on a standard school network connection.
- **SC-002**: Navigating to `/kiosk/driver/VALIDCODE` (old format) consistently results in the 404 Not Found page — verified across all supported browsers.
- **SC-003**: When an invalid kiosk code is used, the error screen appears within 5 seconds of page load with no additional user input.
- **SC-004**: A roster load error is visible to the driver within 3 seconds of the failed request, without requiring a page reload or view change.
- **SC-005**: 100% of driver kiosk URL interactions use the new `/kiosk/:code/driver` format after the change is deployed.

## Assumptions

- The backend API endpoints (`POST /api/kiosk/driver/validate` and `GET /api/kiosk/driver/routes/:code`) remain unchanged — only the frontend page URL is being changed.
- The existing `/api/kiosk/status/:code` endpoint (used by the staff kiosk) is reused to validate the kiosk code on page load for the driver kiosk, since it resolves any valid tenant kiosk code.
- The driver kiosk does not require authentication and remains a fully public page.
- The 2-minute idle timeout behaviour is preserved as-is.
- Mobile browser support is not in scope for this fix; the kiosk is assumed to run on a fixed tablet or desktop terminal.
