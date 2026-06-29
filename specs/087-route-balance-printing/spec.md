# Feature Specification: Route Balance and Printable Student List

**Feature Branch**: `087-route-balance-printing`  
**Created**: 2026-06-09  
**Status**: Ready for Review  
**Input**: User description: "When viewing route details, display all students who have outstanding balances, along with their balance amounts, directly on the Route Details page. Also add an option to print the student list, including each student's assigned stop and the date and time the list was printed. The printed report should clearly show the students, their stops, any outstanding balances, and the print timestamp."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Outstanding Balances on Route Details (Priority: P1)

An administrator or bursar opens a transport route detail page to see which assigned students still owe money. The page now shows each student's current outstanding balance (total ledger balance) alongside their name, class, and assigned stop. A route-level summary shows the aggregate outstanding amount and how many students have a non-zero balance.

**Why this priority**: Transport route managers need to quickly identify which families on a route have unpaid fees so they can follow up before travel commences. This is the core value of the feature.

**Independent Test**: Can be fully tested by loading any route detail page that has active student allocations and verifying that each student row displays a balance amount, and that the route summary card shows the total outstanding balance and count of students with balances greater than zero.

**Acceptance Scenarios**:

1. **Given** a route with 3 active students where 2 have positive outstanding balances and 1 has a zero balance, **When** an admin views the route detail page, **Then** each student row displays their name, class, stop, direction, and outstanding balance amount formatted as currency; the 2 students with balances show positive amounts and the 1 with zero balance shows "$0.00" or "—".
2. **Given** a route with active students, **When** the route detail page loads, **Then** a summary section displays the total number of students on the route, the count of students with outstanding balances, and the sum of all outstanding balances for that route.
3. **Given** a route with no student allocations, **When** the route detail page loads, **Then** the student list shows the existing empty state and the balance summary shows zero values.

---

### User Story 2 - Print Student List with Balances and Stops (Priority: P2)

An administrator clicks a "Print List" button on the route detail page to generate a printable report of all students on the route. The printed report includes each student's name, class, assigned stop, direction, outstanding balance, and the date/time the report was generated. The report is formatted for A4 paper and prints cleanly via the browser print dialog.

**Why this priority**: Schools often need physical lists for drivers, conductors, or administrators who do not have access to the digital system while on the bus or in the field. This extends the digital value to offline workflows.

**Independent Test**: Can be fully tested by clicking the print button on a route detail page and verifying the browser print preview shows a clean formatted list with all required fields and a generation timestamp.

**Acceptance Scenarios**:

1. **Given** a route with active student allocations, **When** an admin clicks the "Print List" button, **Then** the browser print dialog opens showing a formatted report with the route name, a table of students (name, class, stop, direction, balance), a route summary (total students, students with balances, total outstanding), and a footer showing "Printed on [date] at [time]".
2. **Given** a route with zero students, **When** an admin clicks the "Print List" button, **Then** the print dialog opens showing the route name and a message indicating no students are allocated, with the print timestamp still visible.

---

### Edge Cases

- What happens when a student has a negative balance (overpayment)? The display should show the negative amount clearly (e.g., "-$50.00") so the user understands the student is in credit.
- What happens when the ledger service is unavailable or throws an exception? The route detail page should still load; balance values should show an error state or "—" and not crash the page.
- What happens when a student has no stop assigned (NULL stop_id)? The stop column should display "—" or "No stop assigned" in both the UI and the printed report.
- What happens when a student has an inactive status but an active transport allocation? The existing route detail page already filters to active students only; this behavior is preserved.
- How does the print report handle very long student lists? The print stylesheet should ensure the table splits cleanly across pages with repeating headers.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The route detail API response MUST include, for each active student allocation on the route, the student's current outstanding ledger balance (`totalBalance` from `LedgerService.getStudentBalance()`) computed using the existing LedgerService formula.
- **FR-002**: The route detail API response MUST include route-level aggregate summary fields: totalStudents, studentsWithBalance, and totalOutstandingBalance.
- **FR-003**: The route detail page MUST display each student's outstanding balance in the student list card, positioned alongside the existing name, class, stop, and direction fields.
- **FR-004**: The route detail page MUST display a summary card or section showing the total number of students on the route, the count of students with a positive outstanding balance, and the sum of all outstanding balances.
- **FR-005**: The route detail page MUST include a "Print List" button that triggers the browser print dialog.
- **FR-006**: The printable report MUST display the route name as a header.
- **FR-007**: The printable report MUST list every active student on the route in a table with columns: Student Name, Class, Stop, Direction, Outstanding Balance.
- **FR-008**: The printable report MUST include a summary section showing total students, students with outstanding balances, and total outstanding balance.
- **FR-009**: The printable report MUST include the exact date and time the report was generated, formatted as "Printed on [date] at [time]" in a footer or header area.
- **FR-010**: The printable report MUST use a print-specific stylesheet that hides navigation, action buttons, modals, and other non-report UI elements, and ensures the table is readable on A4 paper.
- **FR-011**: Backend APIs MUST return view-ready data for all feature screens, including any
  filtering, searching, pagination, sorting, aggregations, and computed values required by the
  frontend.
