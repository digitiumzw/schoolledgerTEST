# Feature Specification: Subscriptions Operations Dashboard

**Feature Branch**: `079-subscriptions-ops-dashboard`  
**Created**: 2026-05-21  
**Status**: Draft  
**Input**: User description: "Improve the page by making the KPI cards more operational and meaningful (e.g., Active Schools, MRR, Failed Payments, Renewals Due, Churn), strengthen the subscription status badges with semantic colors for faster scanning, simplify financial formatting like changing $25.0000/mo to $25/mo, add a search bar and more filters (plan, billing cycle, payment status, expiring soon), include row action menus for managing subscriptions, improve spacing between sections for better visual rhythm, make the active sidebar state more prominent, redesign the icons to better match the metrics they represent, and enhance the subscriptions table with more actionable information such as renewal dates, payment health, trial states, seats/users, and alerts so the page feels like a true platform operations dashboard rather than just a clean CRUD interface."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Operational KPI Overview (Priority: P1)

A platform operator opens the Subscriptions page and immediately sees a meaningful health snapshot of the platform: how many schools are actively paying, the current MRR, how many payments have failed and need intervention, how many subscriptions are renewing in the next 30 days, and the month's churn count. Each KPI is accompanied by an icon that semantically matches the metric it represents and a tooltip explaining what it measures and how it is calculated. The MRR and other monetary values display as clean currency (e.g., `$25/mo` not `$25.0000/mo`).

**Why this priority**: The KPI bar is the first thing operators see. Replacing generic counts with revenue-health and churn metrics converts the page from a CRUD list into an actionable operations dashboard. All other improvements build on having trustworthy, readable top-level numbers.

**Independent Test**: Can be verified by loading the page, observing that the six KPI cards render with correct labels, icons, and numeric values sourced from the backend finance summary endpoint, and that monetary formatting never shows trailing zeros past the cents boundary.

**Acceptance Scenarios**:

1. **Given** the page loads with a populated tenant base, **When** the KPI bar renders, **Then** six cards appear: Active Schools, MRR, Failed Payments, Renewals Due (30 days), Monthly Churn, and Pricing Plans — each with a contextually matching icon and a tooltip describing the metric.
2. **Given** a plan has a monthly price of $25.00 USD, **When** it is displayed anywhere on the page, **Then** it renders as `$25/mo` (no trailing `.00` or `.0000`).
3. **Given** the finance summary API returns MRR and failed-payment counts, **When** the page loads, **Then** the KPI values match the backend-computed figures without frontend arithmetic.
4. **Given** the KPI bar is loading, **When** data has not yet arrived, **Then** skeleton placeholders of equal card height replace each card without layout shift.

---

### User Story 2 - Subscription Table Search, Filter, and Actionable Rows (Priority: P1)

A platform operator needs to quickly locate a specific school's subscription or filter the list to a subset (e.g., all annual subscribers on the Pro plan whose payment is overdue). They type in a search bar to match school name or email, then apply any combination of four additional filter controls: plan, billing cycle, payment status, and an "expiring soon" toggle. Each matching row in the table now shows renewal date, a payment-health indicator, trial state, seats/student-limit, and any alerts (e.g., payment failed, expiring in 7 days). Every row has a three-dot action menu regardless of status — not just active ones — offering contextually appropriate actions.

**Why this priority**: Without search and multi-filter, operators must scroll or rely on status filter alone. Together with the richer row columns, this converts the subscriptions table from a read-only list into a workspace where operators can find and act on subscriptions in one place.

**Independent Test**: Can be verified by entering a search term, confirming only matching rows remain, applying a plan filter, confirming the combined result narrows further, and clicking the action menu on a cancelled subscription to confirm non-destructive actions are offered.

**Acceptance Scenarios**:

1. **Given** the subscriptions table is visible, **When** the operator types a school name or email into the search bar, **Then** the table updates to show only matching rows within 400 ms of the last keystroke.
2. **Given** search and filter controls are present, **When** the operator selects a plan, a billing cycle, a payment status, and enables the "expiring soon" toggle simultaneously, **Then** the table displays only rows satisfying all four criteria plus the search term, and pagination reflects the filtered count.
3. **Given** a subscription row is visible, **When** the operator views the row, **Then** it shows: school name and email, plan name, billing-cycle badge, status badge (with semantic color), renewal/expiry date with a visual urgency indicator when ≤30 days away, payment health badge, student seat limit, and any alert badges (e.g., "Payment Failed", "Trial Ending").
4. **Given** any subscription row regardless of status, **When** the operator opens the three-dot action menu, **Then** available actions are displayed (e.g., Assign/Reassign Plan, Cancel for active; Reassign for expired/cancelled) and unavailable destructive actions are either absent or visually disabled with a reason.
5. **Given** the operator cancels a subscription from the row action menu, **When** the confirmation is accepted, **Then** a loading spinner is shown on the button, the action is disabled until the response is received, and the row status badge updates to "Cancelled" without a full page reload.

---

