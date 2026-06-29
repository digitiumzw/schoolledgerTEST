# Feature Specification: Backend-Driven Architecture

**Feature Branch**: `084-backend-driven-architecture`  
**Created**: 2026-05-25  
**Status**: Draft  
**Input**: User description: "Refactor the system architecture so that all data operations are handled entirely on the backend. This includes data loading, filtering, searching, pagination, sorting, and all computations or calculations. The frontend must only consume and display the processed data returned by the backend API, without performing any client-side filtering, searching, pagination logic, or calculations. The implementation must also be optimized for high performance and database efficiency. Additionally, the system must support dynamic real-time updates without requiring users to manually reload the webpage."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Backend-Driven Staff Directory (Priority: P1)

An administrator or bursar opens the Staff page to search for a staff member, apply department or employment-status filters, and paginate through results. All filtering, searching, pagination, and summary calculations happen on the backend. The frontend sends user-selected parameters and renders exactly what the backend returns — no in-memory filtering or client-side slicing of a full staff list.

**Why this priority**: The Staff page currently loads all staff records into memory and applies `useMemo`-based filtering and `Array.slice` pagination entirely client-side. As the staff roster grows, this causes unnecessary data transfer, slow renders, and stale result counts. Fixing this is the highest-impact remaining client-side operation.

**Independent Test**: Verify by opening the Staff page with 200+ staff records, applying a department filter, checking that the URL or API request contains the filter parameter, and confirming the response contains only the matching subset with correct pagination metadata.

**Acceptance Scenarios**:

1. **Given** the Staff page is open, **When** the user types in the search box, **Then** only staff members whose name or email matches the search term are returned from the backend; no client-side filtering occurs.
2. **Given** the Staff page is open, **When** the user selects a department filter, **Then** the backend returns only staff in that department with a total count reflecting the filtered set.
3. **Given** 200 staff records exist, **When** the user navigates to page 3 of results, **Then** the backend returns only the page-3 records and pagination metadata; the browser never holds more records than one page.
4. **Given** the Staff page is displaying results, **When** a staff member is added or deleted, **Then** the list reflects the change without requiring a manual page reload.

---

### User Story 2 - Backend-Driven Fee Campaigns (Priority: P1)

An admin or bursar opens the Fee Campaigns page to browse campaigns filtered by status. Currently the page loads all campaigns and applies a local `.filter()` call. After this story, the status filter is sent as a query parameter and the backend returns only matching campaigns with backend-prepared summary metrics per campaign.

**Why this priority**: The Campaigns list uses local array filtering (`campaigns.filter((c) => c.status === statusFilter)`) and a hook that maintains a full local campaigns array. This duplicates logic across hook and page and will not scale when campaign counts grow.

**Independent Test**: Open the Fee Campaigns page, change the status filter dropdown, and verify the network request contains the status query parameter and the response contains only matching campaigns.

**Acceptance Scenarios**:

1. **Given** active and closed campaigns exist, **When** the user selects "Active" from the status filter, **Then** the backend returns only active campaigns; the frontend renders that list without any local filtering.
2. **Given** a campaign is closed, **When** the closure action completes, **Then** the campaigns list automatically updates to reflect the new status without a manual refresh.
3. **Given** the campaigns list is displayed, **When** a new campaign is created, **Then** the list includes the new campaign immediately after the creation response is received.

---

### User Story 3 - Backend-Driven Transport Management (Priority: P1)

An administrator opens the Transport page to search routes, vehicles, and drivers. Currently the Transport page passes a debounced search string to the backend but has no server-side pagination, no sorting controls, and no backend-prepared summary metrics. After this story, the Transport page is fully backend-driven with pagination, sorting, and summary totals returned by the backend.

**Why this priority**: Transport data (routes, vehicles, drivers, student allocations) will grow over time. Adding pagination and sorting now prevents future scalability issues and aligns Transport with the pattern established in other modules.

**Independent Test**: Open the Transport page with 50+ routes, search for a route name, and verify the response contains only matching routes with pagination metadata and route-level summary counts.

**Acceptance Scenarios**:

1. **Given** the Transport page is open, **When** the user searches by route name, **Then** the backend returns only matching routes; no client-side filtering is applied.
2. **Given** multiple pages of routes exist, **When** the user navigates to page 2, **Then** the backend returns only the page-2 routes with correct pagination metadata.
3. **Given** a vehicle or driver is added or removed, **When** the action completes, **Then** the respective tab list automatically updates to reflect the change.

---

