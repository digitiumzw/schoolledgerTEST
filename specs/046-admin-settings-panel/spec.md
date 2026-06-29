# Feature Specification: Admin Settings Panel

**Feature Branch**: `046-admin-settings-panel`  
**Created**: 2026-04-27  
**Status**: Draft  
**Input**: User description: "modify a Settings section in the Platform Admin panel that allows administrators to manage personal account details, user access, and additional system features. The Settings page should include: (1) Account Management — allow the admin to update their password, name, and email address. (2) User Management — provide functionality to invite new users to the platform, allow assigning different roles to users (e.g., admin, viewer), ensure roles control access so users can only see or interact with non-critical or permitted sections. (3) Access Control — implement role-based permissions to restrict visibility and actions based on user roles, clearly define what each role can view or modify. (4) Additional Recommended Features — security options (two-factor authentication, login history), audit logs to track user actions, account deactivation or removal for user management."

## Overview

This feature expands the **Settings section** of the Platform Admin Console (introduced in feature 040) into a fully detailed, operationally complete area. The Settings section is accessible only to authenticated platform-admin users and is organised into six tabs:

1. **Account** — personal profile of the signed-in platform admin (name, email, password).
2. **Team** — invite, assign roles to, deactivate, and remove other platform-admin users.
3. **Access Control** — view and understand the role-permission matrix that governs what each platform-admin role (Owner / Admin / Finance / Support) can see and do.
4. **Security** — two-factor authentication, login history, and platform-wide security toggles.
5. **Audit Logs** — searchable, filterable log of all platform-admin actions across the console.
6. **General / Billing / Email** — platform identity, billing parameters, and email templates (these tabs already exist per feature 040; this spec refines their interaction with role enforcement and audit logging).

The primary goal of this feature is to ensure that role restrictions are enforced **consistently and completely** across all six tabs, that a clear team-management lifecycle exists, and that a dedicated audit-log surface is available to the platform admin.

---

## Clarifications

### Session 2026-04-27

- Q: Should role changes invalidate the current JWT immediately (requiring re-login) or take effect only on the next issued token? → A: Immediate — backend re-fetches the platform admin's role and deactivation status from `platform_users` on every authenticated request; role and deactivation changes take effect within the same request cycle with no re-login required.
- Q: Should "viewer" from the feature request map to the existing Support role, or require a new fifth read-only role? → A: Support = Viewer — the four existing roles (Owner / Admin / Finance / Support) are sufficient; "viewer" in the request maps to Support and no new role is introduced.
- Q: What is the in-console recovery path when a platform admin loses their TOTP device and backup code? → A: Owner disables 2FA — an Owner can disable 2FA on any team member's account from Settings → Team (action is fully audit-logged); the affected admin re-enrols on their next login. No direct database access required.
- Q: What is the audit log retention policy? → A: 2-year active + archive — entries older than 2 years are moved to cold/archive storage; the active `platform_audit_log` table stays bounded and the console UI queries only the active table.
- Q: What happens to audit entries when a platform admin is permanently removed? → A: Retain + tombstone — audit entries are kept immutable; the actor's display name is replaced with `[Removed Admin]` while the email address is retained for traceability.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Platform Admin Updates Their Own Account Details (Priority: P1)

A signed-in platform admin navigates to **Settings → Account**. They can update their display name, email address, and password from a single page. Each update is saved independently (name/email in one form, password change in a separate form requiring the current password). After a successful email change the admin receives a confirmation notification; after a successful password change they remain logged in.

**Why this priority**: Account self-management is the most universally needed setting — every platform admin needs it regardless of role. It is also the entry point for verifying that Settings is wired to real backend data, making it the best P1 smoke test for the whole section.

**Independent Test**: Can be tested end-to-end by navigating to Settings → Account, changing the display name and saving, then reloading the page and confirming the new name persists.

**Acceptance Scenarios**:

1. **Given** a signed-in platform admin on the Account tab, **When** they change their display name and save, **Then** the updated name appears immediately in the page header and persists after reload.
2. **Given** a signed-in platform admin, **When** they submit a new email address that is already in use by another platform-admin account, **Then** the system rejects the change with a clear duplicate-email error.
3. **Given** a signed-in platform admin on the Account tab, **When** they submit a password change with an incorrect current password, **Then** the form shows an "incorrect current password" error and the password is not changed.
4. **Given** a signed-in platform admin, **When** they submit a new password that does not meet the minimum length requirement (8 characters), **Then** inline validation shows an error before the form is submitted.
5. **Given** a signed-in platform admin, **When** they successfully change their password, **Then** they remain logged in and receive a confirmation message; no forced re-login occurs.
6. **Given** a signed-in platform admin, **When** they save any profile change, **Then** the change is recorded as an audit entry attributed to that admin.

