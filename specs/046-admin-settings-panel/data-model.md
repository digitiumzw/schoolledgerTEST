# Data Model: Admin Settings Panel

**Branch**: `046-admin-settings-panel` | **Date**: 2026-04-27

---

## Existing Tables (modified by this feature)

### `platform_users` — add columns (migration `2026-04-27-400000`)

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `status` | ENUM(`Active`, `Invited`, `Deactivated`) | NO | `Active` | New. Existing rows default to `Active`. |
| `two_factor_recovery_hash` | VARCHAR(255) | YES | NULL | New. SHA-256 of the one-time backup recovery code. Cleared after use. |

**Validation rules**:
- `status` must be one of `Active`, `Invited`, `Deactivated`.
- Deactivating the last `Owner` (where `status = 'Active'`) is forbidden.

**State transitions**:
```
Invited ──(accept invite)──► Active
Active  ──(deactivate)──────► Deactivated
Deactivated ──(reactivate)──► Active   [Owner-only, future; not in v1 scope but schema supports it]
```

---

### `platform_audit` — add columns (migration `2026-04-27-400002`)

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `actor_name` | VARCHAR(255) | YES | NULL | New. Snapshot of `platform_users.name` at log time. Set to `[Removed Admin]` if user is permanently removed. |
| `actor_email` | VARCHAR(255) | YES | NULL | New. Snapshot of `platform_users.email` at log time. Retained unchanged after user removal. |

**Index additions**: `actor_email` — supports filter-by-actor queries.

**Immutability rule**: No `UPDATE` or `DELETE` is ever issued against `platform_audit` rows, except the targeted `actor_name` tombstone update on account removal (which is the designed mutation, not a data correction).

---

## New Tables

### `platform_login_history` (migration `2026-04-27-400001`)

Records every login attempt at `POST /api/platform/auth/login`.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | BIGINT UNSIGNED AUTO_INCREMENT | NO | — | PK |
| `platform_user_id` | BIGINT UNSIGNED | YES | NULL | FK → `platform_users.id` ON DELETE SET NULL. Nullable for failed attempts where account not found. |
| `email_attempted` | VARCHAR(255) | NO | — | The email value submitted in the login request. |
| `ip_address` | VARCHAR(45) | YES | NULL | IPv4 or IPv6. |
| `user_agent` | TEXT | YES | NULL | Browser/device string. |
| `outcome` | ENUM(`success`, `failed`) | NO | — | |
| `failure_reason` | VARCHAR(255) | YES | NULL | e.g., `invalid_password`, `invalid_totp`, `account_deactivated`. |
| `created_at` | DATETIME | YES | NULL | Login event timestamp. |

**Indexes**: `platform_user_id`, `created_at`.  
**FK**: `platform_user_id` → `platform_users.id` ON DELETE SET NULL.  
**Retention**: Rows older than 90 days are eligible for purge.

---

### `platform_invitations` (migration `2026-04-27-400003`)

Tracks pending invitations for new platform-admin team members.

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | BIGINT UNSIGNED AUTO_INCREMENT | NO | — | PK |
| `platform_user_id` | BIGINT UNSIGNED | NO | — | FK → `platform_users.id` ON DELETE CASCADE. The user record is created at invitation time with `status = 'Invited'`. |
| `invited_by` | BIGINT UNSIGNED | YES | NULL | FK → `platform_users.id` ON DELETE SET NULL. |
| `token_hash` | VARCHAR(64) | NO | — | `sha256(plain_token)`. UNIQUE. |
| `expires_at` | DATETIME | NO | — | 48 hours from invitation time. |
| `accepted_at` | DATETIME | YES | NULL | Set when the invite is accepted. NULL = still pending. |
| `created_at` | DATETIME | YES | NULL | |

**Indexes**: `token_hash` (UNIQUE), `platform_user_id`, `expires_at`.  
**Uniqueness**: one active (non-accepted, non-expired) invitation per `platform_user_id`; resend invalidates the old row by setting it expired and inserting a new one.

---

## Entity Relationship Summary

```
platform_users (1) ──── (N) platform_audit          [actor_user_id FK, SET NULL on delete]
platform_users (1) ──── (N) platform_login_history  [platform_user_id FK, SET NULL on delete]
platform_users (1) ──── (N) platform_invitations    [platform_user_id FK, CASCADE on delete]
platform_users (1) ──── (N) platform_invitations    [invited_by FK, SET NULL on delete]
```

---

## Role-Permission Matrix (canonical)

This matrix is the source of truth for both `PlatformPolicy.php` and the frontend `AccessControlTab.tsx`.

| Section / Action | Owner | Admin | Finance | Support |
|---|---|---|---|---|
| **Dashboard** (read) | ✅ | ✅ | ✅ | ✅ |
| **Schools** — view list + detail | ✅ | ✅ | ✅ | ✅ |
| **Schools** — create, suspend, reactivate, impersonate | ✅ | ✅ | ❌ | suspend/reactivate/impersonate only |
| **Schools** — permanent delete | ✅ | ❌ | ❌ | ❌ |
| **Subscriptions / Plans** — view | ✅ | ✅ | ✅ | ✅ |
| **Subscriptions / Plans** — create, edit, retire, change, cancel | ✅ | ✅ | ✅ | ❌ |
| **Finance** — view | ✅ | ✅ | ✅ | ✅ |
| **Finance** — export CSV, invoice actions | ✅ | ✅ | ✅ | ❌ |
| **Analytics** (read) | ✅ | ✅ | ✅ | ✅ |
| **Settings → Account** (own) | ✅ | ✅ | ✅ | ✅ |
| **Settings → General / Billing / Email** — view | ✅ | ✅ | ✅ | ✅ |
| **Settings → General / Billing / Email** — write | ✅ | ✅ | ❌ | ❌ |
| **Settings → Team** — view | ✅ | ✅ | ✅ | ✅ |
| **Settings → Team** — invite, deactivate, remove | ✅ | ✅ | ❌ | ❌ |
| **Settings → Team** — change role | ✅ | ❌ | ❌ | ❌ |
| **Settings → Team** — disable 2FA for another admin | ✅ | ❌ | ❌ | ❌ |
| **Settings → Access Control** (read) | ✅ | ✅ | ✅ | ✅ |
| **Settings → Security** — own 2FA enrol/disable | ✅ | ✅ | ✅ | ✅ |
| **Settings → Security** — own login history | ✅ | ✅ | ✅ | ✅ |
| **Settings → Security** — platform-wide toggles | ✅ | ❌ | ❌ | ❌ |
| **Settings → Audit Logs** (read + export) | ✅ | ✅ | ✅ | ✅ |
| **Settings → API Keys** — view (masked) | ✅ | ✅ | ❌ | ❌ |
| **Settings → API Keys** — create, rotate, revoke | ✅ | ❌ | ❌ | ❌ |
