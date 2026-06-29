# Feature Specification: Driver Kiosk View-Only Access

**Feature Branch**: `055-driver-kiosk-viewonly`  
**Created**: 2026-04-30  
**Status**: Draft  
**Input**: User description: "Allow the driver to log in to the kiosk using their Employee ID. Once logged in, the driver should be able to view the bus assigned to them, along with its routes and corresponding stops. The driver should also be able to see the active students assigned to those routes. This access must be strictly view-only, meaning the driver can see route details, student information, and their respective stops without making any changes. Additionally, include a feature that allows the driver to select an option to view only the students who have paid for transport for a specific route, ensuring they can identify and transport only those eligible students."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Driver Login via Employee ID (Priority: P1)

As a bus driver, I want to log into the driver kiosk using my Employee ID so that I can securely access my assigned bus and route information.

**Why this priority**: Authentication is the foundational step that enables all other driver functionality. Without secure login, no driver data access can occur.

**Independent Test**: Can be tested by verifying a driver with valid Employee ID can authenticate and access the kiosk dashboard. Delivers secure, role-based access to driver-specific information.

**Acceptance Scenarios**:

1. **Given** a driver with a valid Employee ID exists in the system, **When** the driver enters their Employee ID on the kiosk login screen, **Then** they are authenticated and redirected to their dashboard showing assigned bus information.
2. **Given** a driver enters an invalid or non-existent Employee ID, **When** they attempt to log in, **Then** the system displays an appropriate error message and denies access.
3. **Given** a driver has successfully logged in, **When** they are inactive for a specified timeout period, **Then** the system automatically logs them out for security purposes.

---

### User Story 2 - View Assigned Bus and Routes (Priority: P1)

As a logged-in driver, I want to view the bus assigned to me along with all its routes and stops so that I know my daily transportation responsibilities.

**Why this priority**: This is the core value proposition of the kiosk - providing drivers with immediate visibility into their assignments without requiring administrative assistance.

**Independent Test**: Can be tested by verifying a logged-in driver can see their bus details, route list, and stop sequence. Delivers operational clarity for daily transportation tasks.

**Acceptance Scenarios**:

1. **Given** a driver is logged in and has a bus assigned, **When** they view the dashboard, **Then** they see their bus details (vehicle number, capacity, etc.) and the complete list of routes assigned to that bus.
2. **Given** a driver is viewing a specific route, **When** they expand or select the route, **Then** they see all stops in the correct sequence with stop names and estimated arrival times.
3. **Given** a driver has no bus assigned, **When** they log in, **Then** the system displays a clear message indicating no assignment exists.

---

### User Story 3 - View Active Students on Routes (Priority: P1)

As a logged-in driver, I want to see all active students assigned to my routes with their respective stop information so that I can manage student pickups and drop-offs effectively.

**Why this priority**: Student safety and accountability is paramount. Drivers need accurate, up-to-date student rosters to ensure no students are missed or incorrectly transported.

**Independent Test**: Can be tested by verifying a driver can view a complete list of students per route with their pickup/drop-off stops. Delivers student safety and operational efficiency.

**Acceptance Scenarios**:

1. **Given** a driver is viewing a specific route, **When** they access the student list, **Then** they see all active students assigned to that route with their names and assigned stops.
2. **Given** a student is assigned to a route but has an inactive status (withdrawn, suspended, etc.), **When** the driver views the student list, **Then** that student does not appear in the active roster.
3. **Given** a driver is viewing the student list, **When** they examine a student's details, **Then** they can see the student's pickup stop, drop-off stop, and any special instructions (if available).

---

### User Story 4 - Filter Students by Payment Status (Priority: P2)

As a logged-in driver, I want to filter the student list to show only those who have paid for transport on a specific route so that I can ensure only eligible, paid students are transported.

**Why this priority**: This prevents transportation of non-paying students and helps drivers enforce payment compliance without needing to manually check payment records.

**Independent Test**: Can be tested by verifying the paid-only filter correctly shows/hides students based on their transport payment status. Delivers compliance enforcement and reduces revenue leakage.

**Acceptance Scenarios**:

