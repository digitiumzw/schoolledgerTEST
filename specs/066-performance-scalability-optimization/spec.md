# Feature Specification: Performance & Scalability Optimization

**Feature Branch**: `066-performance-scalability-optimization`  
**Created**: 2026-05-07  
**Status**: Draft  

## Context & Current State

This feature addresses performance bottlenecks observed across several heavy-data pages in SchoolLedger. The following pages and API patterns are in scope:

| Page / Module | Current Pain Point |
|---|---|
| **Payments page** (`/payments`) | `GET /payments/with-students` fetches **all** payment rows for the tenant with no pagination; frontend filters, paginates, and calculates stats client-side |
| **Payments page — balance stats** | `GET /ledger/balances` fetches every active student's balance just to derive a single "Total Outstanding" metric displayed in the header |
| **Attendance page** (`/attendance`) | Attendance summary loads all records for the selected date range client-side and filters/sorts in memory |
| **Student Profile — Finance tab** | Fee statement loads all charges and payments into the browser; balance calculations (feeBalance, transportBalance, per-term totals) are re-derived on the frontend despite the backend already returning them |
| **Transport page** (`/transport`) | Routes, vehicles, and drivers are loaded in full; client-side `useMemo` filtering with no server-side search or pagination |
| **ClassStudentsPage** | Loads full class roster; client-side search only; no backend search support |
| **Dashboard financial stats** | `DashboardController::stats()` iterates over every active student in PHP to compute per-student term balance counts (`paidInFull`, `withOutstanding`), scaling O(n) with student count |
| **Students page** (`/students`) | Already has server-side pagination via `StudentsOptimizedController` — this is the reference pattern |

The Students page (`StudentsOptimizedController`) is the existing **reference implementation** for all optimizations in this feature.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Server-Side Paginated Payments List (Priority: P1)

An admin or bursar navigates to the Payments page. With thousands of payment records, the page currently loads every payment row upfront, causing noticeable lag. After this optimization, the page loads quickly showing only the first page of results; filters, search, and date range are applied on the server and do not require a full reload.

**Why this priority**: The Payments page is used daily for fee collection and reconciliation. It is the most visibly slow page for schools with large payment histories.

**Independent Test**: Navigate to `/payments`, observe the Payments tab loads within 2 seconds. Change a filter (method, category, class, month/year); the table updates without a full page reload. Verify the response payload contains `data`, `pagination`, and `stats` fields.

**Acceptance Scenarios**:

1. **Given** the Payments page is loaded, **When** the backend responds, **Then** only the records for the current page (default 20) are returned, along with `pagination.total`, `pagination.page`, `pagination.totalPages`, and `pagination.limit`.
2. **Given** filters (method, category, class, month, year) or a search term is entered, **When** the user applies the filter, **Then** the API is called with those parameters and the table reflects server-filtered results without a full page reload.
3. **Given** a search term is typed in the search box, **When** the user stops typing (debounce ≥ 300 ms), **Then** a new API request is issued and results update dynamically.
4. **Given** a paginated response is displayed, **When** the user navigates to page 2, **Then** the scroll position and active filters are preserved and only page 2 data is fetched.
5. **Given** the Payments page loads, **When** the backend calculates the "This Month" and "Today" payment totals, **Then** those aggregate values are returned by the API and the frontend renders them directly without iterating over all payment rows.

---

### User Story 2 — Eliminate Full-Balance-Scan on Payments Dashboard Stats (Priority: P1)

The Payments page header shows "Total Outstanding" by calling `GET /ledger/balances`, which computes and returns a balance row for every active student. With 500+ students this is an expensive query that returns far more data than needed for a single metric.

**Why this priority**: This is a silent scalability bomb — every page load triggers a full-tenant balance scan. Fixing it directly reduces backend CPU and network payload.

**Independent Test**: Open the Network tab, navigate to `/payments`. Confirm that `GET /ledger/balances` is no longer called. Confirm that the payments stats endpoint returns a `totalOutstanding` field instead.

**Acceptance Scenarios**:

1. **Given** the Payments page loads, **When** the stats are fetched, **Then** `totalOutstanding` is returned as a pre-computed aggregate by the payments stats endpoint — not derived by summing all balance rows on the frontend.
2. **Given** the payments stats endpoint is called, **When** the response arrives, **Then** it includes `totalOutstanding`, `totalThisMonth`, `paymentsToday` and no per-student balance rows.

---

### User Story 3 — Server-Side Attendance Summary Filtering & Sorting (Priority: P2)

A teacher or admin views the Attendance Summary tab. Currently, all attendance records for the chosen date range are loaded and then filtered/sorted client-side via `useMemo`. With large classes and long date ranges this becomes slow and memory-heavy.

**Why this priority**: Attendance summary is used by teachers every day. Server-side filtering eliminates the in-memory scan and keeps the UI responsive at scale.

**Independent Test**: Select a date range on the Attendance page and a class. Verify the API is called with `startDate`, `endDate`, and `classId` query parameters, and that the response is already sorted and filtered without further processing on the frontend.

**Acceptance Scenarios**:

1. **Given** a date range and class are selected, **When** the summary data is requested, **Then** the API accepts `startDate`, `endDate`, `classId`, `search`, `sortBy`, and `sortOrder` parameters and returns pre-filtered and pre-sorted rows.
2. **Given** a search term is entered in the Attendance Summary search box, **When** the user stops typing (debounce ≥ 300 ms), **Then** the API is called with the search term and results update without a full component re-render.
3. **Given** a sort column header is clicked, **When** the request is made, **Then** the `sortBy` and `sortOrder` parameters are sent to the backend and the returned rows are already sorted.

---

### User Story 4 — Transport Page Server-Side Search (Priority: P2)

An admin searches for a transport route, vehicle, or driver by name. Currently, all records are loaded and filtered in memory using `useMemo`. As the fleet grows, this becomes wasteful.

**Why this priority**: Transport data (routes, vehicles, drivers) is modestly sized today but the filtering pattern sets a bad precedent and should be corrected to match the Students pattern.

**Independent Test**: Type in the Transport page search box. Verify the API is called with a `search` query parameter for the active tab (routes, vehicles, or drivers), and the response contains only matching records.

**Acceptance Scenarios**:

1. **Given** the Transport page is showing the Routes tab, **When** a search term is entered (debounce ≥ 300 ms), **Then** the API is called with `search` parameter and returns only matching routes.
2. **Given** the same search term is active when the user switches between Routes / Vehicles / Drivers tabs, **Then** the search term is preserved and the API call for the new tab uses the same search term.

---

### User Story 5 — ClassStudentsPage Server-Side Search (Priority: P2)

A teacher or admin opens a class page and searches for a student by name or admission number. Currently, the full class roster is loaded and filtered in memory.

**Why this priority**: Classes can have 40–60 students. Searching server-side ensures the pattern is consistent and scales for large classes or batch imports.

**Independent Test**: Navigate to a class page and type in the search box. Verify the `GET /classes/:id/students` request includes a `search` parameter and the response contains only matching students.

**Acceptance Scenarios**:

1. **Given** the ClassStudentsPage is displayed, **When** a search term is typed (debounce ≥ 300 ms), **Then** the API is called with `search` and returns only matching students.
2. **Given** an empty search, **When** the page loads, **Then** all students in the class are returned.

---

### User Story 6 — Dashboard Financial Stats Pre-Aggregated (Priority: P2)

The admin/bursar Dashboard currently derives financial summary metrics (total outstanding balance across all students) by calling `GET /ledger/balances`. This endpoint returns one row per student and the total is computed client-side. The Dashboard should receive a single pre-computed aggregate value.

**Why this priority**: The Dashboard is the first page every admin sees. A slow Dashboard degrades the entire perceived performance of the application.

**Independent Test**: Load the Dashboard as admin. Confirm `GET /ledger/balances` is no longer called. Confirm the Dashboard stats endpoint returns a `totalOutstanding` aggregate field.

**Acceptance Scenarios**:

1. **Given** the Dashboard loads, **When** financial stats are fetched, **Then** `totalOutstanding` is a pre-computed field in the dashboard stats response, not derived from per-student rows.
2. **Given** the dashboard stats endpoint is called, **When** the response arrives, **Then** it returns within a reasonable time regardless of the number of active students.

