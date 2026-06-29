# Feature Specification: Platform Admin Schools Page Redo

**Feature Branch**: `042-admin-schools-page`  
**Created**: 2026-04-26  
**Status**: Draft  
**Input**: User description: "Redo the platform admin schools page with the following features and requirements: View All Schools, Tenant View Optimization, Functional Actions (Suspend Tenant), Delete Tenant (Critical Action), Invoice Access"

## Overview

The Platform Admin Console (introduced in `040-admin-console`) includes a Schools page for managing the fleet of tenants. The current implementation has usability gaps: the tenant list or detail view may include redundant information (e.g., subdomain display), key lifecycle actions such as Suspend are not reliably functional, tenant deletion lacks the safeguards required for a critical destructive operation, and platform admins cannot access or download a tenant's invoices directly from the Schools page. This feature respecifies and rebuilds the Schools page to address all five identified problem areas, without touching other console sections.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse and search all schools on the platform (Priority: P1)

A platform admin opens the Schools page and immediately sees every registered tenant presented in a clean, paginated list. The list is searchable by school name or admin email and filterable by plan and status. Each row shows exactly the information the admin needs to triage a tenant at a glance, with no redundant or confusing fields.

**Why this priority**: The list view is the entry point for all other actions. If it is unusable or incomplete, every downstream workflow is blocked. It is also the lowest-risk change and can ship independently.

**Independent Test**: Open the Schools page with at least three tenant records in the system. Verify every tenant appears, the column set matches the specification (no subdomain column), search narrows results in real time, and pagination navigates correctly.

**Acceptance Scenarios**:

1. **Given** the Schools page is loaded, **When** the page renders, **Then** every tenant registered on the platform appears in the list with no missing rows.
2. **Given** the Schools page is loaded, **When** the admin types a school name or admin email into the search field, **Then** only matching tenants are shown and the result count updates to reflect the filtered set.
3. **Given** the Schools page is loaded, **When** the admin applies a status filter (e.g., "Suspended"), **Then** only tenants with that status are shown.
4. **Given** the Schools page is loaded, **When** the admin applies a plan filter, **Then** only tenants on the selected plan are shown.
5. **Given** more tenants exist than fit on one page, **When** the admin navigates to the next page, **Then** the next set of tenants loads and pagination controls reflect the correct total.
6. **Given** the Schools page column set, **When** the list is displayed, **Then** no subdomain column or subdomain value is shown anywhere in the list or column headers.

---

### User Story 2 - View a tenant's profile without redundant information (Priority: P1)

A platform admin clicks on any tenant row to open the tenant detail view. The detail view shows useful, actionable information — school name, admin email, plan, status, join date, student count, teacher count, usage, and billing summary — without redundant items such as the subdomain, which carries no practical value for admin decision-making.

**Why this priority**: The detail view is used before every lifecycle action. Cluttered or misleading information increases the chance of acting on the wrong tenant. Cleaning it up is a prerequisite for reliable action-taking.

**Independent Test**: Open the detail view for any tenant. Confirm the subdomain field is absent from all tabs (Profile, Usage, Billing, Danger). Confirm the remaining fields are accurate and sourced from the backend.

**Acceptance Scenarios**:

1. **Given** a tenant detail view is open, **When** the admin reviews the Profile tab, **Then** the subdomain field and its label are not present anywhere on the tab.
2. **Given** a tenant detail view is open, **When** the admin reviews any tab, **Then** all displayed values (name, email, plan, status, join date, student count, teacher count) accurately reflect the current database state.
3. **Given** the tenant detail view is open on the Danger tab, **When** the admin reviews the available actions, **Then** actions are clearly described and their consequences are stated in plain language.

---

### User Story 3 - Suspend and reactivate a tenant reliably (Priority: P1)

A platform admin needs to suspend a tenant — for example, due to a billing dispute or policy violation. They open the tenant detail and trigger "Suspend". The action executes without error, the tenant's status updates to "Suspended" immediately in the UI, and from that point on no user of that tenant can log in. When the admin chooses "Reactivate", the tenant's status returns to "Active" and user access is restored.

**Why this priority**: Suspend/Reactivate is the primary non-destructive control mechanism for tenant lifecycle. Unreliable actions undermine trust in the console and may leave tenants in an incorrect state.

**Independent Test**: Suspend a tenant from the detail view. Attempt to log in as any user of that tenant and confirm authentication is refused with a clear error. Reactivate the tenant from the console and confirm the same user can now log in successfully. Verify the status badge reflects "Suspended" and then "Active" correctly at each step.

**Acceptance Scenarios**:

1. **Given** an active tenant's Danger tab is open, **When** the admin clicks "Suspend" and confirms, **Then** the system sends the suspend request to the backend, receives a success response, and immediately updates the tenant status badge to "Suspended" without requiring a full page reload.
2. **Given** a tenant has been suspended, **When** any user of that tenant attempts to authenticate, **Then** authentication is refused and the user receives a clear message indicating the account is suspended.
3. **Given** a suspended tenant's detail view is open, **When** the admin clicks "Reactivate" and confirms, **Then** the system sends the reactivate request, receives success, and updates the status badge to "Active".
4. **Given** the suspension action fails due to a backend error, **When** the error response is received, **Then** a descriptive error toast is displayed, the tenant status in the UI does not change, and the admin can retry.
5. **Given** the Schools list is visible, **When** a tenant is suspended or reactivated, **Then** the status shown in the list row for that tenant reflects the current state after navigating back to or refreshing the list.

---

### User Story 4 - Delete a tenant safely with full safeguards (Priority: P2)

A platform admin needs to permanently remove a tenant from the platform. Before allowing the deletion, the system checks whether the tenant has any existing financial records (invoices, charges, payments, billing events). If such records exist, deletion is refused and the admin is directed to suspend the tenant instead. Only if the tenant has zero financial records does the system allow deletion — and even then it requires an explicit multi-step confirmation. The action is recorded in the audit log.

**Why this priority**: Tenant deletion is irreversible and can cause data loss or compliance issues. It must be guarded behind checks that prevent accidental or premature deletion. It is lower priority than suspend/reactivate because suspend is the safe first response to most problem situations, and permanent deletion is rarely needed.

**Independent Test**: Attempt to delete a tenant with at least one invoice on record. Verify the backend refuses the request with a clear message recommending suspension. Then attempt to delete a tenant with zero financial records, complete the multi-step confirmation, and verify the tenant is removed from the list and the deletion is logged in the audit stream.

**Acceptance Scenarios**:

1. **Given** a tenant with one or more financial records (invoices, charges, payments), **When** the admin clicks "Delete tenant" and attempts to confirm, **Then** the system checks the backend, receives a refusal, and shows a message explaining that deletion is blocked because financial records exist, suggesting suspension as an alternative.
2. **Given** a tenant with zero financial records, **When** the admin initiates deletion, **Then** the UI presents a multi-step confirmation that requires the admin to explicitly type the school name before the final delete button becomes active.
3. **Given** the admin has completed the multi-step confirmation for a tenant with zero financial records, **When** they confirm the final delete, **Then** the backend permanently removes the tenant and all its dependent data, the tenant disappears from the list, and a success toast is shown.
4. **Given** a deletion is refused due to financial records, **When** the admin dismisses the refusal message, **Then** the tenant's status and data are unchanged.
5. **Given** any deletion action (refused or completed), **When** the action concludes, **Then** an audit entry is recorded with the acting admin's identity, the action type, the target tenant, and the outcome (refused / succeeded).
6. **Given** the delete action fails due to a backend or network error mid-execution, **When** the error is received, **Then** a descriptive error toast is shown, the tenant remains in the list, and no partial deletion has occurred.

---

### User Story 5 - View and download a tenant's invoices from the Schools page (Priority: P2)

A platform admin opens a tenant's detail view, navigates to the Billing tab, and sees the full invoice history for that tenant: invoice ID, amount, status (Paid / Pending / Failed / Refunded), and date. The admin can download any individual invoice as a PDF without leaving the console — even though those invoices originate from the tenant's own subscription billing flow.

**Why this priority**: Cross-tenant invoice access from a single screen removes the need to impersonate a tenant admin or access the database directly for billing queries. It is essential for support and finance workflows but depends on the tenant detail view being usable (User Stories 1–3), so it is P2.

**Independent Test**: Open the Billing tab for a tenant that has at least two invoices with different statuses. Confirm all invoices appear with correct amounts and statuses. Click the download button on one invoice and confirm a PDF file is produced and its contents match the invoice on screen.

**Acceptance Scenarios**:

1. **Given** a tenant detail view is open on the Billing tab, **When** the tab loads, **Then** every invoice belonging to that tenant is listed with invoice ID, amount, status, and date, sourced from the platform's invoice store.
2. **Given** the Billing tab is showing invoices, **When** the admin clicks the download button on any invoice row, **Then** the system requests the PDF from the backend using the platform-admin credential, and the browser downloads the file without requiring the admin to impersonate or navigate to the tenant-facing app.
3. **Given** the Billing tab is loaded for a tenant with no invoices, **When** the tab renders, **Then** a clear empty-state message is shown (e.g., "No invoices found for this tenant") and no error or blank area is displayed.
4. **Given** the admin requests an invoice PDF, **When** the backend returns an error or the file is unavailable, **Then** a descriptive error toast is shown and no broken download dialog opens.
5. **Given** invoices are listed, **When** the admin filters or sorts by status or date, **Then** the list updates to show only the matching invoices in the selected order.

