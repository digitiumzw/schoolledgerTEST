# Data Model: Invitation-Based User Onboarding

**Feature**: `045-invite-user-onboarding`  
**Date**: 2026-04-27

---

## Entity 1: UserInvitation (new table `user_invitations`)

Represents a pending invitation issued by an admin to a new user. Lifecycle: created on invite → consumed on acceptance or expiry.

### Fields

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | VARCHAR(36) | PK, NOT NULL | UUID-format identifier |
| `tenant_id` | VARCHAR(36) | NOT NULL, FK → tenants.id | Owning tenant (sourced from admin's JWT at invite time) |
| `invited_user_id` | VARCHAR(64) | NOT NULL, FK → users.id | The user account created at invite time |
| `email` | VARCHAR(255) | NOT NULL | Email address the invitation was sent to |
| `name` | VARCHAR(255) | NOT NULL | Display name provided by the inviting admin |
| `role` | VARCHAR(32) | NOT NULL | Assigned role (`admin`, `bursar`, `super_admin`) |
| `invited_by` | VARCHAR(64) | NOT NULL | User ID of the admin who sent the invitation |
| `token_hash` | VARCHAR(64) | NOT NULL, UNIQUE | SHA-256 of the plain invitation token |
| `expires_at` | DATETIME | NOT NULL | Token expiry (48 hours from `created_at`) |
| `accepted_at` | DATETIME | NULL | Set when the invited user completes password setup |
| `invalidated_at` | DATETIME | NULL | Set when a resend invalidates a previous token |
| `created_at` | DATETIME | NOT NULL | Creation timestamp |

### Indexes

- `PRIMARY KEY (id)`
- `UNIQUE INDEX idx_ui_token_hash (token_hash)` — fast single-row lookup at accept time
- `INDEX idx_ui_tenant_user (tenant_id, invited_user_id)` — fast lookup for resend / status queries
- `INDEX idx_ui_email_tenant (email, tenant_id)` — duplicate-invite detection

### Validation Rules

- `tenant_id` and `invited_user_id` must reference existing rows.
- `token_hash` must be 64 hex characters (SHA-256 output).
- `expires_at` must be after `created_at`.
- `role` must be one of `['admin', 'bursar', 'super_admin']`.
- Only one active (non-accepted, non-invalidated, non-expired) invitation per `(email, tenant_id)` pair at any time.

### State Transitions

```
PENDING  ──(user accepts)──► ACCEPTED  (accepted_at set; user.status → 'active')
PENDING  ──(admin resends)──► INVALIDATED  (invalidated_at set; new PENDING record created)
PENDING  ──(48h passes)──► EXPIRED  (no column change; queried by expires_at < NOW())
```

---

## Entity 2: User (modified — `users` table)

The existing `users` table gains a new status value and removes the password requirement on creation.

### Status Enum Change

**Before**: `status ENUM('active', 'inactive') DEFAULT 'active'`  
**After**: `status ENUM('active', 'inactive', 'invited') DEFAULT 'active'`

When a user is created via the invitation flow:
- `status` is set to `'invited'`
- `password` column is set to `NULL` (or empty string) — no password exists until accepted

When the invited user accepts:
- `status` transitions to `'active'`
- `password` is set to the bcrypt hash of the chosen password
- `is_temp_password` remains `0` (user chose their own password; no temp password involved)

### Account Cap Enforcement

The per-tenant cap of 5 active admin/bursar accounts is checked against:

```sql
SELECT COUNT(*) FROM users
WHERE tenant_id = ?
  AND role IN ('admin', 'bursar')
  AND status IN ('active', 'invited')
```

---

## Migration Plan

### Migration 1: Create `user_invitations` table

**File**: `backend/app/Database/Migrations/2026-04-27-320000_Create_user_invitations_table.php`

```php
// up()
$this->forge->addField([
    'id'              => ['type' => 'VARCHAR', 'constraint' => 36],
    'tenant_id'       => ['type' => 'VARCHAR', 'constraint' => 36, 'null' => false],
    'invited_user_id' => ['type' => 'VARCHAR', 'constraint' => 64, 'null' => false],
    'email'           => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => false],
    'name'            => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => false],
    'role'            => ['type' => 'VARCHAR', 'constraint' => 32, 'null' => false],
    'invited_by'      => ['type' => 'VARCHAR', 'constraint' => 64, 'null' => false],
    'token_hash'      => ['type' => 'VARCHAR', 'constraint' => 64, 'null' => false],
    'expires_at'      => ['type' => 'DATETIME', 'null' => false],
    'accepted_at'     => ['type' => 'DATETIME', 'null' => true, 'default' => null],
    'invalidated_at'  => ['type' => 'DATETIME', 'null' => true, 'default' => null],
    'created_at'      => ['type' => 'DATETIME', 'null' => false],
]);
$this->forge->addPrimaryKey('id');
$this->forge->addUniqueKey('token_hash', 'idx_ui_token_hash');
$this->forge->addKey(['tenant_id', 'invited_user_id'], false, false, 'idx_ui_tenant_user');
$this->forge->addKey(['email', 'tenant_id'], false, false, 'idx_ui_email_tenant');
$this->forge->createTable('user_invitations');

// down()
$this->forge->dropTable('user_invitations');
```

### Migration 2: Add `invited` status to `users`

**File**: `backend/app/Database/Migrations/2026-04-27-330000_Add_invited_status_to_users.php`

```php
// up()
$this->db->query(
    "ALTER TABLE users MODIFY COLUMN status ENUM('active','inactive','invited') NOT NULL DEFAULT 'active'"
);

// down()
$this->db->query(
    "UPDATE users SET status = 'inactive' WHERE status = 'invited'"
);
$this->db->query(
    "ALTER TABLE users MODIFY COLUMN status ENUM('active','inactive') NOT NULL DEFAULT 'active'"
);
```

---

## Affected Existing Queries

| Location | Change Required |
|----------|----------------|
| `UserController::create()` | Replace with `invite()`: no password field; set `status='invited'`; delegate to `InvitationService` |
| `UserController::resetPassword()` | **Remove entirely** |
| `AuthController::login()` | Add explicit check: reject `status='invited'` with HTTP 403 |
| `UserAccountsTab.tsx` (frontend) | Show `invited` badge; replace "Reset Password" button with "Resend Invite" for invited users |
| `UserFormModal.tsx` (frontend) | Remove password field from create form; rename CTA to "Send Invite" |
| `api.ts` (frontend) | Replace `createUser` (with password) with `inviteUser`; remove `resetUserPassword`; add `resendInvite` |
