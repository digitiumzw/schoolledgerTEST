# Feature Specification: Attendance UI Redesign & Staff Attendance Bug Fixes

**Feature Branch**: `032-attendance-ui-redesign`  
**Created**: 2026-04-14  
**Status**: Draft  
**Input**: Redesign the UI/UX for both the student attendance and staff attendance pages to make them more user-friendly. Fix any bugs in the staff attendance logic. Do not make any changes to the kiosk. Additionally, enhance the pages to ensure that reports are displayed clearly and efficiently.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 – Student Attendance Daily Marking (Priority: P1)

As a teacher or admin, I want to mark student attendance for a selected class and date using a cleaner, more efficient interface so that I can complete the task quickly with fewer clicks and visual confusion.

**Why this priority**: This is the most frequently used workflow. Teachers use it every school day. Any friction here has a daily impact on productivity.

**Independent Test**: Teacher selects a class, picks a date, marks attendance for all students using toggle/buttons, saves, and receives confirmation — all within a clean, scannable layout.

**Acceptance Scenarios**:

1. **Given** a teacher opens the Attendance page, **When** the page loads, **Then** the class selector and date picker are prominently visible and pre-selected to the first class and today's date respectively
2. **Given** a class is selected, **When** the student list renders, **Then** each student row displays their name, a colour-coded status indicator, and status toggle buttons (Present / Absent / Late / Excused) with the current status visually highlighted
3. **Given** attendance records exist for the selected date, **When** the list loads, **Then** existing statuses are pre-filled in each row's toggle so teachers can immediately see what has already been saved
4. **Given** the teacher clicks "Mark All Present", **When** the action fires, **Then** every student's toggle switches to Present instantly with visual feedback
5. **Given** the teacher clicks "Save Attendance", **When** save succeeds, **Then** a success toast is shown and the summary section below refreshes automatically

---

### User Story 2 – Student Attendance Report (Priority: P2)

As a teacher or admin, I want to view a clear, filterable attendance summary per student so that I can quickly identify students with low attendance rates and take action.

**Why this priority**: Reports inform pastoral care, parent communication, and administrative decisions. A poorly presented report causes missed action on at-risk students.

**Independent Test**: Selecting any date-filter preset updates the summary table immediately; badges clearly distinguish high/medium/low attendance rates; the table is sortable by attendance percentage.

**Acceptance Scenarios**:

1. **Given** the teacher is viewing the Attendance Summary section, **When** they change the date filter (Last 30 Days, This Month, This Year, Custom Range), **Then** the summary table updates without a full page reload
2. **Given** the summary table is rendered, **When** a student has ≥90% attendance, **Then** their attendance badge is green; 75–89% is amber; below 75% is red
3. **Given** the table has more than 10 students, **When** the teacher wants to find a specific student, **Then** there is a search/filter input above the table to narrow results by name
4. **Given** a custom date range is selected, **When** start date is after end date, **Then** an inline error is shown and the summary does not attempt to load

---

### User Story 3 – Staff Daily Attendance Overview (Priority: P1)

As an admin, I want the staff daily attendance page to clearly show who has checked in, who is late, who is absent, and who is on leave, with a live attendance rate, so that I can manage staff presence at a glance.

**Why this priority**: Staff attendance monitoring is a daily administrative task with direct operational impact.

**Independent Test**: The overview cards show correct counts for each status group; collapsible sections are labelled clearly; check-in/check-out buttons are accessible from within each section.

**Acceptance Scenarios**:

1. **Given** the admin opens the Staff Attendance page (Daily tab), **When** the page loads, **Then** a stat bar at the top shows counts for: Present, Late, Absent, Not Arrived, On Leave, and Total Staff
2. **Given** a staff member has checked in on time, **When** they appear in the Present section, **Then** their row shows name, position, check-in time, check-out time (or dash), work hours (or "Incomplete"), and a status badge
3. **Given** a staff member has not arrived and the workday cutoff has passed, **When** the system calculates their status, **Then** their status is shown as "Absent" — not "Not Arrived"
4. **Given** a staff member has an approved leave request with `leaveType: 'half_day'`, **When** their attendance status is calculated, **Then** their status displays as "Half Day" (not "On Leave")
5. **Given** the admin clicks "Check In" for a staff member, **When** the modal opens, **Then** it pre-fills the current time and staff name and submits correctly; after success the daily list refreshes

---

### User Story 4 – Staff Attendance Records & Filtering (Priority: P2)