### User Story 4 - Automatic Real-Time Data Refresh (Priority: P2)

Users on any data-displaying page see their data automatically refresh when changes occur in the system, without manually reloading the page. This includes scenario where another admin records a payment, updates a student, changes a staff member's status, or submits attendance — other open sessions on the same tenant should eventually reflect that change within a defined refresh window.

**Why this priority**: Currently all pages require a manual reload or explicit user action to see the latest data. In a multi-user school environment (admin + bursar + teacher all logged in), stale data causes duplicate actions and operational errors.

**Independent Test**: Open the Payments page in two browser tabs. Record a new payment in tab 1 and verify that tab 2 shows the new payment within the configured refresh interval without requiring any user interaction.

**Acceptance Scenarios**:

1. **Given** the Payments page is open in one session, **When** a new payment is recorded in another session, **Then** the Payments page data refreshes automatically within the configured polling interval.
2. **Given** the Students page is open, **When** a student's status is changed by another admin, **Then** the Students page reflects the updated status after the next automatic refresh cycle.
3. **Given** the Dashboard is open, **When** backend metrics are updated, **Then** the displayed KPI values update automatically without requiring a manual refresh click.
4. **Given** a user is on a slow connection, **When** the automatic refresh request is in flight, **Then** the currently displayed data remains visible and no blank/loading flash occurs.

---

### User Story 5 - Performance-Optimized Backend Queries (Priority: P2)

All backend list, filter, search, and report endpoints operate within target response-time bounds regardless of data volume. This includes adding appropriate database indexes for columns used in filtering and sorting, eliminating N+1 query patterns in list endpoints, applying query-result caching for frequently accessed read-only summaries, and ensuring all paginated endpoints return bounded row counts.

**Why this priority**: Backend-driven architecture only delivers user-visible value if the backend is fast. Unbounded queries or N+1 patterns will cancel out the gains from removing client-side processing.

**Independent Test**: Run the staff list endpoint with 1,000 staff records while monitoring query count via database logs; confirm fewer than 5 queries are executed per request and response time is under 500ms.

**Acceptance Scenarios**:

1. **Given** 1,000 staff records exist, **When** the staff list endpoint is called with default pagination, **Then** the response is returned in under 500ms and the browser receives no more records than the requested page size.
2. **Given** 10,000 payment records exist, **When** the payments list is loaded with search and filter parameters, **Then** only the matched page is returned and all computations (totals, counts) are performed in the database, not in application code.
3. **Given** a summary metric endpoint is called repeatedly within a short interval, **When** the underlying data has not changed, **Then** subsequent calls return cached results without re-executing expensive aggregation queries.
4. **Given** an invalid or out-of-range pagination parameter is submitted, **When** the API processes the request, **Then** it returns a clear validation error rather than an unbounded result set.

---

### Edge Cases

- What happens when a user applies a filter combination that returns zero results? The backend returns an empty data array with a valid pagination object (`total: 0, totalPages: 0`) and the frontend renders a clear empty state — not an error.
- What happens when the real-time polling request fails due to a network interruption? The currently displayed data remains on screen; the failure is silently retried at the next interval without showing an error to the user unless repeated failures exceed a threshold.
- What happens when a sort or filter parameter value is not supported by the backend? The backend returns HTTP 400 with a descriptive validation message; the frontend falls back to its default parameter values.
- What happens when a cached summary value becomes stale due to a recent mutation? Mutations must invalidate or update the relevant cache keys immediately upon success, ensuring the next read reflects the latest state.
- What happens when two users simultaneously mutate the same record? The last-write-wins at the database level; the automatic refresh on other sessions will eventually converge to the latest server state.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Staff directory endpoint MUST accept search, department, teaching-type, employment-status, sortBy, sortOrder, page, and limit parameters and return a paginated, backend-filtered response with a summary object containing total count and department breakdown.
- **FR-002**: The Fee Campaigns list endpoint MUST accept a status filter parameter and return only matching campaigns; backend MUST compute and return per-campaign summary metrics (totalCollected, totalExpected, fullyPaidCount, partiallyPaidCount, unpaidCount) in the same response.
- **FR-003**: The Transport routes, vehicles, and drivers list endpoints MUST accept search, sortBy, sortOrder, page, and limit parameters and return paginated, backend-filtered responses with summary metadata.
- **FR-004**: All paginated list endpoints MUST enforce a maximum page size (e.g., 100 records) and return HTTP 400 for invalid pagination parameters rather than silently capping or returning unbounded results.
- **FR-005**: No list or report endpoint MUST execute a separate per-row database query to compute values that can be derived using SQL aggregation, JOINs, or subqueries in the same request.
- **FR-006**: Backend APIs MUST return view-ready data for all feature screens, including any filtering, searching, pagination, sorting, aggregations, and computed values required by the frontend.
- **FR-007**: Frontend behavior MUST be limited to passing user-selected query parameters and rendering backend-prepared responses; it MUST NOT perform client-side data filtering, searching, sorting, pagination, aggregations, or business computations.
- **FR-008**: Every user action that triggers a data change (create, update, delete, submit, refresh, bulk-operation, status-change) MUST display a visible loading indicator from the moment the request is initiated until the response is fully received and the UI reflects the confirmed server state. Action-triggering controls MUST be disabled during in-flight requests to prevent duplicate submissions.
- **FR-009**: After any mutation completes, all React Query queries whose data was affected MUST be invalidated or updated so the next render reflects the latest server state. Stale cached values MUST NOT flash or re-appear after the mutation response is processed.
- **FR-010**: All data-displaying pages MUST implement automatic background polling at a configurable interval so that changes made by other users are reflected without requiring a manual reload; the stale-while-revalidate pattern MUST be used to avoid blank/loading flashes during background refreshes.
- **FR-011**: Frequently read, rarely mutated summary aggregations (e.g., campaign summaries, transport route student counts, dashboard KPIs) MUST use server-side response caching with cache invalidation triggered by the relevant mutation operations.
- **FR-012**: Database columns used as filter, sort, or join targets in list and report queries MUST have appropriate indexes to prevent full-table scans.

