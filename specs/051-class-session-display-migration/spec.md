# Feature Specification: Class Page Session Display & Migration Session Awareness

**Feature Branch**: `051-class-session-display-migration`  
**Created**: 2026-04-29  
**Status**: Draft  
**Input**: User description: "In the Class Page module, add a field at the top of the page that displays the current academic session. This session must match the one used for the latest enrollments. When migrating students, the system should use this current session as the source and automatically move students to the next academic session, determined based on the current session."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Current Academic Session on Classes Page (Priority: P1)

An admin or teacher opens the Classes page and immediately sees a clearly labelled badge or info field near the top that shows the active academic session (e.g. "2025/2026"). This is the same session that governs all current enrollments, sourced from `tenants.settings.activeAcademicSession` via `AcademicSessionService`. The display is read-only and requires no interaction.

**Why this priority**: Without session visibility, users cannot confirm which year's class assignments they are viewing. It is the foundation for the migration story below and is achievable with no new backend endpoint.

**Independent Test**: Open the Classes page → verify a session badge/label reading the active academic session is visible in the page header area. Fully testable in isolation.

**Acceptance Scenarios**:

1. **Given** a tenant with `activeAcademicSession = "2025/2026"` configured, **When** the admin navigates to the Classes page, **Then** a session indicator reading "2025/2026" is visible in the page header without any additional interaction.
2. **Given** only a legacy `academicYear = "2025"` is set (no `activeAcademicSession`), **When** the admin views the Classes page, **Then** the indicator shows the normalised form "2025/2026" (consistent with the existing `AcademicSessionService` fallback chain).
3. **Given** the settings API call fails, **When** the Classes page loads, **Then** the session indicator shows a graceful fallback (e.g. "—") and does not block page content from rendering.
4. **Given** a teacher (read-only role) views the Classes page, **Then** the session indicator is visible to them as well.

---

### User Story 2 - Migration Uses Current Session as Source and Auto-Derives Target (Priority: P2)

When an admin opens the "Promote Students" migration flow, the migration preview modal shows the source and target sessions derived from the active session — not from a hardcoded wall-clock year. The source session matches exactly what is displayed on the Classes page header, and the target session is automatically incremented (e.g. "2025/2026" → "2026/2027"). No manual session entry is required.

**Why this priority**: The session indicator (P1) makes the current session visible. This story ensures that session drives the migration — closing the loop and eliminating mis-migration risk from session drift.

**Independent Test**: Trigger "Promote Students" → open migration preview → verify modal header reads "2025/2026 → 2026/2027" matching the displayed session → confirm migration executes without manual session selection.

**Acceptance Scenarios**:

1. **Given** active session "2025/2026", **When** admin opens the migration preview modal, **Then** the modal title shows "Migration Summary – 2025/2026 → 2026/2027" sourced from the active session.
2. **Given** active session "2025/2026", **When** admin confirms migration, **Then** the promotion is executed using "2025/2026" as source and "2026/2027" as target with no additional user input.
3. **Given** no active session is configured, **When** admin opens the migration preview, **Then** a clear warning explains that no active session could be determined and the "Confirm Migration" button is disabled.
4. **Given** the current session matches the latest enrollment session, **When** migration is confirmed, **Then** students are moved to the derived next session without manual entry.

---

### User Story 3 - Session Badge Offers Configuration Path When Fallback is Active (Priority: P3)

If the session displayed on the Classes page is a fallback value (not explicitly configured), the session indicator provides a subtle cue — a tooltip or "Configure" link — pointing to Settings → General where `activeAcademicSession` can be set. This enables self-service resolution without needing a support ticket.

**Why this priority**: A useful discoverability enhancement, but P1 and P2 can ship without it.

**Independent Test**: Remove `activeAcademicSession` from tenant settings → open Classes page → verify the session indicator shows the fallback value with a "Configure in Settings" affordance.

**Acceptance Scenarios**:

1. **Given** no `activeAcademicSession` is set (fallback mode), **When** the admin views the Classes page session badge, **Then** the badge includes a visual cue and a link or tooltip pointing to Settings.
2. **Given** `activeAcademicSession` is explicitly set, **When** the admin views the Classes page, **Then** no "Configure" prompt is shown — the badge renders cleanly.

---

### Edge Cases

