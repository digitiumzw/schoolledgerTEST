# Research: Admin Settings Panel

**Branch**: `046-admin-settings-panel` | **Date**: 2026-04-27

---

## 1. Immediate Role-Enforcement via DB Re-Fetch

**Decision**: Extend `PlatformJWTAuthFilter` to re-fetch the platform user's `platform_role` and `status` from `platform_users` on every authenticated request. The JWT continues to be validated for signature and expiry; however, `platform_role` and `status` are sourced exclusively from the live DB record and written onto `$request->platformUser` before any controller is reached.

**Rationale**: Prevents a window where a deactivated or role-changed admin can continue to act with stale claims. This is the correct security posture for a console managing multi-tenant financial data. The overhead of a single indexed primary-key lookup (`WHERE id = ?`) per request is negligible at the scale of a platform-admin console (< 50 users, < 100 concurrent requests).

**Implementation detail**: After JWT signature validation succeeds, perform:
```php
$liveUser = (new PlatformUser())->find($tokenData->id);
if (!$liveUser || $liveUser['status'] === 'Deactivated') {
    return $this->unauthorised('Your account has been deactivated.');
}
$tokenData->platform_role = $liveUser['platform_role'];
$tokenData->status        = $liveUser['status'];
$request->platformUser    = $tokenData;
```

**Alternatives considered**:
- JWT blacklist: requires a cache/DB store keyed by `jti`; more complex with no benefit for this use case.
- Short-lived JWTs (< 5 min) with refresh: adds client complexity; still has a small stale window.

---

## 2. `platform_users` — Status Field & Deactivation

**Decision**: Add a `status` ENUM column (`Active`, `Invited`, `Deactivated`) to `platform_users` via a new migration (`2026-04-27-400000`). Default = `Active` for existing rows.

**Rationale**: Currently `platform_users` has no status concept. Deactivation requires a non-destructive status change (not hard delete) so that the user can be reactivated if needed, and so that their audit entries can still display a resolved actor name.

**"Last Owner" guard**: `SettingsController::deactivateTeamMember` must check `SELECT COUNT(*) FROM platform_users WHERE platform_role = 'Owner' AND status = 'Active'` before deactivating an Owner. If the count would drop to zero, return 409.

---

## 3. TOTP 2FA — Enrolment Flow

**Decision**: Reuse the inline TOTP implementation already in `AuthController` (`verifyTotp` + `base32Decode`). No external TOTP library is needed.

**Enrolment sequence**:
1. `POST /api/platform/auth/2fa/setup` — generates a Base32 TOTP secret, returns it as a `otpauth://` URI (for QR display) plus a one-time backup recovery code (stored hashed). Does NOT yet enable 2FA on the account.
2. `POST /api/platform/auth/2fa/confirm` — verifies the submitted TOTP code against the generated secret. On success, sets `two_factor_secret = <secret>`, `two_factor_enabled = true`, stores the hashed backup code. Emits audit entry.
3. `DELETE /api/platform/auth/2fa` — verifies current password, then sets `two_factor_secret = null`, `two_factor_enabled = false`. Emits audit entry.

**Owner-disable-2FA for another admin** (recovery flow):
- `DELETE /api/platform/team/{id}/2fa` — Owner-only. Clears 2FA for the target account. Gated by confirmation dialog on frontend. Emits audit entry with both actor and target.

**Backup recovery code**: Generate a 10-word or 20-character alphanumeric code. Store `sha256(code)` in a new `two_factor_recovery_hash` column on `platform_users`. On use: verify hash, clear 2FA and recovery hash, prompt re-enrolment.

---

## 4. Login History

**Decision**: Create a new `platform_login_history` table (`2026-04-27-400001`) to record every login attempt (success or failure) at the `AuthController::login` endpoint, capturing: `platform_user_id` (nullable, for failed attempts where the user exists), `email_attempted`, `ip_address`, `user_agent`, `outcome` (`success` | `failed`), `failure_reason` (nullable), `created_at`.

**Retention**: Retain for 90 days (same as `platform_users` login history assumption). A scheduled command or cron job purges rows older than 90 days. For v1, manual purge via `php spark` command is acceptable.

**Frontend display**: `GET /api/platform/auth/login-history` returns the last 20 entries for the authenticated admin's own account only.

---

## 5. Audit Log — Actor Snapshot + Tombstone

**Decision**: Add `actor_name` (VARCHAR 255, nullable) and `actor_email` (VARCHAR 255, nullable) snapshot columns to `platform_audit` via migration `2026-04-27-400002`. These are populated at write time from the live `platform_users` record. The existing `actor_user_id` FK is `ON DELETE SET NULL` (already in the migration), so removing a user sets `actor_user_id = NULL`. The `actor_name` snapshot is then updated to `[Removed Admin]` and `actor_email` is preserved.

