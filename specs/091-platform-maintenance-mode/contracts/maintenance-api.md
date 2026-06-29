# API Contracts: Platform Maintenance Mode

**Feature Branch**: `091-platform-maintenance-mode`
**Date**: 2026-06-22

## Public Endpoints (No Authentication Required)

### GET /api/maintenance-status

Returns the current maintenance mode state and configured message. This endpoint is public (unauthenticated) so the frontend can check maintenance state before login.

**Request**: No headers required.

**Response (200)**:
```json
{
  "status": true,
  "message": "Success",
  "data": {
    "maintenance_mode": false,
    "headline": "Platform Under Maintenance",
    "message": "The platform is currently under maintenance. Service will be restored shortly."
  }
}
```

**Response when maintenance is on (200 — the endpoint itself is always available)**:
```json
{
  "status": true,
  "message": "Success",
  "data": {
    "maintenance_mode": true,
    "headline": "Platform Under Maintenance",
    "message": "The platform is currently under maintenance. Service will be restored shortly."
  }
}
```

**Notes**:
- This endpoint is excluded from `JWTAuthFilter` via `PUBLIC_PATHS`.
- The endpoint returns 200 even when maintenance mode is on — it is the *status check* endpoint, not a tenant data endpoint.
- When `maintenance_headline` or `maintenance_message` is empty, the defaults are returned.

---

## Platform Admin Endpoints (Platform JWT Required)

### PUT /api/platform/settings

The existing settings update endpoint is used to update maintenance mode settings. The request body includes the maintenance keys alongside any other settings being updated.

**Request Headers**: `Authorization: Bearer <platform-jwt-token>`

**Request Body** (maintenance keys only shown — other keys can be included):
```json
{
  "maintenance_mode": {
    "value": true,
    "type": "boolean",
    "description": "Whether maintenance mode is enabled"
  },
  "maintenance_headline": {
    "value": "Platform Under Maintenance",
    "type": "string",
    "description": "Custom headline for the maintenance notice"
  },
  "maintenance_message": {
    "value": "The platform is currently under maintenance. Service will be restored shortly.",
    "type": "string",
    "description": "Custom message body for the maintenance notice"
  }
}
```

**Response (200)**:
```json
{
  "status": true,
  "message": "Settings updated",
  "data": {
    "maintenance_mode": {
      "value": true,
      "type": "boolean",
      "description": "Whether maintenance mode is enabled"
    },
    "maintenance_headline": {
      "value": "Platform Under Maintenance",
      "type": "string",
      "description": "Custom headline for the maintenance notice"
    },
    "maintenance_message": {
      "value": "The platform is currently under maintenance. Service will be restored shortly.",
      "type": "string",
      "description": "Custom message body for the maintenance notice"
    },
    "support_email": {
      "value": "support@schoolledger.io",
      "type": "string",
      "description": "Support contact email"
    }
  }
}
```

**Error Responses**:
- `401` — No authentication token or invalid token
- `403` — User does not have Owner or Admin role (`canManageSettings` check)

---

### GET /api/platform/settings

Returns all platform settings including maintenance keys. Used by the Platform Control Panel Settings page to populate the maintenance toggle and message fields.

**Request Headers**: `Authorization: Bearer <platform-jwt-token>`

**Response (200)**:
```json
{
  "status": true,
  "message": "Success",
  "data": {
    "maintenance_mode": {
      "value": false,
      "type": "boolean",
      "description": "Whether maintenance mode is enabled"
    },
    "maintenance_headline": {
      "value": "Platform Under Maintenance",
      "type": "string",
      "description": "Custom headline for the maintenance notice"
    },
    "maintenance_message": {
      "value": "The platform is currently under maintenance. Service will be restored shortly.",
      "type": "string",
      "description": "Custom message body for the maintenance notice"
    }
  }
}
```

---

## Tenant API Maintenance Response (503)

When maintenance mode is enabled, all authenticated tenant API requests from non-admin users (role != `admin` and role != `super_admin`) receive a 503 response instead of normal payload data.

**Response (503)**:
```json
{
  "status": false,
  "message": "Platform Under Maintenance",
  "data": {
    "maintenance_mode": true,
    "headline": "Platform Under Maintenance",
    "message": "The platform is currently under maintenance. Service will be restored shortly."
  }
}
```

**Notes**:
- The 503 response is returned by `JWTAuthFilter::before()` after JWT validation succeeds but before the controller executes.
- Admin users (`admin`, `super_admin`) receive normal responses — the maintenance check is bypassed.
- Public endpoints (kiosk, receipts, demo-requests, auth/login, auth/register, etc.) are not affected — they never reach the maintenance check because they are in `PUBLIC_PATHS`.
- Platform admin routes (`/api/platform/*`) are not affected — they use `PlatformJWTAuthFilter`, not `JWTAuthFilter`.
