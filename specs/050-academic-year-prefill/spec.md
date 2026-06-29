# Feature Specification: Academic Year Auto-Prefill for Migration Form

**Feature Branch**: `050-academic-year-prefill`  
**Created**: 2026-04-28  
**Status**: Implemented  
**Input**: User description: "The academic year should be automatically prefilled by the system based on the current date, but it must remain editable. The UI should clearly indicate the current active academic year and the next academic year. Users should select the academic year from a dropdown that includes the prefilled value. In the form the From Academic Year field should be prefilled with the current active academic year and the To Academic Year field should be prefilled with the newly generated (next) academic year. Ensure the interface is user-friendly, clear, and intuitive."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Auto-Prefill Migration Form with Current and Next Academic Year (Priority: P1)

When an administrator opens the year-end class migration form, the system automatically detects the current active academic year and the next academic year, then prefills the "From Academic Year" and "To Academic Year" dropdowns respectively. The administrator sees both values clearly labelled and can confirm or change them before submitting.

**Why this priority**: Reducing manual data entry in a high-stakes operation (year-end migration) is the primary UX improvement requested. Incorrect year selection could trigger migration for the wrong academic period. Auto-prefill with clear labelling prevents this class of error and saves administrator time on every migration run.

**Independent Test**: Open the migration trigger form as an administrator whose tenant has a current active academic year configured. Verify that the "From Academic Year" dropdown is pre-selected to the current active year and the "To Academic Year" dropdown is pre-selected to the generated next academic year, without the administrator manually choosing anything.

**Acceptance Scenarios**:

1. **Given** a tenant has an active academic year "2025/2026" and today's date falls within it, **When** the migration form is opened, **Then** the "From Academic Year" dropdown displays "2025/2026 (Current)" pre-selected and the "To Academic Year" dropdown displays "2026/2027 (Next)" pre-selected.
2. **Given** the form is prefilled, **When** the administrator changes the "From Academic Year" to a different year, **Then** the form accepts the change and retains it without reverting to the prefilled value.
3. **Given** the form is prefilled, **When** the administrator changes the "To Academic Year" to a different year, **Then** the form accepts the change without forcing it back to the auto-generated value.
4. **Given** both fields are prefilled, **When** the administrator submits the form without any changes, **Then** the migration runs using the prefilled year values.

---

### User Story 2 - Visual Distinction Between Current and Next Academic Year in Dropdown (Priority: P1)

Within the academic year dropdown on the migration form, each option is clearly labelled to indicate its status relative to today: the current active year is marked "(Current Active)" and the next academic year is marked "(Next)". All other years have no badge. This allows administrators to orient themselves instantly even if they choose to scroll the dropdown.

**Why this priority**: Without clear labelling, all academic years look identical in a dropdown list (e.g., "2023/2024", "2024/2025", "2025/2026"), forcing the administrator to mentally compute which is current. Labels eliminate cognitive load and reduce mis-selection risk, directly supporting the primary P1 story.

**Independent Test**: Open the "From Academic Year" dropdown and verify that the option corresponding to the current active year shows a "(Current Active)" label, the option for the next year shows "(Next)", and at least one historical year has no badge. Repeat for the "To Academic Year" dropdown.

**Acceptance Scenarios**:

1. **Given** a tenant has academic years for 2023/2024, 2024/2025, 2025/2026 (current), and 2026/2027 (next), **When** either dropdown is opened, **Then** "2025/2026" displays an additional "(Current Active)" indicator and "2026/2027" displays a "(Next)" indicator; other years display no special badge.
2. **Given** the current active year badge is visible, **When** the administrator hovers or focuses on that option, **Then** a tooltip or supporting text clarifies "This is the currently running academic year."
3. **Given** the next academic year does not yet exist in the system, **When** the dropdown is rendered, **Then** the "(Next)" option is shown as a system-generated suggestion with a visual indicator that it will be created on form submission.

---

### User Story 3 - System-Derived Next Academic Year Generation (Priority: P2)

When the next academic year does not yet exist in the tenant's calendar, the system derives the next year automatically from the current active year's date range. For example, if the current year is "2025/2026" ending on 31 July 2026, the system suggests "2026/2027" as the next year with start date 1 August 2026 and end date 31 July 2027. This suggestion is shown in the "To Academic Year" dropdown and is visually distinguished as "to be created". The administrator may confirm, edit the suggested dates, or pick a manually created year from the list instead.

**Why this priority**: This reduces friction when a school has not yet formally created the next year in settings. It prevents the migration form from being blocked by the absence of a future calendar entry, while still giving the administrator control to review the derived dates.

**Independent Test**: Open the migration form for a tenant whose calendar ends at the current year (no "next" year record exists). Verify the "To Academic Year" dropdown contains a derived entry labelled "2026/2027 (To Be Created)" with editable start/end dates. Confirm that submitting the form creates the academic year record before running the migration.

**Acceptance Scenarios**:

1. **Given** no next academic year record exists, **When** the migration form loads, **Then** the "To Academic Year" field shows a derived option "2026/2027 (To Be Created)" based on the current year's end date plus one day.
2. **Given** the derived option is shown, **When** the administrator edits the start or end date of the suggested year, **Then** the edited dates are used when the academic year is created during migration.
3. **Given** the derived option is selected and the administrator submits the form, **Then** the system creates the academic year record first and then proceeds with the migration — the administrator is not required to navigate to settings first.
4. **Given** a manually created "2026/2027" record already exists in the system, **Then** the derived option is not shown; the existing record is displayed with a "(Next)" badge instead.

---

