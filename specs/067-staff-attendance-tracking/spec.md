# Feature Specification: Staff Attendance Tracking

**Feature Branch**: `067-staff-attendance-tracking`  
**Created**: 2026-05-08  
**Status**: Draft  
**Input**: User description: "the staff attendance module should be built as a time-based tracking system that records daily presence, absence, and working hours for each staff member without modifying their core profile. Instead of storing a simple present/absent flag, the system should log attendance events such as check-in, check-out, late arrival, early departure, and leave records, ideally with timestamps. This event-based approach allows accurate calculation of total hours worked, overtime, and attendance patterns over time. Leave management should also integrate tightly with attendance, so approved leave automatically reflects in attendance summaries rather than being manually adjusted and reporting should aggregate data per staff member, department, or time period"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Daily Attendance Event Logging (Priority: P1)

An administrator or HR officer records daily attendance events for staff members. Each event captures what happened and when: a staff member checked in at 08:15, left early at 14:30, or was absent on a given date. These events are timestamped and linked to the staff member's identity without altering their core profile. The system derives the day's attendance status (present, absent, late, early departure) from the logged events rather than requiring a manually set status flag.

**Why this priority**: This is the foundational data-collection layer. Without accurate event records, all downstream calculations (hours worked, overtime, reporting) are meaningless. Every other user story depends on this data existing.

**Independent Test**: Can be fully tested by logging check-in and check-out events for a staff member on a specific date and verifying that the system stores the correct timestamps and derives the correct daily status.

**Acceptance Scenarios**:

1. **Given** a staff member is active and a work day is ongoing, **When** an administrator logs a check-in event with a timestamp, **Then** the system records the event against that staff member and date, and the day's status is derived as "present."
2. **Given** a check-in has been logged, **When** an administrator logs a check-out event with a later timestamp, **Then** the system records the event and the daily worked hours are calculable from the difference.
3. **Given** a staff member has no events for a past work day, **When** an administrator marks them absent for that date, **Then** an absence event is recorded with the date and no hours are counted.
4. **Given** a check-in timestamp is after the configured start-of-day threshold, **When** the event is saved, **Then** the system marks the event type as "late arrival."
5. **Given** a check-out timestamp is before the configured end-of-day threshold, **When** the event is saved, **Then** the system marks the event type as "early departure."
6. **Given** attendance events already exist for a date, **When** the same event type is submitted again for the same staff member and date, **Then** the system rejects the duplicate or replaces the existing entry with an audit note.

---

### User Story 2 - Working Hours & Overtime Calculation (Priority: P1)

Based on the logged attendance events, the system automatically computes each staff member's total hours worked per day and per period. If total hours exceed the configured standard working hours for the day, the excess is flagged as overtime. Administrators can view daily and period summaries per staff member without manually tallying records.

**Why this priority**: This is the primary value proposition of an event-based attendance system over a simple present/absent flag — accurate time-based calculations that inform payroll and operational decisions. It completes the P1 MVP with US1.

**Independent Test**: Can be fully tested by logging a check-in and check-out for a staff member, then retrieving the daily summary and verifying that hours worked and overtime are correctly computed.

**Acceptance Scenarios**:

1. **Given** check-in and check-out events exist for a staff member on a date, **When** the daily summary is requested, **Then** the system returns total hours worked as the difference between check-out and check-in timestamps.
2. **Given** standard working hours are configured (e.g., 8 hours/day), **When** a staff member's worked hours exceed that threshold, **Then** the excess is recorded as overtime for that day.
3. **Given** a staff member has multiple days of events in a period, **When** the period summary is requested, **Then** the system returns total days present, total hours worked, total overtime hours, and total days absent.
4. **Given** a day has a leave event rather than check-in/check-out, **When** the daily summary is computed, **Then** hours worked are shown as zero and the day is excluded from overtime calculation.

---

### User Story 3 - Leave Management & Attendance Integration (Priority: P2)

HR officers manage staff leave requests (e.g., annual leave, sick leave, compassionate leave). When leave is approved for a date range, the attendance record for each covered day is automatically populated with a leave event of the appropriate type. Administrators do not need to manually adjust attendance for leave days; the approved leave acts as the attendance entry. Leave days are counted separately from absent days in summaries.

**Why this priority**: This eliminates the manual double-entry problem — approving leave in the system should be sufficient to keep attendance summaries accurate. It is P2 because the attendance event log from US1/US2 is fully functional without it; leave can initially be a standalone record and integrated once core tracking is stable.

**Independent Test**: Can be fully tested by creating a leave record for a staff member covering 3 days, approving it, then checking the attendance summary for those days and confirming each shows a leave event rather than absence or missing data.

