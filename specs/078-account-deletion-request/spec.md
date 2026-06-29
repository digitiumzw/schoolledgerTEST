# Feature Specification: Account Deletion Request

**Feature Branch**: `078-account-deletion-request`  
**Created**: 2026-05-19  
**Status**: Draft  
**Input**: User description: "In the Settings page, add an Account Deletion Request feature that allows a tenant to request deletion of their account. When a tenant requests account deletion, the system should: Mark the account as 'Pending Deletion'. Start a 7-day grace period during which the tenant can undo the deletion request. Show an option in Settings → Account to 'Undo Account Deletion'. During the 7-day grace period: The system should send reminder emails to the tenant every 3 days informing them that: Their account is scheduled for deletion in X remaining days. They can undo the deletion by going to Settings → Account and clicking 'Undo'. If the tenant clicks 'Undo', the deletion request should be canceled immediately and the account restored to normal status. After the 7th day: The tenant account and all associated tenant data must be permanently deleted from the database entirely. The deletion process must only be executable by the Super Admin. Add a custom PHP Spark command that can be run manually or via cron job to: Check for tenants with pending deletion requests. Send reminder emails when required. Permanently delete tenant accounts whose 7-day grace period has expired. Ensure the deletion process removes all tenant-related data completely from the system database."

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Request Account Deletion (Priority: P1)

As a tenant admin, I want to request deletion of my account so that I can permanently close my SchoolLedger subscription and remove all my data from the system.

**Why this priority**: This is the core functionality of the feature. Without the ability to request deletion, no other parts of the feature can function. This addresses user privacy rights and regulatory compliance requirements (GDPR, data retention policies).

**Independent Test**: Can be tested by a tenant admin navigating to Settings → Account and clicking "Request Account Deletion", which immediately marks the account as "Pending Deletion" and initiates the 7-day grace period.

**Acceptance Scenarios**:

1. **Given** a tenant admin is logged in and viewing Settings → Account, **When** they click "Request Account Deletion" and confirm the action, **Then** the tenant account status changes to "Pending Deletion", a deletion request timestamp is recorded, and the UI shows the grace period countdown with remaining days.
2. **Given** a tenant admin has requested deletion, **When** they view the Account settings page during the grace period, **Then** they see a prominent warning banner stating the account is scheduled for deletion with remaining days displayed and an "Undo Account Deletion" button is available.

---

### User Story 2 - Undo Deletion Request (Priority: P1)

As a tenant admin who has requested account deletion, I want to be able to cancel the deletion request during the grace period so that I can continue using SchoolLedger if I change my mind.

**Why this priority**: This is essential to prevent accidental deletions and provides a safety net for users. It's required for good user experience and reduces support burden from accidental deletion requests.

**Independent Test**: Can be tested by clicking "Undo Account Deletion" on the Settings → Account page during the grace period, which immediately restores the account to normal status.

**Acceptance Scenarios**:

1. **Given** a tenant has a pending deletion request with 5 days remaining, **When** the admin clicks "Undo Account Deletion" and confirms, **Then** the account status reverts to "Active", the deletion request is canceled, the UI returns to normal account settings, and all system functionality is immediately restored.
2. **Given** a tenant attempts to undo deletion after the 7-day grace period has expired, **When** they access the Account settings, **Then** the undo option is not available and the account shows as inaccessible or already deleted.

---

### User Story 3 - Automated Deletion Processing (Priority: P1)

As a Super Admin, I want the system to automatically process expired deletion requests so that tenant data is permanently removed after the grace period without manual intervention.

**Why this priority**: This is critical for data privacy compliance and ensures that data is actually deleted as promised. Without automated processing, data could remain indefinitely, violating user trust and regulatory requirements.

**Independent Test**: Can be tested by running the PHP Spark command `php spark tenants:process-deletion` which identifies expired requests, sends final notifications, and permanently deletes tenant data.

**Acceptance Scenarios**:

1. **Given** a tenant has a pending deletion request that was submitted 7 days ago, **When** the Super Admin runs the deletion processing command, **Then** all tenant data (users, students, classes, payments, attendance, settings) is permanently removed from the database and the tenant record is deleted.
2. **Given** multiple tenants have pending deletion requests at various stages, **When** the command runs, **Then** only tenants whose grace period has expired are fully deleted, while others remain in "Pending Deletion" status.

---

### User Story 4 - Deletion Reminder Emails (Priority: P2)

As a tenant admin with a pending deletion request, I want to receive periodic reminder emails during the grace period so that I am aware of the impending deletion and have opportunities to undo the request.

**Why this priority**: This improves user experience by providing clear communication about account status and helps prevent unintended data loss. It also demonstrates system transparency.

**Independent Test**: Can be tested by running the PHP Spark command which checks for tenants needing reminders and sends emails at 3-day intervals (Day 4 and Day 7, or Day 3 and Day 6 depending on implementation).

**Acceptance Scenarios**:

1. **Given** a tenant requested deletion 3 days ago, **When** the reminder processing command runs, **Then** an email is sent to the tenant admin with subject "Account Deletion Reminder - 4 Days Remaining" containing the deletion date and instructions to undo the request.
2. **Given** a tenant requested deletion 6 days ago (1 day remaining), **When** the reminder command runs, **Then** a final warning email is sent with subject "FINAL REMINDER: Account Deletion Tomorrow" with urgent messaging and undo instructions.