### User Story 3 - Semantic Status Badges and Visual Rhythm (Priority: P2)

A platform operator scanning the subscriptions table can instantly distinguish subscription health through color-coded status badges without reading the text. Active subscriptions are green, trials are blue, past-due/warning states are amber, cancelled/expired/superseded states are grey, and failed payment states are red. Section spacing throughout the page follows a consistent visual rhythm so the KPI bar, tab strip, and table card each feel clearly separated and the page is not cramped. The sidebar's active link for this page is visually prominent — clearly heavier than inactive links.

**Why this priority**: Visual scanning speed matters for ops workflows. Semantic color consistency and proper spacing are lower risk than the data changes in US1/US2 but meaningfully improve the operator experience and signal professionalism.

**Independent Test**: Can be verified by loading the subscriptions table with rows of varying statuses and confirming each badge color matches its status category without relying on the badge label text alone.

**Acceptance Scenarios**:

1. **Given** the subscriptions table contains rows with active, trial, past_due, cancelled, expired, superseded, and failed-payment statuses, **When** the operator views the table, **Then** each status badge renders with the correct semantic color: green for active/paid, blue for trial/trialing, amber for past_due/pending, grey for cancelled/expired/superseded, red for failed/overdue.
2. **Given** the subscriptions page is open, **When** the operator views the overall page layout, **Then** there is clear visual separation (whitespace or dividers) between the header, KPI bar, tab strip, and the card body, with no sections feeling cramped or overloaded.
3. **Given** the platform admin panel sidebar is rendered with the Subscriptions link active, **When** the operator views the sidebar, **Then** the active Subscriptions link is visually distinct from inactive links through a heavier background, stronger text color, or accent indicator — not just a subtle color shift.

---

### User Story 4 - Plan Card Price Display Cleanup (Priority: P2)

A platform operator viewing the Pricing Plans tab sees clean, human-readable prices on plan cards. Monthly price shows as `$25/mo`, annual shows as `$240/yr`, and the annual discount annotation (e.g., `17% off`) is displayed inline. No raw decimal places like `.0000` or `.00` appear unless the price has meaningful cents (e.g., `$9.99/mo` is fine). The "Assign subscription" dialog's plan selector also shows clean price labels.

**Why this priority**: Price formatting is a presentational polish that applies across the Subscriptions page and the assign-subscription modal. It is independent of data-model changes and can be delivered after US1/US2 without risk.

**Independent Test**: Can be verified by opening the Pricing Plans tab and the Assign Subscription dialog and confirming no price string ends in `.00`, `.0000`, or any other trailing zero pattern.

**Acceptance Scenarios**:

1. **Given** a plan with `monthly_price = 25.0`, **When** displayed on a plan card or in the assign dialog's plan selector, **Then** it renders as `$25/mo` not `$25.00/mo` or `$25.0000/mo`.
2. **Given** a plan with `monthly_price = 9.99`, **When** displayed, **Then** it renders as `$9.99/mo` (meaningful cents preserved).
3. **Given** a plan with an annual price, **When** displayed on a plan card, **Then** it renders as `$X/yr` with the `(Y% off)` annotation inline, never with trailing zeros beyond meaningful precision.

---

### Edge Cases

