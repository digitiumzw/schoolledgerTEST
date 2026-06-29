# Feature Specification: Navbar Data Refresh

**Feature Branch**: `072-navbar-data-refresh`  
**Created**: 2026-05-13  
**Status**: Draft  
**Input**: User description: "Add a small refresh button in the navbar that allows users to manually refresh their data. Required functionality: The refresh button should trigger a data reload across the platform, ensuring the user always sees the latest information. When clicked, it should fetch and update all relevant data for the current tenant. Automatic refresh behavior: The application should automatically refresh data after a user performs any action. Specifically: Trigger a refresh immediately after an action request is successfully submitted to the server, or Trigger a refresh when a response is received from the server confirming the action. This should ensure the UI always reflects the most up-to-date state without requiring manual refresh. Performance requirements: The refresh system must be highly efficient and optimized for large datasets and large tenants. Avoid full page reloads where possible; prefer targeted or incremental data updates. Ensure the refresh mechanism does not degrade performance, even with large volumes of data. It should feel fast, responsive, and seamless for the user."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manual Refresh via Navbar Button (Priority: P1)

A logged-in user is viewing any page (Students, Payments, Transport, etc.) and wants to ensure they are seeing the most current data — for example, after a colleague records a payment on another device. The user clicks a small refresh icon in the top navigation bar. The button shows a brief loading animation, all visible data on the current page reloads from the server, and the user sees up-to-date information without a full page reload or losing their scroll position or filter state.

**Why this priority**: This is the explicit primary request. It is immediately visible and valuable to all user roles. It provides the foundation for the automatic post-action refresh in US2.

**Independent Test**: Can be fully tested by placing a refresh button in the header and verifying that clicking it triggers a re-fetch of the current page's data queries and the button shows a spinning/loading state during the fetch.

**Acceptance Scenarios**:

1. **Given** the user is on any authenticated page, **When** they click the navbar refresh button, **Then** all active data queries for the current page reload from the server without a full page reload.
2. **Given** the user clicks the refresh button, **When** the reload is in progress, **Then** the refresh button displays a loading/spinning indicator and is disabled to prevent concurrent requests.
3. **Given** the refresh completes successfully, **When** the button returns to its idle state, **Then** the displayed data reflects the latest server state.
4. **Given** the user has applied filters or is mid-scroll on a page, **When** the refresh completes, **Then** filter and UI state (scroll position, open panels, selected tabs) are preserved.
5. **Given** the network is unavailable or the server returns an error, **When** the user clicks refresh, **Then** the button returns to idle and a non-intrusive error indicator is shown; existing data remains visible.

---

### User Story 2 - Automatic Refresh After Successful Actions (Priority: P2)

After a user completes an action — such as recording a payment, enrolling a student, assigning transport, generating charges, or approving leave — the relevant data on the page automatically refreshes to reflect the change. The user does not need to manually click refresh to see the result of their own action; the UI updates seamlessly once the server confirms the action succeeded.

**Why this priority**: Reduces cognitive load and prevents confusion from stale data appearing immediately after user-initiated mutations. Builds on the refresh infrastructure from US1. Scoped to successful server responses only to avoid masking errors.

**Independent Test**: Can be tested independently by performing any mutation action (e.g., record a payment) and verifying the relevant data list or summary updates automatically after the confirmation response without a manual refresh click.

**Acceptance Scenarios**:

1. **Given** a user submits any create, update, or delete action, **When** the server responds with success, **Then** the data queries relevant to that action are automatically invalidated and re-fetched.
2. **Given** a mutation is in progress, **When** the server has not yet responded, **Then** no automatic refresh is triggered (refresh fires on confirmed success, not on submission).
3. **Given** a mutation fails (server returns an error), **When** the error is received, **Then** no automatic refresh is triggered; existing data is preserved.
4. **Given** the automatic refresh fires after an action, **When** refetching, **Then** only queries relevant to the affected domain (e.g., payments queries after a payment, not unrelated transport queries) are refreshed to minimise server load.

---

### User Story 3 - Refresh Performance & Large Tenant Optimisation (Priority: P3)

For schools with large datasets (hundreds of students, many classes, long payment histories), both manual and automatic refreshes complete within an acceptable time frame. The refresh mechanism targets only stale or affected query domains rather than re-fetching every dataset simultaneously, preventing server overload or sluggish UI for large tenants.

**Why this priority**: Non-functional quality requirement. US1 and US2 deliver functional correctness; this story ensures they remain performant under real-world scale.

**Independent Test**: Can be tested by auditing network requests triggered by a refresh action and confirming that only domain-relevant queries fire, not every available endpoint, and that concurrent request storms are avoided.

**Acceptance Scenarios**:

1. **Given** a manual refresh is triggered from the navbar, **When** the refresh fires, **Then** only queries that are currently active/mounted on the visible page are re-fetched, not all possible application queries.
2. **Given** multiple actions are performed in quick succession, **When** automatic refreshes are triggered, **Then** requests are deduplicated or debounced so the same endpoint is not called multiple times simultaneously.
3. **Given** a large tenant with many data records, **When** a refresh completes, **Then** the UI remains responsive throughout the loading state (data is not cleared/blanked; existing data stays visible while new data loads in the background).

---

### Edge Cases