As an admin, I want to browse, filter, and manage historical staff attendance records with a clear layout and efficient pagination so that I can audit attendance history and correct errors.

**Why this priority**: HR and payroll processes depend on accurate historical records. Poor filter UX leads to wasted time and missed corrections.

**Independent Test**: Records tab shows paginated results; date-range presets and status filters work independently and in combination; editing/deleting a record works and the list refreshes.

**Acceptance Scenarios**:

1. **Given** the admin opens the Records tab, **When** it loads, **Then** records are sorted newest-first and the first page shows up to 20 rows; pagination controls appear when there are more than 20 records
2. **Given** the admin applies a "Last 7 Days" preset, **When** the filter is applied, **Then** only records dated within the last 7 days appear
3. **Given** the admin types a name in the search field, **When** results update (debounced), **Then** only rows matching the staff member's name are shown
4. **Given** a record shows an incomplete (no check-out) status, **When** the admin edits it via the modal, **Then** they can set a check-out time and save; the row updates in-place without a full reload

---

### User Story 5 – Staff Leave Management (Priority: P3)

As an admin, I want a clearly organised Leave Management tab that separates pending requests from all requests, with easy approve/reject actions, so that I can process leave efficiently.

**Why this priority**: Leave affects daily attendance display. Clear leave management prevents confusion between "absent" and "on leave" states.

**Independent Test**: Pending requests section shows only unapproved requests; the "All Requests" table is sortable and shows correct status badges; approving a pending request moves it out of the pending section.

**Acceptance Scenarios**:

1. **Given** there are pending leave requests, **When** the admin views the Leave Management tab, **Then** a "Pending Requests" section appears above the "All Requests" table with a count badge
2. **Given** the admin selects "Review" on a pending request, **When** the review modal opens, **Then** it shows the staff member name, leave type, date range, reason, and approve/reject buttons
3. **Given** the admin approves a leave request, **When** confirmation is received, **Then** the request disappears from the "Pending" section and its status badge in "All Requests" changes to "APPROVED"

---

### Edge Cases

- **Empty state**: When no students are in a selected class, a clear empty-state message is displayed instead of an empty table
- **No attendance records**: When a summary is requested for a period with no records, a helpful message explains there is no data rather than rendering an empty table
- **Staff with no attendance record today**: Staff with no check-in record display "Not Arrived" before cutoff; "Absent" after cutoff — never blank
- **Half-day leave detection**: The `leaveType` field (not `type`) on `LeaveRequest` must be checked when determining half-day status (existing bug)
- **Leave status hook mismatch**: `LeaveManagementTab` destructures `isLoading` but `useStaff()` and `useLeaveRequests()` return `loading` — this causes the loading guard to never fire (existing bug)
- **`getWorkHours()` called without arguments**: In `DailyAttendanceTab` the `StatusReasonPanel` passes `getWorkHours()` (no argument) but the function signature requires `settings` — this returns default hours instead of the configured hours (existing bug)
- **Stale cache after mutation**: After a check-in/check-out, the data cache must be invalidated and the list must refetch automatically; the current `onSuccess` handlers already call `clearDataCache()` and `refetch()` but this should be verified consistent across all mutation paths

---

## Requirements *(mandatory)*

### Functional Requirements

#### Student Attendance Page (`Attendance.tsx`)

- **FR-001**: The page header must display the selected class name and formatted date prominently; the class selector and date picker must be in a single row on desktop and stacked on mobile
- **FR-002**: Each student row must show a sequential number, full name, and a status toggle group with four options: Present (green), Absent (red), Late (amber), Excused (blue); the active state must be visually distinct
- **FR-003**: The attendance summary section must include a search/filter input to find students by name; this must debounce at ≥300 ms
- **FR-004**: The attendance summary table must display columns: Student Name, Present, Absent, Late, Excused, Total Days, Attendance %; rows must be sortable by Attendance % (descending by default)
- **FR-005**: The attendance summary must show attendance-rate progress bars or colour-coded badges: green ≥90%, amber 75–89%, red <75%
- **FR-006**: The "Mark All Present" and "Clear All" quick actions must remain accessible at the top of the attendance marking card
- **FR-007**: The bulk selection panel (checkbox select + status + Apply) must only appear when ≥1 student is selected, and must disappear after the action is applied
- **FR-008**: The save button must be disabled while saving; a loading spinner or text indicator must show during the save operation

#### Staff Attendance Page (`StaffAttendance.tsx` and sub-components)

