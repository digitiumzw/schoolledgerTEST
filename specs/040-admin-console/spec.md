# Feature Specification: Admin Platform Console

**Feature Branch**: `040-admin-console`
**Created**: 2026-04-21
**Status**: Draft
**Input**: User description: "I want you to work on the template UI located in the `admin-frontend` folder. I plan to use it to control and manage the platform, so build it accordingly and ensure it integrates and works properly with the backend."

## Overview

SchoolLedger is a multi-tenant SaaS school management platform. Today, each tenant (school) has its own operational console; the platform operator ("platform admin") has no dedicated surface to oversee the fleet of tenants, subscription health, billing outcomes, or platform-wide configuration.

This feature turns the existing `admin-frontend` template into a fully functional **Platform Admin Console** — a separate, authenticated application used by SchoolLedger staff (not by school users) to:

1. Oversee every tenant on the platform (health, plan, usage, status).
2. Manage subscription plans and the lifecycle of individual tenant subscriptions.
3. Review platform revenue, invoices, and billing events across all tenants.
4. Track platform-wide growth and adoption analytics.
5. Configure global platform settings (identity, billing provider, team, security, API keys).

The console must be powered by real backend data — no mock data remains in the shipped build — and must reuse the existing authentication, multi-tenant, and subscription domain already implemented in the backend, extending it with a small number of platform-scoped endpoints where cross-tenant aggregation or tenant lifecycle actions are required.

## Clarifications

### Session 2026-04-21

- Q: Where do platform-admin accounts live and authenticate from? → A: A separate `platform_users` table with its own login endpoint and a dedicated JWT scope (`scope: "platform"`, no `tenant_id` claim), fully isolated from the tenant `users` table.
- Q: Should the console support tenant-user impersonation, and at what scope? → A: Yes, in scope for v1 — restricted to tenant `admin` role only, short-lived scoped JWT (max 30 min), visible banner in the impersonated session, fully audit-logged.
- Q: What can each console role (Owner / Admin / Finance / Support) do? → A: Adopt a least-privilege matrix — Owner has full access including Team/role changes and tenant deletion; Admin has full operational access except role changes and Finance writes; Finance drives plan/subscription changes and full Finance (incl. refunds & CSV export) but is read-only on tenants and team; Support handles tenant suspend/reactivate/impersonate but is read-only on Subscriptions, Finance, and Settings.
- Q: Is the Payouts panel in scope for v1? → A: No — the Payouts panel is removed from v1; the Finance page instead surfaces failed/overdue invoices, outstanding receivables, and refund activity from existing invoice data.
- Q: Where should platform-wide settings (name, currency, tax rate, security toggles, email templates) be stored? → A: In a new `platform_settings` DB table (simple key-value or typed column schema), writable via platform-scoped API endpoints, isolated from tenant settings.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in and view platform health at a glance (Priority: P1)

A platform admin opens the console, authenticates, and lands on a dashboard that immediately shows the current state of the business: number of tenants, number of active subscriptions, monthly recurring revenue (MRR), total students across all schools, churn rate, revenue trend over the last 12 months, plan distribution, new-tenant signups per month, and the most recent platform-level events (new signup, plan upgrade, failed payment, cancellation).

**Why this priority**: Without authenticated access and a live health view, the console delivers no value. This is the smallest slice that lets an operator replace spreadsheets / ad-hoc DB queries.

**Independent Test**: Log in as a platform admin, confirm the dashboard loads with real values computed from the tenant, subscription, invoice, and billing-event records — and that an unauthenticated visitor cannot reach any console page.

**Acceptance Scenarios**:

1. **Given** a valid platform-admin credential, **When** the admin submits the login form, **Then** they are redirected to the dashboard and a session is established.
2. **Given** an unauthenticated visitor, **When** they navigate to any console route, **Then** they are redirected to the login screen.
3. **Given** a signed-in non-platform user (e.g. a school admin/bursar/teacher), **When** they attempt to access the console, **Then** they are denied with a clear "insufficient privileges" message.
4. **Given** a signed-in platform admin, **When** the dashboard loads, **Then** every KPI, chart, and recent-activity entry reflects current production data (no placeholder/mock values).
5. **Given** the dashboard is loaded, **When** any underlying metric changes (e.g. a new tenant signs up), **Then** refreshing the page shows the updated value within one refresh cycle.

