# Feature Specification: Promote Student – Session-Scoped Preview & Filtering

**Feature Branch**: `053-promote-student-session-filter`  
**Created**: 2026-04-29  
**Status**: Draft  
**Input**: User description: "When running the 'Promote Student' feature, the preview should clearly indicate that only students with active enrollments in the current academic session will be migrated. For example, if the current academic session is 2026/2027, the system should only process students who are active and enrolled in the 2026/2027 session. These students should then be promoted to the next class, and their academic session should be updated to the subsequent session accordingly."

## User Scenarios & Testing *(mandatory)*

### User Story 1 – Preview Displays Active-Session Scope Clearly (Priority: P1)

An administrator opens the Promote Students migration preview. The modal prominently displays the current academic session (e.g. **2026/2027**) and makes it unambiguous that only students with an active enrollment in that exact session are counted and will be processed. Students who are enrolled in any other session, or who have no active enrollment, are excluded from the preview totals and the student list.

**Why this priority**: The core gap is informational — the preview currently shows all active students regardless of whether their enrollment belongs to the current session, misleading admins about who will actually be migrated. Fixing the display scope is the highest-value, lowest-risk change.

**Independent Test**: Open the migration preview modal while at least one student has an active enrollment from a prior session (e.g. 2025/2026) and at least one student has an active enrollment in the current session (e.g. 2026/2027). Verify the out-of-session student is absent from the preview count and student name list.

**Acceptance Scenarios**:

1. **Given** the active academic session is 2026/2027 and a student has `enrollment.status = 'active'` and `enrollment.academic_session = '2026/2027'`, **When** the admin opens the migration preview, **Then** that student appears in the preview with a destination class and next session 2027/2028.
2. **Given** the active academic session is 2026/2027 and a student has `enrollment.status = 'active'` but `enrollment.academic_session = '2025/2026'`, **When** the admin opens the migration preview, **Then** that student does NOT appear in any migration row or student count.
3. **Given** the active academic session is 2026/2027, **When** the preview modal is rendered, **Then** the modal header or description explicitly states that only students enrolled in 2026/2027 will be promoted.

---

### User Story 2 – Promotion Engine Filters by Current Session (Priority: P2)

When the admin confirms the promotion, the backend only promotes students whose active enrollment belongs to the current academic session. Students active in a different session are skipped, and the response counts reflect the actual session-scoped set.

**Why this priority**: Without the backend filter, the preview and the actual promotion can diverge — a student shown as excluded in the preview could still be promoted. The preview fix (P1) is meaningless unless the engine enforces the same rule.

**Independent Test**: Confirm the promotion with a mixed dataset. Verify the API response `promoted` count matches only the students enrolled in the current session, and that a student with a prior-session enrollment is absent from `promotionDetails`.

**Acceptance Scenarios**:

1. **Given** student A has an active enrollment in 2026/2027 and student B has an active enrollment in 2025/2026, **When** the admin confirms the migration for session 2026/2027, **Then** only student A is promoted; student B remains unchanged.
2. **Given** no students have an active enrollment in the current session, **When** the admin confirms the migration, **Then** the response returns `promoted: 0` and an informational message indicating no eligible students were found for the current session.
3. **Given** a student is promoted, **When** the promotion completes, **Then** the student's new enrollment record carries `academic_session = '2027/2028'` (the session immediately following the current one).

---

### User Story 3 – Persistent Session Scope Banner in Preview Modal (Priority: P3)

The preview modal shows a visible, non-dismissable banner that communicates the exact session scope: "Only students actively enrolled in **[current session]** will be promoted to **[next session]**." This banner is present regardless of whether there are students to promote.

**Why this priority**: A persistent, contextual cue prevents admins from confusing the cohort scope, especially in schools where multiple sessions coexist in the enrollment history.

**Independent Test**: Open the migration preview with no students eligible for the current session. Verify the session scope banner is still displayed and the summary counters all read 0.

