# Feature Specification: Student Attendance – Class-Linked Event Tracking

**Feature Branch**: `068-student-attendance-classes`  
**Created**: 2026-05-08  
**Status**: Draft  
**Input**: User description: "The student attendance module should be designed as a daily event-tracking system connected to classes, rather than as a simple present/absent flag stored on the student record. Each attendance record must associate a student with a specific class instance, academic session, and date, ensuring that attendance data is always contextual rather than global. This structure enables the system to accurately handle scenarios such as class transfers, section changes, or repeated courses without losing historical accuracy. Attendance should be stored using structured status values such as present, absent, late, excused, or half-day, and should support either per-period or per-day tracking depending on the school configuration. Administrators should be able to record attendance, and every attendance action must be stored as an immutable log entry to preserve a complete audit trail. Using this event-based architecture, the system should be able to generate aggregated insights over time, including attendance percentages per student, class, section, or academic term, without modifying the original attendance records."

## User Scenarios & Testing *(mandatory)*

### User Story 1 – Daily Class Attendance Recording (Priority: P1)

An administrator opens the attendance view for a specific class on a given school day. They see the list of students currently enrolled in that class instance for the active academic session. They mark each student as present, absent, late, excused, or half-day, then submit. The system stores each mark as an immutable attendance event linked to the class instance, session, and date. Submitting a second time for the same class and date is allowed to correct mistakes, but the original entry is preserved in an audit log.

**Why this priority**: Recording daily class attendance is the primary and most frequently performed action in the module. All other functionality (reporting, aggregation) depends on having this data captured correctly.

**Independent Test**: Can be fully tested by submitting attendance for a class on a specific date and verifying the stored records contain the correct student, class instance, session, date, and status — without any reporting feature being in place.

**Acceptance Scenarios**:

1. **Given** a class instance exists in the active academic session and has enrolled students, **When** an administrator submits attendance with one status per student for that date, **Then** one immutable attendance event is created per student containing class instance, session, date, and status.
2. **Given** attendance has already been recorded for a class on a given date, **When** an administrator resubmits with corrections, **Then** a new attendance event is stored for each corrected student while the original event remains untouched in the audit log, and the latest event is used as the effective status.
3. **Given** a student is absent from the attendance submission, **When** the batch is saved, **Then** the student receives an explicit "absent" status event rather than having no record.
4. **Given** an administrator has no access rights, **When** they attempt to submit attendance, **Then** the system rejects the request with an authorization error.

---

### User Story 2 – Per-Period Attendance Tracking (Priority: P2)

A school configured for per-period tracking allows administrators to record attendance multiple times per day — once per class period — rather than a single daily mark. Each period record is still tied to the class instance, session, date, and an additional period identifier. Aggregation across periods gives a derived daily status for the student.

**Why this priority**: This supports schools with period-based timetables. The data model must accommodate periods from the start, but it is not the universal default and can be deferred from the initial MVP.

**Independent Test**: Can be fully tested by recording two separate period entries for the same student on the same date in the same class and verifying both are stored independently, then verifying the derived daily summary correctly reflects both.

**Acceptance Scenarios**:

1. **Given** the school is configured for per-period tracking, **When** an administrator submits attendance for Period 1 of a class, **Then** the event is stored with the period identifier alongside class instance, session, and date.
2. **Given** attendance has been recorded for multiple periods in a day, **When** the daily summary for a student is queried, **Then** the system derives a single daily status based on a configured aggregation rule (e.g., absent in any period = absent for the day).
3. **Given** the school is configured for per-day tracking, **When** an administrator views the attendance entry form, **Then** no period selector is presented and one entry per student per day is enforced.

---

### User Story 3 – Attendance Aggregation and Reporting (Priority: P2)

An administrator queries attendance statistics for a student, class, section, or academic term. The system computes attendance rates (e.g., "attended 85 of 100 school days") without modifying any underlying event records. Reports can be filtered by academic session, class instance, and date range.

