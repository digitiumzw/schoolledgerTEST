# Feature Specification: Student Status Filtering & Immediate Status Updates

**Feature Branch**: `049-student-status-filtering`  
**Created**: 2026-04-28  
**Status**: Draft  
**Input**: User description: "When updating a student's status on the Students page, ensure the change is applied immediately in accordance with the system's migration logic. The system should only include active students in the transport module, dashboard, and other relevant modules, including class attendance. In the payment recording modal, searching for students should display all students regardless of their status. The search must query students directly from the backend and must not rely on prefetched data. The implementation should be performance-efficient to avoid excessive use of computing power or memory."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Immediate Student Status Update (Priority: P1)

An administrator updates a student's status (e.g., from Active to Inactive, or Suspended) on the Students page. The change takes effect immediately across the system — the student list refreshes without requiring a page reload, and any module that filters by status reflects the new state right away.

**Why this priority**: Immediate feedback is the baseline expectation for any data mutation. Without this, administrators are left uncertain whether the change was saved, leading to repeated clicks or data integrity issues.

**Independent Test**: An admin can update a student's status and immediately see the updated status reflected in the Students page list — this alone is a complete, verifiable slice.

**Acceptance Scenarios**:

1. **Given** a student is currently Active, **When** the admin changes the status to Inactive and confirms, **Then** the student's status updates immediately on the Students page without a manual page reload.
2. **Given** a student's status is changed, **When** the admin navigates to another module (e.g., Transport) that uses student status, **Then** the updated status is respected in that module's data.
3. **Given** the system applies migration-driven student status transitions, **When** a status is set, **Then** the system honours only valid status values defined by the migration (e.g., Active, Inactive, Suspended, Graduated, Transferred).

---

### User Story 2 - Active-Only Students in Operational Modules (Priority: P2)

An administrator views the Transport module, Dashboard, or Class Attendance module. Only students with an Active status are included in rosters, summaries, headcounts, and any operational lists within those modules.

**Why this priority**: Showing inactive, suspended, or transferred students in operational modules creates noise, inflates numbers, and leads to incorrect resource planning (e.g., transport seats, fee charges).

**Independent Test**: An admin marks a student as Inactive, then opens the Transport module — that student no longer appears in any transport-related list. Fully testable on its own.

**Acceptance Scenarios**:

1. **Given** a student is Inactive, Suspended, Graduated, or Transferred, **When** the Transport module loads its student roster, **Then** that student is excluded from all transport-related lists and counts.
2. **Given** the Dashboard displays student headcounts or summaries, **When** the page loads, **Then** only Active students are counted.
3. **Given** Class Attendance is being taken for a class, **When** the attendance roster is displayed, **Then** only Active students enrolled in that class appear on the list.
4. **Given** any other module that displays student lists (excluding the payment modal), **When** it fetches students, **Then** it filters to Active status only.

---

### User Story 3 - All-Students Search in Payment Recording Modal (Priority: P3)

A bursar or administrator opens the payment recording modal to log a payment. When they search for a student by name or ID, all students are returned regardless of their status. The search queries the backend live each time and does not depend on a pre-loaded, cached, or prefetched list already in memory.

**Why this priority**: Payments may need to be recorded for students who are no longer active (e.g., a student who left but has an outstanding balance). Blocking by status would prevent financial record completion.

**Independent Test**: An admin marks a student as Inactive, then opens the payment modal and searches for that student by name — the student appears in results. Testable independently of the other stories.

**Acceptance Scenarios**:

1. **Given** the payment recording modal is open, **When** the user types a student name or ID into the search field, **Then** results include students of all statuses (Active, Inactive, Suspended, Graduated, Transferred).
2. **Given** the user types at least one character, **When** a search is triggered, **Then** the query is sent to the backend in real time and results are not sourced from a prefetched or cached list.
3. **Given** a search with no matching students, **When** results are returned, **Then** an empty state message is displayed with no error.
4. **Given** the user types quickly, **When** search requests fire, **Then** only the most recent request's result is shown — earlier superseded requests are discarded to avoid redundant processing.
5. **Given** the modal is opened and no search term is entered, **When** the modal loads, **Then** no students are pre-loaded; the list remains empty until the user types.