---

### User Story 2 - Manage the roster of tenant schools (Priority: P1)

The platform admin opens the Schools page and sees every tenant on the platform in a searchable, filterable, paginated list (by name, plan, status, region). For each tenant they can open a detail panel showing profile, usage (students, teachers, storage, MRR), billing history, and danger-zone actions. They can **create a new tenant** (which provisions the school and its initial admin account), **suspend** a tenant (disabling access for all that tenant's users until reactivated), **reactivate** a suspended tenant, and **delete** a tenant (soft-deactivate by default, with a separate confirmed "permanent delete" for tenants without financial records).

**Why this priority**: Tenant lifecycle is the core job of the console; without it the product cannot be operated.

**Independent Test**: Create a tenant from the console, verify the school appears in the list and that its initial admin can log in to the tenant-facing app; then suspend the tenant and verify no user of that tenant can log in until reactivation.

**Acceptance Scenarios**:

1. **Given** the Schools page, **When** the admin applies plan and status filters and types a search term, **Then** the list narrows to matching tenants and pagination reflects the filtered total.
2. **Given** the "Add school" dialog, **When** the admin submits a valid school name, admin email, and plan, **Then** a new tenant and a new admin user are created and an onboarding email is dispatched to that address.
3. **Given** an active tenant, **When** the admin chooses "Suspend" and confirms, **Then** all users belonging to that tenant are blocked from authenticating until the tenant is reactivated, and the tenant's status in the list becomes "Suspended".
4. **Given** a suspended tenant, **When** the admin chooses "Reactivate", **Then** the tenant status returns to "Active" and its users can log in again.
5. **Given** a tenant with zero financial records (no charges, payments, invoices), **When** the admin confirms a permanent delete, **Then** the tenant and its dependent records are removed and it disappears from the list.
6. **Given** a tenant with financial records, **When** the admin attempts a permanent delete, **Then** the action is refused with a message recommending suspension instead.
7. **Given** the tenant detail panel, **When** the admin opens the Billing tab, **Then** the tenant's real invoices and their statuses are displayed, sourced from the platform's invoice store.

---

### User Story 3 - Manage subscription plans and tenant subscriptions (Priority: P2)

The admin opens Subscriptions and sees: (a) the catalog of plan tiers (name, price, billing cycle, feature list, count of tenants on each tier), with the ability to **create**, **edit**, and **retire** a plan; and (b) a table of every live tenant subscription with plan, status, renewal date, amount, and actions to **change plan** or **cancel** a subscription.

**Why this priority**: Plan/subscription changes drive the revenue of the platform and are second only to tenant lifecycle.

**Independent Test**: Create a new plan tier, assign a tenant to it from the subscriptions table, and verify the tenant's billing events and next invoice reflect the new plan.

**Acceptance Scenarios**:

1. **Given** the Plans grid, **When** the admin edits a plan's price and saves, **Then** future renewals of tenants on that plan use the new price while existing invoices are unaffected.
2. **Given** a plan with active subscribers, **When** the admin tries to delete it, **Then** the action is refused until those subscribers are migrated.
3. **Given** a tenant subscription, **When** the admin triggers "Change plan", **Then** the proration logic of the existing subscription engine produces a preview and, on confirmation, applies the new plan and emits a billing event.
4. **Given** a tenant subscription, **When** the admin cancels it, **Then** the subscription moves to a cancelled state with an effective-end date and the tenant is scheduled to enter grace / downgrade according to platform rules.

---

### User Story 4 - Review revenue, invoices, and payouts (Priority: P2)

On the Finance page the admin sees MRR, ARR, outstanding receivables, monthly refund total, a revenue-by-plan stacked chart, a list of recent invoices across all tenants (with download), and a list of recent payouts. Invoices can be filtered by status and date range and exported to CSV.

**Why this priority**: Operators need this to answer "are we getting paid?" without leaving the console.

**Independent Test**: Export the last 30 days of invoices to CSV and verify the totals reconcile with the MRR/ARR KPIs shown on the page.

**Acceptance Scenarios**:

1. **Given** a date range, **When** the admin clicks "Export CSV", **Then** a CSV of every invoice in that range (all tenants) is produced with invoice id, tenant, amount, status, and date.
2. **Given** an unpaid invoice, **When** the admin opens its row, **Then** they see the tenant, due date, amount, failure reason (if any), and a link to the tenant's billing history.
3. **Given** MRR and ARR tiles, **When** the page loads, **Then** their values match the sum of active subscription amounts at their current plan price.

---

### User Story 5 - Platform-wide analytics (Priority: P3)

The Analytics page visualises 12-month growth of schools, active users, students, and daily logins; a geographic distribution of schools/students by country/region; and a leaderboard of top tenants by usage (student count, active users, storage).

**Why this priority**: Strategic / reporting value, does not block day-to-day operations.

**Independent Test**: Verify the growth chart's "schools" series at the current month equals the total tenant count shown on the Dashboard.

**Acceptance Scenarios**:

1. **Given** at least 12 months of platform history, **When** the Analytics page loads, **Then** the growth chart shows monthly series for schools, users, and students.
2. **Given** tenants with country/region metadata, **When** the page loads, **Then** the geographic widget aggregates tenants and students by country and sorts descending.

---

### User Story 6 - Configure the platform (Priority: P3)

Settings is organised into tabs: **General** (platform name, support email, default currency, default timezone, tagline); **Billing** (payment provider connection status, tax rate, trial length, invoice prefix); **Email** (editable templates for welcome, trial-ending, payment-failed, subscription-cancelled, monthly invoice); **Team** (invite/remove platform staff with roles Owner / Admin / Finance / Support); **Security** (toggles for 2FA enforcement, SSO enforcement, auto-suspend after N failed payments, weekly security digest); **API keys** (create, reveal-once, rotate, and revoke programmatic keys).

**Why this priority**: Required for a production-ready platform but most settings are rarely changed.

**Independent Test**: Create a new API key, immediately copy its value, reload the page, and verify the raw value is no longer retrievable (only a masked preview remains).

**Acceptance Scenarios**:

1. **Given** the General tab, **When** the admin updates the platform name and saves, **Then** the new value persists and is shown on the next page load.
2. **Given** the Team tab, **When** the admin invites an email address with role "Finance", **Then** that person receives an invitation and, upon accepting, can access the console with Finance-level permissions.
3. **Given** the API keys tab, **When** the admin creates a new key, **Then** the full key value is shown exactly once and subsequently only a masked form is stored and displayed.
4. **Given** "Auto-suspend after 3 failed payments" is enabled, **When** a tenant records a third consecutive failed payment, **Then** that tenant is automatically suspended and an activity entry is written.

---

### Edge Cases

- What happens when the platform admin's JWT expires while they are viewing the console? The client must detect the 401, attempt a silent refresh, and fall back to redirecting to login with the current route preserved as a return target.
- What happens when a tenant is suspended while the admin already has its detail panel open? The next mutation attempt shows an updated status badge and disables destructive actions.
- What happens when an admin tries to delete the very plan tier they are subscribed to on the sample/internal tenant? The action is refused with a clear message listing blocking subscribers.
- What happens when the backend returns a cross-tenant list larger than the page can render (e.g. 10,000 tenants)? The list is paginated and remains responsive; server-side search/filter/sort are used rather than client-side.
- What happens when two platform admins edit the same plan simultaneously? The later save either wins with a toast, or is rejected with a conflict message — the implementation must choose one and do it consistently (last-write-wins is acceptable for v1).
- What happens when a CSV export request matches more rows than a single request should return? The export is generated as a download and streamed / paginated server-side so the UI does not freeze.
- What happens when a platform admin loses network connectivity mid-action? Mutations show a clear failure toast and the UI state is not left in a half-applied condition.
- What happens when a tenant has never recorded a billing event? Billing tab shows an empty state, not a crash.

## Requirements *(mandatory)*

### Functional Requirements

**Access & session**

- **FR-001**: The console MUST require authentication before showing any operational page and MUST restrict access to accounts stored in a dedicated platform-admin identity store (separate from the tenant `users` table).
- **FR-002**: Platform-admin authentication MUST issue a JWT that carries a `scope: "platform"` claim and NO `tenant_id` claim; the console MUST handle token expiry by attempting refresh and, on failure, redirecting to login with the intended URL preserved.
- **FR-003**: The console MUST log the acting platform admin's identity against every mutating action in an auditable activity stream.
- **FR-004**: Tenant-scoped JWTs (any token carrying a `tenant_id` claim or tenant roles `admin`, `teacher`, `bursar`, `super_admin`) MUST NOT grant access to platform-level endpoints; conversely, a platform-scoped JWT MUST NOT satisfy tenant-scoped endpoints without an explicit impersonation flow.
- **FR-005**: Platform-admin accounts MUST be stored in a dedicated `platform_users` table (identity, credentials, platform role, 2FA state, last-login) — distinct from the tenant `users` table — and MUST be managed exclusively from the console's Team tab.

**Dashboard**

- **FR-010**: The Dashboard MUST show live values for: total tenants, active subscriptions, MRR, total students across all tenants, and churn rate (last 30 days).
- **FR-011**: The Dashboard MUST render a 12-month revenue trend, a plan-distribution breakdown of active tenants, a new-tenants-per-month bar chart, and a recent-activity feed with at least: new signup, plan upgrade, payment failed, subscription cancelled.
- **FR-012**: Dashboard widgets MUST refresh on page reload and MUST NOT use placeholder/mock data in any production build.

**Tenants (Schools)**

- **FR-020**: The Schools page MUST list every tenant with columns: name, plan, student count, status, MRR, region, join date; and MUST support server-side search, plan filter, status filter, and pagination.
- **FR-021**: The admin MUST be able to create a new tenant by providing school name, initial admin email, and selected plan; creation MUST provision the tenant record, create the initial admin user, and send an onboarding email.
- **FR-022**: The admin MUST be able to suspend a tenant; while suspended, no user of that tenant may authenticate, and any valid active session for that tenant's users MUST be invalidated on their next request.
- **FR-023**: The admin MUST be able to reactivate a suspended tenant, restoring normal access.
- **FR-024**: The admin MUST be able to permanently delete a tenant ONLY when the tenant has zero financial records (no charges, payments, invoices, billing events); otherwise the action is refused and suspension is recommended.
- **FR-025**: The tenant detail view MUST expose tabs for Profile, Usage (students, teachers, storage, MRR), Billing (real invoice history), and Danger (suspend / reactivate / delete).
- **FR-026**: The admin MUST be able to impersonate a tenant `admin` user for support purposes. Impersonation MUST: (a) be restricted to the tenant `admin` role — no impersonation of `teacher`, `bursar`, or any other tenant role; (b) issue a short-lived scoped JWT with a hard maximum lifetime of 30 minutes and no refresh; (c) display a persistent, non-dismissible banner in the tenant UI for the duration of the session identifying the acting platform admin; (d) record every action taken during the session in the audit stream as "by <platform admin> on behalf of <tenant admin>"; (e) be terminable immediately by the platform admin from the console.

**Subscriptions & plans**

- **FR-030**: The Plans grid MUST show each defined plan tier with name, price, billing cycle, feature list, and count of active subscribers, sourced from the platform's subscription catalog.
- **FR-031**: The admin MUST be able to create, edit, and retire plan tiers; retirement MUST be refused while any active subscriber is on that plan.
- **FR-032**: The Subscriptions table MUST list every active subscription across all tenants with plan, status, renewal date, and amount.
- **FR-033**: The admin MUST be able to change a tenant's plan and MUST see a proration preview (using the existing proration capability of the subscription engine) before confirming.
- **FR-034**: The admin MUST be able to cancel a tenant subscription, which transitions the subscription to a cancelled state with an effective end-date and emits a billing event.

**Finance**

- **FR-040**: The Finance page MUST show MRR, ARR (= MRR × 12), outstanding receivables (sum of unpaid invoices), monthly refunds, and count of failed or overdue invoices (unpaid invoices past their due date).
- **FR-041**: The Finance page MUST show a revenue-by-plan stacked monthly chart for the last 12 months.
- **FR-042**: The invoices list MUST show every invoice across all tenants with invoice id, tenant, amount, status, and date; it MUST support status and date-range filters and MUST offer CSV export of the filtered set.
- **FR-043**: Each invoice row MUST be downloadable as a PDF using the existing per-tenant invoice-download capability, scoped to the authenticated platform admin.
- **FR-044**: The Finance page MUST NOT display a Payouts panel in v1.

**Analytics**

- **FR-050**: The Analytics page MUST display 12-month growth series for number of schools, active users, and students.
- **FR-051**: The Analytics page MUST display a geographic distribution widget aggregating tenants and students by country/region.
- **FR-052**: The Analytics page MUST display a leaderboard of the top tenants by student count.

**Settings**

- **FR-060**: General settings (platform name, support email, default currency, default timezone, tagline) MUST be stored in the `platform_settings` table and MUST be persisted and applied globally.
- **FR-061**: Billing settings (tax rate, trial length, invoice prefix, provider status) MUST be stored in the `platform_settings` table and MUST be consumed by the invoicing flow.
- **FR-062**: Email templates listed in the Email tab MUST be stored in the `platform_settings` table; when saved, they MUST be used for all subsequent outbound emails dispatched by the platform.
- **FR-063**: The Team tab MUST support inviting a new platform staff member by email with role Owner, Admin, Finance, or Support; removing members; and enforcing role-based access inside the console according to the matrix defined in FR-066.
- **FR-066**: Console role permissions MUST be enforced both in the UI (hiding / disabling unauthorized actions) and on every platform endpoint (rejecting unauthorized requests with 403), per the following matrix:
    - **Owner** — Read all; full write on Tenants, Subscriptions/Plans, Finance, and all Settings tabs (General, Billing, Email, Security, API keys, Team, including role changes and member removal). Only Owner may delete tenants, change a member's role, or revoke/rotate API keys.
    - **Admin** — Read all; full write on Tenants (create/suspend/reactivate/impersonate but NOT permanent delete), Subscriptions/Plans, General/Email/Billing/Security/API-keys settings; may invite and remove Team members but may NOT change existing members' roles; read-only on Finance.
    - **Finance** — Read all; write on Finance (CSV export, invoice actions, refunds) and on Subscriptions/Plans (change plan, cancel subscription, edit plan price); read-only on Tenants, all non-billing Settings tabs, and Team.
    - **Support** — Read all; write on Tenants limited to Suspend, Reactivate, and Impersonate; read-only on Subscriptions/Plans, Finance, all Settings tabs, and Team.
    - Dashboard and Analytics are read-only for all roles.
- **FR-064**: Security toggles (enforce 2FA for platform admins, enforce SSO, auto-suspend tenants after N failed payments, weekly security digest) MUST be persisted and enforced by the platform.
- **FR-065**: API keys MUST be creatable by platform admins, MUST display the raw key value exactly once on creation, MUST be revocable, and MUST never be retrievable in raw form after creation (only a masked preview).

**Data freshness & integration**

- **FR-070**: All tables, charts, and KPIs MUST be powered by backend data via authenticated HTTP calls; no page in the shipped build may render mock/static data as its primary source.
- **FR-071**: Any platform-level aggregation not already exposed by the backend (cross-tenant tenant list, cross-tenant invoice list, cross-tenant MRR, cross-tenant activity feed, plan CRUD) MUST be added as new platform-scoped endpoints; these endpoints MUST enforce platform-admin authorization and MUST NOT be reachable by tenant-scoped JWTs.
- **FR-072**: The console MUST surface backend errors (4xx/5xx) as non-destructive toasts with a human-readable message and MUST NOT silently discard failed mutations.

### Key Entities

- **Platform Admin User**: A human operating the console, stored in the `platform_users` table. Attributes: name, email, password hash, platform role (Owner / Admin / Finance / Support), 2FA state, last-login. Distinct from tenant users in the `users` table.
- **Tenant (School)**: A SaaS customer. Attributes: name, admin email, plan, status (Active / Trial / Suspended / Cancelled), region, country, joined date, student count, teacher count, storage used, MRR contribution.
- **Plan Tier**: A sellable subscription tier. Attributes: name, price, billing cycle, feature list, active / retired, popular flag.
- **Subscription**: A tenant's live commitment to a plan. Attributes: tenant, plan, status, renewal date, amount, effective start/end.
- **Invoice**: A billed amount due from a tenant. Attributes: id, tenant, amount, status (Paid / Pending / Failed / Refunded), date, downloadable PDF.
- **Billing Event**: A platform-level event describing a change to a subscription/invoice (new signup, upgrade, downgrade, cancel, payment failed, payment succeeded, refund).
- **Platform Settings**: Global configuration stored in the `platform_settings` table (identity, billing, email templates, security toggles). Isolated from per-tenant settings.
- **Platform API Key**: A programmatic credential stored in a dedicated table. Attributes: label, created date, last-used, masked preview, revoked state.
- **Audit Entry**: A record of a platform-admin action. Attributes: actor, action, target (tenant / plan / subscription / setting / user), timestamp, result.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A platform admin can locate any tenant on the platform by name or admin email in under 5 seconds from the Schools page.
- **SC-002**: The Dashboard's primary KPIs (tenants, active subscriptions, MRR, students, churn) are within 1 refresh cycle of the authoritative value in the database at all times — i.e. no cached/stale numbers persist across a page reload.
- **SC-003**: 100% of operational actions currently performed against the production database via direct SQL or ad-hoc scripts (create tenant, suspend tenant, change plan, cancel subscription, edit plan price, invite platform staff) are available from the console, eliminating the need for direct DB access for routine operations.
- **SC-004**: Exporting a month of invoices as CSV from the Finance page completes in under 5 seconds for up to 10,000 invoices and produces a file whose row count and total amount match the on-screen totals exactly.
- **SC-005**: No page in the shipped build renders any piece of mock / hard-coded placeholder data as its primary content; a code audit finds zero imports from the `mock-data` module outside of test fixtures.
- **SC-006**: A non-platform user (school admin / bursar / teacher) who obtains a valid tenant JWT cannot reach any console endpoint — verified by an automated authorization test covering every platform route.
- **SC-007**: The console's console-critical pages (Dashboard, Schools, Subscriptions, Finance) render interactively in under 2 seconds on a mid-range laptop with the platform's production dataset.
- **SC-008**: Every platform-admin mutation is recorded in the audit entry stream with actor, action, target, and outcome; spot-checks of 20 randomly sampled actions show 100% coverage.

## Assumptions

- The console is a separate application (`admin-frontend`) from the tenant-facing `frontend`, served at a different URL, and is never exposed to end-users of a school.
- The existing backend (CodeIgniter 4, MySQL, JWT) continues to be the single source of truth; this feature extends it with platform-scoped endpoints rather than standing up a new service.
- Platform-admin accounts live in a dedicated `platform_users` table (not the tenant `users` table); authentication uses a separate platform login endpoint and issues JWTs with `scope: "platform"` and no `tenant_id`. Tenant `super_admin` is tenant-scoped and NOT equivalent to a platform admin.
- Subscription business logic (plan catalog, proration, invoices, billing events, Ecocash/Stripe payment flows) already lives in the backend and is reused without re-implementation.
- CSV exports and invoice PDFs are produced server-side (the browser only triggers and downloads them).
- Email delivery (onboarding, trial-ending, payment-failed, team invitations) uses the platform's existing mailer; only template content and triggers are configured by this feature.
- Mobile layouts are supported at a "usable" level (tablet-and-up is a first-class target; phone-sized layouts collapse but are not heavily optimised) for v1.
- Impersonation in v1 is limited to the tenant `admin` role, hard-capped at 30 minutes per session, banner-flagged in the tenant UI, and fully audit-logged.
- The token storage key used by the tenant frontend (`schoolledger_token`) is NOT shared with the console; the console uses its own key to avoid cross-app session confusion.
