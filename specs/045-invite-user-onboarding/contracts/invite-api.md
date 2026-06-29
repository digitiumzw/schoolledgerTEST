# API Contract: Invitation-Based User Onboarding

**Feature**: `045-invite-user-onboarding`  
**Date**: 2026-04-27  
**Base path**: `/api`  
**Auth**: Bearer JWT (except where marked public)

All responses use the standard envelope:
```json
{ "status": true|false, "message": "...", "data": { ... } }
```

---

## 1. POST /api/users/invite

**Auth**: Required (roles: `super_admin`, `admin`)  
**Description**: Invite a new user. Creates a `pending` user account and dispatches an invitation email. No password is accepted or stored.

### Request Body

```json
{
  "name":  "Jane Doe",
  "email": "jane@school.example",
  "role":  "admin"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | ✅ | 1–255 characters |
| `email` | string | ✅ | Valid email format |
| `role` | string | ✅ | One of `admin`, `bursar` (non-super-admin callers); `super_admin` additionally allowed for super-admin callers |

### Success Response — `201 Created`

```json
{
  "status": true,
  "message": "Invitation sent to jane@school.example",
  "data": {
    "id":          "u1745000000_ab12cd34",
    "tenantId":    "tenant-uuid",
    "email":       "jane@school.example",
    "name":        "Jane Doe",
    "role":        "admin",
    "status":      "invited",
    "createdDate": "2026-04-27T14:00:00Z"
  }
}
```

### Error Responses

| HTTP | Condition |
|------|-----------|
| 400 | Missing or invalid `name`, `email`, or `role` |
| 400 | Account cap reached (5 active+invited admin/bursar accounts for tenant) |
| 401 | No or invalid JWT |
| 403 | Caller role insufficient (e.g., non-super-admin tries to invite `super_admin`) |
| 409 | Email already belongs to an active or invited user in the same tenant |

---

## 2. POST /api/users/{id}/resend-invite

**Auth**: Required (roles: `super_admin`, `admin`)  
**Description**: Re-issue an invitation for a user whose status is still `invited`. Invalidates the previous token and sends a fresh email.

### Path Parameter

| Param | Description |
|-------|-------------|
| `id` | User ID of the pending/invited user |

### Request Body

_(empty)_

### Success Response — `200 OK`

```json
{
  "status": true,
  "message": "Invitation resent to jane@school.example",
  "data": null
}
```

### Error Responses

| HTTP | Condition |
|------|-----------|
| 400 | User status is not `invited` (already active or inactive) |
| 401 | No or invalid JWT |
| 403 | Caller lacks permission (cannot resend for super_admin target unless caller is super_admin) |
| 404 | User not found |

---

## 3. POST /api/auth/accept-invite

**Auth**: **Public** (no JWT required — added to `JWTAuthFilter` public paths)  
**Description**: Accept an invitation token and set the user's password. Activates the account.

### Request Body

```json
{
  "token":    "64-hex-char-plain-token",
  "password": "mynewpassword1"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `token` | string | ✅ | Non-empty string |
| `password` | string | ✅ | Minimum 8 characters |

### Success Response — `200 OK`

```json
{
  "status": true,
  "message": "Your account is ready. You can now sign in.",
  "data": null
}
```

### Error Responses

| HTTP | Condition |
|------|-----------|
| 400 | Missing `token` or `password` |
| 400 | `password` shorter than 8 characters |
| 400 | Token not found, already used, or expired (`"This invitation link is invalid or has expired."`) |

---

## 4. Modified: POST /api/users (create — existing endpoint)

**Status**: **Removed** — superseded by `POST /api/users/invite`. The backend `UserController::create()` method and `POST /api/users` route are removed. All new user creation goes through the invite flow.

---

## 5. Modified: POST /api/users/{id}/reset-password (existing endpoint)

**Status**: **Removed** — this endpoint returned a temporary password to the calling admin, violating the self-service-only password reset requirement (FR-010). Self-service reset is handled by `POST /api/auth/forgot-password` and `POST /api/auth/reset-password` (feature 044).

---

## Frontend Integration Types

```typescript
// api.ts additions

export interface InviteUserPayload {
  name:  string;
  email: string;
  role:  'admin' | 'bursar' | 'super_admin';
}

export interface AcceptInvitePayload {
  token:    string;
  password: string;
}

// Replace createUser / resetUserPassword with:
inviteUser: (payload: InviteUserPayload) => Promise<User>
resendInvite: (userId: string) => Promise<void>

// New auth method:
acceptInvite: (payload: AcceptInvitePayload) => Promise<void>

// Remove:
// createUser (accepted a password field)
// resetUserPassword (returned a temp password to the admin)
```

---

## Frontend Route

| Path | Component | Auth | Notes |
|------|-----------|------|-------|
| `/accept-invite` | `AcceptInvitePage.tsx` | Public | Reads `?token=` from query string; shows set-password form; redirects to `/login` on success |

---

## Audit Log Events

| Event | Description |
|-------|-------------|
| `user.invite` | Admin sent an invitation |
| `user.invite_accepted` | Invited user accepted and set password |
| `user.invite_resent` | Admin resent an invitation |
| `user.invite_expired` | Token expired (logged on first failed accept attempt) |