### Key Entities

- **Staff Directory**: A paginated, searchable, filterable list of staff members per tenant; produced entirely by the backend from the `staff` table with aggregate counts.
- **Fee Campaign List**: A paginated, status-filtered list of fee campaigns with per-campaign summary metrics computed by the backend from `fee_campaigns` and `campaign_students` tables.
- **Transport Catalogue**: Paginated lists of routes, vehicles, and drivers per tenant; each list supports search, sort, and pagination served by the backend.
- **Polling Configuration**: A per-page or global setting defining the automatic refresh interval for background data polling on live data views.
- **Query Cache**: Server-side or application-level cache entries for expensive aggregation queries, keyed by tenant and relevant parameters, invalidated on related mutations.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The Staff directory page with 500 staff records loads within 600ms on first open and applies any filter or search in under 400ms, with the browser receiving no more records than the configured page size.
- **SC-002**: The Fee Campaigns list with 200 campaigns returns the filtered + summarised list in under 300ms; the frontend performs zero local array filter or sort operations.
- **SC-003**: The Transport routes, vehicles, and drivers lists with 100 records each load and respond to search within 400ms; no client-side `useMemo` or `.filter()` calls remain in the Transport page.
- **SC-004**: All data-displaying pages automatically reflect changes made by other users within 30 seconds without any manual user action; no page shows data older than the configured polling interval at steady state.
- **SC-005**: List/report endpoints return only the requested page and required summary metadata; backend query count per paginated list request does not exceed 3 SQL queries.
- **SC-006**: No `useMemo` data-filtering, `Array.prototype.filter` for business logic, `Array.prototype.sort` for display ordering, or in-memory pagination (`Array.prototype.slice`) remains in any frontend page component for data that is sourced from the backend.

## Assumptions

- The existing JWT-based authentication and multi-tenant data isolation model remains unchanged; all new and modified endpoints follow the same tenant-scoping rules.
- Real-time updates are implemented via frontend polling (React Query `refetchInterval`) rather than WebSockets or server-sent events, as the existing infrastructure does not include a persistent socket layer.
- Modules that have already been migrated in prior features (Students, Payments, Classes, Staff Attendance, Analytics) are considered out of scope for re-implementation but may require minor alignment adjustments if gaps are discovered.
- The Staff page is the primary remaining page with full client-side filtering and pagination; Fee Campaigns and Transport have partial client-side operations that will be fully moved to the backend.
- Performance indexes for previously migrated modules (payments, students, classes) are assumed to be in place from Feature 074; this feature adds indexes only for newly migrated tables.
- Caching is implemented at the application/query level (e.g., React Query stale time on the frontend, PHP-layer result caching on the backend) and does not require a separate caching infrastructure like Redis.
- The `refetchInterval` polling value defaults to 30 seconds and is applied globally via React Query's default options; individual pages may override it for high-frequency data views (e.g., live attendance).