---

### Edge Cases

- What happens when a student's status is changed while the same student record is open in another admin session?
- How does the system handle a status update that fails on the backend (network error, validation error)?
- What if a class has no Active students when attendance is being taken — does the module show an empty state or an informative message?
- What if a payment modal search returns a very large result set (e.g., "a" typed in a school with many students)?
- What happens if a student's status changes mid-session while that student is already loaded in a module list — does the module reflect the change or retain stale data?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST reflect a student's new status immediately on the Students page after the status change is confirmed, without requiring a manual page reload.
- **FR-002**: The system MUST accept only status values that are valid per the current migration schema (e.g., Active, Inactive, Suspended, Graduated, Transferred).
- **FR-003**: The Transport module MUST only include students with Active status in all rosters, seat assignments, and headcounts.
- **FR-004**: The Dashboard MUST only count and display Active students in all student-related summaries and statistics.
- **FR-005**: The Class Attendance module MUST only present students with Active status in attendance rosters.
- **FR-006**: Any additional module that displays a student list (other than the payment recording modal) MUST filter to Active students only.
- **FR-007**: The payment recording modal's student search MUST return students of all statuses regardless of their current status.
- **FR-008**: The payment recording modal's student search MUST query the backend directly on each search and MUST NOT rely on prefetched, cached, or in-memory student data.
- **FR-009**: The payment modal search MUST debounce user input to prevent a new backend request on every keystroke, and superseded in-flight requests MUST be cancelled or ignored.
- **FR-010**: The payment modal MUST NOT pre-load any student list on open; results appear only after the user initiates a search.
- **FR-011**: When a status update fails (backend error), the system MUST display a clear error message and revert the displayed status to its previous value.

### Key Entities

- **Student**: A learner enrolled (or previously enrolled) in a school tenant. Has a `status` attribute with values defined by the migration schema (Active, Inactive, Suspended, Graduated, Transferred).
- **Student Status**: Determines whether a student appears in operational modules. Active students are included everywhere; non-Active students are excluded from operational modules but remain searchable in the payment modal.
- **Module Filter**: Each operational module (Transport, Dashboard, Attendance, etc.) applies an Active-only status filter when fetching students. The payment modal is the sole exception and fetches students of all statuses.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After a status change is confirmed, the updated status is visible on the Students page within 2 seconds with no manual refresh required.
- **SC-002**: Zero non-Active students appear in Transport, Dashboard, or Class Attendance module lists after their status has been changed to non-Active.
- **SC-003**: The payment modal search returns results for students of all statuses, verified by successfully finding an Inactive student via name search.
- **SC-004**: Each payment modal search triggers at most one backend request per debounce window, with no duplicate or redundant requests for the same query.
- **SC-005**: The payment modal produces no student-list network request on open — the first request only fires when the user types a search term.
- **SC-006**: 100% of modules that render student rosters (Transport, Dashboard, Attendance) consistently exclude non-Active students across all test scenarios.

## Assumptions

- Student status values are defined by the existing migration schema; no new status values are introduced by this feature.
- "Immediate" update on the Students page means the client-side state is refreshed after a successful backend response — optimistic UI is not required.
- The payment recording modal is the only context where an all-status student search is needed; all other modals and modules filter to Active only.
- Debounce delay for the payment modal search defaults to 300ms, consistent with standard interactive search UX.
- The backend supports a student search endpoint that accepts a query string and returns a limited result set to avoid large response payloads.
- Class attendance rosters pull from the same student data source that already respects the Active status filter.
- "Other relevant modules" is interpreted as any module displaying a student roster or performing student-based calculations, excluding the payment modal.
