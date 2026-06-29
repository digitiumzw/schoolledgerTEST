# Feature Specification: Staff Attendance Summary — Aligned Column Format

**Feature Branch**: `033-staff-attendance-summary-columns`  
**Created**: 2026-04-14  
**Status**: Draft  
**Input**: User description: "Make the staff attendance summary display in the same format as the student attendance summary, with the following columns: Name | Present | Absent | Late | Excused | Total Days | Attendance %"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Consistent Attendance Summary Columns (Priority: P1)

An admin or school manager navigates to the Staff Attendance page and opens the Attendance Summary section. They expect to see the same column layout used in the Student Attendance Summary: Name, Present, Absent, Late, Excused, Total Days, and Attendance %. Currently the staff summary shows "On Leave" instead of "Excused", which creates an inconsistent experience when reviewing both reports side-by-side.

**Why this priority**: This is the core ask — the column structure must match exactly. Everything else in the summary (filters, search, sort) already exists and is correct.

**Independent Test**: Navigate to Staff Attendance → Attendance Summary tab. The table headers should read: Name | Present | Absent | Late | Excused | Total Days | Attendance %. This is fully testable in isolation.

**Acceptance Scenarios**:

1. **Given** the staff attendance summary is displayed, **When** a user views the table header row, **Then** the columns are: Name, Present, Absent, Late, Excused, Total Days, Attendance % — in that order.
2. **Given** a staff member has attendance records with statuses of `on_leave` and/or `half_day`, **When** the summary is computed, **Then** those records are counted under the "Excused" column.
3. **Given** the mobile view is active, **When** a user views a staff member's summary card, **Then** the card shows "Excused" (not "On Leave") with the correct count.

---

### User Story 2 - Accurate Excused Count in Summary (Priority: P2)

An admin reviews the staff attendance summary and wants to verify that the "Excused" count accurately reflects days where a staff member was on approved leave (on_leave) or worked a half day (half_day). Previously these were grouped together under "On Leave". The label should now be "Excused" to match student attendance terminology.

**Why this priority**: Data accuracy under the new label is critical — renaming the column without updating the underlying count logic would produce misleading information.

**Independent Test**: For a known staff member with recorded `on_leave` and `half_day` records in the selected period, verify the "Excused" count equals the sum of those two statuses.

**Acceptance Scenarios**:

1. **Given** a staff member has 3 `on_leave` records and 2 `half_day` records in the period, **When** the summary is computed, **Then** the Excused column shows 5.
2. **Given** a staff member has no leave or half-day records, **When** the summary is displayed, **Then** the Excused column shows 0.

---

### Edge Cases

- What if a staff member has no records in the selected period? The row should still appear with all counts at 0 and Attendance % at 0.
- What if Total Days is 0 (e.g. a future-only custom date range)? Attendance % should display as 0% without a divide-by-zero error.
- Mobile summary cards must also reflect the "Excused" label change (not just the desktop table).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The staff attendance summary table MUST display columns in this exact order: Name, Present, Absent, Late, Excused, Total Days, Attendance %.
- **FR-002**: The "On Leave" column MUST be renamed to "Excused" in the desktop table header and mobile summary card label.
- **FR-003**: The "Excused" count MUST aggregate both `on_leave` and `half_day` attendance statuses for each staff member.
- **FR-004**: The Attendance % calculation MUST remain unchanged: `(present + late) / totalDays * 100`.
- **FR-005**: The mobile summary card MUST show "Excused" as the label (replacing "On Leave") with the same aggregated count.
- **FR-006**: All existing summary features (date filters, search by name, sort by Attendance %) MUST continue to work without regression.

### Key Entities

- **Staff Attendance Summary Row**: Per-staff aggregate showing name, present, absent, late, excused (on_leave + half_day), total days, and attendance percentage for a selected date range.
- **Attendance Status Mapping**: The statuses `on_leave` and `half_day` map to the "Excused" column. The statuses `present`, `absent`, and `late` map to their respective columns unchanged.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The staff attendance summary table header exactly matches the student attendance summary table header: Name | Present | Absent | Late | Excused | Total Days | Attendance %.
- **SC-002**: The "Excused" column count for each staff member equals the sum of their `on_leave` and `half_day` records in the selected period.
- **SC-003**: Mobile summary cards display "Excused" and no longer show "On Leave".
- **SC-004**: No regression in existing summary filter, search, or sort behaviour.

## Assumptions

- The `on_leave` and `half_day` statuses are the staff equivalents of the student `excused` status and should be grouped together under "Excused".
- The attendance percentage formula (`(present + late) / totalDays * 100`) is not changing — only the column label and the field name for the leave/half-day bucket.
- "Total Days" in the staff summary continues to be calculated from actual recorded attendance days (not weekday counts), as the existing implementation computes it.
- No backend API changes are required; the aggregation is performed client-side.
- The change applies to both the desktop table and the mobile card view within the Attendance Records Tab component.