### Edge Cases

- What happens when no active academic year exists for the tenant today? The form loads with both dropdowns empty/unselected, a prominent warning banner states "No active academic year found. Please configure the current academic year before triggering migration", and the submit button is disabled.
- What happens when the current date falls in a gap between two academic years (e.g., holiday period between end of one year and start of the next)? The system selects the most recently ended academic year as the "current" year for prefill purposes and shows a notice: "No year is currently active. Prefilled with the most recent year (2025/2026)."
- What happens when two academic years overlap (misconfigured calendar)? The system selects the one whose `start_date` is most recent, prefills with it, and shows a warning: "Multiple overlapping academic years detected. Please review your calendar settings."
- What happens if the administrator opens the form, the server-derived prefill is loaded, and then the active academic year changes server-side before they submit? The form submission validates that the selected "From" year is still a valid, existing academic year; if the record has been deleted or deactivated in the interim, the server returns a clear error.
- What happens when the "From Academic Year" and "To Academic Year" are set to the same value? The form shows an inline validation error: "The source and destination academic years must be different" and prevents submission.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST expose an endpoint that returns the current active academic year and the derived (or existing) next academic year for the authenticated tenant, based on today's date at the time of the request.
- **FR-002**: The "From Academic Year" field on the migration form MUST be prefilled with the tenant's current active academic year when the form is first loaded, with no action required from the administrator.
- **FR-003**: The "To Academic Year" field on the migration form MUST be prefilled with the next academic year (existing or system-derived) when the form is first loaded.
- **FR-004**: Both prefilled values MUST remain editable — the administrator MUST be able to change either dropdown to any available academic year without the system reverting the selection.
- **FR-005**: In both academic year dropdowns, the current active year option MUST be visually labelled with a "(Current Active)" indicator and the next academic year option MUST be labelled with a "(Next)" indicator; all other options MUST have no special badge.
- **FR-006**: When the next academic year does not yet exist as a record in the tenant's calendar, the system MUST derive a suggested next year from the current year's end date and present it in the dropdown as a "(To Be Created)" option.
- **FR-007**: When the administrator selects the "(To Be Created)" derived option and submits the form, the system MUST automatically create the academic year record before triggering the migration — no separate navigation to settings is required.
- **FR-008**: The form MUST display a warning banner and disable the submit button when no active academic year is found for the tenant.
- **FR-009**: The form MUST show an inline validation error and prevent submission when the selected "From Academic Year" and "To Academic Year" are the same value.
- **FR-010**: The prefill logic MUST be computed server-side and delivered to the form via the API response, not derived purely in the browser, so all clients show consistent values.
- **FR-011**: The academic year dropdowns MUST list all academic years for the tenant in descending order (most recent first), with the prefilled selections highlighted at the top or visually distinguished.
- **FR-012**: When today's date falls outside all configured academic years, the form MUST prefill with the most recently ended academic year and display a notice explaining the fallback selection.

### Key Entities

- **Academic Year**: An existing per-tenant entity with `id`, `tenant_id`, `label` (e.g., "2025/2026"), `start_date`, `end_date`, and `status`. The prefill logic queries this entity to determine which year is currently active (today ∈ [start_date, end_date]) and derives the next year from the active year's `end_date`.
- **Derived Next Academic Year**: A transient, unsaved suggestion computed by the system when no next-year record exists. Carries a suggested `label`, `start_date`, and `end_date` derived from the current year. Becomes a persisted Academic Year record only when the administrator confirms the migration form submission.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: When the migration form is opened by an administrator with a configured active academic year, both dropdowns are prefilled within the form's initial load — zero manual selections required before the form is ready to submit.
- **SC-002**: 100% of academic year dropdown options display the correct badge: the current active year shows "(Current Active)", the next year shows "(Next)" or "(To Be Created)", and no other option has a badge.
- **SC-003**: Submitting the form with the auto-derived "(To Be Created)" next year creates the academic year record and initiates migration in a single round trip — the administrator is not redirected to a settings page.
- **SC-004**: The form correctly prevents submission (inline error shown, button disabled) in 100% of cases where "From Academic Year" equals "To Academic Year".
- **SC-005**: When no active academic year exists, the form disables submission and displays the explanatory warning banner within 200 ms of page load, before any user interaction.
- **SC-006**: The prefill API endpoint returns the current active year and the next year (existing or derived) within 300 ms for any tenant with up to 20 configured academic years.
- **SC-007**: An administrator can complete the entire migration form — from opening it to submitting — in under 60 seconds when the auto-prefill values are correct, with no additional navigation required.

## Assumptions

- The existing academic year management system already persists `start_date` and `end_date` per tenant record; this feature reads those fields to determine which year is active today.
- "Current active academic year" is defined as the academic year record whose `start_date ≤ today ≤ end_date` for the requesting tenant. If multiple records match, the one with the most recent `start_date` is selected.
- The "next academic year" derivation rule is: `start_date = current_year.end_date + 1 day`, `end_date = derived_start_date + 364 days` (or 365 for a leap year), producing a label in "YYYY/YYYY+1" format. This default may be reviewed by the administrator before submission.
- The migration form referred to in this specification is the same form introduced by feature 048 (Academic Year Enrollment Migration); this feature enhances its UX without altering its submission logic or API contract.
- Only users with administrator-level access for a tenant can access the migration form and therefore interact with the prefill feature.
- Academic years are tenant-scoped; the prefill logic never reads another tenant's year records.
- Mobile support for the migration form is not a new requirement of this feature; the prefill behaviour applies to the existing form layout on all supported screen sizes.
