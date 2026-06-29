# API Contract: Admin Settings Panel

**Branch**: `046-admin-settings-panel` | **Date**: 2026-04-27  
**Base path**: `/api/platform`  
**Auth**: All endpoints require `Authorization: Bearer <platform-JWT>` except those marked `PUBLIC`.  
**Response envelope** (all endpoints):
```json
{ "status": "success" | "error", "data": { ... } | null, "message": "..." }
```

---

## Account

### `PUT /account`
Update the signed-in admin's name and/or email.

**Roles**: All (own account only)  
**Request body**:
```json
{ "name": "Jane Smith", "email": "jane@example.com" }
```
**Success** `200`:
```json
{ "status": "success", "data": { "id": 1, "name": "Jane Smith", "email": "jane@example.com" }, "message": "Profile updated" }
```
**Errors**: `400` validation fail | `409` email already in use

---

### `PUT /account/password`
Change the signed-in admin's password.

**Roles**: All (own account only)  
**Request body**:
```json
{ "current_password": "...", "new_password": "...", "new_password_confirmation": "..." }
```
**Success** `200`:
```json
{ "status": "success", "data": null, "message": "Password changed" }
```
**Errors**: `400` validation | `401` current password incorrect

---

## 2FA (Two-Factor Authentication)

### `POST /auth/2fa/setup`
Initiate 2FA enrolment — generates and returns TOTP secret and QR URI. Does NOT enable 2FA yet.

**Roles**: All  
**Request body**: _(empty)_  
**Success** `200`:
```json
{
  "status": "success",
  "data": {
    "secret": "BASE32SECRET",
    "otpauth_uri": "otpauth://totp/SchoolLedger%3Ajane%40example.com?secret=BASE32SECRET&issuer=SchoolLedger",
    "recovery_code": "PLAIN-RECOVERY-CODE-SHOWN-ONCE"
  },
  "message": "Scan the QR code and confirm with a TOTP code to activate 2FA"
}
```
**Note**: `recovery_code` is shown exactly once; backend stores only its SHA-256 hash.

---

### `POST /auth/2fa/confirm`
Confirm TOTP code to complete enrolment and activate 2FA.

**Roles**: All  
**Request body**:
```json
{ "totp_code": "123456" }
```
**Success** `200`:
```json
{ "status": "success", "data": null, "message": "Two-factor authentication enabled" }
```
**Errors**: `422` invalid or expired TOTP code

---

### `DELETE /auth/2fa`
Disable 2FA for the signed-in admin (requires current password confirmation).

**Roles**: All  
**Request body**:
```json
{ "current_password": "..." }
```
**Success** `200`:
```json
{ "status": "success", "data": null, "message": "Two-factor authentication disabled" }
```
**Errors**: `401` incorrect password

---

### `DELETE /team/{id}/2fa`
Owner disables 2FA for another admin (recovery flow).

**Roles**: Owner only  
**Request body**: _(empty)_  
**Success** `200`:
```json
{ "status": "success", "data": null, "message": "Two-factor authentication disabled for team member" }
```
**Errors**: `403` not Owner | `404` member not found

---

### `GET /auth/login-history`
Return the last 20 login events for the signed-in admin.

**Roles**: All  
**Success** `200`:
```json
{
  "status": "success",
  "data": [
    {
      "id": 42,
      "ip_address": "192.168.1.1",
      "user_agent": "Mozilla/5.0 ...",
      "outcome": "success",
      "failure_reason": null,
      "created_at": "2026-04-27T14:30:00Z"
    }
  ],
  "message": ""
}
```

---

## Team Management (extensions)

### `POST /team/invite` *(replaces existing — no password field)*
Invite a new platform admin via email (invitation-based flow).

**Roles**: Owner, Admin  
**Request body**:
```json
{ "name": "Alice Brown", "email": "alice@example.com", "platform_role": "Finance" }
```
**Success** `201`:
```json
{ "status": "success", "data": { "id": 5, "name": "Alice Brown", "email": "alice@example.com", "platform_role": "Finance", "status": "Invited" }, "message": "Invitation sent" }
```
**Errors**: `409` email already exists | `403` insufficient role

