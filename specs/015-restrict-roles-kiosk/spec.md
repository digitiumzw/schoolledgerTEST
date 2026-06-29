# Feature Specification: Restrict Tenant Roles and Kiosk-Only Access for Drivers and Teachers

**Feature Branch**: `015-restrict-roles-kiosk`  
**Created**: 2026-04-07  
**Status**: Draft  
**Input**: User description: "Each tenant should have only the following accounts: Administrator and Bursar. In total, the number of accounts per tenant must not exceed five. Remove all other roles for tenants. Drivers should not have regular accounts. Instead, they must access the 'My Routes' page through a kiosk interface using their Employee ID. same applies for teachers"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Enforce Tenant Account Limits (Priority: P1)

A school administrator manages user accounts for their tenant. The system only allows them to create accounts with the roles **Administrator** or **Bursar**, and enforces a hard cap of five accounts per tenant. Attempting to create more than five accounts or assign a disallowed role (e.g., teacher, driver) is rejected.

**Why this priority**: This is the foundational constraint. All other stories depend on roles being correctly restricted. It also prevents data integrity issues caused by stale driver/teacher login accounts.

**Independent Test**: Can be tested by attempting to create a sixth account or a teacher/driver account via the admin UI and verifying that both operations are blocked.

**Acceptance Scenarios**:

1. **Given** a tenant with 0 accounts, **When** an administrator creates accounts with role "Administrator" or "Bursar", **Then** accounts are created successfully up to a maximum of five.
2. **Given** a tenant already at the five-account limit, **When** an administrator attempts to create a new account, **Then** the system rejects the creation with a clear message indicating the limit has been reached.
3. **Given** an administrator on the account creation form, **When** they view the available role options, **Then** only "Administrator" and "Bursar" are listed — teacher and driver are not available.
4. **Given** existing teacher or driver accounts in a tenant, **When** the migration/cleanup runs, **Then** those accounts are deactivated and can no longer log in.

---

### User Story 2 - Driver Kiosk Access to My Routes (Priority: P2)

A driver arrives at a kiosk terminal (a shared tablet or screen in the school office). They enter their Employee ID. The system looks up their assigned routes and displays the "My Routes" view — showing route details and the student roster — without requiring a password or a personal login account.

**Why this priority**: Drivers need operational access to their route and student data, but do not require a full system account. This reduces account sprawl and simplifies driver onboarding.

**Independent Test**: Can be tested by navigating to the driver kiosk URL, entering a valid Employee ID, and verifying the correct route list is displayed. Can also verify that an invalid Employee ID is rejected.

**Acceptance Scenarios**:

1. **Given** a kiosk page for drivers is open, **When** a driver enters their valid Employee ID, **Then** the system displays their assigned routes and roster without requiring a password.
2. **Given** a kiosk page for drivers is open, **When** an invalid or unrecognized Employee ID is entered, **Then** the system displays an error message and does not reveal any data.
3. **Given** a driver has viewed their routes on the kiosk, **When** a configurable idle timeout elapses (default: 2 minutes), **Then** the kiosk returns to the Employee ID entry screen automatically.
4. **Given** a driver is no longer assigned to any routes, **When** they enter their Employee ID at the kiosk, **Then** the system confirms their identity but shows an empty routes list with an appropriate message.

---

### User Story 3 - Teacher Kiosk Access for Attendance (Priority: P3)

A teacher approaches the kiosk terminal and enters their Employee ID. The system authenticates them by Employee ID alone and grants access to the student attendance marking interface — the same functionality they previously accessed via a full login account.

**Why this priority**: Teachers need attendance-marking capability but do not need broader system access. Consolidating teacher access through the existing student-attendance kiosk flow removes the need for teacher login accounts.

**Independent Test**: Can be tested by entering a teacher's Employee ID at the kiosk and verifying attendance marking works end-to-end, independent of any login session.

**Acceptance Scenarios**:

1. **Given** a student-attendance kiosk is open, **When** a teacher enters their valid Employee ID, **Then** they are granted access to mark attendance for their class.
2. **Given** a teacher has submitted attendance, **When** the kiosk idle timeout elapses, **Then** the session clears and returns to the Employee ID entry screen.
3. **Given** a teacher's Employee ID is not found in the system, **When** they enter it at the kiosk, **Then** the system rejects entry with a clear error message.

---

### Edge Cases

- What happens when a tenant already has more than five accounts before this feature is deployed? Existing excess accounts must be flagged for review; the system should not auto-delete them but should prevent new ones until the count is at or below five.
- What happens if a driver's Employee ID is shared with another staff member? Employee IDs must be unique per tenant; the system must enforce this uniqueness.
- What happens if a kiosk device is left unattended? The idle timeout must clear sensitive data from the screen automatically.
- What happens when an existing teacher or driver attempts to log in via the standard login page after their account is deactivated? The system must return a clear "account disabled" message.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST restrict account creation for tenants to only the roles "Administrator" and "Bursar".
- **FR-002**: System MUST enforce a maximum of five active user accounts per tenant at all times.
- **FR-003**: System MUST reject any attempt (via UI or API) to create an account with a role other than Administrator or Bursar for a tenant.
- **FR-004**: Existing tenant accounts with roles "teacher" or "driver" MUST be deactivated so they can no longer authenticate via the standard login flow.
- **FR-005**: System MUST provide a dedicated driver kiosk interface accessible via a public URL that does not require a password.
- **FR-006**: The driver kiosk MUST authenticate drivers by Employee ID only and display their assigned routes and student roster.
- **FR-007**: System MUST provide (or extend the existing) teacher kiosk interface that authenticates teachers by Employee ID only and grants access to student attendance marking.
- **FR-008**: All kiosk sessions for drivers and teachers MUST automatically time out after a configurable idle period (default: 2 minutes) and return to the Employee ID entry screen.
- **FR-009**: The backend MUST expose kiosk-specific endpoints for driver route lookup and teacher attendance access by Employee ID, without requiring JWT authentication.
- **FR-010**: The standard login page and account management screens MUST NOT offer "teacher" or "driver" as selectable roles.

### Key Entities

- **User Account**: A login credential within a tenant; constrained to roles Administrator or Bursar; max five per tenant.
- **Staff Member**: A school employee (teacher, driver, etc.) identified by a unique Employee ID within a tenant; does not require a login account.
- **Driver Kiosk Session**: A temporary session initiated by an Employee ID on the driver kiosk; expires on idle timeout.
- **Teacher Kiosk Session**: A temporary session initiated by a teacher's Employee ID on the student-attendance kiosk; expires on idle timeout.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero tenant accounts with roles other than Administrator or Bursar exist in the system after migration.
- **SC-002**: No tenant can have more than five active accounts; every attempt to exceed this limit is rejected.
- **SC-003**: Drivers can access their route and roster information within 30 seconds of arriving at the kiosk terminal using only their Employee ID.
- **SC-004**: Teachers can begin marking attendance within 30 seconds of entering their Employee ID at the kiosk.
- **SC-005**: Kiosk sessions clear automatically within the configured timeout (default 2 minutes) of the last user interaction, verified across both driver and teacher kiosk flows.
- **SC-006**: 100% of former teacher and driver login accounts are blocked from authenticating via the standard login page post-migration.

## Assumptions

- The `super_admin` role is a platform-level role (not tenant-scoped) and is unaffected by the five-account-per-tenant limit and role restriction.
- Drivers and teachers already exist as staff records with Employee IDs in the system; this feature reuses those records as the sole authentication source for kiosk access.
- The existing staff attendance kiosk infrastructure (Employee ID lookup) can be extended or adapted for the driver and teacher kiosk flows.
- The existing `StudentKioskPage` teacher-validation endpoint (`POST /api/kiosk/student-attendance/validate-teacher`) is the basis for teacher kiosk authentication and will be reused or extended.
- Deactivating teacher/driver accounts means setting them to an inactive/disabled state (not hard-deleting) to preserve audit history.
- A single shared kiosk terminal per school is the primary deployment model; personal devices are out of scope for v1.