---

### Edge Cases

- What happens when the Schools page is loaded and the backend returns an empty tenant list? The page shows a clear empty state message ("No schools registered yet") rather than a blank table.
- What happens when the admin initiates a suspend on a tenant that was already suspended by another admin concurrently? The backend returns the current state; the UI updates the status badge without showing a false success for an already-suspended tenant.
- What happens when the admin initiates a delete confirmation but navigates away before completing it? The confirmation dialog closes, the tenant is unchanged, and no delete request is sent.
- What happens when the tenant detail view is open and the backend is unreachable? Each tab shows a loading error state with a retry option rather than blank content.
- What happens when the delete safeguard check itself fails (the backend cannot determine whether financial records exist)? Deletion is blocked with an error message; the system errs on the side of safety and does not allow deletion under uncertainty.
- What happens when an invoice PDF download returns a very large file? The download is streamed and does not block the UI; the browser's native download progress indicator is shown.
- What happens when the search query matches zero tenants? The list shows a "No results" empty state, not a crash or blank area.

## Requirements *(mandatory)*

### Functional Requirements

**Schools list**

- **FR-001**: The Schools page MUST display every tenant registered on the platform in a paginated list, with columns for: school name, admin email, plan, status, student count, and join date. No subdomain column may appear.
- **FR-002**: The Schools list MUST support server-side search by school name and admin email, and server-side filtering by plan and by status. All search and filter operations MUST be executed via backend API calls, not client-side in-memory filtering.
- **FR-003**: Pagination MUST be server-driven; the total tenant count and current page MUST be reflected in the pagination controls at all times.

**Tenant detail view**

- **FR-010**: The tenant detail view MUST NOT display the tenant's subdomain on any tab (Profile, Usage, Billing, or Danger). The subdomain field MUST be removed from all rendered content and from any data requests that previously fetched it for display purposes.
- **FR-011**: The Profile tab MUST show: school name, admin email, plan, status, join date, and region/country where available.
- **FR-012**: The Usage tab MUST show: student count, teacher count, and MRR contribution for the tenant, sourced from the backend.
- **FR-013**: All displayed values in the tenant detail view MUST be sourced from the backend via authenticated API calls using the platform-admin credential; no values may be hardcoded or derived from client-side state alone.

**Suspend / Reactivate**

- **FR-020**: The admin MUST be able to suspend an active tenant from the tenant detail Danger tab. Triggering suspend MUST send a suspend request to the backend, and on success the status badge in the detail view MUST update to "Suspended" immediately without a full page reload.
- **FR-021**: While a tenant is suspended, all authentication attempts by users of that tenant MUST be rejected by the backend. The frontend status badge and Schools list row MUST both reflect "Suspended".
- **FR-022**: The admin MUST be able to reactivate a suspended tenant. On success the status MUST return to "Active" and user access MUST be restored.
- **FR-023**: If the suspend or reactivate request fails, the system MUST display a descriptive error toast and MUST NOT update the displayed tenant status.
- **FR-024**: Both suspend and reactivate actions MUST be recorded in the platform audit log with the acting admin's identity, the action, the target tenant, and the timestamp.

**Delete tenant**

- **FR-030**: Before allowing deletion, the system MUST send a safeguard check to the backend to determine whether the tenant has any financial records (invoices, charges, payments, or billing events).
- **FR-031**: If the safeguard check finds any financial records, the delete action MUST be refused. The UI MUST display a message explaining the block and recommending suspension as an alternative. The tenant MUST remain unchanged.
- **FR-032**: If the safeguard check confirms zero financial records, the UI MUST present a multi-step confirmation dialog requiring the admin to type the school's exact name before the final confirm button becomes enabled.
- **FR-033**: On completion of the multi-step confirmation, the system MUST send the permanent delete request to the backend. On success, the tenant MUST be removed from the Schools list and a success toast MUST be shown.
- **FR-034**: If the safeguard check itself fails (backend error or timeout), deletion MUST be blocked and an error message MUST be shown. The system MUST NOT allow deletion to proceed under uncertainty.
- **FR-035**: If the deletion request fails after the confirmation is submitted (backend error mid-execution), a descriptive error toast MUST be shown and no partial deletion may leave the tenant in an inconsistent state.
- **FR-036**: Every delete attempt — whether refused, succeeded, or errored — MUST be recorded in the platform audit log with the acting admin's identity, the action, the target tenant, and the outcome.

**Invoice access**

