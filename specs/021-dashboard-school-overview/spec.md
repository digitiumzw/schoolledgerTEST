# Feature Specification: Dashboard School Overview

**Feature Branch**: `021-dashboard-school-overview`  
**Created**: 2026-04-08  
**Status**: Draft  
**Input**: User description: "redo the dashboard and make it provide overview of the school data"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Admin Gets Full School Health Snapshot (Priority: P1)

A school administrator opens the dashboard and immediately sees the health of the entire school without navigating elsewhere. Within seconds they know: how many students are enrolled, the current financial collection status, how staff attendance looks today, and whether any alerts need attention.

**Why this priority**: This is the primary purpose of the dashboard — replace the current minimal metric cards with a genuinely useful overview. All other stories depend on this layout being in place.

**Independent Test**: Open the dashboard as an admin user and verify that all key metric sections are visible and populated with live data without any further navigation.

**Acceptance Scenarios**:

1. **Given** an admin is logged in, **When** the dashboard loads, **Then** they see metric tiles for total enrolment, outstanding balance total, term collection rate, total staff, active classes, and students on transport — all with current values.
2. **Given** fresh payments were recorded today, **When** the admin views the dashboard, **Then** the outstanding balance and collection-rate tiles reflect those payments without a page refresh.
3. **Given** the school has never recorded any payments, **When** the dashboard loads, **Then** financial tiles display zero values with appropriate empty-state messaging rather than blank or broken UI.

---

### User Story 2 — Financial Overview Section (Priority: P1)

The bursar or admin can see a dedicated financial summary section showing term revenue, total outstanding debt, collection rate, and a breakdown of how many students are fully paid vs. have balances — so they can gauge fee collection health at a glance.

**Why this priority**: Financial health is the most critical operational concern for school management; it is the most-used section of any school admin tool.

**Independent Test**: Verify financial tiles and the paid-vs-outstanding split show correct values by cross-checking against the Payments page totals.

**Acceptance Scenarios**:

1. **Given** the current term has charges and payments, **When** the admin views the financial section, **Then** they see: term revenue collected, total outstanding, collection rate percentage, count of fully-paid students, and count of students with balances.
2. **Given** a student's payment is just recorded, **When** the admin returns to the dashboard, **Then** the outstanding total and collection rate update to reflect the new payment.
3. **Given** no charges have been generated for the current term, **When** the financial section loads, **Then** collection rate shows 0% and an informational note indicates no charges are active for the term.

---

### User Story 3 — Enrolment & Academics Overview Section (Priority: P2)

An admin or principal sees a section summarising student enrolment numbers, class counts, average class size, and how many students are on bursary — giving a snapshot of the school's academic footprint.

**Why this priority**: Enrolment data is frequently checked but currently buried in the Students page. A summary here reduces navigation.

**Independent Test**: Verify enrolment tile values match the Students list totals and the Classes page class count.

**Acceptance Scenarios**:

1. **Given** students are enrolled across multiple classes, **When** the admin views the enrolment section, **Then** they see total active students, total classes, average class size, and number of students on bursary.
2. **Given** a new student is enrolled, **When** the admin refreshes the dashboard, **Then** total student count increments by one.
3. **Given** no classes exist, **When** the section loads, **Then** class-related tiles show zero with an actionable link to the Classes page.

---

### User Story 4 — Staff & Alerts Section (Priority: P2)

An admin sees a staff summary (total staff, pending leave requests) and a student attendance alert count (students below the attendance threshold) so they can quickly spot operational issues that need follow-up.

**Why this priority**: Staff management and attendance concerns are daily operational tasks; surfacing these on the dashboard prevents issues from being missed.

**Independent Test**: Create a pending leave request, then reload the dashboard and verify the pending leave count increments.

**Acceptance Scenarios**:

1. **Given** staff have submitted leave requests, **When** the admin views the staff section, **Then** they see total staff count, how many leave requests are pending approval, and a link to manage them.
2. **Given** students have attendance records below 75%, **When** the dashboard loads, **Then** a tile shows the count of low-attendance students with a link to the Attendance page.
3. **Given** no leave requests are pending, **When** the staff section loads, **Then** the pending-leave tile shows zero with a "No pending requests" label.

---

### User Story 5 — Recent Activity Feed (Priority: P2)

Any admin-level user sees a chronological feed of the most recent school activity (payments received, leave requests submitted) so they can quickly review what has happened without digging through individual module pages.

**Why this priority**: A live activity feed is standard in school-management dashboards and reduces the need to visit multiple pages just to see what occurred recently.

**Independent Test**: Record a payment, then return to the dashboard and confirm it appears at the top of the activity feed.

**Acceptance Scenarios**:

1. **Given** payments and leave requests exist, **When** the admin views the activity feed, **Then** the 10 most recent events are listed in reverse-chronological order with type, description, amount or detail, and relative timestamp ("2 minutes ago").
2. **Given** no activity has been recorded, **When** the feed loads, **Then** an empty state message ("No recent activity") is shown instead of a blank list.
3. **Given** the feed contains both payments and leave events, **When** the admin reads the list, **Then** each item is visually distinguished by type with an icon and brief description.

---

### User Story 6 — Quick Actions Bar (Priority: P3)

Admins can trigger the most common tasks (add student, record payment, mark attendance) directly from the dashboard without navigating to another page first.

**Why this priority**: Quick actions are a convenience feature; the dashboard delivers value without them, but they reduce friction for daily power users.

**Independent Test**: Click "Record Payment" from the dashboard and confirm the payment modal opens and successfully records a payment, then verify the financial tiles refresh.

**Acceptance Scenarios**:

1. **Given** the admin is on the dashboard, **When** they click "Add Student", **Then** the add-student modal opens without leaving the dashboard.
2. **Given** the admin submits a new payment via Quick Actions, **When** the modal closes, **Then** the financial summary tiles refresh to reflect the new payment.

---

### User Story 7 — Teacher Dashboard (Priority: P3)

A teacher who logs in sees a focused, class-specific view showing their assigned class's attendance summary and a per-student attendance breakdown. The existing teacher view is retained and continues to work correctly.

**Why this priority**: Teachers must not see financial or staff data. This story ensures the rebuild does not break the role-gated teacher experience.

**Independent Test**: Log in as a teacher and confirm only class-selection and attendance data is visible, with no financial tiles or staff sections.

**Acceptance Scenarios**:

1. **Given** a teacher is logged in, **When** the dashboard loads, **Then** they see only their assigned classes and attendance data — no financial tiles, staff sections, or Quick Actions for adding students.
2. **Given** a teacher selects a class and date range, **When** the attendance table renders, **Then** each student's present/absent/late/excused counts and attendance percentage are visible.

---

### Edge Cases

- What happens when the dashboard stats API is slow or fails? Each section must degrade gracefully with skeleton loaders and a per-section error state, not a full-page blank.
- What if `collectionRate` is undefined because no charges exist? Must render as "0%" not "NaN%".
- What if a currency amount is very large (> $1,000,000)? Formatting must not overflow the tile layout.
- What happens if the user's connection drops mid-load? Loaded sections remain visible; failed sections show a retry option.
- What if a role has no data (e.g., a new school with zero students)? All tiles show zero with constructive empty-state guidance.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The dashboard MUST display a **Financial Summary** section containing: total term revenue collected, total outstanding balance, collection rate (%), count of fully-paid students, and count of students with outstanding balances.
- **FR-002**: The dashboard MUST display an **Enrolment & Academics** section containing: total active students, total classes, average class size, and number of students on bursary.
- **FR-003**: The dashboard MUST display a **Staff & Alerts** section containing: total staff count, pending leave request count, and count of students with attendance below 75%.
- **FR-004**: The dashboard MUST display a **Transport** summary tile showing active route count and number of students using transport.
- **FR-005**: The dashboard MUST display a **Recent Activity** feed showing the 10 most recent payment and leave-request events in reverse-chronological order with relative timestamps.
- **FR-006**: The dashboard MUST provide **Quick Action** buttons for Add Student, Record Payment, and Mark Attendance.
- **FR-007**: All financial metric values MUST be sourced from the ledger (LedgerService-backed totals) — not from stale per-student cached balance fields.
- **FR-008**: Each dashboard section MUST show a skeleton loader while fetching and an inline error state (with retry) if the fetch fails — never a blank section.
- **FR-009**: The **teacher role** MUST see only the class-specific attendance view and MUST NOT see financial, staff, transport, or alert sections.
- **FR-010**: The **bursar role** MUST see financial and enrolment sections; staff leave and attendance-alert sections are visible if the backend data is accessible.
- **FR-011**: After a Quick Action modal closes successfully, the relevant dashboard tiles MUST refresh automatically.
- **FR-012**: All metric values MUST handle zero and null gracefully — zero counts show "0", percentages show "0%", currency shows formatted zero — never "NaN", "undefined", or blank.
- **FR-013**: The dashboard layout MUST be responsive: single-column on mobile, two-column on tablet, three or four-column on desktop.

### Key Entities

- **DashboardStats**: Aggregated school metrics — financial totals (outstanding, revenue, collection rate, paid counts), enrolment counts, staff counts, transport counts, and alert counts. Sourced from a single backend stats endpoint.
- **RecentActivity**: A unified feed item representing either a payment or a leave request. Attributes: type, description, amount or detail string, and timestamp.
- **TeacherDashboardData**: Class-scoped data — selected class, date range filter, per-student attendance breakdown (present, absent, late, excused, percentage).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin user can view all key school metrics (financial, enrolment, staff, transport, alerts) on a single screen at 1280px width without horizontal scrolling.
- **SC-002**: Dashboard data loads and all metric tiles render within 3 seconds on a standard broadband connection; skeleton loaders appear within 300ms of page open.
- **SC-003**: Every numeric metric on the dashboard matches the corresponding figure on the source-of-truth module page (Payments, Students, Classes) with 100% accuracy.
- **SC-004**: Role-based section visibility is enforced: teachers see no financial data, verified by logging in with each role and confirming restricted sections are absent from the DOM.
- **SC-005**: After recording a payment through Quick Actions, the financial summary tiles update within a single user interaction — no manual page refresh required.
- **SC-006**: All zero-state and error-state scenarios render without layout breakage or JavaScript console errors across mobile, tablet, and desktop screen sizes.

## Assumptions

- The existing `/api/dashboard/stats` backend endpoint will be extended to return all required metrics; no new endpoint URL is needed.
- The existing `LedgerService::getAllBalances()` optimised single-query method will be used for financial aggregates to avoid per-student N+1 queries.
- Role-based section visibility follows the existing role model: `super_admin` and `admin` see all sections; `bursar` sees financial and enrolment; `teacher` sees the class-attendance view only.
- The low-attendance threshold is 75%, consistent with the existing codebase definition in TeacherDashboard.
- Transport section data is available from the existing transport routes and assignment tables via the existing API.
- The recent activity feed covers payments and leave requests only in this iteration; enrolment events and other audit entries are out of scope.
- Historical trend charts (revenue over time, enrolment growth) are out of scope for this iteration — the focus is accurate, current-state metrics.
- Mobile layout is in scope; a native mobile or PWA build is out of scope.
