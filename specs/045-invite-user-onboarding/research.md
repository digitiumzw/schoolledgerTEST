# Research: Invitation-Based User Onboarding

**Feature**: `045-invite-user-onboarding`  
**Date**: 2026-04-27

---

## Decision 1: Separate `user_invitations` Table vs. Reusing `password_reset_tokens`

**Decision**: Introduce a dedicated `user_invitations` table.

**Rationale**: The spec assumption flagged this as an open question. The `password_reset_tokens` table has a different lifecycle (30-min expiry, `scope` column, no `tenant_id`, no `user_id` link). Reusing it would require adding `tenant_id`, `user_id`, `name`, and `role` columns — polluting the reset-token schema with invite-specific concerns. A dedicated table is cleaner, independently indexable, and allows invite-specific columns (`tenant_id`, `invited_user_id`, `role`, `name`) without bloating password-reset logic.

**Alternatives considered**:
- Reuse `password_reset_tokens` with a new `scope='invite'`: Rejected — the token table lacks `tenant_id` and `user_id`, which are required for invite-scoped queries. Adds 3-4 columns to a table designed for a different purpose.
- Store invitation state on the `users` row itself (add `invite_token_hash`, `invite_expires_at`): Rejected — mixes authentication lifecycle data into the core entity row; harder to clean up and audit.

---

## Decision 2: `users.status` Value for Invited-but-Not-Yet-Accepted Accounts

**Decision**: Add `'invited'` as a valid status value (alongside existing `'active'` and `'inactive'`).

**Rationale**: A pending account needs a distinguishable state so that: (a) the login flow can reject it explicitly rather than returning "invalid credentials", (b) the admin list can show an "Invited" badge, and (c) `ProtectedRoute` can deny access for invited users without relying on password absence. Altering the `users.status` ENUM to include `'invited'` requires a new migration but no structural change to existing queries (they filter on `status = 'active'`).

**Alternatives considered**:
- Use `status = 'inactive'` for pending accounts: Rejected — conflates two different states; admins can't distinguish a deactivated user from an uninvited one.
- Add a separate `is_invited TINYINT` column: Rejected — adds a boolean alongside an enum, creating redundant state; `status = 'invited'` is self-documenting.

---

## Decision 3: Token Generation and Storage

**Decision**: Use `bin2hex(random_bytes(32))` (256-bit entropy) for the plain token, stored as `hash('sha256', $plainToken)` in the database. Plain token transmitted only in the invitation email URL.

**Rationale**: Consistent with the existing `password_reset_tokens` approach (feature 044). SHA-256 of a 256-bit random token is collision-resistant and computationally infeasible to reverse. Storing only the hash means a database breach does not expose usable tokens.

**Alternatives considered**:
- JWT-based invitation token: Rejected — JWTs are verifiable without a database lookup but require a secret and can't be cleanly invalidated server-side without a blocklist. The hash-in-DB approach supports easy single-use consumption.
- ULID or UUID as token: Rejected — insufficient entropy for security-sensitive tokens.

---

## Decision 4: Token Expiry — 48 Hours

**Decision**: Invitation tokens expire 48 hours after issuance.

**Rationale**: Password-reset tokens use 30 minutes (high urgency, user-initiated). Invitations are initiated by an admin; the invited user may not check email immediately. 48 hours covers a full working day plus overnight, balancing security and usability. The spec mandated 48 hours.

**Alternatives considered**:
- 7 days: More convenient but increases window of exposure if the email is compromised.
- 24 hours: Reasonable, but can miss users in different time zones or busy schedules.

---

## Decision 5: InvitationService Extraction

**Decision**: Create `backend/app/Services/InvitationService.php` to house token generation, email dispatch, token validation, and acceptance logic.

**Rationale**: Constitution Principle VII (Code Quality) and the DRY principle. Both `UserController::invite()` and `UserController::resendInvite()` need to create/invalidate invitation tokens. Extracting to a service avoids duplication and keeps controllers thin. Mirrors the `SchoolProvisioningService` pattern already in the codebase.

**Alternatives considered**:
- Inline logic in `UserController`: Rejected — `resendInvite` would duplicate token creation and email dispatch code from `invite`.
- Static helper methods on `UserController`: Rejected — harder to test in isolation; violates single-responsibility.

---

## Decision 6: Removing `UserController::resetPassword` Admin Endpoint

**Decision**: Remove the existing `POST /api/users/{id}/reset-password` endpoint entirely (both backend route + controller method and frontend `api.ts` method + `ResetPasswordModal`).

**Rationale**: FR-010 mandates that password reset is self-service only. The existing endpoint returns a generated temporary password to the calling admin — a security anti-pattern that violates the user's password ownership. With feature 044 already providing self-service reset and this feature introducing invitation-based initial password setup, the admin endpoint is fully superseded.

**Alternatives considered**:
- Keep the endpoint but restrict it to `super_admin` only: Rejected — still violates the "each user can only reset their own password" requirement; the spec is explicit.
- Deprecate (log warning) but leave in place: Rejected — leaving a security-sensitive endpoint alive creates risk; clean removal is preferred.

---

## Decision 7: Login Block for `invited` Status

**Decision**: Modify `AuthController::login()` to return a `403` with a descriptive message (`"Your account is pending. Please accept your invitation email to set a password."`) when `users.status = 'invited'`.

**Rationale**: Currently login only checks `status = 'inactive'`. Adding an explicit check for `'invited'` prevents invited users from attempting (and failing) to log in, and gives a clear error rather than "invalid credentials". This also protects against edge cases where an admin accidentally reactivates a pending account.

**Alternatives considered**:
- Return `401 Invalid credentials` for invited accounts: Rejected — obscures a fixable user situation; gives the same error as wrong password, making it hard for the user to know what to do.
- Block at `JWTAuthFilter` based on a JWT claim: Rejected — invited users can never get a JWT because login is blocked; filtering is redundant.

---

## Decision 8: Pending Accounts Count Toward the 5-Account Cap

**Decision**: The per-tenant cap of 5 active admin/bursar accounts is enforced against `status IN ('active', 'invited')` accounts, not just `active`.

**Rationale**: Without this, an admin could send 10 pending invitations, bypassing the cap until acceptance. Counting `invited` accounts prevents cap circumvention via bulk invitations. When an invitation expires without acceptance, those counts are freed (or the admin can cancel/delete the pending user).

**Alternatives considered**:
- Only count `active` accounts toward the cap: Rejected — creates a loophole for bulk invitations.
- Cap invitations separately (e.g., max 5 pending at a time): Rejected — introduces two separate limits to manage; a single combined cap is simpler and equally protective.