1. **Given** a driver is viewing students on a route, **When** they activate the "Paid Only" filter, **Then** the list updates to show only students who have an active, paid transport assignment for the current billing period.
2. **Given** the "Paid Only" filter is active, **When** a student with unpaid transport status exists on the route, **Then** that student is hidden from the filtered view.
3. **Given** the driver has applied the "Paid Only" filter, **When** they deactivate the filter, **Then** the full student list (including unpaid) is displayed again.
4. **Given** no students on a route have paid transport status, **When** the driver applies the "Paid Only" filter, **Then** an appropriate "No paid students found" message is displayed.

---

### Edge Cases

- What happens when a driver's Employee ID is associated with multiple buses (job sharing, backup assignments)?
- How does the system handle a bus assignment that becomes inactive mid-day (bus breakdown, reassignment)?
- What happens when a student is marked as active but has no valid stop assignment?
- How does the system handle route stops that have no students assigned?
- What happens when the "Paid Only" filter is applied but the driver's route has no transport charges configured?
- How does the kiosk behave when the driver attempts to access it outside of scheduled route hours?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST authenticate drivers using their unique Employee ID as the login credential.
- **FR-002**: The system MUST provide a dedicated kiosk interface optimized for tablet or large-screen devices.
- **FR-003**: The system MUST display only the bus currently assigned to the logged-in driver.
- **FR-004**: The system MUST show all routes associated with the driver's assigned bus.
- **FR-005**: The system MUST display all stops for each route in the correct sequence order.
- **FR-006**: The system MUST display active students assigned to each route with their respective pickup and drop-off stops.
- **FR-007**: The system MUST strictly enforce view-only access - no create, update, or delete operations are permitted from the kiosk interface.
- **FR-008**: The system MUST provide a toggle or filter option to display only students with confirmed transport payment status.
- **FR-009**: The system MUST automatically log out drivers after a configurable period of inactivity for security.
- **FR-010**: The system MUST handle cases where a driver has no bus assignment with a clear informational message.
- **FR-011**: The system MUST handle invalid login attempts with appropriate error messaging and without revealing whether the Employee ID exists.
- **FR-012**: The system MUST only display students with an active enrollment status (withdrawn or suspended students must be excluded).

### Key Entities *(include if feature involves data)*

- **Driver**: A staff member with Employee ID, name, contact information, and an optional bus assignment. Represents the kiosk user.
- **Bus**: A vehicle with vehicle number, capacity, and assigned driver. The primary transport unit visible to drivers.
- **Route**: A transportation path with name, description, and associated bus. Contains multiple stops in sequence.
- **Stop**: A pickup/drop-off location with name, address, sequence order within a route, and estimated arrival time.
- **Student**: An enrolled pupil with name, student ID, enrollment status, and assigned route/stop information.
- **Transport Assignment**: Links a student to a route and stop with payment status, billing period, and assignment dates.
- **Transport Payment**: Records payment status for a student's transport assignment for a specific billing period.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Drivers can complete login using Employee ID within 10 seconds on the kiosk interface.
- **SC-002**: 100% of drivers with valid bus assignments can view their complete route and stop information without administrative assistance.
- **SC-003**: Student roster displayed on the kiosk matches the actual active transport assignments with 100% accuracy (verified against database).
- **SC-004**: The "Paid Only" filter correctly identifies students with paid transport status with 100% accuracy.
- **SC-005**: Zero unauthorized data modifications occur through the kiosk interface (verified by audit logs showing only read operations).
- **SC-006**: Drivers can access all relevant information (bus, routes, stops, students) within 3 taps/clicks from the dashboard.
- **SC-007**: The kiosk interface is usable on tablets with screen sizes of 10 inches and larger without horizontal scrolling.

## Assumptions

- Drivers have stable internet connectivity at the kiosk location (wired or Wi-Fi).
- Each driver has a unique Employee ID already stored in the system (no new employee management needed).
- Bus, route, and stop data is already configured in the system by administrators.
- Student transport assignments and payment status are managed through existing admin interfaces.
- The kiosk device has a modern web browser (Chrome, Safari, Edge) capable of running a web application.
- Kiosk access is strictly view-only; any changes to assignments or student data must be done through existing admin interfaces.
- The existing authentication system can be extended or adapted to support Employee ID-based login without password (kiosk mode).
- Transport payment status is determined by the existing billing/charge system already in use.