**Acceptance Scenarios**:

1. **Given** a leave request is submitted for a staff member covering a date range, **When** the request is approved, **Then** an attendance event of type "leave" is automatically created for each working day in the range, linked to the approved leave record.
2. **Given** approved leave events exist for a period, **When** the period attendance summary is generated, **Then** leave days are counted as a separate category (not absent, not present) and reported with the leave type (annual, sick, etc.).
3. **Given** approved leave covers a date, **When** someone attempts to log a check-in event for that same staff member and date, **Then** the system warns that approved leave exists and requires confirmation before overriding.
4. **Given** approved leave is revoked or cancelled, **When** the cancellation is saved, **Then** the automatically created attendance events for the covered days are removed or voided.
5. **Given** a staff member has both leave days and present days in a period, **When** the attendance summary is requested, **Then** the summary correctly distinguishes days present, days on leave, and days absent.

---

### User Story 4 - Attendance Reporting by Staff, Department & Period (Priority: P2)

Administrators and HR officers can generate attendance reports aggregated by individual staff member, by department, or across a custom date range. Reports surface patterns such as chronic lateness, high absenteeism, or overtime trends. Data can be filtered and viewed per term, per month, or for an arbitrary date range.

**Why this priority**: Reporting is what turns raw event data into actionable insight. It is P2 because the underlying data must be correct first; reporting is the consumption layer built on top of P1 tracking.

**Independent Test**: Can be fully tested by generating a monthly summary report for a department, verifying it lists each staff member with correct days present, days absent, days on leave, total hours, and overtime hours.

**Acceptance Scenarios**:

1. **Given** attendance events exist for multiple staff members in a department, **When** a department summary report is requested for a date range, **Then** the report returns one row per staff member with aggregated days present, days absent, leave days, total hours worked, and overtime hours.
2. **Given** a date range is specified, **When** an individual staff member report is requested, **Then** the system returns a day-by-day breakdown showing each event type and hours worked per day.
3. **Given** a staff member has a pattern of late arrivals in a period, **When** the report is viewed, **Then** the count of late-arrival days is surfaced as a distinct metric.
4. **Given** no attendance data exists for a staff member in a requested period, **When** the report is generated, **Then** the system returns a zero-row summary rather than an error.
5. **Given** a report covers a period that includes approved leave days, **When** the report is rendered, **Then** leave days are shown under the leave category, not as absences.

---

### Edge Cases

- What happens when a check-out timestamp is earlier than the check-in timestamp for the same day? The system must reject the event with a validation error.
- What happens when no standard working hours are configured for the tenant? Hours worked must still be recorded; overtime calculation must be skipped or flagged as "unconfigured" rather than erroring.
- What happens when a leave request spans a weekend or public holiday? Only working days within the range should generate attendance leave events.
- What happens when attendance events are submitted for a future date? The system should allow pre-scheduling (e.g., planned leave) but mark forward-dated events distinctly.
- What happens when a staff member's profile is deactivated? Historical attendance records must remain intact and queryable; new events must not be accepted for deactivated staff.
- What happens when two administrators simultaneously submit conflicting events for the same staff member and date? The system must apply optimistic concurrency control or last-write-wins with an audit trail.
- What happens when the tenant has no staff members in a department? Department-level reports should return an empty result, not an error.

## Requirements *(mandatory)*

### Functional Requirements

**Event Logging**

- **FR-001**: The system MUST record attendance events per staff member per day, with each event carrying an event type (check-in, check-out, late-arrival, early-departure, absent, leave) and a precise timestamp.
- **FR-002**: The system MUST derive the daily attendance status (present, absent, late, early-departure, on-leave) from the combination of events for that day rather than requiring a manually set status flag.
- **FR-003**: The system MUST reject check-out events where the timestamp precedes the same-day check-in timestamp, returning a descriptive validation error.
- **FR-004**: The system MUST prevent duplicate events of the same type for the same staff member and date, or require explicit confirmation to override an existing event.
- **FR-005**: The system MUST preserve the core staff member profile unchanged; attendance data must be stored as a separate, linked record.

**Hours & Overtime Calculation**

- **FR-006**: The system MUST calculate daily hours worked as the elapsed time between check-in and check-out events for a given staff member and date.
- **FR-007**: The system MUST flag daily overtime when calculated hours worked exceed the tenant-configured standard working hours threshold for that day.
- **FR-008**: The system MUST aggregate per-period totals for each staff member: total days present, total days absent, total days on leave, total hours worked, and total overtime hours.
- **FR-009**: Leave days MUST contribute zero hours worked and MUST NOT be included in overtime calculations.