**Why this priority**: Aggregated insights are the primary output of the attendance system for school management. They require the event data from US1 but are not needed to start recording attendance.

**Independent Test**: Can be fully tested by pre-populating a set of attendance events and querying the aggregation endpoint to verify computed percentages, counts, and breakdowns are correct.

**Acceptance Scenarios**:

1. **Given** a student has attendance events across multiple dates, **When** their attendance summary is requested for a term, **Then** the system returns total days recorded, present count, absent count, late count, excused count, half-day count, and attendance percentage.
2. **Given** a class instance has attendance recorded for multiple students, **When** the class attendance summary is requested, **Then** the system returns per-student breakdowns and an overall class attendance rate.
3. **Given** a student has transferred between classes within the same session, **When** their attendance history is queried, **Then** records from both class instances appear separately, each attributed to its correct class instance.
4. **Given** no attendance records exist for a queried date range, **When** the report is requested, **Then** the system returns an empty result rather than an error.

---

### User Story 4 – Audit Log Access (Priority: P3)

An administrator can view the full immutable audit trail for any attendance entry, showing every event recorded for a student on a given date including who submitted it and when, even when a correction has been applied.

**Why this priority**: Audit access is important for compliance and transparency but is not required to deliver the core attendance workflow.

**Independent Test**: Can be fully tested by recording attendance, resubmitting with a correction, then querying the audit log and verifying both the original and the corrected event are present with actor and timestamp.

**Acceptance Scenarios**:

1. **Given** attendance has been submitted and subsequently corrected, **When** the audit log is queried for that student and date, **Then** both the original and the corrected events are returned with submitter identity and timestamps.
2. **Given** no corrections have been made, **When** the audit log is queried, **Then** only the original event is returned.

---

### Edge Cases

- What happens when a student is enrolled in two class instances on the same date (e.g., after a transfer mid-term)? — Each attendance event is independently tied to its class instance; no conflict arises.
- What happens when attendance is submitted for a date in the future? — The system should reject attendance records dated in the future.
- What happens when a student is no longer enrolled in a class but historical attendance exists? — Historical events remain and are returned in reports; new attendance cannot be submitted for a class the student is not enrolled in.
- What happens when the school switches from per-day to per-period tracking mid-year? — Existing per-day records are preserved; new records follow the updated configuration. Aggregation treats pre-switch records as single-period days.
- What happens when a class instance has no enrolled students on the requested date? — The system returns an empty attendance list without error.
- What happens if the same student-class-session-date-(period) combination is submitted twice in the same batch? — The system should reject the batch with a duplicate-entry validation error.

## Requirements *(mandatory)*

### Functional Requirements

#### Event Recording

- **FR-001**: System MUST store each attendance action as a distinct immutable event record that cannot be updated or deleted after creation.
- **FR-002**: Each attendance event MUST link to a specific student, class instance, academic session, and date as required context fields.
- **FR-003**: Each attendance event MUST carry a structured status value from the set: `present`, `absent`, `late`, `excused`, `half-day`.
- **FR-004**: System MUST allow administrators to submit attendance for all students in a class in a single batch operation.
- **FR-005**: System MUST support an optional period identifier on each attendance event to enable per-period tracking.
- **FR-006**: System MUST enforce that per-period or per-day mode is determined by a tenant-level configuration setting; per-day mode prohibits multiple events for the same student, class, session, and date.
- **FR-007**: System MUST reject attendance events dated in the future.
- **FR-008**: System MUST reject a batch that contains duplicate student-class-session-date-(period) combinations.
- **FR-009**: System MUST store submitter identity (user) and submission timestamp on every attendance event.

#### Correction Workflow

- **FR-010**: System MUST allow a new attendance event to be submitted for a student-class-session-date-(period) that already has an existing event; the new event becomes the effective status.
- **FR-011**: System MUST retain all prior events for a given student-class-session-date-(period) combination as the immutable audit trail; prior events MUST NOT be deleted or modified.