### Edge Cases

- **What happens when a tenant requests deletion while having active student enrollments?** The system allows the request but continues normal operation during the grace period; all data is deleted after grace period expires.
- **How does the system handle a tenant trying to undo deletion on day 7 after the cron job has already started?** The undo action should verify the account still exists before attempting restoration; if deletion has begun, return an error state.
- **What happens if the deletion processing command fails mid-deletion?** The command should be idempotent or use transactions where possible; partial deletions should be logged and flagged for manual review.
- **How does the system prevent non-Super Admin users from triggering permanent deletion?** The Spark command checks for Super Admin role before executing; API endpoints for deletion processing require Super Admin authentication.
- **What happens if a tenant makes a payment during the grace period?** Payment processing should continue normally; the grace period is unaffected by continued account usage.
- **How are linked records (payments, attendance, etc.) handled during deletion?** All child records with tenant_id foreign keys should be cascade-deleted or removed via explicit queries before the parent tenant record is deleted.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow tenant admins to submit an account deletion request from Settings → Account page.
- **FR-002**: System MUST mark the tenant account as "Pending Deletion" status when a deletion request is submitted.
- **FR-003**: System MUST record the deletion request timestamp to track the 7-day grace period.
- **FR-004**: System MUST calculate and display the remaining days of the grace period in the UI.
- **FR-005**: System MUST provide an "Undo Account Deletion" button during the grace period.
- **FR-006**: System MUST immediately restore the account to "Active" status when undo is requested.
- **FR-007**: System MUST clear the deletion request timestamp when the deletion is undone.
- **FR-008**: System MUST send reminder emails at 3-day intervals (Day 4 and Day 7, or Day 3 and Day 6) during the grace period.
- **FR-009**: Reminder emails MUST include the remaining days until deletion and instructions to undo the request.
- **FR-010**: System MUST only allow Super Admin role to execute permanent tenant data deletion.
- **FR-011**: System MUST provide a PHP Spark command `tenants:process-deletion` to process expired deletion requests.
- **FR-012**: The deletion command MUST identify all tenants with deletion requests older than 7 days.
- **FR-013**: The deletion command MUST send final notification emails before permanent deletion.
- **FR-014**: The deletion command MUST permanently delete all tenant-related data including: tenant record, all tenant users, students, enrollments, classes, payments, charges, attendance records, transport assignments, fee campaigns, settings, and all other tenant-scoped entities.
- **FR-015**: The deletion command MUST maintain an audit log of deleted tenants including tenant_id, deletion_date, and requesting_admin_email.
- **FR-016**: Backend APIs MUST return view-ready data for Settings → Account page including tenant status, deletion request timestamp, and remaining days calculation.
- **FR-017**: Frontend behavior MUST be limited to passing user action parameters and rendering backend-prepared responses.
- **FR-018**: Every mutation (request deletion, undo deletion) MUST display a visible loading indicator until the response is received and UI reflects confirmed server state.
- **FR-019**: After any mutation completes, affected React Query caches MUST be invalidated to reflect latest server state.

### Key Entities *(include if feature involves data)*

- **Tenant**: Represents a school/organization account. Key attributes include status (active, pending_deletion, deleted), deletion_requested_at timestamp, and identifying information.
- **DeletionAuditLog**: Records all deletion requests and completions for compliance. Key attributes include tenant_id, requested_by_email, requested_at, completed_at, and status.
- **TenantUser**: Admin users belonging to a tenant. Must be cascade-deleted when the tenant is permanently removed.
- **Student**: Student records belonging to a tenant. Includes academic and personal data that must be purged.
- **All Tenant-Scoped Entities**: Classes, Enrollments, Payments, Charges, Attendance, TransportRoutes, FeeCampaigns, Settings - all must be identified and removed during tenant deletion.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Tenant admin can request account deletion in under 30 seconds from the Settings → Account page.
- **SC-002**: Undo deletion action restores account access immediately (under 2 seconds response time).
- **SC-003**: Reminder emails are sent exactly at 3-day intervals (Day 4 and Day 7 of grace period).
- **SC-004**: 100% of tenant data is removed from the database after grace period expiration (verified via data audit queries).
- **SC-005**: Zero non-deleted tenant data remains 24 hours after grace period expiration (accounting for cron job execution windows).
- **SC-006**: The deletion processing command completes within 60 seconds for a tenant with 10,000 student records.

## Assumptions

- Tenant admin must have valid email configured to receive reminder emails.
- The PHP Spark command will be scheduled via cron job to run daily at a low-traffic time (e.g., 3 AM).
- Email service is already configured and operational in the existing system.
- Super Admin role is pre-existing and has the highest level of system access.
- "Permanent deletion" means data is removed from the primary database; backups may retain data based on separate backup retention policies.
- The 7-day grace period is fixed and not configurable per tenant in v1.
- Reminder emails are sent on days 4 and 7 (after 3 days and 6 days respectively), or days 3 and 6 depending on interval calculation preference.
- All tenant-scoped tables have a tenant_id foreign key for identification during deletion.
- Cascade delete constraints or explicit deletion queries will be used to remove related records.
