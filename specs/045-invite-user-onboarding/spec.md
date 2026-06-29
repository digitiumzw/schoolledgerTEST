# Feature Specification: Invitation-Based User Onboarding

**Feature Branch**: `045-invite-user-onboarding`  
**Created**: 2026-04-27  
**Status**: Draft  
**Input**: User description: "Instead of having the tenant admin create a password for users, implement an invitation-based flow. The admin should only enter the user's name, email, and role, then click 'Invite.' The system should send an invite link to the user. When the user clicks the link, they should be prompted to set their password, and after setting it, be redirected to the login page to sign in. Additionally, ensure that each user can only reset their own password."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Admin Invites a New User (Priority: P1)

A tenant admin (or super admin) wants to add a new team member to their school account. Instead of creating a password on the user's behalf, the admin fills in only the new user's name, email address, and role, then clicks "Invite." The system creates the user account in a pending state and immediately sends an invitation email to the new user containing a secure, time-limited link.

**Why this priority**: This is the core change to the user creation flow. Without it, the invitation system cannot function at all. It directly eliminates the current pattern of admins setting passwords on behalf of users.

**Independent Test**: Can be tested end-to-end by submitting the invite form and verifying the user account appears in a pending/invited state and an email is dispatched.

**Acceptance Scenarios**:

1. **Given** the admin is signed in and on the Users page, **When** they enter a valid name, email, and role and click "Invite," **Then** the system creates the user account with no password set and a pending/invited status, and dispatches an invitation email to the entered address.
2. **Given** the admin submits the invite form, **When** the email address already belongs to an active user in the same tenant, **Then** the system rejects the request with a clear error message and does not send an email.
3. **Given** the admin submits the invite form, **When** the email field is empty or malformed, **Then** the form displays a validation error and does not submit.
4. **Given** the admin is a non-super-admin, **When** they attempt to invite a user with the `super_admin` role, **Then** the system rejects the request with an authorization error.
5. **Given** the tenant already has 5 active admin/bursar accounts, **When** the admin tries to invite another admin or bursar, **Then** the system rejects the request with an account limit error.

---

### User Story 2 - Invited User Sets Their Password (Priority: P1)

A newly invited user receives an invitation email containing a unique, time-limited link. Clicking the link takes them to a "Set Your Password" page. They enter and confirm their chosen password. After successful submission, their account is activated and they are redirected to the login page to sign in with their new credentials.

**Why this priority**: This completes the invitation loop. Without this, invited users can never access the system. It is equally critical to the admin invite story.

**Independent Test**: Can be tested in isolation by generating a valid invitation token directly, visiting the accept-invite URL, setting a password, and verifying the account becomes active with the new credentials.

**Acceptance Scenarios**:

1. **Given** a user has received an invitation email, **When** they click the invitation link, **Then** they are taken to a password setup page that recognises the token as valid.
2. **Given** a user is on the password setup page with a valid token, **When** they enter matching passwords of at least 8 characters and submit, **Then** their account is activated, the invitation token is consumed, and they are redirected to the login page.
3. **Given** a user attempts to use an invitation link that has expired (older than 48 hours), **Then** the page displays an "invitation expired" message with an option to contact their admin.
4. **Given** a user attempts to reuse an already-accepted invitation link, **Then** the page displays an "invitation already used" message and redirects to the login page.
5. **Given** a user enters a password shorter than 8 characters or enters mismatched confirmation, **Then** inline validation errors are shown and the form is not submitted.

---

### User Story 3 - User Resets Their Own Password (Priority: P2)

An existing active user forgets their password and navigates to the "Forgot Password" page. They enter their email address and the system sends them a password reset link. The user clicks the link, sets a new password, and is redirected to the login page. The system ensures that a user can only reset their own password; admins cannot trigger a password reset on behalf of another user through this flow.

**Why this priority**: This enforces the "each user can only reset their own password" requirement. The existing admin-driven reset endpoint (which returns a temporary password to the admin) must be replaced or restricted.

**Independent Test**: Can be tested by triggering a forgot-password request for a real user email, following the emailed link, setting a new password, and verifying login succeeds with the new password.

**Acceptance Scenarios**:

1. **Given** an active user requests a password reset for their own email, **When** they submit the forgot-password form, **Then** the system sends a reset link to that email.
2. **Given** an admin calls the reset-password endpoint with another user's ID, **Then** the system rejects the request with an authorization error — only a user resetting their own credentials is permitted through the self-service flow.
3. **Given** a user clicks a valid reset link and sets a new password, **Then** their old password no longer works and the new password grants login access.
4. **Given** a non-existent email is submitted to the forgot-password form, **Then** the system returns a generic success message to avoid email enumeration.

---

### User Story 4 - Admin Resends an Invitation (Priority: P3)

An admin notices that an invited user never accepted their invitation (e.g., the email was not received or the link expired). The admin can trigger a re-send of the invitation from the Users list, which invalidates the old token, issues a new one, and dispatches a fresh invitation email.

**Why this priority**: Operationally important but not blocking — the core invite flow works without it. It improves the admin experience for failure cases.