**Acceptance Scenarios**:

1. **Given** any state of student data, **When** the migration preview modal opens with a configured active session, **Then** a session scope banner is displayed showing the current session and the next session it promotes into.
2. **Given** the active academic session is not configured, **When** the modal opens, **Then** the session scope banner is replaced by the existing "No Active Session" error and the confirm button remains disabled.

---

### Edge Cases

- What happens when a student's `current_enrollment_id` points to an enrollment with a stale or mismatched `academic_session`? These students are treated as out-of-session and excluded from the current promotion run; they are surfaced via the existing reconciliation drift count.
- How does the system handle a student who has two active enrollments (data integrity anomaly)? Only the enrollment referenced by `current_enrollment_id` is considered for session matching.
- What if the current session is not set? The confirm button stays disabled and no promotion can be triggered.
- What if all students in a class are enrolled in a past session? The class row should still appear in the preview but with `studentsToPromote = 0`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The migration preview API MUST filter eligible students to only those whose active enrollment record has `academic_session` equal to the current academic session.
- **FR-002**: The `getStudentsForPromotion` method MUST accept the current academic session as a parameter and apply it as an additional filter on the `enrollments.academic_session` column.
- **FR-003**: The migration preview modal MUST display a clearly visible session scope indicator showing the current session and the target next session before any student counts are shown.
- **FR-004**: The promotion engine (`POST /api/students/promote`) MUST use the same session-scoped student set as the preview, ensuring preview and actual promotion are consistent.
- **FR-005**: The preview response MUST include an explicit `academicSession` field in the per-class breakdown so the frontend can surface the filter context per row.
- **FR-006**: Students excluded due to session mismatch MUST NOT be conflated with configuration-skipped students in the response counters; the distinction must be surfaced.
- **FR-007**: The confirm button in the migration preview modal MUST remain disabled until a valid `academicSession` is present in the preview response.

### Key Entities

- **Enrollment**: Represents a student's enrolment in a class for a specific `academic_session`. The `status` field (active/promoted/graduated/repeating) and `academic_session` together determine promotion eligibility.
- **Student**: Has a `current_enrollment_id` pointing to their most recent active enrollment. Status `active` is a prerequisite but not sufficient alone — the linked enrollment's `academic_session` must also match the current session.
- **AcademicSession**: A tenant-scoped setting (`YYYY/YYYY+1` format) stored in `tenants.settings.activeAcademicSession`. Acts as the single source of truth for which session is being migrated.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The migration preview student count matches exactly the number of students with `enrollment.status = 'active'` AND `enrollment.academic_session = currentSession` for the given tenant — verified by comparing preview totals to a direct database count.
- **SC-002**: After confirming promotion, 0% of students from a prior session are found with a new enrollment bearing `academic_session = nextSession`, confirming the engine filtered correctly.
- **SC-003**: The session scope banner/indicator is visible in 100% of preview modal renders when an active session is configured.
- **SC-004**: The time to open and render the migration preview modal is not measurably increased (within 200 ms of the baseline) after the session filter is applied, even for tenants with 500+ students.

## Assumptions

- The current academic session is always stored in `tenants.settings.activeAcademicSession` and resolved via `AcademicSessionService::getCurrentSession()` — the existing service is the single source of truth and will not be replaced.
- A student's eligibility is determined by their `current_enrollment_id` enrollment record, not by scanning all historical enrollment records.
- The `YYYY/YYYY+1` session format is enforced by `AcademicSessionService::isValidSession()` and guaranteed before any promotion logic runs.
- The existing reconciliation mechanism handles drift (mismatched `current_enrollment_id`) independently; this feature does not alter reconciliation logic.
- Bulk promote (`POST /api/students/promote`) and the per-class preview (`GET /api/classes/promotion-preview`) share the same `getStudentsForPromotion` query path, so the session filter added to that method covers both endpoints.
- Mobile support and batch export of the preview are out of scope for this feature.