---

### User Story 2 - Owner Invites and Manages Platform Team Members (Priority: P1)

An **Owner** or **Admin** role platform admin opens **Settings → Team**. They see a table of all current platform-admin team members showing name, email, role, status (Active / Invited / Deactivated), and last login. They can invite a new member by entering a name, email, and role. Invited members receive an email with a secure, time-limited link to set their password. The Owner can change any member's role; the Admin can invite and remove members but cannot change existing roles.

**Why this priority**: The ability to bring team members onto the platform and control their access is the core purpose of the Settings → Team tab and directly enables the access-control model.

**Independent Test**: Can be tested by inviting a new platform-admin member (Finance role), accepting the invitation, logging in with that account, and verifying the Finance-level permissions are correctly enforced across the console.

**Acceptance Scenarios**:

1. **Given** an Owner or Admin on the Team tab, **When** they submit the invite form with a valid name, email, and role, **Then** a new platform-admin account is created in Invited status and an invitation email is dispatched.
2. **Given** an invite form submission, **When** the email is already associated with an active platform-admin account, **Then** the system rejects the invitation with a clear error.
3. **Given** an Owner on the Team tab, **When** they change an existing member's role, **Then** the new role is applied immediately and takes effect on the member's next API request (subsequent requests are validated against the new role).
4. **Given** an Admin on the Team tab, **When** they attempt to change an existing member's role, **Then** the role-change action is hidden in the UI and rejected by the backend with a 403 error.
5. **Given** an Owner or Admin, **When** they deactivate a team member, **Then** any active session for that member is invalidated on their next request and their status changes to Deactivated.
6. **Given** an Owner, **When** they permanently remove a team member, **Then** the member's account is deleted (or hard-deactivated) and they can no longer log in; the action is recorded in the audit log.
7. **Given** a Finance or Support role admin, **When** they navigate to Settings → Team, **Then** the tab is visible in read-only mode (they can see the member list) but all write actions (invite, change role, deactivate, remove) are hidden and rejected by the backend.

---

### User Story 3 - Admin Views the Role-Permission Matrix (Priority: P2)

Any authenticated platform-admin navigates to **Settings → Access Control**. This tab displays a clear, human-readable table showing what each role (Owner / Admin / Finance / Support) can view or modify across every section of the console (Dashboard, Schools, Subscriptions, Finance, Analytics, Settings tabs). The table is informational only — it cannot be edited here — but it reflects the live permission rules that are enforced by the backend.

**Why this priority**: Visibility into what each role can do prevents support requests and misconfiguration. It is a prerequisite for confidently assigning roles during team management.

**Independent Test**: Can be tested by navigating to Access Control and verifying the displayed matrix matches the documented role definitions; cross-check by logging in as a Finance-role user and confirming they cannot perform Owner-only actions.

**Acceptance Scenarios**:

1. **Given** any signed-in platform admin, **When** they open Settings → Access Control, **Then** a table shows all four roles as columns and all console sections as rows, with clear "Full", "Read-only", or "None" indicators for each cell.
2. **Given** the Access Control tab, **When** the page loads, **Then** no edit or save controls are visible — the matrix is strictly informational.
3. **Given** a Finance-role admin viewing the Access Control tab, **When** they attempt to access an Owner-only action via a direct API call, **Then** the backend returns a 403 and the tab's matrix accurately described this restriction.

---

### User Story 4 - Admin Manages Two-Factor Authentication and Views Login History (Priority: P2)

A platform admin navigates to **Settings → Security**. They can enrol in (or remove) two-factor authentication (TOTP-based) for their own account. They can also view a personal login history table listing the last N login events (date, time, IP address, device/browser, status: success or failed). An Owner-level admin additionally sees platform-wide security toggles: enforce 2FA for all platform admins, auto-suspend tenants after N failed payments, and enable a weekly security digest email.