- **FR-040**: The Billing tab of the tenant detail view MUST list every invoice for that tenant with: invoice ID, amount, status (Paid / Pending / Failed / Refunded), and date. The list MUST be sourced from the platform's invoice store via a platform-admin–authenticated API call.
- **FR-041**: The admin MUST be able to download any individual invoice as a PDF by clicking a download action on the invoice row. The download MUST be triggered via a backend endpoint that accepts the platform-admin JWT and returns the PDF; the admin MUST NOT need to impersonate a tenant user to perform this action.
- **FR-042**: If the tenant has no invoices, the Billing tab MUST show a clear empty-state message rather than a blank area or error.
- **FR-043**: If an invoice PDF download fails (backend error or file unavailable), the system MUST show a descriptive error toast without opening a broken download dialog.
- **FR-044**: The Billing tab invoice list MUST support filtering by status and sorting by date so admins can quickly locate specific invoices.

**General**

- **FR-050**: All actions on the Schools page MUST be guarded by the platform-admin role matrix defined in the parent `040-admin-console` specification (FR-066): Owner and Admin may suspend/reactivate/delete; only Owner may permanently delete; Finance and Support roles see the page read-only (Support may suspend/reactivate per the matrix).
- **FR-051**: All backend errors (4xx / 5xx) encountered on the Schools page MUST be surfaced as non-destructive toast messages with a human-readable explanation. Silent failures are prohibited.
- **FR-052**: The Schools page and tenant detail view MUST NOT render any mock or placeholder data in a production build.

### Key Entities

- **Tenant (School)**: A SaaS customer registered on the platform. Relevant attributes for this feature: name, admin email, plan, status (Active / Trial / Suspended / Cancelled), join date, student count, teacher count, MRR contribution, region/country. Notably **excluded** from display: subdomain.
- **Invoice**: A billing record associated with a tenant. Attributes: ID, amount, status (Paid / Pending / Failed / Refunded), date, downloadable PDF. Sourced from the platform's invoice store; accessible to platform admins without impersonation.
- **Audit Entry**: A platform-level record of an admin action. Attributes: actor (platform admin identity), action type (suspend / reactivate / delete-refused / delete-succeeded), target tenant, timestamp, outcome.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The Schools list loads with real data (no placeholder rows) within 2 seconds on a standard network connection for a dataset of up to 500 tenants.
- **SC-002**: A platform admin can locate any specific tenant by name or admin email using the search field in under 10 seconds from the Schools page.
- **SC-003**: The subdomain field is absent from 100% of tenant list rows and detail view tabs — confirmed by a UI audit with zero occurrences of subdomain values or labels in rendered output.
- **SC-004**: Suspend and Reactivate actions succeed on the first attempt for 100% of test cases where the backend is reachable; failures are surfaced as actionable error messages within 3 seconds of the failed request completing.
- **SC-005**: Tenant deletion is refused by the backend for 100% of tenants with existing financial records; zero tenants with financial records can be deleted via the console.
- **SC-006**: The multi-step deletion confirmation requires the admin to type the correct school name exactly; a mis-typed name keeps the confirm button disabled.
- **SC-007**: Invoice PDFs for any tenant can be downloaded by the platform admin from the Billing tab without impersonating the tenant — verified by downloading at least one PDF per test run without triggering an impersonation flow.
- **SC-008**: 100% of delete attempts (refused, succeeded, or errored) produce a corresponding audit log entry; spot-checks of 10 sampled events show complete actor, action, target, and outcome data.

## Assumptions

- This feature refines only the Schools page and the tenant detail view; all other sections of the Platform Admin Console (Dashboard, Subscriptions, Finance, Analytics, Settings) are out of scope.
- The existing backend already exposes a tenant list endpoint, a suspend/reactivate endpoint, and a delete endpoint; this feature verifies and fixes their behavior rather than creating entirely new endpoints — though the safeguard check for deletion and the platform-admin–scoped invoice download may require new or extended endpoints.
- The subdomain field exists in the current tenant record but has no operational value for platform admins; it is safe to omit it from the UI without impacting backend data integrity.
- The invoice PDF download endpoint already exists for tenant-scoped use (tenant subscription page); this feature extends access so that a platform-admin JWT can also trigger it without an impersonation token. A backend endpoint change or new platform-scoped wrapper endpoint may be required.
- "Financial records" for the deletion safeguard includes: any invoice, any charge, any payment, or any billing event linked to the tenant. A tenant must have zero of all these to be eligible for permanent deletion.
- The audit log (platform activity stream) is already operational per the `040-admin-console` specification; this feature only adds new event types (delete-refused, delete-succeeded) to the existing stream.
- Platform-admin role enforcement (which roles may suspend / delete) follows the matrix established in `040-admin-console` FR-066 without modification.
- Server-side pagination, search, and filtering are already implemented or will be implemented alongside this feature; client-side filtering of the full tenant list is not acceptable.