**Independent Test**: Can be tested by inviting a user, waiting for the token to expire, then resending and confirming the new link works while the old one is rejected.

**Acceptance Scenarios**:

1. **Given** a user has a pending/invited status, **When** an admin clicks "Resend Invitation," **Then** the old token is invalidated, a new token is issued, and a fresh email is sent.
2. **Given** the user has already accepted their invitation (status is active), **When** an admin attempts to resend, **Then** the system rejects the request with a clear error.

---

### Edge Cases

- What happens when the invited user's email address belongs to a user in a different tenant? Each email is scoped per tenant; duplicate emails across different tenants are permitted.
- What happens if an admin invites the same email address twice before the first invitation is accepted? The second invite invalidates the first token and issues a new one.
- How does the system handle invitation links opened on a different device or browser than where the email was received? The link must work on any device/browser — no session binding.
- What if the invitation email fails to send (e.g., SMTP error)? The user record is still created in pending state; the admin should be notified of the email failure and able to resend.
- What happens when an invitation token is tampered with? The token hash comparison will fail and the page must show an "invalid link" error.
- What if a user tries to access the application while their account is in pending/invited state (e.g., via direct URL)? They must be denied access until their account is activated.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow tenant admins and super admins to invite a new user by supplying only name, email address, and role — no password field shall be presented on the invite form.
- **FR-002**: System MUST create the invited user account in a `pending` (invited) status with no password set at the time of invitation.
- **FR-003**: System MUST generate a cryptographically secure, single-use invitation token and store a hashed version; the plain token is included only in the invitation email link.
- **FR-004**: System MUST send an invitation email to the invited user containing a unique, time-limited link to the password setup page.
- **FR-005**: Invitation tokens MUST expire after 48 hours from the time of issuance.
- **FR-006**: System MUST provide a password setup page accessible via the invitation link where the user can set their own password.
- **FR-007**: System MUST activate the user account and consume the invitation token upon successful password submission.
- **FR-008**: System MUST redirect the user to the login page immediately after their password is set.
- **FR-009**: System MUST reject attempts to use an expired or already-consumed invitation token and display a clear error message with guidance.
- **FR-010**: System MUST enforce that password reset through the self-service forgot-password flow is only possible for the account owner — no admin-driven password assignment to another user's account through this flow.
- **FR-011**: System MUST allow admins to resend an invitation to a user whose status is still pending/invited, invalidating the previous token.
- **FR-012**: System MUST reject invitations to email addresses already associated with an active user in the same tenant.
- **FR-013**: System MUST enforce existing role and account-limit rules (max 5 active admin/bursar accounts; non-super-admin cannot invite super_admin users) during the invite flow.
- **FR-014**: System MUST deny access to protected areas of the application for user accounts in pending/invited status.
- **FR-015**: System MUST log all invitation events (issued, accepted, expired, resent) in the audit trail.

### Key Entities

- **UserInvitation**: Represents a pending invitation. Key attributes: invited user's email, associated tenant, assigned role, invited user's name, hashed token, expiry timestamp, used/accepted timestamp, created timestamp. Links to the user account created at invitation time.
- **User** (extended): Gains an `invited` status value in addition to the existing `active` / `inactive` statuses, representing an account where the user has not yet set their password.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can complete the invite form (name, email, role) and trigger an invitation email in under 30 seconds from opening the invite dialog.
- **SC-002**: An invited user can click the link in their email, set a password, and reach the login page in under 2 minutes on a first attempt.
- **SC-003**: 100% of invitation tokens are single-use — no token can be accepted more than once.
- **SC-004**: 100% of invitation tokens expire and become non-functional after 48 hours from issuance.
- **SC-005**: Zero cases where an admin can set or view a password belonging to another user through any supported UI flow.
- **SC-006**: All invitation lifecycle events (issued, accepted, expired, resent) appear in the audit log within 5 seconds of occurrence.
- **SC-007**: Users with pending/invited status receive a clear denial when attempting to access protected application screens.

## Assumptions

- The existing `password_reset_tokens` table (with its `scope` and `used_at` columns added in feature 044) will be reused or a separate `user_invitations` table will be introduced; the planning phase will decide based on schema fit.
- Invitation emails are sent via the existing `EmailService`; a new email template for invitations will be created.
- The invitation link points to a frontend route (e.g., `/accept-invite?token=…`) that is publicly accessible without authentication.
- Token expiry of 48 hours is chosen to give invited users enough time to check their email across work days; this differs from the 30-minute window used for password reset tokens.
- The existing `UserController::resetPassword` endpoint (which returns a temporary password to the calling admin) will be restricted or removed as part of this feature to satisfy the "users can only reset their own password" requirement.
- Mobile support for the invitation acceptance page is required (responsive layout); the existing shadcn/ui component library satisfies this.
- The tenant account cap of 5 active admin/bursar accounts applies only to active accounts; pending/invited accounts count toward the cap to prevent cap circumvention via bulk invitations.
- Super admins (platform-wide) are out of scope for the invitation flow; they are provisioned through existing platform admin tooling.
