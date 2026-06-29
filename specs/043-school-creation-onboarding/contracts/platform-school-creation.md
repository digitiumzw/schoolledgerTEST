# Contract: Platform School Creation API

**Feature**: `043-school-creation-onboarding`  
**Base path**: `/api/platform/tenants`  
**Auth**: `platform-jwt-auth` filter — `platform_role` IN (`Owner`, `Admin`)  
**Response envelope**: `{ "status": "success"|"error", "data": {...}, "message": "..." }`

---

## POST /api/platform/tenants

Creates a new school, provisions the admin user account, and dispatches the welcome email.

> Extends the existing `TenantsController::store()` method. Subdomain is now auto-generated from the school name — no longer required from the client.

### Request

```json
{
  "name": "Greenwood Academy",
  "email": "admin@greenwoodacademy.co.zw"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `name` | string | Yes | Non-empty, max 255 chars |
| `email` | string | Yes | Valid email format; must not already exist in `users.email` |

### Response — 201 Created

```json
{
  "status": "success",
  "message": "School created successfully. Welcome email sent.",
  "data": {
    "id": "a1b2c3d4-...",
    "name": "Greenwood Academy",
    "email": "admin@greenwoodacademy.co.zw",
    "subdomain": "greenwood-academy",
    "status": "pending",
    "created_at": "2026-04-27T09:00:00Z"
  }
}
```

### Response — 201 Created (email delivery failed)

When the tenant and user are created successfully but the welcome email fails to send:

```json
{
  "status": "success",
  "message": "School created successfully. Welcome email could not be delivered — use Resend Welcome to retry.",
  "data": {
    "id": "a1b2c3d4-...",
    "name": "Greenwood Academy",
    "email": "admin@greenwoodacademy.co.zw",
    "subdomain": "greenwood-academy",
    "status": "pending",
    "email_sent": false,
    "created_at": "2026-04-27T09:00:00Z"
  }
}
```

### Response — 409 Conflict (duplicate email)

```json
{
  "status": "error",
  "message": "An admin account with this email address already exists.",
  "errors": {}
}
```

### Response — 422 Unprocessable Entity (validation)

```json
{
  "status": "error",
  "message": "Validation failed.",
  "errors": {
    "name": "School name is required.",
    "email": "A valid email address is required."
  }
}
```

### Response — 403 Forbidden

```json
{
  "status": "error",
  "message": "Insufficient permissions.",
  "errors": {}
}
```

---

## POST /api/platform/tenants/:id/resend-welcome

Resends the welcome email to the admin of a pending school.

**Auth**: Same as above — `Owner` or `Admin` platform role.

### Request

No body required.

### Response — 200 OK

```json
{
  "status": "success",
  "message": "Welcome email resent successfully.",
  "data": null
}
```

### Response — 404 Not Found

```json
{
  "status": "error",
  "message": "Tenant not found.",
  "errors": {}
}
```

### Response — 409 Conflict (already activated)

```json
{
  "status": "error",
  "message": "This school has already completed onboarding. Resend is only available for pending schools.",
  "errors": {}
}
```

---

## GET /api/platform/tenants (updated filter)

The existing list endpoint now supports filtering by `status=pending` to surface newly provisioned schools awaiting onboarding completion.

**New query parameter**:

| Param | Values | Description |
|-------|--------|-------------|
| `status` | `active`, `suspended`, `trialing`, `pending` | Filter by tenant status |

No changes to response shape.