- What happens when the Classes page loads but the settings fetch is still in flight? The session indicator shows a skeleton/loading state; page class content loads independently without waiting.
- What happens when the derived next session (e.g. "2026/2027") already has enrollments? The existing migration preview reconciliation warning handles this; no additional handling is needed at the session display layer.
- What happens if `activeAcademicSession` is in an invalid format in the database? The backend `AcademicSessionService` normalises it before returning; the frontend treats a null/undefined value as unset and falls back to the legacy `academicYear` field.
- What happens if the session shown in the Classes header and the session in the migration preview modal disagree? The migration preview's `academicSession` field is authoritative (it comes directly from the backend's promotion logic); the header display should be consistent but does not override the preview.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Classes page MUST display the current active academic session in a clearly visible, labelled element within the page header area.
- **FR-002**: The displayed session MUST be sourced from the existing settings API (`GET /api/settings` → field `activeAcademicSession`), using the same fallback chain as `AcademicSessionService`: `activeAcademicSession` → normalised `academicYear` → current calendar year.
- **FR-003**: The session indicator MUST be visible to all roles that can access the Classes page (admin, teacher, bursar).
- **FR-004**: The session indicator MUST render a skeleton/loading state while the settings API call is pending, and MUST degrade gracefully (e.g. show "—") if the call fails, without blocking other page content.
- **FR-005**: The migration preview modal MUST display source and target session values that match the active session — the modal's existing `academicSession` and `nextSession` fields (returned by the migration preview endpoint) are trusted as the authoritative source.
- **FR-006**: The session displayed in the Classes page header and the source session shown in the migration preview modal MUST be consistent for the same tenant within the same page load.
- **FR-007**: The student promotion flow MUST use the active session as the source session and the auto-derived next session as the target, with no manual session selection required from the user for a standard year-end migration.
- **FR-008**: If no active session can be determined (both `activeAcademicSession` and `academicYear` are absent from settings), the migration "Confirm Migration" button MUST be disabled and a human-readable error message MUST be shown explaining that the session must be configured before migration can proceed.
- **FR-009** *(P3)*: When the session indicator is displaying a fallback-derived value (not explicitly configured), it SHOULD provide a navigation affordance pointing users to Settings to configure the active session.

### Key Entities

- **Active Academic Session**: The `activeAcademicSession` string in `tenants.settings` (format `YYYY/YYYY+1`), resolved by `AcademicSessionService`. Single source of truth for session-aware operations on the Classes page.
- **Next Academic Session**: Derived by incrementing the current session by one year (e.g. "2025/2026" → "2026/2027"). Computed server-side by `AcademicSessionService::getNextSession()`.
- **Migration Preview**: The object returned by `GET /api/students/migration-preview`, already carrying `academicSession` and `nextSession` fields aligned with the active session.
- **Settings Response**: The payload returned by `GET /api/settings`, which carries `activeAcademicSession` and legacy `academicYear` fields used to derive the displayed session.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of Classes page loads show the active academic session in the page header, with no additional navigation or interaction required.
- **SC-002**: The session displayed in the Classes page header matches the source session shown in the migration preview modal in 100% of concurrent views within the same tenant.
- **SC-003**: A standard year-end student migration can be initiated with zero manual session-selection steps — current session sourced automatically, next session derived automatically.
- **SC-004**: When no active session is configured, the migration confirmation is blocked and a resolution path (navigate to Settings) is presented, preventing accidental migration to incorrect sessions.
- **SC-005**: The session indicator's loading state resolves within the same render cycle as the page's own loading indicator, introducing no additional perceived latency for the user.

## Assumptions

- The `GET /api/settings` endpoint already returns `activeAcademicSession` in its response payload (confirmed in `SettingsController::index()` which calls `AcademicSessionService::getCurrentSession()`).
- The `MigrationPreview` object from `GET /api/students/migration-preview` already returns correctly-resolved `academicSession` and `nextSession` fields; no backend changes are required for FR-005/FR-007 as long as those fields are accurate.
- No new backend endpoints are required for the session display — the existing settings endpoint is sufficient. A dedicated lightweight endpoint may be considered if settings payload proves a performance concern but is not assumed necessary.
- The `ClassMigrationController` year-prefill endpoint (`GET /api/class-migration/year-prefill`) from spec 050 is available as a supplementary source but this feature relies on the settings endpoint for consistency with what the rest of the UI already uses.
- Session format is always `YYYY/YYYY+1` with consecutive years; the frontend trusts the backend's normalised output and does not revalidate the format client-side.
- Multi-tenant isolation is enforced at the backend; the frontend session display is scoped to the authenticated tenant's settings and requires no additional tenant-scoping logic.
- The feature is frontend-only for P1 and P2. P3 (configure affordance) is also frontend-only.