- **FR-012**: Frontend behavior MUST be limited to passing user-selected query parameters and
  rendering backend-prepared responses; it MUST NOT perform client-side data filtering,
  searching, sorting, pagination, aggregations, or business computations.
- **FR-013**: Every user action that triggers a data change (create, update, delete, submit,
  refresh, bulk-operation, status-change) MUST display a visible loading indicator from the
  moment the request is initiated until the response is fully received and the UI reflects
  the confirmed server state. Action-triggering controls MUST be disabled during in-flight
  requests to prevent duplicate submissions.
- **FR-014**: After any mutation completes, all React Query queries whose data was affected
  MUST be invalidated or updated so the next render reflects the latest server state. Stale
  cached values MUST NOT flash or re-appear after the mutation response is processed.

### Key Entities *(include if feature involves data)*

- **TransportRoute**: Represents a school bus route. Already exists. Key attributes: routeName, monthlyFee, status, stops, vehicle, driver, students.
- **TransportAllocationStudent**: Represents a student assigned to a route. Already exists. Key attributes: allocationId, studentId, studentName, studentClass, stopId, stopName, direction, status. This feature adds: balance.
- **RouteBalanceSummary**: A computed aggregate for a route. Key attributes: totalStudents (count), studentsWithBalance (count of students where balance > 0), totalOutstandingBalance (sum of all positive balances).
- **PrintableRouteReport**: A view-only representation of the route and its students formatted for printing. Key attributes: routeName, printedAt, students[], summary.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can view outstanding balances for all students on a route in a single page load without navigating away from the route detail page.
- **SC-002**: The printable student list generates within 1 second of clicking the print button and renders correctly in the browser print preview.
- **SC-003**: The route detail API endpoint returns all student balance data and route summary aggregates in a single request with response time under 500ms for routes with up to 100 students.
- **SC-004**: The printed report contains 100% of the required fields (student name, class, stop, direction, balance, print timestamp) and no hidden or extraneous UI elements.
- **SC-005**: The `totalBalance` values shown on the route detail page exactly match the `totalBalance` values returned by `LedgerService.getStudentBalance()` for each student within the same tenant context.

## Clarifications

### Session 2026-06-09

- **Q**: Which specific balance value should be displayed per student — totalBalance, feeBalance, transportBalance, or a transport-specific subset? → **A**: The `totalBalance` field from `LedgerService.getStudentBalance()` is the canonical value to display per student and to aggregate at the route level. Fee/transport splits are available in the existing student profile but are not required on the route detail page.

## Assumptions

- The existing LedgerService.getStudentBalance() method is the authoritative source for student outstanding balances and will be reused.
- The existing route detail endpoint already returns active students with allocations; this feature enriches that data with balance fields and aggregates.
- The print functionality is browser-native (window.print()) with a dedicated print stylesheet; no PDF generation service or third-party library is required for v1.
- Mobile-specific print optimization is out of scope for v1; the primary use case is desktop printing for office staff.
- Only users with the existing route-detail access roles (super_admin, admin, bursar) can view balances and print the list; no new role requirements are introduced.