---

### `POST /team/{id}/resend-invite`
Resend invitation to an admin still in Invited status.

**Roles**: Owner, Admin  
**Success** `200`:
```json
{ "status": "success", "data": null, "message": "Invitation resent" }
```
**Errors**: `409` account is already Active | `404` member not found

---

### `POST /team/{id}/deactivate`
Deactivate a platform admin account (status → Deactivated).

**Roles**: Owner, Admin  
**Success** `200`:
```json
{ "status": "success", "data": null, "message": "Team member deactivated" }
```
**Errors**: `409` cannot deactivate last active Owner | `403` insufficient role

---

### `PUT /team/{id}/role` *(tighten existing — Owner only)*
Change a team member's role.

**Roles**: Owner only *(was Owner + Admin — tightened per spec)*  
**Request body**: `{ "role": "Finance" }`  
**Success** `200`: `{ "status": "success", "data": null, "message": "Role updated" }`  
**Errors**: `403` not Owner | `400` invalid role

---

## Accept Invitation (PUBLIC)

### `POST /auth/accept-invite`
Accept a team invitation and set a password. No JWT required.

**Roles**: PUBLIC  
**Request body**:
```json
{ "token": "<plain-invitation-token>", "password": "...", "password_confirmation": "..." }
```
**Success** `200`:
```json
{ "status": "success", "data": null, "message": "Account activated. You can now sign in." }
```
**Errors**: `400` invalid/expired token | `400` password too short | `400` passwords don't match

---

## Audit Logs

### `GET /audit`
Paginated, filterable audit log.

**Roles**: All  
**Query params**:
| Param | Type | Description |
|-------|------|-------------|
| `page` | int | Default 1 |
| `per_page` | int | Default 50, max 200 |
| `from_date` | date (Y-m-d) | Filter by date range start |
| `to_date` | date (Y-m-d) | Filter by date range end |
| `actor_email` | string | Filter by actor email snapshot |
| `action` | string | Filter by action type |
| `target_type` | string | Filter by target entity type |

**Success** `200`:
```json
{
  "status": "success",
  "data": {
    "items": [
      {
        "id": 1001,
        "actor_user_id": 3,
        "actor_name": "Jane Smith",
        "actor_email": "jane@example.com",
        "action": "platform.tenant.suspend",
        "target_type": "tenant",
        "target_id": "42",
        "details": { "reason": "manual" },
        "ip_address": "10.0.0.1",
        "created_at": "2026-04-27T10:00:00Z"
      }
    ],
    "total": 1234,
    "page": 1,
    "per_page": 50
  },
  "message": ""
}
```

---

### `POST /audit/export`
Stream filtered audit log as CSV download.

**Roles**: All  
**Request body**: Same filter fields as `GET /audit` (no pagination params — exports full filtered set).  
**Success** `200`:  
`Content-Type: text/csv`  
`Content-Disposition: attachment; filename="audit-log-YYYY-MM-DD.csv"`  
CSV columns: `id`, `actor_name`, `actor_email`, `action`, `target_type`, `target_id`, `ip_address`, `created_at`

---

## Settings (role-enforcement corrections)

### `PUT /settings` *(existing — tighten role check)*
Currently Owner-only. Per spec, Owner + Admin may write General/Billing/Email settings.

**Roles**: Owner, Admin *(changed from Owner-only)*

---

## Security Toggles (Owner-only platform-wide)

These are stored in `platform_settings` via the existing `PUT /settings` endpoint using specific keys:

| Setting key | Type | Description |
|-------------|------|-------------|
| `enforce_2fa` | boolean | Force all platform admins to enrol in 2FA |
| `auto_suspend_failed_payment_threshold` | integer | N failed payments before auto-suspend |
| `weekly_security_digest_enabled` | boolean | Send weekly security digest email |
