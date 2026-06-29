# Feature Specification: Fix Recent Activity Scope Isolation

**Feature Branch**: `082-fix-recent-activity-scope`  
**Created**: 2026-05-22  
**Status**: Draft  

## Background

The platform has two distinct dashboard surfaces:

1. **Control Panel Dashboard** — used exclusively by platform administrators to monitor
   platform-wide health (subscriptions, tenants, revenue). Recent Activity here must only
   show platform-level administrative actions such as tenant provisioning, subscription
   changes, plan management, and platform admin logins.

2. **Tenant Dashboard** — used by school administrators, bursars, and teachers within a
   single school tenant. Recent Activity here must only show events that belong to that
   specific tenant and must never expose data from other tenants or from the control panel.

Currently, the two dashboards share an activity endpoint that produces mismatched or
incorrectly scoped results. Specifically:
- The **platform dashboard** `activity` endpoint reads from `platform_audit` without
  restricting to purely platform-scoped action types, meaning subscription payment events
  (e.g. `payment.failed`, `payment.success`) that are contextually tenant-level can
  surface in the platform feed.
- The **tenant dashboard** `activity` endpoint only returns the 5 most recent payment
  records for that tenant. It does not include other meaningful tenant-level events such as
  student enrolments, status changes, or staff leave approvals, leaving the feed sparse and
  not representative of actual school activity. Additionally, there is no validation that
  guards against leaking data between tenants should the tenant context be absent or
  spoofed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Platform Admin Sees Only Platform Activity (Priority: P1)

A platform administrator opens the Control Panel Dashboard and views the Recent Activity
section. Every event shown must relate exclusively to platform-level operations: tenant
provisioning, subscription assignments or cancellations, plan management, and platform
admin logins or impersonation events. School-level student payments, enrolments, or
attendance records must never appear in this feed.

**Why this priority**: Security and trust — platform admins must not see operational data
that belongs to a school's private records. This is the primary constraint driving the bug
fix.

**Independent Test**: Can be fully tested by querying the platform activity endpoint as a
platform admin and confirming every returned event has a `platform.*` action prefix.

**Acceptance Scenarios**:

1. **Given** platform audit records that include both `platform.tenant.provision` and
   `payment.success` entries, **When** a platform admin loads the Control Panel Dashboard
   Recent Activity section, **Then** only `platform.*`-prefixed entries are returned and
   `payment.success` is absent.

2. **Given** a tenant has recent student payment records, **When** a platform admin loads
   the Recent Activity section, **Then** no tenant payment records appear in the feed.

3. **Given** a platform admin performs an impersonation action, **When** the activity feed
   is refreshed, **Then** the `platform.impersonate` event appears in the feed.

---

### User Story 2 — Tenant User Sees Only Their Own Tenant's Activity (Priority: P1)

A school administrator or bursar opens their Tenant Dashboard and views the Recent Activity
section. Every event shown must belong exclusively to their school. Activity from other
tenants or from the platform control panel must never appear. The feed should include a
meaningful cross-section of recent school activity — not only payments.

**Why this priority**: Data isolation is a non-negotiable requirement (Constitution
Principle I). A tenant must never see another tenant's data or platform administrative
records.

**Independent Test**: Can be fully tested by loading the tenant dashboard as two different
tenant users and confirming neither can see the other's activity entries.

**Acceptance Scenarios**:

1. **Given** a tenant with recent payment and enrolment events, **When** the tenant admin
   loads the Dashboard Recent Activity section, **Then** all returned activities belong to
   that tenant only.

2. **Given** two tenants each with recent activity, **When** each tenant admin views their
   dashboard, **Then** neither sees activity records belonging to the other tenant.

3. **Given** platform audit records exist, **When** a tenant admin views the Recent
   Activity section, **Then** no platform-level audit events appear in the feed.

4. **Given** a tenant has recent payments, enrolments, and leave approvals, **When** the
   tenant admin views Recent Activity, **Then** the feed includes a mix of these event
   types (not payments only), each clearly labelled by type.

---

### User Story 3 — Empty States Are Handled Gracefully (Priority: P2)

When a dashboard has no qualifying recent activity (new tenant, no data yet), the Recent
Activity section displays a clear, friendly empty state rather than an error or blank space.

**Why this priority**: User experience concern that prevents confusion on first use.

**Independent Test**: Can be tested by loading the dashboard on a newly provisioned tenant
with no payments or events.

**Acceptance Scenarios**:

1. **Given** a tenant with no activity records, **When** the tenant admin views Recent
   Activity, **Then** a friendly "No recent activity" message is displayed.

2. **Given** the platform has no audit records yet, **When** a platform admin views Recent
   Activity, **Then** a friendly "No activity recorded yet" message is displayed.

---

### Edge Cases