**Why this priority**: 2FA and login history are standard baseline security expectations for an admin console handling multi-tenant financial data. They are independently deliverable without blocking other settings work.

**Independent Test**: Can be tested by enrolling in TOTP 2FA on a test account, logging out, and verifying the next login requires an OTP code; and by viewing the Security tab's login history table and confirming the most recent login events appear.

**Acceptance Scenarios**:

1. **Given** a platform admin on the Security tab who has not enrolled in 2FA, **When** they click "Enable Two-Factor Authentication," **Then** they are shown a QR code and a backup code; after confirming a valid TOTP code, 2FA is activated on their account.
2. **Given** a platform admin with 2FA enabled, **When** they log in, **Then** after entering valid credentials they are prompted for their TOTP code before gaining access.
3. **Given** a platform admin with 2FA enabled, **When** they disable 2FA, **Then** they must confirm with their current password before 2FA is removed.
4. **Given** any platform admin on the Security tab, **When** the login history section loads, **Then** it shows at least the last 20 login events (timestamp, IP address, browser/device, success or failure) for their own account.
5. **Given** an Owner on the Security tab, **When** they enable "Enforce 2FA for all platform admins," **Then** platform admins without 2FA enrolled are prompted to enrol on their next login before accessing any console page.
6. **Given** an Owner, **When** they save the "auto-suspend after N failed payments" setting, **Then** the value is persisted and the subscription enforcement engine uses it going forward.

---

### User Story 5 - Admin Browses and Filters the Audit Log (Priority: P2)

A platform admin navigates to **Settings → Audit Logs**. They see a chronological, paginated log of all platform-admin actions recorded across the console: who performed the action, what action was taken (create, update, delete, suspend, impersonate, login, etc.), which entity was affected (tenant, plan, subscription, team member, setting key), and when. They can filter by date range, acting admin, action type, and entity type, and they can export the filtered log as a CSV.

**Why this priority**: Audit logs are a compliance and security requirement — operators need to know what happened, who did it, and when, especially for a platform that manages financial data for multiple schools.

**Independent Test**: Can be tested by performing a known sequence of actions (e.g., suspend a tenant, change a plan price), then opening Audit Logs, filtering by those action types and the current admin, and confirming the entries appear with correct details.

**Acceptance Scenarios**:

1. **Given** a platform admin on the Audit Logs tab, **When** the page loads, **Then** a paginated table shows all recorded audit entries in reverse-chronological order with columns: timestamp, actor, action, entity type, entity identifier, outcome.
2. **Given** the Audit Logs tab, **When** the admin applies a date-range filter, **Then** only entries within that range are shown and the total entry count updates accordingly.
3. **Given** the Audit Logs tab, **When** the admin filters by actor (another team member's name or email), **Then** only entries attributed to that actor are shown.
4. **Given** the Audit Logs tab, **When** the admin filters by action type (e.g., "Suspend Tenant"), **Then** only entries of that type are shown.
5. **Given** the admin has applied filters, **When** they click "Export CSV," **Then** a CSV is downloaded containing exactly the filtered set of entries with all displayed columns.
6. **Given** a Finance or Support role admin, **When** they open the Audit Logs tab, **Then** the full audit log is visible in read-only mode (they cannot delete or modify entries).

---

### User Story 6 - Role-Based Access Is Consistently Enforced Across the Entire Console (Priority: P1)

After all settings are in place, the system must enforce the role-permission matrix uniformly: hidden UI elements for disallowed actions AND backend rejection of any direct API calls that bypass the UI. A Support-role admin navigating around the console sees no controls for actions outside their permitted set. A Finance-role admin can only modify Finance and Subscription/Plan data. An Owner retains full access. This story verifies holistic, end-to-end role enforcement.

**Why this priority**: Role enforcement is the security backbone of the multi-admin console. A gap here compromises the entire access-control model and represents a critical security defect.

**Independent Test**: Log in as each of the four roles in turn and attempt every restricted action both via UI navigation and via direct API calls. Verify that 100% of disallowed actions are blocked at the backend regardless of UI state.

**Acceptance Scenarios**:

1. **Given** a Support-role admin, **When** they attempt to create, edit, or retire a subscription plan, **Then** no such UI controls are visible and the corresponding API endpoint returns 403.
2. **Given** a Finance-role admin, **When** they attempt to suspend a tenant, **Then** the suspend control is absent from the UI and the suspend API endpoint returns 403.
3. **Given** an Admin-role admin, **When** they attempt a permanent tenant deletion, **Then** the delete option is hidden in the UI and the delete endpoint returns 403.
4. **Given** any non-Owner role, **When** they attempt to access the API-keys tab or call the create-API-key endpoint, **Then** the tab is either hidden or read-only and the create endpoint returns 403.
5. **Given** any role, **When** they access the Dashboard and Analytics pages, **Then** the data is visible but no write controls are shown or accessible.
6. **Given** a platform admin whose role has just been changed by an Owner, **When** they make the next API request, **Then** the request is evaluated against the new role sourced from the database — not the stale role encoded in their current JWT — and takes effect immediately without requiring re-login.

---

### Edge Cases

- What happens when the only Owner deactivates their own account? The system must refuse the action with an error — the platform must always have at least one active Owner.
- What happens when an admin's 2FA device is lost and they are locked out? The admin uses their backup recovery code. If the recovery code is also lost, an Owner disables 2FA on the locked-out account from Settings → Team (audit-logged); the admin re-enrols on their next login.
- What happens when an invite email fails to deliver (SMTP error)? The account is created in Invited status; the inviting admin is notified of the failure and can resend the invitation.
- What happens when a platform admin's session is still active at the moment their account is deactivated by another admin? Their current session remains valid until their next API request, at which point the backend rejects it with 401.
- What happens when a platform admin is permanently removed — do their historical audit entries disappear? No: entries are retained and the actor display name is replaced with `[Removed Admin]` while the email is kept for traceability.
- What happens when the Audit Log grows very large (e.g., millions of rows)? Pagination and server-side filtering must handle large datasets without UI freeze; the export must stream the CSV rather than buffer all rows in memory.
- What happens when two Owners change the same platform setting simultaneously? Last-write-wins is acceptable for v1; the conflict MUST be surfaced as a toast notification rather than silently discarded.
- What happens when a platform admin changes their own email address to one used by a pending (Invited) account? The system must treat the pending account's email as reserved and reject the change.
- What happens if the TOTP secret is shown to the user but they never confirm a valid code? 2FA enrollment must be treated as incomplete; the admin's account remains without 2FA until enrollment is fully confirmed.

---

## Requirements *(mandatory)*

### Functional Requirements

**Account Management**

- **FR-001**: System MUST allow any signed-in platform admin to update their own display name and email address via Settings → Account; changes MUST be validated (no empty name, valid email format, no duplicate email) before being persisted.
- **FR-002**: System MUST allow a signed-in platform admin to change their own password by providing their current password plus a new password that meets minimum strength requirements (at least 8 characters); the current password MUST be verified before the new one is stored.
- **FR-003**: System MUST record every account-detail change (name, email, password) as an audit entry attributed to the acting admin.
- **FR-004**: System MUST NOT allow a platform admin to view or modify another admin's password through any supported UI flow.

**Team Management**

- **FR-010**: The Team tab MUST display all platform-admin accounts for the platform in a table with columns: name, email, role, status (Active / Invited / Deactivated), and last-login timestamp.
- **FR-011**: Owners and Admins MUST be able to invite a new platform-admin by providing name, email, and role; the system MUST create the account in Invited status, generate a secure invitation token, and dispatch an invitation email with a time-limited accept link (expiry: 48 hours).
- **FR-012**: Only the Owner role MAY change an existing team member's role; all other roles MUST receive a 403 when attempting this action via the API.
- **FR-013**: Owners and Admins MUST be able to deactivate a platform-admin account; deactivation MUST invalidate any active sessions for that account on their next API request.
- **FR-014**: Only the Owner role MAY permanently remove a platform-admin account; the action MUST be gated behind a confirmation dialog and recorded in the audit log.
- **FR-015**: System MUST prevent the last active Owner from being deactivated or removed; the action must be refused with a clear error message.
- **FR-016**: Finance and Support roles MUST see the Team tab in read-only mode; all write actions (invite, change role, deactivate, remove) MUST be hidden in the UI and rejected by the backend with 403.
- **FR-017**: System MUST allow an Owner or Admin to resend an invitation to an account still in Invited status; resend MUST invalidate the previous token and issue a fresh one.

**Access Control**

- **FR-020**: Settings → Access Control MUST display a human-readable role-permission matrix covering all four platform-admin roles (Owner, Admin, Finance, Support) and all console sections (Dashboard, Schools, Subscriptions, Finance, Analytics, Settings — General, Billing, Email, Team, Security, API Keys, Audit Logs).
- **FR-021**: The Access Control tab MUST be informational only — no edit controls; the matrix content MUST be derived from the same permission rules enforced by the backend.
- **FR-022**: Backend MUST enforce role checks on every platform API endpoint by re-fetching the acting admin's role and status from `platform_users` on each authenticated request; the role encoded in the JWT MUST NOT be the sole source of truth. Role or deactivation changes MUST take effect within the same request cycle. The backend MUST return 403 for any request whose actor's current role lacks permission.
- **FR-023**: Frontend MUST hide or disable UI controls for actions the signed-in admin's role does not permit, in addition to the backend enforcement (defense in depth).

**Security**

- **FR-030**: System MUST allow any platform admin to enrol in TOTP-based two-factor authentication (2FA) from Settings → Security; enrollment MUST require displaying a QR code, a backup recovery code, and confirming a valid TOTP code before activation.
- **FR-031**: System MUST allow a platform admin to disable their own 2FA by re-confirming their current password; disabling MUST be audit-logged.
- **FR-031a**: Owner-only: System MUST allow an Owner to disable 2FA on any other platform-admin account from Settings → Team (e.g., to recover a locked-out admin who has lost both their TOTP device and backup code); the action MUST be gated behind a confirmation dialog and recorded in the audit log. The affected admin MUST be prompted to re-enrol in 2FA on their next login if the platform-wide enforcement toggle is active.
- **FR-032**: Settings → Security MUST display the signed-in admin's personal login history: at least the last 20 events with timestamp, IP address, browser/device, and outcome (success / failed).
- **FR-033**: Owner-only: System MUST provide a toggle to enforce 2FA for all platform-admin accounts; when enabled, any platform admin without 2FA enrolled MUST be redirected to the 2FA enrollment flow immediately after login, before accessing any console page.
- **FR-034**: Owner-only: System MUST allow setting the "auto-suspend tenant after N consecutive failed payments" threshold; this value MUST be persisted in `platform_settings` and consumed by the subscription enforcement engine.
- **FR-035**: Owner-only: System MUST allow enabling a weekly security digest email summarising logins, permission changes, and unusual access events.
- **FR-036**: Login history events (successful login, failed login attempt) MUST be recorded with timestamp, actor identity, IP address, and browser/device at the time of the authentication attempt.

**Audit Logs**

- **FR-040**: Every mutating action performed by any platform admin (create, update, delete, suspend, reactivate, impersonate, invite, role change, deactivate, setting change, API key action, login) MUST generate an audit entry with: actor identity, action type, affected entity type, affected entity identifier, timestamp, and outcome (success / failure with reason).
- **FR-041**: Settings → Audit Logs MUST present the full audit log in a paginated table (default page size: 50 rows) sorted in reverse-chronological order.
- **FR-042**: Audit Logs MUST support server-side filtering by: date range, actor (by name or email), action type, and entity type; all combinations MUST be stackable.
- **FR-043**: Any platform admin MUST be able to view the Audit Logs tab; no role may delete or modify existing audit entries.
- **FR-044**: System MUST allow the filtered audit log to be exported as a CSV containing all displayed columns; the export MUST be server-side-generated and streamed to the browser.
- **FR-045**: Audit entries MUST be immutable after creation — no endpoint may update or delete an audit record.
- **FR-046**: When a platform-admin account is permanently removed, the system MUST retain all audit entries previously attributed to that account. The actor display name in those entries MUST be replaced with `[Removed Admin]`; the actor email address MUST be preserved to maintain traceability. No audit entry may be deleted as a result of account removal.

**General, Billing, and Email tabs (role enforcement clarifications)**

- **FR-050**: General, Billing, and Email settings tabs (already specified in feature 040) MUST enforce write access for Owner and Admin roles only; Finance, Support read-only; all write attempts by disallowed roles MUST return 403.
- **FR-051**: Every save action on General, Billing, or Email tabs MUST produce an audit entry recording the setting key(s) changed, old value(s), and new value(s).

### Key Entities

- **PlatformAdmin**: A user of the Platform Admin Console, stored in `platform_users`. Attributes: name, email, hashed password, platform role (Owner / Admin / Finance / Support), status (Active / Invited / Deactivated), 2FA enrolled flag, 2FA secret (encrypted), last-login timestamp. Distinct from tenant `users`.
- **PlatformInvitation**: A pending invitation to join the console team. Attributes: invitee email, invitee name, assigned role, inviting admin, hashed invitation token, expiry timestamp, accepted timestamp. Linked to the `platform_users` record created at invitation time.
- **AuditEntry**: An immutable record of a platform-admin action. Attributes: actor (platform admin identity), action type, entity type, entity identifier, timestamp, outcome (success / failure), additional context (e.g., old value → new value for setting changes).
- **LoginHistoryEntry**: A record of a single login attempt. Attributes: actor identity, timestamp, IP address, browser/device string, outcome (success / failed), failure reason if applicable.
- **PlatformSettings**: Global key-value configuration stored in `platform_settings`. Relevant keys for this feature: `enforce_2fa`, `auto_suspend_failed_payment_threshold`, `weekly_security_digest_enabled`, plus General/Billing/Email keys already defined in feature 040.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A platform admin can update their display name, email, or password and have the change take effect and persist in under 30 seconds from opening the Account tab.
- **SC-002**: An Owner can invite a new team member, assign a role, and have the invitation email dispatched in under 60 seconds from opening the invite dialog.
- **SC-003**: 100% of role-permission rules are enforced at the API layer — verified by an automated test suite that exercises every platform endpoint with each of the four roles and confirms correct 403 responses for all unauthorized combinations.
- **SC-004**: 100% of mutating platform-admin actions produce a corresponding audit entry within 5 seconds; a spot-check of 20 randomly sampled actions shows zero omissions.
- **SC-005**: A platform admin can enrol in 2FA in under 3 minutes from clicking "Enable Two-Factor Authentication."
- **SC-006**: The Audit Logs tab loads the first page of results in under 2 seconds for a log containing up to 100,000 entries; server-side pagination ensures no full-table scan on the client.
- **SC-007**: CSV export of a filtered audit log of up to 10,000 rows completes in under 10 seconds and the exported row count matches the on-screen total exactly.
- **SC-008**: Deactivating a platform-admin account results in their next API request being rejected with 401 within the same request cycle — no grace window beyond the current in-flight request.
- **SC-009**: The system prevents the last active Owner from being deactivated or removed in 100% of attempts — verified by automated test.
- **SC-010**: The Access Control tab renders the complete role-permission matrix without any placeholder or mock data on first load.
- **SC-011**: Audit log entries older than 2 years are moved to archive storage and no longer appear in the active console UI; entries within the 2-year window remain fully queryable and exportable.

---

## Assumptions

- The Platform Admin Console (`admin-frontend`) and its authentication system (`platform_users` table, platform-scoped JWT) are already in place per feature 040; this feature extends the Settings section of that console rather than building a new application.
- The invitation flow for platform team members reuses the same token-generation and email-dispatch mechanics established in feature 045 (Invitation-Based User Onboarding), but targets the `platform_users` table and platform-admin email templates instead of the tenant `users` table.
- TOTP-based 2FA is chosen as the 2FA method; SMS-based 2FA is out of scope for v1. A well-tested TOTP library already available to the backend stack will be used.
- Login history is collected at the platform authentication endpoint; events for the last 90 days are retained and older events may be archived or purged per a future data-retention policy.
- Audit log entries are append-only and stored in a dedicated `platform_audit_log` table; no soft-delete mechanism is required since entries are immutable. Entries older than 2 years are moved to cold/archive storage; the console UI queries only the active table. The archival process is a background operation and does not affect entry immutability.
- Role changes take effect immediately: the backend re-fetches each platform admin's role and deactivation status from `platform_users` on every authenticated request. The JWT is used only for identity verification (signature + expiry); role and status are always sourced from the database.
- The Access Control tab's role-permission matrix is statically derived from the backend's permission rules; it is not a dynamically configurable policy (no custom role editor in v1).
- All Settings tabs described in feature 040 (General, Billing, Email, API Keys) are in scope for role-enforcement and audit-logging as part of this feature.
- "Viewer" mentioned in the feature request is confirmed as the **Support** role. No fifth role will be introduced; the platform admin role set is fixed at four: Owner, Admin, Finance, Support.