**Leave Integration**

- **FR-010**: The system MUST automatically create attendance events of type "leave" for each working day covered by an approved leave record, eliminating the need for manual attendance entry.
- **FR-011**: Leave events MUST carry the leave type (e.g., annual, sick, compassionate) sourced from the linked leave record.
- **FR-012**: The system MUST warn when a manual attendance event is submitted for a date already covered by approved leave, requiring confirmation before overriding.
- **FR-013**: When an approved leave record is cancelled or revoked, the system MUST void or remove the automatically created attendance leave events for the covered days.
- **FR-014**: Leave days MUST be reported as a distinct category, separate from both "present" and "absent," in all summaries and reports.

**Reporting & Aggregation**

- **FR-015**: The system MUST provide an attendance summary report filterable by individual staff member, department, and date range (including term-aligned and calendar-month ranges).
- **FR-016**: Individual staff member reports MUST include a day-by-day breakdown with event types, timestamps, hours worked per day, and overtime flag.
- **FR-017**: Department-level reports MUST aggregate one row per staff member showing days present, days absent, days on leave, total hours worked, and overtime hours within the requested period.
- **FR-018**: Reports MUST surface late-arrival count as a distinct metric for each staff member.
- **FR-019**: The system MUST return empty/zero-row summaries (not errors) when no data exists for a requested period or staff member.

**Access Control**

- **FR-020**: Only users with the admin or HR officer role MUST be permitted to create, update, or delete attendance events and leave records.
- **FR-021**: All attendance and leave data MUST be scoped to the authenticated user's tenant; cross-tenant access MUST be rejected.

### Key Entities

- **StaffAttendanceEvent**: Represents a single timestamped event in a staff member's working day. Attributes: staff member reference, date, event type (check-in / check-out / late-arrival / early-departure / absent / leave), timestamp, source (manual / leave-integration / future), notes, linked leave record reference (nullable). Each staff member may have multiple events per day.
- **StaffLeaveRecord**: Represents a leave request and its lifecycle. Attributes: staff member reference, leave type (annual / sick / compassionate / other), start date, end date, status (pending / approved / cancelled), approved-by reference, approval timestamp, notes. Drives automatic attendance event generation on approval.
- **AttendanceDaySummary** (derived): A computed view aggregating all events for one staff member on one date into: daily status, hours worked, overtime hours, event list. Not stored independently; computed on read from raw events.
- **AttendancePeriodSummary** (derived): A computed aggregation over a date range for one staff member or a department: days present, days absent, days on leave, late-arrival count, total hours worked, total overtime hours.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An administrator can log a check-in and check-out for a staff member, and the system correctly returns calculated daily hours worked and correct attendance status without any manual calculation.
- **SC-002**: Approving a leave record for N working days automatically creates N attendance leave events, each correctly typed, with zero manual attendance entries required.
- **SC-003**: A department attendance report covering a one-month period is returned within 3 seconds for departments of up to 100 staff members.
- **SC-004**: Late-arrival and early-departure events are automatically classified by the system based on configured time thresholds, with zero manual classification required.
- **SC-005**: All attendance data remains isolated per tenant; a query against one school's data returns zero results from another school's records, verified by tenant-isolation tests.
- **SC-006**: Cancelling an approved leave record voids all associated automatically created attendance events, and the affected days revert to an unrecorded state in the summary, requiring no manual cleanup.
- **SC-007**: An individual staff member's attendance report for any date range accurately reflects the combination of manual events and leave-integrated events, with no double-counting of leave days as absences.

## Assumptions

- Staff members already exist as entities in the system with unique IDs and department associations; this feature records attendance against existing staff records without creating a new staff profile entity.
- The system supports a concept of "departments" for staff, allowing department-level filtering in reports; if the staff model does not already have a department field, this feature adds it as a lightweight attribute.
- Standard working hours (e.g., start time, end time, hours per day) are configurable per tenant via the existing settings mechanism; the feature reads these thresholds to classify late arrivals and compute overtime.
- "Working days" excludes weekends (Saturday and Sunday) by default; public holiday calendars are out of scope for v1 and leave spanning non-working days will skip those days automatically.
- Leave types (annual, sick, compassionate, other) are a fixed enumeration for v1; a configurable leave-type registry is deferred to a future iteration.
- Attendance event submission is performed by administrators or HR officers through the existing admin UI; a self-service staff portal for self check-in is out of scope for v1.
- The existing JWT authentication and role-based access control system is reused; no new authentication mechanism is required.
- Tenant isolation follows the existing multi-tenant pattern applied across all other features in the system.
- Historical attendance data import from external systems is out of scope; only events created within this system are managed here.