- What if the platform audit table contains entries without a `platform.` action prefix
  due to legacy or misconfigured logging? These entries should be excluded from the
  platform dashboard activity feed.
- What if a tenant has zero activity records? The endpoint must return an empty list with
  HTTP 200, not an error.
- What if the authenticated user's tenant context is missing or invalid on the tenant
  activity endpoint? The request must be rejected with HTTP 401.
- What if a burst of events occurs simultaneously? The feed returns the most recent `N`
  events (configurable, default 10), ordered by newest first, without duplicates.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The platform dashboard Recent Activity endpoint MUST only return events with
  a `platform.` action prefix sourced from the platform audit log. No tenant-level
  operational data (payments, enrolments, attendance, leave) may appear.

- **FR-002**: The tenant dashboard Recent Activity endpoint MUST return events scoped
  strictly to the authenticated user's tenant. It MUST NOT return records belonging to any
  other tenant or to the platform audit log.

- **FR-003**: The tenant dashboard Recent Activity feed MUST include a meaningful variety
  of recent school-level events — at minimum: payments received, student enrolments/status
  changes, and staff leave approvals. The feed MUST NOT be limited to payments only.

- **FR-004**: The tenant dashboard activity endpoint MUST enforce tenant isolation using
  the authenticated JWT's tenant context. Requests without a valid tenant context MUST be
  rejected with HTTP 401.

- **FR-005**: Each activity item returned by either endpoint MUST include: a unique
  identifier, an event type or action label, a human-readable description, an actor or
  system label, and an ISO 8601 timestamp.

- **FR-006**: Backend APIs MUST return view-ready data for all feature screens, including
  any filtering, aggregations, and computed values required by the frontend.

- **FR-007**: Frontend behavior MUST be limited to passing user-selected query parameters
  and rendering backend-prepared responses; it MUST NOT perform client-side data filtering,
  searching, sorting, pagination, aggregations, or business computations.

- **FR-008**: Every user action that triggers a data change (create, update, delete,
  submit, refresh, bulk-operation, status-change) MUST display a visible loading indicator
  from the moment the request is initiated until the response is fully received and the UI
  reflects the confirmed server state. Action-triggering controls MUST be disabled during
  in-flight requests to prevent duplicate submissions.

- **FR-009**: After any mutation completes, all React Query queries whose data was affected
  MUST be invalidated or updated so the next render reflects the latest server state. Stale
  cached values MUST NOT flash or re-appear after the mutation response is processed.

### Key Entities

- **Platform Audit Log**: Records of platform-level administrative actions. Identified by
  `action` values prefixed with `platform.`. Actors are platform users. Contains no
  tenant-specific operational data.

- **Tenant Activity Feed**: A synthesised view of the most recent cross-entity events
  within a single school tenant. Sourced from multiple tenant-scoped tables (payments,
  student status history, enrolment records, leave requests) and always filtered by
  tenant ID from the authenticated session.

- **Activity Item**: A normalised representation of a single event returned by either
  activity endpoint. Contains: id, action/type, description, actor label, timestamp, and
  optional metadata (amount, target name).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A platform admin loading the Control Panel Dashboard Recent Activity section
  receives zero tenant-level payment, enrolment, or attendance events in the response.

- **SC-002**: A tenant user loading their Dashboard Recent Activity section receives zero
  records belonging to another tenant or to the platform audit log.

- **SC-003**: The tenant Recent Activity feed includes events from at least two distinct
  event types (not payments only) when the tenant has data across multiple domains.

- **SC-004**: Both activity endpoints return HTTP 401 when called without a valid
  authenticated session.

- **SC-005**: Both activity endpoints return results within 500 ms under normal data
  volumes (fewer than 100,000 records per tenant).

- **SC-006**: Both activity feeds display a meaningful empty state when no qualifying
  events exist, with no error state shown to the user.

## Assumptions

- The platform audit log (`platform_audit`) is exclusively written to by platform
  controllers and services — it does not receive entries from tenant API controllers.
  This is confirmed by codebase analysis (only `AuditService` writes there, called only
  from `Platform\*` controllers).

- The tenant dashboard activity feed does not require persistence in a dedicated activity
  log table for v1 of this fix; it can be synthesised by querying existing tenant-scoped
  tables (payments, student_status_history, leave_requests) via a UNION or multi-source
  aggregation in the backend.

- No new database migrations are required for this fix; all required data already exists
  in tenant-scoped tables.

- The tenant activity feed limit defaults to 10 events (configurable via query parameter),
  matching the platform activity feed limit.

- The existing JWT authentication and tenant isolation middleware are assumed to be
  functioning correctly and will be reused without modification.

- "Tenant-specific activities" in the tenant feed scope means events in that tenant's own
  operational data: payments, student status changes, enrolments, and staff leave
  approvals. Academic calendar changes and settings updates are out of scope for v1 of
  this fix.