---

### User Story 7 — Loading States & Optimistic UI on All Optimized Pages (Priority: P3)

Users experience smooth, non-flickering UI transitions when paginating, filtering, or searching on any optimized page. No full page remounts occur during data refreshes.

**Why this priority**: UX quality improvement — ensures the performance work feels polished to end users.

**Independent Test**: On Payments and Attendance pages, change a filter. Verify the existing data remains visible with a loading overlay or skeleton until the new data arrives — the table does not flash empty.

**Acceptance Scenarios**:

1. **Given** a filter or search is changed, **When** the new data is being fetched, **Then** the previous data remains visible with a loading indicator overlaid, not replaced by a blank/empty state.
2. **Given** a page navigation occurs, **When** data is loading, **Then** a skeleton or spinner is shown in the table area and pagination controls are disabled to prevent duplicate requests.
3. **Given** a debounced search input, **When** the user is still typing, **Then** no API request is made until the debounce interval has elapsed.

---

### Edge Cases

- What happens when a page number requested exceeds the total pages? → API returns the last valid page (or an empty data array with correct pagination metadata).
- What happens when filters produce zero results? → API returns an empty `data` array with `pagination.total = 0`; frontend shows a "No results found" empty state, not a loading spinner.
- What happens when a network request fails mid-pagination? → The current page data remains visible; an error message and a Retry button appear without clearing the existing rows.
- What happens when the search debounce fires while a previous request is still in flight? → The in-flight request is cancelled (or its result discarded) and only the latest request result is applied.
- What happens when `GET /ledger/balances` is removed from the Payments page but a component still imports it? → The component must be updated; the endpoint itself is not deleted (other consumers such as the Reconciliation tab may still use it).

---

## Requirements *(mandatory)*

### Functional Requirements

#### Payments API & Page

- **FR-001**: The `GET /payments/with-students` endpoint MUST accept query parameters: `page` (integer), `limit` (integer, default 20), `search` (string), `method` (string), `category` (string), `classId` (string), `month` (integer 1–12), `year` (integer), `sortBy` (string: `date`|`amount`|`studentName`), `sortOrder` (string: `asc`|`desc`).
- **FR-002**: The `GET /payments/with-students` endpoint MUST return a response shaped as `{ data: Payment[], pagination: { page, limit, total, totalPages }, stats: { totalThisMonth, paymentsToday } }`.
- **FR-003**: All filtering and sorting for the payments list MUST be performed at the database level, not on the frontend.
- **FR-004**: The Payments page MUST NOT call `GET /ledger/balances` for the purpose of computing "Total Outstanding". This value MUST be provided by a dedicated stats endpoint or embedded in the payments stats response.
- **FR-005**: The Payments page search input MUST debounce API requests by at least 300 ms.
- **FR-006**: Changing any filter on the Payments page MUST reset to page 1 and issue a new server-side request without a full component unmount/remount.

#### Attendance API & Page

- **FR-007**: The attendance summary endpoint MUST accept `startDate`, `endDate`, `classId`, `search`, `sortBy`, and `sortOrder` query parameters and apply them at the database level.
- **FR-008**: The Attendance Summary tab search input MUST debounce API requests by at least 300 ms.
- **FR-009**: Sorting the Attendance Summary table MUST trigger an API call with the corresponding `sortBy`/`sortOrder` parameters rather than re-sorting existing in-memory data.

#### Transport API & Page

- **FR-010**: The routes, vehicles, and drivers list endpoints MUST accept a `search` query parameter and filter results at the database level.
- **FR-011**: The Transport page search input MUST debounce API requests by at least 300 ms and preserve the search term when switching between tabs.

#### ClassStudentsPage

- **FR-012**: The `GET /classes/:id/students` (or equivalent) endpoint MUST accept a `search` query parameter and return only students whose name or admission number matches.
- **FR-013**: The ClassStudentsPage search input MUST debounce API requests by at least 300 ms.

#### Dashboard

