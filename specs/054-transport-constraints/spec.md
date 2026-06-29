# Feature Specification: Transport Student Assignment Constraints & History

**Feature Branch**: `054-transport-constraints`  
**Created**: 2026-04-30  
**Status**: Ready for Review  
**Input**: User description: "In the Transport module, ensure that each student can only be assigned to one transport route at a time. Students should not be allowed to belong to multiple routes simultaneously, but they may be reassigned from one route to another when needed. Each student must also be assigned to a specific stop within their assigned route.

Students should only be removed from transport through manual deallocation by an admin, or automatically when the student's status is no longer active. Additionally, transport assignments must be stored historically, similar to class enrollments, so that any changes in routes or student assignments do not overwrite previous records. These historical transport records should be accessible from the student profile page.

In the Transport module, if no charges have been generated for a student in the current month, the system should automatically alert the admin to ensure the student is billed for that month."

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Single Route Assignment Enforcement (Priority: P1)

As an admin, when assigning a student to a transport route, the system must prevent that student from being simultaneously assigned to any other route. If the student is already on a different route, the system should require explicit reassignment (ending the old assignment before creating the new one).

**Why this priority**: This is the core constraint that ensures data integrity and prevents billing conflicts. Without this, a student could be charged multiple times or appear on multiple route manifests.

**Independent Test**: Can be tested by attempting to assign an already-assigned student to a second route and verifying the system rejects the request with a clear error message.

**Acceptance Scenarios**:

1. **Given** a student with no active transport assignment, **When** admin assigns the student to Route A with Stop 1, **Then** the assignment is created successfully and the student appears on Route A's roster
2. **Given** a student already assigned to Route A, **When** admin attempts to assign the same student to Route B, **Then** the system rejects the request with error "Student is already assigned to Route A. Please reassign instead."
3. **Given** a student assigned to Route A, **When** admin explicitly reassigns the student to Route B (which ends the Route A assignment), **Then** the Route A assignment is marked inactive with end_date set, and a new active assignment is created for Route B

---

### User Story 2 - Mandatory Stop Assignment (Priority: P1)

As an admin, when assigning a student to a transport route, I must select a specific stop from that route's available stops. The system must enforce that no student can be assigned without a designated stop.

**Why this priority**: Stop information is essential for route planning, pickup coordination, and driver manifests. Without mandatory stop assignment, drivers cannot know where to collect students.

**Independent Test**: Can be tested by attempting to create a student allocation without providing a stop_id and verifying the system rejects the request.

**Acceptance Scenarios**:

1. **Given** Route A has stops [Stop 1, Stop 2, Stop 3], **When** admin assigns a student to Route A and selects Stop 2, **Then** the assignment is created with stop_id referencing Stop 2
2. **Given** Route A has no stops configured, **When** admin attempts to assign a student to Route A, **Then** the system rejects with error "Route must have at least one stop before students can be assigned"
3. **Given** admin attempts to assign a student without selecting a stop, **Then** the system rejects with error "Stop selection is required for all student assignments"

---

### User Story 3 - Automatic Student Deallocation (Priority: P2)

As an admin, when a student's status changes from "active" to any non-active status (inactive, transferred, dropped_out, graduated), the system should automatically end their active transport assignments. This ensures inactive students are not billed for transport services they cannot use.

**Why this priority**: Prevents billing errors and ensures compliance with school policy. Manual cleanup of inactive students is error-prone and often forgotten.

**Independent Test**: Can be tested by changing a student's status to "withdrawn" and verifying their transport assignment is automatically terminated with an end_date set.

**Acceptance Scenarios**:

1. **Given** a student with active status has an active transport assignment on Route A, **When** admin changes student status to "withdrawn", **Then** the transport assignment is automatically marked inactive with end_date set to today
2. **Given** a student with active status has an active transport assignment, **When** admin changes student status to "suspended", **Then** the transport assignment is automatically terminated
3. **Given** a student with withdrawn status has no active transport assignments, **When** admin reactivates the student, **Then** no automatic transport assignment is created (manual reassignment required)

---

### User Story 4 - Transport Assignment History (Priority: P2)

As an admin viewing a student's profile, I can see a complete chronological history of the student's transport assignments, including previous routes, stops, assignment dates, and end dates. This provides auditability for billing disputes and enrollment tracking.

**Why this priority**: Historical data is essential for resolving billing disputes, understanding student movement patterns, and meeting audit requirements. Similar functionality exists for class enrollments.

**Independent Test**: Can be tested by viewing a student profile page and verifying that past transport assignments are displayed with full details.

**Acceptance Scenarios**:

1. **Given** a student was previously assigned to Route A (Jan-Mar 2026) then reassigned to Route B (Apr-present), **When** admin views the student's profile, **Then** both assignments appear in the transport history section with correct date ranges
2. **Given** a student has transport assignment history, **When** admin clicks on a historical assignment, **Then** the assignment details (route name, stop name, dates, notes) are displayed
3. **Given** a student has no transport history, **When** admin views the profile, **Then** the transport history section shows "No transport assignments on record"

---

### User Story 5 - Missing Transport Charge Alerts (Priority: P2)

As an admin, when viewing the transport dashboard or a specific route, the system highlights students who have active transport assignments but no charge generated for the current month, prompting me to generate their monthly transport bill.

**Why this priority**: Prevents revenue loss from missed billing. Manual tracking of which students need charges is impractical for large student populations.

**Independent Test**: Can be tested by creating an active transport assignment, ensuring no charge exists for current month, and verifying an alert/notification appears.

**Acceptance Scenarios**:

1. **Given** a student has an active transport assignment on Route A, **When** no transport charge exists for the current month, **Then** the admin dashboard shows an alert: "3 students missing transport charges for April 2026"
2. **Given** admin views Route A details, **When** 2 students on that route lack current month charges, **Then** those students are highlighted with a "Missing Charge" badge
3. **Given** admin generates charges for the current month, **When** viewing the route again, **Then** the missing charge alerts no longer appear for students who now have charges

---

### Edge Cases

- **Student reassignment mid-month**: When reassigning a student from Route A to Route B on the 15th, the Route A assignment should end on the 14th, and Route B assignment should start on the 15th to ensure accurate prorated billing
- **Route deletion with active students**: When deleting a route that has active student assignments, the system should either prevent deletion or automatically end all assignments with appropriate warnings
- **Stop deletion with assigned students**: When deleting a stop that has assigned students, the system should require reassigning those students to different stops before allowing deletion
- **Academic year boundary**: Transport assignments should be scoped to academic years. When a new academic year starts, assignments from the previous year should be automatically ended or require explicit rollover
- **Billing for partial months**: Students assigned mid-month should have prorated charges or full-month charges based on school policy (to be configured in settings)
- **Concurrent admin operations**: If two admins simultaneously attempt to assign the same student to different routes, the system must use database constraints to prevent duplicate active assignments

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

#### Single Route Assignment Constraints

- **FR-001**: System MUST enforce that each student can have at most ONE active transport assignment at any given time across all routes in the tenant
- **FR-002**: System MUST reject new assignment requests with HTTP 409 Conflict if the student already has an active assignment on any route
- **FR-003**: System MUST provide a "reassign" operation that atomically ends the current assignment (set end_date, status=inactive) and creates a new assignment to the target route
- **FR-004**: System MUST use database-level constraints (unique index on student_id + status) to prevent race conditions in concurrent assignment attempts

#### Mandatory Stop Assignment

- **FR-005**: System MUST require a valid stop_id from the assigned route when creating a new student allocation
- **FR-006**: System MUST validate that the provided stop_id belongs to the route being assigned
- **FR-007**: System MUST reject assignment requests with HTTP 400 Bad Request if stop_id is missing or invalid
- **FR-008**: System MUST reject assignment requests with HTTP 400 Bad Request if the target route has no configured stops

#### Automatic Deallocation on Student Status Change

- **FR-009**: System MUST automatically terminate all active transport assignments when a student's status changes from "active" to any non-active status (withdrawn, suspended, graduated, transferred)
- **FR-010**: System MUST set the assignment end_date to the current date when auto-terminating due to student status change
- **FR-011**: System MUST set the assignment status to "inactive" when auto-terminating
- **FR-012**: System MUST NOT automatically reactivate transport assignments when a student's status is changed back to "active"
- **FR-013**: System MUST execute deallocation within the same database transaction as the student status update to ensure consistency

#### Transport Assignment History

- **FR-014**: System MUST preserve all transport assignment records (including inactive ones) for historical reference
- **FR-015**: System MUST expose a student's complete transport history via API endpoint GET /students/:id/transport-history
- **FR-016**: System MUST display transport history on the student profile page, ordered chronologically by start_date (newest first)
- **FR-017**: Each history record MUST include: route name, stop name, start_date, end_date, direction, notes, and assignment status

#### Missing Charge Alerts

- **FR-018**: System MUST identify students with active transport assignments who lack a transport charge for the current month
- **FR-019**: System MUST expose an API endpoint GET /transport/missing-charges that returns students missing charges for a given month
- **FR-020**: System MUST display a dashboard alert showing the count of students missing transport charges for the current month
- **FR-021**: System MUST highlight individual students with "Missing Charge" badges in route detail views when they lack current month charges
- **FR-022**: System MUST support filtering alerts by route and academic year

### Key Entities *(include if feature involves data)*

- **Transport Student Allocation**: Represents a time-bound assignment of a student to a specific stop on a route. Key attributes: student_id (FK), route_id (FK), stop_id (FK), direction, start_date, end_date, status, notes, academic_year
- **Transport Assignment History**: Read-only view derived from all transport_student_allocations records for a given student, ordered chronologically
- **Missing Charge Alert**: Computed entity representing a gap between an active transport assignment and existing charges for the current month. Not persisted; generated dynamically from allocation and charge data
- **Student Status**: Enum on the Student entity (active, withdrawn, suspended, graduated, transferred) that triggers automatic deallocation when changed from active

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: Zero students can be assigned to multiple active routes simultaneously (enforced by database constraint)
- **SC-002**: 100% of new transport assignments require a valid stop selection (enforced at API level)
- **SC-003**: 100% of student status changes to non-active statuses result in automatic transport assignment termination within the same transaction
- **SC-004**: Admin can view complete transport history for any student within 2 seconds of profile page load
- **SC-005**: System identifies students missing transport charges within 1 second of dashboard load
- **SC-006**: No student with an active transport assignment can go more than 48 hours without generating a billing alert if no charge exists for current month

## Assumptions

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right assumptions based on reasonable defaults
  chosen when the feature description did not specify certain details.
-->

- Each route must have at least one stop configured before students can be assigned (enforced by validation)
- Academic year scoping applies to transport assignments (based on existing transport_student_allocations.academic_year field)
- The existing charges table structure with charge_type='transport' and route_id FK will be used for billing records
- Transport assignments are tenant-scoped (tenant_id on all transport tables)
- Student status values are limited to: active, withdrawn, suspended, graduated, transferred (enforced by database enum)
- The system uses soft deletes for assignment records (status='inactive' with end_date) rather than hard deletion to preserve history
- Prorated billing for partial months is out of scope; full-month charges apply regardless of assignment date within month
- [NEEDS CLARIFICATION: Should reassignment within the same month generate a new charge or update the existing one? This affects billing logic.]