#### Aggregation & Reporting

- **FR-012**: System MUST provide an attendance summary for a student filtered by academic session and optional date range, returning counts per status and an attendance percentage.
- **FR-013**: System MUST provide a class-level attendance summary filtered by class instance and optional date range, returning per-student breakdowns and an overall class attendance rate.
- **FR-014**: System MUST provide a term-level or section-level attendance aggregation, grouping by academic session.
- **FR-015**: Aggregation queries MUST derive results from event records without modifying any stored event data.
- **FR-016**: System MUST correctly attribute historical attendance to the class instance in which it was recorded, even when a student has subsequently transferred to a different class.

#### Audit Access

- **FR-017**: System MUST expose a query interface for the full event history for a given student, date, and class instance, including all superseded events.
- **FR-018**: Each audit event MUST include the submitter's identity and the timestamp of submission.

#### Access Control

- **FR-019**: Only authenticated users with administrator or designated attendance-recorder roles MUST be permitted to submit or correct attendance events.
- **FR-020**: Read access to attendance summaries and audit logs MUST respect tenant isolation; users in one tenant MUST NOT be able to access records belonging to another tenant.

### Key Entities

- **StudentAttendanceEvent**: An immutable record of a single attendance action. Attributes: student reference, class instance reference, academic session reference, date, period identifier (nullable), status (`present`/`absent`/`late`/`excused`/`half-day`), submitted-by (user reference), submitted-at timestamp, is-effective flag (latest for this combination).
- **ClassInstance**: An existing entity representing a class within an academic session and year. Attendance events are tied to this, not to the bare class template.
- **AcademicSession**: An existing entity representing the school year / term context. Required on every attendance event for temporal scoping.
- **AttendanceConfiguration**: A tenant-level setting that governs whether the school operates in per-day or per-period attendance mode.
- **AttendanceSummary** *(derived, not stored)*: A computed view of attendance counts and percentages aggregated from events, scoped to a student, class, or term.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An administrator can record attendance for an entire class of 50 students and have the results persisted within 3 seconds of submission.
- **SC-002**: After a correction is submitted, the effective attendance status for the affected student reflects the correction within one request cycle, while the original event remains retrievable from the audit log.
- **SC-003**: An attendance percentage for a student over an academic term is computed correctly (within ±0.1%) when queried against a known data set.
- **SC-004**: Attendance events from before and after a class transfer are both returned in a student's full history, each correctly attributed to the respective class instance.
- **SC-005**: The system rejects any attempt to submit attendance for a date in the future with an appropriate error.
- **SC-006**: Tenant isolation is enforced: an authenticated user from Tenant A receives zero attendance records when querying a student belonging to Tenant B.
- **SC-007**: Switching between per-day and per-period configuration at the tenant level takes effect for new submissions without corrupting or altering previously stored events.

## Assumptions

- The class instance (class × academic session) entity already exists in the system; this feature records against it without modifying the classes module.
- The academic session entity already exists; attendance events reference sessions by their existing identifiers.
- Student enrollment in a class instance is already tracked; attendance submission is only permitted for students who have an active enrollment record in that class instance on the given date.
- The existing JWT/RBAC authentication system is reused; no new authentication mechanism is introduced.
- Existing multi-tenant data isolation patterns from the codebase (tenant_id scoping) apply to all new attendance tables.
- Per-period tracking uses a simple period label/number (e.g., "Period 1", "Period 2") rather than a full timetable engine; timetable management is out of scope for v1.
- Public holiday calendars and automatic non-school-day detection are out of scope for v1; administrators are responsible for not recording attendance on non-school days.
- Self-service student or parent attendance dispute submission is out of scope for v1.
- Bulk import of historical attendance data via CSV or external integration is out of scope for v1.
- Reporting output is API-driven; PDF or CSV export is out of scope for v1.
