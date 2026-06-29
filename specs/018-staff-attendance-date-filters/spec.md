# Feature Specification: Add Date Filters to Staff Attendance Records

**Feature Branch**: `018-staff-attendance-date-filters`  
**Created**: 2026-04-08  
**Status**: Draft  
**Input**: User description: "i want you to add date filters in the staff attendance records"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Filter Records by Preset Date Range (Priority: P1)

An admin or bursar visiting the Staff Attendance > Records tab wants to narrow down the list to a specific time period. They select a preset range (e.g. "Last 30 Days", "This Month", "Last Month") from a dropdown, and the records table immediately updates to show only attendance entries within that range.

**Why this priority**: The records tab currently shows all historical records with no time scoping. A date range filter is the most common way staff review attendance history and is the minimum useful addition.

**Independent Test**: Open the Records tab, select "This Month" — only records dated within the current calendar month appear. Selecting "All" restores the full list.

**Acceptance Scenarios**:

1. **Given** the Records tab is open with multiple records spanning several months, **When** the user selects "This Month" from the date range filter, **Then** only records whose date falls within the current calendar month are displayed.
2. **Given** a date range filter is active, **When** the user selects "All" or clears the filter, **Then** all records are restored and the record count returns to the full total.
3. **Given** no records exist in the selected range, **When** a date range filter is applied, **Then** an empty-state message is shown rather than an error.

---

### User Story 2 - Filter Records by Custom Date Range (Priority: P2)

An admin needs to audit attendance for a specific pay period or disciplinary review. They choose "Custom Range", pick a start date and an end date from calendar pickers, and the table updates to show only records within that window.

**Why this priority**: Preset ranges cover common cases; custom ranges are needed for ad-hoc reviews, audits, and payroll periods that don't align with calendar months.

**Independent Test**: Select "Custom Range", enter a start and end date that spans 2 weeks, confirm only records within those 2 weeks are shown.

**Acceptance Scenarios**:

1. **Given** the user selects "Custom Range", **When** they provide a valid start date and end date, **Then** the table shows only records within the inclusive date window.
2. **Given** the user enters a start date that is after the end date, **When** they attempt to apply the filter, **Then** an inline validation message is shown and no records are filtered.
3. **Given** a custom range is active, **When** the user changes either date, **Then** the table updates immediately without requiring a separate "Apply" action.

---

### Edge Cases

- What happens when the selected date range spans a future date? Records for future dates should not be included (no future attendance exists).
- How does the filter interact with the existing staff name search and status filter? All active filters must apply together (AND logic).
- What if the user clears only the start or end date of a custom range? The filter should remain inactive until both dates are provided.
- How does pagination behave when a filter is applied? The page should reset to page 1 when the date filter changes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Records tab MUST provide a date range filter control visible above the records table.
- **FR-002**: The filter MUST offer preset options: All, Last 7 Days, Last 30 Days, This Month, Last Month, This Year.
- **FR-003**: The filter MUST offer a "Custom Range" option that reveals a start date picker and an end date picker.
- **FR-004**: Applying any date filter MUST update the displayed records immediately without a full page reload.
- **FR-005**: The date filter MUST combine with the existing staff name search and status filter using AND logic — all active filters apply simultaneously.
- **FR-006**: Selecting a new date filter preset or changing custom dates MUST reset the records list to page 1.
- **FR-007**: When a custom range has a start date after the end date, the system MUST display an inline validation message and prevent filtering.
- **FR-008**: When no records match the active filters, the system MUST display an empty-state message.
- **FR-009**: The selected date filter state MUST persist while the user is on the Records tab (but need not persist across navigation away and back).

### Key Entities

- **Attendance Record**: Has a `date` field (YYYY-MM-DD) used for range filtering. Filtering is performed client-side on already-loaded records.
- **Date Range**: Represented as a start date and end date (inclusive on both ends).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can filter attendance records to a specific month in under 5 seconds (2 clicks + table update).
- **SC-002**: Custom date range filtering requires no more than 3 user interactions (select "Custom Range", pick start, pick end).
- **SC-003**: All three active filters (date range, staff name search, status) work together correctly — 100% of records shown must satisfy all active filter conditions simultaneously.
- **SC-004**: Pagination correctly reflects filtered results — the record count shown in the pagination summary matches the number of filtered rows.

## Assumptions

- Filtering is performed client-side on the already-fetched records (no new API call per filter change), consistent with the existing search and status filter pattern in AttendanceRecordsTab.
- The preset list (Last 7 Days, Last 30 Days, This Month, etc.) is fixed; no user-configurable preset management is in scope.
- Mobile layout receives the same filter controls, stacked vertically if needed.
- The existing "All Status" and staff name search filters remain unchanged and continue to work alongside the new date filter.
