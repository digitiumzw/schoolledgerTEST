# Feature Specification: Session Alert and Configuration

**Feature Branch**: `052-session-alert-and-config`  
**Created**: 2026-04-29  
**Status**: Draft  
**Input**: User description: "If no session is configured in the settings, show an alert prompting the user to update the session there. The session should be both editable and configurable within the academic calendar. Provide it as a pre-filled dropdown so the user can easily select and update it. This functionality must also be integrated with the class promotion logic. Additionally, in the session dropdown within the Academic Calendar tab, display the recommended session by default."

## User Scenarios & Testing *(mandatory)*

### User Story 1 – No-Session Alert with Pre-filled Dropdown in General Settings (Priority: P1)

An admin opens the General Settings tab. The active academic session field currently shows "Not set" (or is null). Instead of a static read-only display, the session is shown as a pre-filled `Select` dropdown. When no session has been saved, the dropdown defaults to the *recommended* session (current year / next year, e.g., `2026/2027`). A prominent alert banner appears above the settings form explaining that no session is configured and directing the user to update it. The user selects or accepts the pre-filled value and clicks **Save Session**.

**Why this priority**: Without a configured session, class promotion and student migration are blocked. This is the highest-value unblock for admins.

**Independent Test**: Can be fully tested by loading General Settings with a tenant that has `activeAcademicSession = null`, verifying the alert renders, the dropdown is pre-filled with the recommended session, and saving updates the setting without errors.

**Acceptance Scenarios**:

1. **Given** the admin loads General Settings and `activeAcademicSession` is `null`, **When** the page renders, **Then** an alert is shown stating no session is configured with a call-to-action to set one, and the session field is an editable dropdown pre-filled with the recommended session (current/next year).
2. **Given** the session dropdown is pre-filled with the recommended session, **When** the admin clicks Save Session, **Then** the session is persisted and the alert disappears on reload.
3. **Given** `activeAcademicSession` is already set, **When** the admin loads General Settings, **Then** no "no session" alert is shown and the dropdown displays the currently saved session value.
4. **Given** the admin wants to change the session, **When** they open the dropdown, **Then** options spanning 2 years back through 3 years ahead are available and selectable.

---

### User Story 2 – Recommended Session Default in Academic Calendar Tab (Priority: P2)

An admin opens the Academic Calendar tab. The **Active Academic Session** card contains a `Select` dropdown for choosing the session. When no session is saved, the dropdown is pre-filled with the *recommended* session (current year / next year) rather than defaulting to "— Not set". When a session is already configured, it shows the saved value as before.

**Why this priority**: Reduces friction when setting up or updating the session; the most likely intended value is pre-selected so the admin only needs to confirm and save.

**Independent Test**: Can be fully tested by navigating to Academic Calendar tab with `activeAcademicSession = null` and confirming the dropdown value is pre-populated with the recommended session (not blank / "— Not set").

**Acceptance Scenarios**:

1. **Given** `activeAcademicSession` is `null` and the admin opens the Academic Calendar tab, **When** the session card renders, **Then** the dropdown shows the recommended session (e.g., `2026/2027`) as the pre-selected value.
2. **Given** `activeAcademicSession` is set to `2025/2026`, **When** the admin opens the Academic Calendar tab, **Then** the dropdown shows `2025/2026` (existing behaviour preserved).
3. **Given** the dropdown is showing the recommended session (pre-filled), **When** the admin clicks "Save Session" without changing it, **Then** the recommended session is saved and a success toast is shown.

---

### User Story 3 – Class Promotion Blocked with In-context Session Alert (Priority: P3)

An admin navigates to the Classes page and attempts to run "Promote Students" when no active session is configured. The existing destructive alert and toast remain, but the alert now also embeds a pre-filled session selector (a compact inline dropdown + save button) so the admin can configure the session without leaving the page. Once saved, the promotion button becomes active.

**Why this priority**: Reduces the round-trip to Settings. The promotion flow already gracefully blocks and redirects; the inline fix-in-place UX is a quality-of-life improvement.

**Independent Test**: Can be fully tested by visiting Classes with no active session, confirming the session-missing alert shows an inline session selector, setting a session, and then clicking Promote Students successfully.

**Acceptance Scenarios**:

1. **Given** no active session is configured, **When** the admin visits the Classes page, **Then** the existing "No active academic session" alert includes an inline compact session dropdown (pre-filled with recommended session) and a "Set Session" save button.
2. **Given** the admin uses the inline dropdown to set a session and clicks "Set Session", **When** the save succeeds, **Then** the alert disappears, the session badge updates, and the "Promote Students" button becomes clickable without a full page reload.
3. **Given** the admin clicks "Promote Students" with no session, **When** the toast is shown, **Then** it still contains guidance directing them to configure the session.