- **FR-009**: The Daily Attendance tab must open in a clean layout with a stat bar showing Present, Late, Absent, Not Arrived, On Leave, and Total Staff counts; the attendance rate percentage must be displayed
- **FR-010**: Collapsible status sections (Not Arrived, Present, Late, Absent, On Leave) must have clear section headers with colour-coded badges matching the status colour; the chevron icon must rotate when collapsed
- **FR-011**: Each staff row in a compact table section must show: Name, Position, Status badge, Check-in time, Check-out time, Work Hours, and Action buttons (Check In / Check Out)
- **FR-012**: The Records tab must render with filters (search by name, status filter, date range preset) in a responsive row; custom date range pickers must appear inline below the filter row when "Custom Range" is selected
- **FR-013**: The Records tab must show a results count ("Showing X–Y of Z") above or below the table; pagination controls must be clearly labelled
- **FR-014**: The Leave Management tab must separate pending requests in a distinct card from the all-requests table; pending section must only show when pending requests exist
- **FR-015**: The "New Request" button must be consistently placed in the top-right of the "All Leave Requests" card header

### Bug Fixes (Staff Attendance Logic)

- **BUG-001**: In `attendanceStateTransitions.ts`, the half-day check uses `staffLeave.type` but the `LeaveRequest` type uses `leaveType`. Fix: change `staffLeave.type === 'half_day'` to `staffLeave.leaveType === 'half_day'`
- **BUG-002**: In `LeaveManagementTab.tsx`, `useStaff()` and `useLeaveRequests()` are destructured with `isLoading` but the hook returns `loading`. Fix: change destructuring to use `loading` and rename local variables accordingly
- **BUG-003**: In `DailyAttendanceTab.tsx`, `getWorkHours()` is called with no arguments in the `StatusReasonPanel` props. Fix: pass `settings` as argument — `getWorkHours(settings)` — so configured work hours are used

### Key Entities

- **Attendance (Student)**: `studentId`, `classId`, `date`, `status` (`present | absent | late | excused`), `remarks`
- **Attendance (Staff)**: `staffId`, `date`, `checkIn`, `checkOut`, `status`, `remarks`
- **LeaveRequest**: `staffId`, `leaveType`, `startDate`, `endDate`, `days`, `reason`, `status`, `appliedDate`, `reviewedBy`, `reviewNotes`
- **StudentAttendanceSummary**: `studentId`, `studentName`, `presentDays`, `absentDays`, `lateDays`, `excusedDays`, `totalDays`, `attendancePercentage`
- **WorkHours**: `startTime`, `endTime` (used for late detection and absent cutoff)

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A teacher can complete the full daily attendance marking workflow (select class → mark all students → save) in under 60 seconds for a class of 40 students
- **SC-002**: The attendance summary filters (date presets + custom range) update the displayed report within 2 seconds of selection
- **SC-003**: Staff daily attendance status is accurately computed for all three fixed bugs: half-day leave shows "Half Day", `LeaveManagementTab` loading state fires correctly, and `StatusReasonPanel` receives the correct work hours from settings
- **SC-004**: The staff Records tab correctly filters and paginates results; applying any single filter (name search, status, or date range) narrows results without error
- **SC-005**: All collapsible sections on the Daily Staff Attendance tab open and close without layout shift; section counts stay accurate after check-in/check-out mutations
- **SC-006**: On mobile, all attendance UI components render correctly without horizontal overflow; action buttons and status toggles are accessible by tap
- **SC-007**: No existing kiosk pages or components (`/kiosk*`, kiosk-related hooks and modals) are modified

---

## Assumptions

- The kiosk (`/kiosk*` routes and all kiosk-specific components) will not be touched; this feature is scoped to `Attendance.tsx`, `StaffAttendance.tsx`, and `src/components/staff-attendance/`
- The backend APIs for both student and staff attendance remain unchanged; the redesign is frontend-only except for the three bug fixes which are also frontend logic
- The existing `shadcn/ui` component library (Table, Card, Badge, Button, Collapsible, Tabs, Select, etc.) and TailwindCSS will be used for all UI changes — no new UI library is introduced
- Mobile-first responsive behaviour is required; the `useIsMobile()` hook and `MobileCard` pattern already in use will be retained
- The `SubscriptionGuard` wrapper on both pages will not be modified
- Date formatting will continue using `date-fns`; the `format()` function from `date-fns` is the standard for all date display
- The `excusedDays` column is intentionally absent from the current summary table; it will be added as part of this redesign (the data is already computed in the summary map)