- What happens when the user clicks refresh repeatedly before the first refresh completes? (Should debounce or disable button while in-progress.)
- What happens when the refresh button is clicked on the Login or public pages? (Should not be rendered on unauthenticated pages.)
- What happens when a mutation action partially succeeds (e.g., 207 Multi-Status or partial batch)? (Auto-refresh should still fire on any 2xx success.)
- What happens when the user navigates to a new page while a manual refresh is still in-flight? (In-flight requests complete normally; no refresh storm on the new page.)
- What happens if a query has an explicit long `staleTime`? (Manual refresh must bypass stale time and force a refetch regardless.)

## Requirements *(mandatory)*

### Functional Requirements

**Manual Refresh Button**

- **FR-001**: The system MUST display a small refresh icon button in the top navigation bar (AppHeader), visible on all authenticated pages.
- **FR-002**: When the refresh button is clicked, the system MUST re-fetch all currently active data queries for the current page without triggering a full browser page reload.
- **FR-003**: The refresh button MUST display a loading/spinning state for the duration of the re-fetch and MUST be disabled (non-clickable) while loading is in progress.
- **FR-004**: The refresh button MUST return to its idle/ready state once all active queries have completed (success or error).
- **FR-005**: The refresh MUST preserve existing UI state including applied filters, active tabs, open modals, and scroll position.
- **FR-006**: If a refresh fails (network error or server error), the system MUST display a brief non-blocking error notification and leave existing data unchanged.

**Automatic Post-Action Refresh**

- **FR-007**: After any mutation action (create, update, delete, approve, void, generate, assign, etc.) returns a successful server response, the system MUST automatically invalidate and re-fetch the data queries relevant to that action's domain.
- **FR-008**: Automatic refresh MUST be scoped to the affected data domain only (e.g., a payment action refreshes payment and ledger queries; it does NOT refresh unrelated datasets such as transport routes or class lists).
- **FR-009**: Automatic refresh MUST NOT fire when a mutation returns an error response; existing data MUST be preserved in error cases.
- **FR-010**: Automatic refresh MUST NOT fire before the server confirms success; it fires on confirmed server response, not at the moment of request submission.

**Performance & Optimisation**

- **FR-011**: The refresh mechanism MUST operate through targeted query cache invalidation rather than re-mounting components or reloading the full application state.
- **FR-012**: If a manual refresh is already in progress, subsequent click attempts MUST be ignored (no concurrent duplicate refresh requests).
- **FR-013**: Automatic post-action refreshes MUST NOT trigger simultaneous mass re-fetches; only domain-specific queries relevant to the completed action are invalidated.
- **FR-014**: Existing cached data MUST remain visible during a background refresh so users do not see blank/empty states while new data loads.
- **FR-015**: The refresh button MUST NOT be rendered on unauthenticated pages (login, password reset, driver kiosk, public routes).

### Key Entities

- **Refresh Context / Global Refresh State**: A lightweight, globally accessible state that tracks whether a platform-wide manual refresh is in progress. Components subscribe to this state to show loading indicators and respond to refresh triggers.
- **Domain Query Key Groups**: Logical groupings of query cache keys by data domain (e.g., students, payments, transport, attendance, staff, classes, dashboard). Used to scope both manual page refresh and automatic post-action invalidation.
- **Mutation Action → Domain Mapping**: A declarative or convention-based mapping that links each mutation type to the set of domain query key groups it should invalidate on success.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can click the navbar refresh button and see updated data on the current page within the same time it would take to reload the page, with no full browser reload occurring.
- **SC-002**: After any successful mutation action, the UI reflects the server-confirmed change without the user needing to manually refresh, within one re-fetch cycle.
- **SC-003**: A manual refresh triggers re-fetch of only the queries active on the current page, not all possible application endpoints; verified by inspecting network requests.
- **SC-004**: During a refresh, previously loaded data remains visible (no blank/empty flash), maintaining a seamless experience for the user.
- **SC-005**: Clicking the refresh button multiple times in rapid succession results in at most one in-flight refresh request at any given time (no duplicate concurrent requests).
- **SC-006**: The automatic post-action refresh fires for all mutation types across the application (payments, students, transport, attendance, staff, classes, settings, campaigns, etc.) without requiring per-page manual wiring.
- **SC-007**: The refresh button is absent from all unauthenticated and public-facing pages (login, driver kiosk, etc.).

## Assumptions

- All authenticated pages use the existing TanStack Query (`@tanstack/react-query`) cache. The refresh mechanism will leverage query cache invalidation rather than any alternative state management approach.
- The existing `AppHeader` component is the correct placement for the refresh button, as it is rendered on all authenticated pages via the `AppLayout` wrapper.
- "All relevant data for the current tenant" means all query keys that are currently mounted and active on the visible page — not a global invalidation of every query in the cache simultaneously.
- Automatic post-action refresh is implemented by ensuring all existing and future mutation hooks call `queryClient.invalidateQueries` with appropriate domain key groups in their `onSuccess` handlers. No server-side push or websocket mechanism is required for v1.
- The manual refresh button does not need to trigger the backend `/dashboard/refresh` aggregation endpoint on every click; it only re-fetches the frontend query cache for the current page.
- For large tenants, server-side pagination and filtering are already in place (implemented in prior features); the refresh mechanism relies on those existing patterns and does not bypass pagination.
- The refresh button is scoped to the tenant app (`AppHeader`); the platform admin app (`AdminLayout`) is out of scope for v1.
- Mobile responsiveness of the refresh button follows the same responsive patterns already used by the theme toggle and logout buttons in the existing header.