- What happens when the finance summary API is unavailable? → KPI cards that depend on it show a `—` placeholder and a muted "unavailable" subtitle rather than `0` or `NaN`.
- What happens when zero subscriptions match the current search + filter combination? → The table body shows an empty-state illustration with a "No subscriptions match your filters" message and a "Clear filters" link.
- What happens when a subscription has no expiry date (open-ended)? → The renewal date cell renders "No expiry" instead of a blank or invalid date.
- What happens when the operator rapidly changes filter values? → Requests are debounced so that only the final stable filter combination triggers a backend fetch.
- What happens when a plan has `monthly_price = 0`? → The price displays as `Free` not `$0/mo`.
- What happens when `renewals_due` or `churn_count` data is not yet returned by the finance summary? → Those KPI cards show `—` gracefully until the backend provides the value.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The KPI bar MUST display six cards: Active Schools, MRR, Failed Payments, Renewals Due (next 30 days), Monthly Churn, and Pricing Plans — each with a semantically matching icon, tooltip, and backend-sourced value.
- **FR-002**: All monetary values displayed on the page MUST be formatted without trailing zeros beyond meaningful precision (e.g., `$25/mo`, not `$25.00/mo` or `$25.0000/mo`); prices equal to zero MUST render as `Free`.
- **FR-003**: The subscriptions table MUST include a full-text search bar that filters by school name or email, debounced to avoid excessive requests.
- **FR-004**: The subscriptions table MUST provide four additional filter controls alongside the existing status filter: Plan (select from available plans), Billing Cycle (monthly / annual), Payment Status (paid / past_due / failed / pending), and an "Expiring Soon" toggle (subscriptions expiring within 30 days).
- **FR-005**: Every row in the subscriptions table MUST display: school name and contact email, plan name, billing-cycle badge, status badge, renewal/expiry date with visual urgency styling when ≤30 days away, payment health indicator, student seat limit or "Unlimited", and any alert badges applicable to that subscription.
- **FR-006**: Backend APIs MUST return view-ready data for all feature screens, including any filtering, searching, pagination, sorting, aggregations, and computed values required by the frontend.
- **FR-007**: Frontend behavior MUST be limited to passing user-selected query parameters and rendering backend-prepared responses; it MUST NOT perform client-side data filtering, searching, sorting, pagination, aggregations, or business computations.
- **FR-008**: Every user action that triggers a data change (create, update, delete, submit, refresh, bulk-operation, status-change) MUST display a visible loading indicator from the moment the request is initiated until the response is fully received and the UI reflects the confirmed server state. Action-triggering controls MUST be disabled during in-flight requests to prevent duplicate submissions.
- **FR-009**: After any mutation completes, all React Query queries whose data was affected MUST be invalidated or updated so the next render reflects the latest server state. Stale cached values MUST NOT flash or re-appear after the mutation response is processed.
- **FR-010**: The three-dot row action menu MUST be present on every subscription row (not only active ones); available actions MUST be contextually scoped to the subscription's current status (e.g., "Cancel" only for active; "Reassign Plan" for any status).
- **FR-011**: Status badges throughout the page MUST use semantic color mapping: green for active/paid, blue for trial/trialing, amber for past_due/pending, grey for cancelled/expired/superseded/inactive, red for failed/overdue.
- **FR-012**: The sidebar active-state styling for the Subscriptions page link MUST be visually prominent enough to distinguish it clearly from inactive sidebar links at a glance.
- **FR-013**: The subscriptions backend endpoint MUST accept `search`, `plan_id`, `billing_cycle`, `payment_status`, and `expiring_soon` query parameters in addition to the existing `status`, `page`, and `limit` parameters, and MUST apply them server-side.
- **FR-014**: The finance summary backend endpoint MUST return `failed_payments_count`, `renewals_due_count` (subscriptions expiring within 30 days), and `monthly_churn_count` (subscriptions cancelled in the current calendar month) in addition to existing MRR fields.
- **FR-015**: Each subscription record returned by the subscriptions endpoint MUST include `payment_status`, `next_renewal_at` (or `expires_at`), `max_students` from the associated plan, and `alerts` (array of string codes such as `payment_failed`, `expiring_soon`, `trial_ending`).

### Key Entities

- **Subscription**: A tenant's active or historical assignment to a pricing plan, including billing cycle, date range, payment status, and associated alert codes.
- **Plan**: A pricing tier with a name, monthly/annual price (in cents and formatted value), student seat limit, and subscriber count.
- **Finance Summary**: Aggregated platform-level metrics: MRR, active subscription count, failed payment count, renewals due in 30 days, and monthly churn count.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A platform operator can identify all subscriptions expiring within 30 days in fewer than 3 filter interactions (toggle "Expiring Soon" filter → results appear).
- **SC-002**: No monetary value on the page displays trailing zeros beyond meaningful precision; spot-checking 5 plan cards and 5 subscription rows shows clean formatting 100% of the time.
- **SC-003**: The subscriptions table search returns visible results within 400 ms of the operator stopping typing (debounce boundary).
- **SC-004**: Every subscription row — regardless of status — exposes a three-dot action menu with at least one available action.
- **SC-005**: The subscriptions list endpoint returns only the requested page of rows plus summary metadata (total, active_count, filtered_count) without full-table scans on the frontend.
- **SC-006**: All six KPI cards are populated from backend-computed values; zero frontend arithmetic is used to derive KPI figures.
- **SC-007**: Status badges are distinguishable by color alone for active, trial, past_due, cancelled, and failed states — verifiable by visual inspection without reading the badge label.

## Assumptions

- The platform admin panel is a standalone React application with its own JWT auth flow and API layer (`frontend/src/api/platform.ts`), separate from the tenant-facing app.
- The existing `getFinanceSummary()` API call will be extended rather than replaced; new KPI fields (`failed_payments_count`, `renewals_due_count`, `monthly_churn_count`) will be added to its response.
- The `getSubscriptions()` endpoint will be extended with new query parameters server-side; no new REST route is required.
- Each subscription row's `payment_status` will be derived server-side (from the most recent invoice or payment record) and included in the subscription list response.
- "Renewals Due" is defined as subscriptions with `expires_at` between today and 30 days from today with status = `active`.
- "Monthly Churn" is defined as subscriptions with `cancelled_at` in the current calendar month.
- Trial state detection relies on `status = 'trialing'` or `status = 'trial'` already present in the data model.
- The sidebar active-state improvement targets `frontend/src/admin/components/admin/AppSidebar.tsx` and uses the existing active-link styling pattern already in place for other nav items.
- No new database migrations are required; the new KPI and filter fields can be derived from existing tables in the platform database.
- Email notifications for payment failures, upcoming renewals, or churn are out of scope for this feature.
- Mobile responsiveness for the new filter row follows the existing page's responsive patterns (stack on small screens).