**Tombstone implementation**: In `SettingsController::removeTeamMember`, after deletion:
```php
$db->table('platform_audit')
   ->where('actor_user_id', $id)  // id before deletion
   ->update(['actor_name' => '[Removed Admin]']);
// actor_email snapshot already written at log time; leave unchanged
// actor_user_id is set NULL by FK ON DELETE SET NULL
```

**Alternatives considered**: Store only `actor_user_id` and JOIN at query time — breaks when the user is deleted. Store full snapshot only — wastes space on large logs. Chosen approach (snapshot + tombstone update) balances traceability with storage efficiency.

---

## 6. Audit Log — Pagination & Export

**Decision**: `GET /api/platform/audit` supports server-side pagination (default page 1, per_page 50) and filters: `from_date`, `to_date`, `actor_email`, `action`, `target_type`. All filters stack via query builder `where()` chains. Response includes `data`, `total`, `page`, `per_page`.

**CSV Export**: `POST /api/platform/audit/export` accepts the same filter params, runs the query without pagination limit, and streams a CSV response with `Content-Disposition: attachment; filename="audit-log.csv"`. Rows are fetched in batches of 500 to avoid loading all rows into memory simultaneously.

**Index strategy** (existing + additions):
- `created_at` — already indexed in migration `2026-04-22-000004`.
- `actor_user_id` — already indexed.
- `action` — already indexed.
- `actor_email` (new snapshot column) — add index in migration `2026-04-27-400002`.

---

## 7. Platform Invitations for Team Members

**Decision**: Reuse the invitation token pattern from feature 045 (`user_invitations` table / `UserInvitationModel`). Create a separate `platform_invitations` table (`2026-04-27-400003`) targeting `platform_users` instead of tenant `users`. Token lifetime: 48 hours. Token: `bin2hex(random_bytes(32))`, stored as `sha256(token)`.

**Acceptance endpoint**: `POST /api/platform/auth/accept-invite` — public (no JWT required). Validates token, sets password, sets `status = 'Active'`, marks invitation as accepted.

**No-password invite flow replaces current flow**: The existing `SettingsController::inviteTeamMember` currently accepts a `password` field and sets it directly. This will be replaced: no `password` field; instead generates an invitation token and dispatches an email. The `platform_users` record is created with `status = 'Invited'` and a blank `password_hash` placeholder.

---

## 8. Access Control Matrix — Frontend-Only Tab

**Decision**: The Access Control tab is a static read-only React component rendering the role-permission matrix as a `<table>`. The matrix values are hard-coded in the component (mirroring `PlatformPolicy.php` constants). No API call required. Any future policy change requires updating both `PlatformPolicy.php` and the matrix component — acceptable for v1.

**Alternatives considered**: Serve the matrix from a `/api/platform/access-control` endpoint — adds complexity with no user-visible benefit; the matrix changes infrequently.

---

## 9. Account Self-Management

**Decision**: Two separate forms in the Account tab:
1. **Profile form** (`PUT /api/platform/account`) — updates `name` and `email`. Validates: non-empty, valid email, unique email across `platform_users`.
2. **Password form** (`PUT /api/platform/account/password`) — requires `current_password`, `new_password` (min 8 chars), `new_password_confirmation`. Verifies current password with `password_verify` before hashing and saving the new one.

Both changes emit audit entries. Password form never returns or logs the password value.

---

## 10. Role Permissions — Gap Analysis vs. Existing `PlatformPolicy`

Current `PlatformPolicy::canManageSettings` returns `true` only for `Owner`. Per the spec, **Admin** can also write General/Email/Billing settings. The policy must be updated:

| Action | Current | Required |
|--------|---------|----------|
| `canManageSettings` (General/Billing/Email write) | Owner only | Owner + Admin |
| `canManageTeam` (invite + remove) | Owner + Admin | ✅ unchanged |
| `canChangeTeamRole` | (not separated) | Owner only — **new policy method** |
| `canDeactivateTeamMember` | (not exist) | Owner + Admin — **new policy method** |
| `canViewAuditLog` | (not exist) | All roles — **new policy method** |
| `canManageOwnAccount` | (not exist) | All roles — **new policy method** (always true) |
| `canDisableOtherAdmin2FA` | (not exist) | Owner only — **new policy method** |

The `SettingsController::changeTeamMemberRole` currently uses `canManageTeam` which allows Admin. This must be tightened to Owner-only via a new `canChangeTeamRole` method.