---

### Edge Cases

- What happens when the recommended session (current year/next year) is not in the options list? (The options always span current year ± several years, so the recommended session is always included.)
- How does the system handle a race condition where the session is set via the inline Classes widget and then the MigrationPreviewModal checks `preview.academicSession`? (The modal re-fetches preview on open; after the inline save the new session is reflected on next modal open.)
- What if the user saves the pre-filled recommended session and then navigates back — is the "no session" alert suppressed? (Yes — the alert only shows when `activeAcademicSession` is null/unset.)
- What if the user clears the session back to "— Not set" in the Academic Calendar tab and saves? (The alert reappears on next load of General Settings and Classes pages.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display a persistent alert on the General Settings tab when `activeAcademicSession` is `null` or unset, informing the admin that no session is configured.
- **FR-002**: The active session field in General Settings MUST be an editable `Select` dropdown (not a read-only input) so the admin can select and save a session directly from that tab.
- **FR-003**: The session dropdown in General Settings MUST be pre-filled with the recommended session (current calendar year / next year, e.g., `2026/2027`) when no session is currently saved.
- **FR-004**: The session dropdown in General Settings MUST retain its current saved value when a session is already configured.
- **FR-005**: Saving the session from the General Settings tab MUST persist the change to the backend via the same settings API used by the Academic Calendar tab.
- **FR-006**: The session `Select` dropdown in the Academic Calendar tab MUST default to the recommended session (current year / next year) when `activeAcademicSession` is `null`, instead of defaulting to "— Not set".
- **FR-007**: The Classes page "No active session" alert MUST include an inline session selector (pre-filled with the recommended session) and a "Set Session" save button, allowing the admin to configure the session without navigating away.
- **FR-008**: After the inline session save on the Classes page succeeds, the session state MUST refresh so the promotion button becomes active and the alert is dismissed — without requiring a full page reload.
- **FR-009**: The MigrationPreviewModal's "No Active Session" alert MUST remain present and continue to block the "Confirm Migration" button when no session is set.
- **FR-010**: All session dropdowns across General Settings, Academic Calendar, and the Classes inline widget MUST present the same set of session options (2 years back through 3 years ahead from the current year).

### Key Entities

- **Settings**: Contains `activeAcademicSession` — the single source of truth for the configured session. Updated via `PUT /settings`.
- **Session Option**: A string in `YYYY/YYYY+1` format (e.g., `2026/2027`). The *recommended* session is computed as `currentYear + "/" + (currentYear + 1)`.
- **Active Session Alert**: UI notice shown on General Settings and Classes pages when `activeAcademicSession` is null.
- **Inline Session Selector**: A compact dropdown + save button embedded in the Classes page alert for in-context session configuration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When `activeAcademicSession` is null, the General Settings tab renders a visible alert and a pre-filled session dropdown within 500 ms of page load.
- **SC-002**: An admin with no session configured can set the session entirely from the General Settings tab or the Classes page without navigating to the Academic Calendar tab.
- **SC-003**: The session dropdown on the Academic Calendar tab shows the recommended session as the default value (not "— Not set") when no session is saved; verified across fresh loads.
- **SC-004**: After setting the session via the inline Classes widget, the "Promote Students" button becomes active and the alert dismisses within 1 second — without a full page reload.
- **SC-005**: All session dropdowns (General Settings, Academic Calendar, Classes inline) show the same recommended default and the same option set when no session is configured.

## Assumptions

- The "recommended session" is always `currentYear/currentYear+1` (e.g., for 2026, the recommendation is `2026/2027`). This matches the existing `sessionOptions` computation already present in both tabs.
- Session data is stored as a string field on `Settings`; no separate `Session` entity or table is required.
- The General Settings tab session save will use a dedicated "Save Session" action (matching the Academic Calendar tab pattern) rather than bundling it with the full general-settings save, for consistency and minimal API payload.
- Mobile responsiveness of the inline Classes widget is in scope; it should stack gracefully on small screens using flex-wrap.
- The `useActiveSession` hook (which queries `settings` with a 5-minute stale time) will be invalidated after a successful inline save on the Classes page so the session badge and promotion button update reactively.
- The MigrationPreviewModal's "Go to Settings" link target may optionally be updated to `/settings/academic-calendar` as a minor improvement, but this is not a blocking requirement.