- **FR-014**: The admin/bursar Dashboard MUST NOT call `GET /ledger/balances` to derive total outstanding. The Dashboard stats endpoint MUST return `totalOutstanding` as a pre-computed aggregate field.

#### General Frontend Behaviour

- **FR-015**: All paginated or filtered data tables MUST display a loading skeleton or spinner while a request is in flight, keeping existing data visible rather than replacing it with an empty state.
- **FR-016**: Pagination controls MUST be disabled while a request is in flight to prevent duplicate requests.
- **FR-017**: When a request fails, the current page data MUST remain visible and an inline error with a Retry action MUST be shown.

#### General Backend Behaviour

- **FR-018**: All new list endpoints that return potentially large result sets MUST support `page` and `limit` parameters (default limit: 20, maximum limit: 100).
- **FR-019**: All paginated responses MUST include a `pagination` object with `page`, `limit`, `total`, and `totalPages` fields.
- **FR-020**: All filtering and sorting on list endpoints MUST be applied before pagination (i.e., `total` reflects the filtered count, not the full table count).

### Key Entities

- **Paginated Response**: A standard envelope returned by all optimized list endpoints containing `data` (array of records), `pagination` (page metadata), and optionally `stats` (pre-computed aggregates).
- **Stats Aggregate**: A pre-computed server-side summary (e.g., `totalOutstanding`, `totalThisMonth`, `paymentsToday`) embedded in an API response to eliminate client-side aggregation over large datasets.
- **Debounced Search**: A frontend input pattern that delays API requests until the user has stopped typing for a configured interval (≥ 300 ms), reducing redundant network traffic.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The Payments page initial load time (time until first meaningful data is displayed) is reduced by at least 50% compared to the current `GET /payments/with-students` full-dump approach when there are ≥ 500 payment records.
- **SC-002**: The Payments page network payload on initial load MUST NOT exceed the data for 20 records plus stats metadata, regardless of how many total payment records exist in the tenant.
- **SC-003**: `GET /ledger/balances` MUST NOT be called on the Payments page or Dashboard page load. Network traces confirm this.
- **SC-004**: Applying any filter or search on the Payments page results in a UI update (new data rendered) within 1 second under normal network conditions, with no full component flash or blank state.
- **SC-005**: The Attendance Summary tab applies server-side search and sorting — no in-memory `filter` or `sort` over the full attendance dataset occurs on the frontend.
- **SC-006**: The Transport page and ClassStudentsPage search inputs trigger server-side queries with the search term as a parameter, confirmed by network inspection.
- **SC-007**: All paginated list responses include `pagination.total`, `pagination.page`, `pagination.totalPages`, and `pagination.limit` fields.
- **SC-008**: No pagination or filter action causes a full page reload (browser navigation). All updates are in-place via asynchronous data fetching.

---

## Assumptions

- The Students page (`StudentsOptimizedController` + `getFilteredStudents` / `getFilteredStudentsCount` / `getGlobalStats` in `StudentModel`) is already optimized and serves as the **reference implementation** for all new paginated endpoints.
- `GET /ledger/balances` is **not** deleted — it remains available for the Reconciliation tab and any other consumer that legitimately needs per-student balances. Only the Payments page and Dashboard are changed to stop using it for aggregate-only metrics.
- The default page size for new paginated endpoints is 20 records; the Students page uses a default of 10 — new pages may use 20 for consistency with the user's request unless the admin preference feature is already configured.
- Backend caching (e.g., CodeIgniter Cache for classes, already implemented in `StudentsOptimizedController`) may be applied where data changes infrequently, but is not required for all endpoints in scope.
- Mobile responsive behaviour of existing paginated components (as in `Students.tsx`) is already handled; this feature carries the same expectation for newly paginated pages.
- Search debounce is implemented on the frontend; the backend endpoints are stateless and do not need to know about debouncing.
- No new database migrations are required for this feature — all optimizations use existing tables. New indexes may be added as a separate schema migration if query analysis identifies missing indexes on `payments.date`, `payments.category`, `payments.method`, or `payments.student_id`.
- The `withStudents` method on `PaymentController` will be refactored in-place (not replaced by a new controller) to avoid breaking the existing route `GET /payments/with-students`.
