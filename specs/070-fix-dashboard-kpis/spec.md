# Feature Specification: Fix Dashboard KPIs & Layout

**Feature Branch**: `070-fix-dashboard-kpis`  
**Created**: 2026-05-11  
**Status**: Ready for Planning  
**Input**: User description: "Fix the dashboard KPIs and layout with corrected metric definitions, removed KPI cards, tooltips, compact Quick Actions, and removed Refresh KPIs button."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Accurate Financial KPIs (Priority: P1)

An administrator or bursar opens the dashboard and needs the Financial Summary section to reflect trustworthy, precisely scoped figures. They need to see the total outstanding amount across all students, this term's collection rate, the count of students who have fully paid this term, and this term's revenue — all without navigating away to the Payments page.

**Why this priority**: Financial data drives day-to-day decisions. Incorrect collection rate or outstanding totals directly erode trust in the system and cause manual double-checking.

**Independent Test**: Can be fully tested by loading the dashboard and comparing Financial Summary KPI values against independently computed figures from the Payments/Charges pages, with all four cards showing correct scoped values.

**Acceptance Scenarios**:

1. **Given** students with outstanding charges across multiple terms, **When** the dashboard loads, **Then** Total Outstanding shows the sum of all unpaid balances from all students across all terms.
2. **Given** charges and payments exist for the current term, **When** the dashboard loads, **Then** Collection Rate shows `(payments received this term ÷ charges raised this term) × 100%`.
3. **Given** some students have paid all their current-term charges in full, **When** the dashboard loads, **Then** Paid in Full shows the count of those students only.
4. **Given** payments were received this term, **When** the dashboard loads, **Then** Term Revenue shows the total monetary value of those payments.
5. **Given** no active academic term is configured, **When** the dashboard loads, **Then** term-scoped KPIs (Collection Rate, Paid in Full, Term Revenue) display a "No active term" indicator rather than zero or an error.

---

### User Story 2 - Accurate Enrolment & Academics KPIs (Priority: P1)

An administrator views the Enrolment & Academics section to understand school population metrics. They need active-student-only totals, active-class-only counts, an accurate average class size, and a count of students currently on bursary or scholarship. The enrollment-by-class table must show a gender breakdown.

**Why this priority**: These figures are used for planning purposes (staffing, classroom allocation) and must reflect the current live state of the school.

**Independent Test**: Can be fully tested by comparing dashboard Enrolment KPIs against the Students and Classes list pages, verifying active-only filters and gender breakdown match.

**Acceptance Scenarios**:

1. **Given** a mix of active and inactive students, **When** the dashboard loads, **Then** Total Students shows only active students.
2. **Given** archived and active classes exist, **When** the dashboard loads, **Then** Total Classes shows only non-archived, active classes.
3. **Given** 100 active students and 5 active classes, **When** the dashboard loads, **Then** Average Class Size shows 20.
4. **Given** students with bursary/scholarship discounts applied, **When** the dashboard loads, **Then** On Bursary shows the count of students receiving any full or partial scholarship/bursary discount.
5. **Given** students are enrolled in classes with known genders, **When** the enrollment-by-class table renders, **Then** each row shows class name, total active headcount, male count, and female count.
6. **Given** a student has no recorded gender, **When** the enrollment-by-class table renders, **Then** that student is counted in an "Other/Unknown" sub-column or absorbed into total without causing an error.

---

### User Story 3 - Accurate Students & Alerts KPIs (Priority: P1)

An administrator checks the Students & Alerts section to identify students requiring intervention. They need Low Attendance (below 75% this term), Outstanding Balances (students with any positive balance owed), and Over-Capacity Classes. The High Overdue Balances card must be removed entirely.

**Why this priority**: Alerts drive pastoral and financial follow-up actions. Stale or incorrect alert counts lead to missed interventions.

**Independent Test**: Can be fully tested by verifying the three remaining KPI cards show correct counts and that the High Overdue Balances card is absent from the rendered page.

**Acceptance Scenarios**:

1. **Given** students with attendance records this term, **When** the dashboard loads, **Then** Low Attendance shows the count of students whose attendance rate is below 75% for the current term.
2. **Given** students with outstanding balances, **When** the dashboard loads, **Then** Outstanding Balances shows the count of students who owe any positive amount.
3. **Given** the current dashboard layout, **When** the dashboard renders, **Then** the High Overdue Balances KPI card is not present anywhere on the page.
4. **Given** classes with a configured maximum capacity, **When** the dashboard loads, **Then** Over-Capacity Classes shows the count of classes where the enrolled student count exceeds the configured capacity.

---

### User Story 4 - Accurate Staff Overview KPIs (Priority: P2)

An HR officer or administrator opens the Staff Overview section to monitor workforce metrics. They need total staff count regardless of status, active teaching staff, non-teaching staff, all active staff, staff on leave today, and today's attendance rate (excluding staff on leave from the denominator). The Teaching w/ Active Classes card must be removed.

**Why this priority**: Staff metrics are operational but secondary to financial and student metrics. Accurate leave exclusion from the attendance rate prevents misleading figures.

**Independent Test**: Can be fully tested by loading the dashboard Staff section and verifying each KPI against the Staff list and attendance records; confirming Teaching w/ Active Classes card is absent.

**Acceptance Scenarios**:

1. **Given** staff records with various statuses, **When** the dashboard loads, **Then** Total Staff shows the count of all staff regardless of status.
2. **Given** active and inactive teaching staff, **When** the dashboard loads, **Then** Teaching Staff shows only active staff with a teaching role.
3. **Given** staff with non-teaching roles, **When** the dashboard loads, **Then** Non-Teaching Staff shows all non-teaching staff regardless of status is consistent with the spec intent of showing non-teaching staff total.
4. **Given** staff with various statuses, **When** the dashboard loads, **Then** All Active Staff shows the count of all staff with an active status.
5. **Given** staff on leave records for today, **When** the dashboard loads, **Then** Staff On Leave Today shows the count of staff on approved leave covering today's date.
6. **Given** staff attendance events for today exist, **When** Today's Attendance Rate is computed, **Then** the rate is `(staff who checked in today ÷ (total active staff − staff on leave today)) × 100%`.
7. **Given** the current dashboard layout, **When** the dashboard renders, **Then** the Teaching w/ Active Classes KPI card is not present anywhere on the page.

---

### User Story 5 - Transport KPIs Remain Accurate (Priority: P2)

An administrator verifies the Transport section shows the number of active routes and the number of students currently assigned to those routes.

**Why this priority**: Transport data is already largely correct; this story confirms no regression after other KPI changes.

**Independent Test**: Can be fully tested by comparing dashboard transport KPIs against the Transport routes and assignments list.

**Acceptance Scenarios**:

1. **Given** active transport routes with assigned students, **When** the dashboard loads, **Then** Active Routes shows the count of routes with status = active.
2. **Given** students assigned to active transport routes, **When** the dashboard loads, **Then** Students on Transport shows the distinct count of active students in active-route assignments.

---

### User Story 6 - KPI Tooltips & UX Improvements (Priority: P2)

An administrator or first-time user hovers over any KPI card or dashboard metric and sees a tooltip explaining what the metric means and what data scope is currently displayed. Quick Actions are compact and the Refresh KPIs button is removed.

**Why this priority**: Tooltips increase trust and reduce the learning curve. Compact Quick Actions free visual space without removing utility. Removing Refresh KPIs de-clutters the header.

**Independent Test**: Can be fully tested by hovering each KPI card to confirm a tooltip appears with a meaningful description, verifying Quick Actions section is visually compact, and confirming no Refresh KPIs button is present anywhere.

**Acceptance Scenarios**:

1. **Given** any KPI card on the dashboard, **When** the user hovers over the card or its info icon, **Then** a tooltip appears describing what the metric represents and its current data scope (e.g., "current term", "all time", "active students only").
2. **Given** the dashboard header or Quick Actions area, **When** the page renders, **Then** the Refresh KPIs button is absent from the entire page.
3. **Given** the Quick Actions section, **When** the page renders, **Then** the section is visually compact — buttons/links are smaller and the section occupies less vertical space than the current layout.
4. **Given** a KPI that is term-scoped, **When** no active term exists, **Then** the tooltip still renders and indicates the metric is term-scoped with a note that no active term is detected.

---

### Edge Cases

- What happens when no active academic term is set? Term-scoped KPIs (Collection Rate, Paid in Full, Term Revenue, Low Attendance) must display a graceful "No active term" state rather than dividing by zero or throwing an error.
- What happens when no students are active? All student-based KPIs must show zero without error.
- What happens when there are no attendance records for the current term? Low Attendance must show zero.
- What happens when all active staff are on leave today? Today's Attendance Rate denominator would be zero — the system must display "N/A" or 100% (all accounted for) rather than dividing by zero.
- What happens when a class has no capacity configured? Over-Capacity Classes must not count that class as over-capacity.
- What if a student has no gender recorded? The enrollment-by-class table must not fail; the student is counted in an "Other/Unknown" column.

## Requirements *(mandatory)*

### Functional Requirements

#### Financial Summary

- **FR-001**: The dashboard Financial Summary MUST display Total Outstanding as the sum of all positive outstanding balances across all active students, spanning all terms.
- **FR-002**: The dashboard Financial Summary MUST display Collection Rate as `(total payments received in the current academic term ÷ total charges raised in the current academic term) × 100`, expressed as a percentage rounded to one decimal place.
- **FR-003**: The dashboard Financial Summary MUST display Paid in Full as the count of active students who have no outstanding balance for the current academic term.
- **FR-004**: The dashboard Financial Summary MUST display Term Revenue as the total monetary value of all payments received within the date range of the current academic term.
- **FR-005**: When no active academic term is configured, term-scoped Financial KPIs (FR-002, FR-003, FR-004) MUST display a "No active term" indicator rather than a numeric value.

#### Enrolment & Academics

- **FR-006**: The dashboard Enrolment section MUST display Total Students as the count of students with an active status only.
- **FR-007**: The dashboard Enrolment section MUST display Total Classes as the count of non-archived, active classes only.
- **FR-008**: The dashboard Enrolment section MUST display Average Class Size as `total active students ÷ total active classes`, rounded to one decimal place; show "N/A" when there are no active classes.
- **FR-009**: The dashboard Enrolment section MUST display On Bursary as the count of active students who have any active full or partial scholarship or bursary discount applied.
- **FR-010**: The Enrollment by Class table MUST show, per class, the total active student headcount, male count, female count, and an Other/Unknown count for students with no recorded gender.

#### Students & Alerts

- **FR-011**: The dashboard Students & Alerts section MUST display Low Attendance as the count of active students whose attendance rate for the current term is below 75%.
- **FR-012**: The High Overdue Balances KPI card MUST be removed from the Students & Alerts section and must not appear anywhere on the dashboard.
- **FR-013**: The dashboard Students & Alerts section MUST display Outstanding Balances as the count of active students who have any positive outstanding balance (any term, not just the current one).
- **FR-014**: The dashboard Students & Alerts section MUST retain the Over-Capacity Classes KPI, showing the count of active classes where enrolled active student count exceeds the class's configured maximum capacity.

#### Staff Overview

- **FR-015**: The dashboard Staff Overview section MUST display Total Staff as the count of all staff records regardless of employment status.
- **FR-016**: The dashboard Staff Overview section MUST display Teaching Staff as the count of active staff with a teaching role designation.
- **FR-017**: The dashboard Staff Overview section MUST display Non-Teaching Staff as the count of all staff with a non-teaching role designation.
- **FR-018**: The dashboard Staff Overview section MUST display All Active Staff as the count of all staff with an active employment status.
- **FR-019**: The dashboard Staff Overview section MUST display Staff On Leave Today as the count of staff on approved leave records that cover today's date.
- **FR-020**: The dashboard Staff Overview section MUST display Today's Attendance Rate as `(staff who have a check-in attendance event today ÷ (total active staff − staff on leave today)) × 100%`; display "N/A" when the denominator is zero.
- **FR-021**: The Teaching w/ Active Classes KPI card MUST be removed from the Staff Overview section and must not appear anywhere on the dashboard.

#### Transport

- **FR-022**: The dashboard Transport section MUST display Active Routes as the count of transport routes with status = active.
- **FR-023**: The dashboard Transport section MUST display Students on Transport as the distinct count of active students with an active assignment to an active transport route.

#### Tooltips & UX

- **FR-024**: Every KPI card on the dashboard MUST display a tooltip (on hover or via an info icon) that describes what the metric measures and its current data scope.
- **FR-025**: The Refresh KPIs button MUST be removed from the dashboard entirely.
- **FR-026**: The Quick Actions section MUST be redesigned to be visually compact — reduced button size, reduced padding, and smaller overall footprint — without removing any action links.

### Key Entities

- **Academic Term**: The currently active term record used to scope term-specific KPIs; identified by a start date ≤ today ≤ end date.
- **Active Student**: A student record whose status is "active".
- **Active Class**: A class record that is not archived and has an active status.
- **Charge**: A ledger charge raised against a student for a given term.
- **Payment**: A ledger payment recorded against a student, associated with a payment date.
- **Bursary/Scholarship Discount**: A discount record linked to a student indicating a full or partial fee reduction.
- **Staff Attendance Event**: A check-in or check-out event for a staff member on a given date.
- **Leave Record**: An approved leave record covering a date range for a staff member.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All 4 Financial Summary KPIs display values that exactly match independently computed figures from the Payments and Charges data for the same scope.
- **SC-002**: Collection Rate renders as a percentage with one decimal place and reflects only the current term's charges and payments; it does not divide by zero when no term is active.
- **SC-003**: The High Overdue Balances and Teaching w/ Active Classes KPI cards are completely absent from the rendered dashboard — 0 occurrences in the DOM.
- **SC-004**: The Refresh KPIs button is completely absent from the rendered dashboard — 0 occurrences in the DOM.
- **SC-005**: Every KPI card displays a tooltip containing at least the metric name, a plain-language description, and the data scope (e.g., "current term", "all active students").
- **SC-006**: The Quick Actions section renders with noticeably reduced vertical height compared to the current layout, with no action links removed.
- **SC-007**: Today's Attendance Rate displays "N/A" when all active staff are on leave (zero denominator), with no division-by-zero error.
- **SC-008**: The Enrollment by Class table renders a gender breakdown (male/female/other) per class row without error, including when students have no recorded gender.
- **SC-009**: All KPI computations complete and the dashboard renders within 3 seconds under normal load.

## Assumptions

- The existing academic term model provides a reliable way to identify the "current active term" by date range; if multiple terms overlap, the most recently started one is used.
- "Bursary/On Bursary" is determined by the presence of an active discount record linked to the student with a scholarship or bursary type; the exact discount table/field will be confirmed during planning.
- "Non-Teaching Staff" is determined by staff role designation existing in the current staff model; the exact role field will be confirmed during planning.
- The existing LedgerService eligible charge/payment filters remain in use for all financial KPI calculations to maintain consistency with the ledger balance feature.
- The dashboard continues to use the pre-aggregated `/dashboard` snapshot endpoint backed by `DashboardAggregationService`; this feature updates the computations within that service rather than adding new endpoints.
- Gender breakdown for the enrollment table relies on a `gender` field already present on the student record; if absent, students are categorised as "Other/Unknown".
- Tooltips are implemented as UI-only additions and do not require backend changes.
- Quick Actions compact redesign is a frontend-only CSS/layout change; no actions are added or removed.
- The Refresh KPIs button removal is frontend-only; the underlying refresh endpoint is not removed from the backend.
- Staff roles (teaching vs. non-teaching) are assumed to be a flag or role field already present on the staff record.
- Working days for the attendance rate denominator are Mon–Fri; public holidays are out of scope for v1.
