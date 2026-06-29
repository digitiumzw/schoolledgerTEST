# Platform API Contract

**Base URL**: `http://localhost:8080/api/platform`  
**Authentication**: Bearer JWT with `scope: "platform"`  
**Content-Type**: `application/json`

## Authentication Endpoints

### POST /auth/login
Authenticates a platform admin and returns a JWT.

**Request**:
```json
{
  "email": "admin@example.com",
  "password": "secret",
  "totp_code": "123456"  // Required if 2FA enabled
}
```

**Response 200**:
```json
{
  "token": "eyJ...",
  "expires_in": 3600,
  "user": {
    "id": 1,
    "name": "Admin User",
    "email": "admin@example.com",
    "platform_role": "Owner",
    "two_factor_enabled": true,
    "last_login_at": "2026-04-21T10:00:00Z"
  }
}
```

**Errors**:
- 400: Invalid credentials, missing TOTP
- 401: Invalid email/password or TOTP
- 429: Too many attempts (rate limited)

### POST /auth/refresh
Refreshes an existing JWT.

**Request**: Bearer token in Authorization header

**Response 200**:
```json
{
  "token": "eyJ...",
  "expires_in": 3600
}
```

**Errors**: 401 (invalid/expired token), 429

### POST /auth/impersonate
Creates a short-lived impersonation JWT for a tenant admin.

**Request**:
```json
{
  "tenant_id": 123
}
```

**Response 200**:
```json
{
  "token": "eyJ...",
  "expires_in": 1800,
  "tenant_url": "https://school.example.com/login?token=eyJ..."
}
```

**Errors**: 403 (insufficient permissions), 404 (tenant not found), 429

### POST /auth/stop-impersonation
Revokes active impersonation session(s) for the admin.

**Request**: (empty body)

**Response 204**: No content

**Errors**: 401, 403

### GET /auth/me
Returns current platform admin profile.

**Response 200**:
```json
{
  "id": 1,
  "name": "Admin User",
  "email": "admin@example.com",
  "platform_role": "Owner",
  "two_factor_enabled": true,
  "last_login_at": "2026-04-21T10:00:00Z",
  "created_at": "2026-01-01T00:00:00Z"
}
```

**Errors**: 401

## Tenants Endpoints

### GET /tenants
Lists all tenants with pagination and filtering.

**Query Parameters**:
- `page` (int, default: 1)
- `limit` (int, default: 20, max: 100)
- `search` (string): searches name and admin email
- `plan` (string): filter by plan name
- `status` (string): Active|Trial|Suspended|Cancelled
- `sort` (string): name|created_at|students|mrr (default: created_at)
- `order` (string): asc|desc (default: desc)

**Response 200**:
```json
{
  "data": [
    {
      "id": 123,
      "name": "Sample School",
      "admin_email": "admin@school.com",
      "plan": "Premium",
      "status": "Active",
      "student_count": 250,
      "teacher_count": 15,
      "mrr": 99.99,
      "currency": "USD",
      "region": "US",
      "country": "United States",
      "joined_at": "2026-01-15T00:00:00Z"
    }
  ],
  "pagination": {
    "current_page": 1,
    "per_page": 20,
    "total": 150,
    "last_page": 8
  }
}
```

**Errors**: 401, 403

### GET /tenants/{id}
Retrieves detailed tenant information.

**Response 200**:
```json
{
  "id": 123,
  "name": "Sample School",
  "admin_email": "admin@school.com",
  "plan": "Premium",
  "status": "Active",
  "student_count": 250,
  "teacher_count": 15,
  "storage_used_mb": 1024,
  "mrr": 99.99,
  "currency": "USD",
  "region": "US",
  "country": "United States",
  "joined_at": "2026-01-15T00:00:00Z",
  "trial_ends_at": null,
  "subscription": {
    "id": 456,
    "plan": "Premium",
    "status": "active",
    "renewal_date": "2026-05-15T00:00:00Z",
    "amount": 99.99,
    "currency": "USD"
  },
  "billing": {
    "total_invoices": 12,
    "paid_invoices": 11,
    "outstanding_amount": 99.99,
    "last_invoice_date": "2026-04-15T00:00:00Z"
  }
}
```

**Errors**: 401, 403, 404

### POST /tenants
Creates a new tenant.

**Request**:
```json
{
  "name": "New School",
  "admin_email": "admin@newschool.com",
  "plan_id": 3,
  "region": "EU",
  "country": "Germany"
}
```

**Response 201**:
```json
{
  "id": 124,
  "name": "New School",
  "admin_email": "admin@newschool.com",
  "plan": "Premium",
  "status": "Trial",
  "trial_ends_at": "2026-05-21T00:00:00Z",
  "created_at": "2026-04-21T10:00:00Z"
}
```

**Errors**: 400 (validation), 401, 403, 409 (email exists)

### POST /tenants/{id}/suspend
Suspends a tenant.

**Request**: (empty body)

**Response 204**: No content

**Errors**: 401, 403, 404, 409 (already suspended)

### POST /tenants/{id}/reactivate
Reactivates a suspended tenant.

**Request**: (empty body)

**Response 204**: No content

**Errors**: 401, 403, 404, 409 (not suspended)

### DELETE /tenants/{id}
Permanently deletes a tenant (only if no financial records).

**Request**: (empty body)

**Response 204**: No content

**Errors**: 401, 403, 404, 409 (has financial records)

## Plans Endpoints

### GET /plans
Lists all plan tiers.

**Response 200**:
```json
{
  "data": [
    {
      "id": 1,
      "name": "Basic",
      "price": 29.99,
      "currency": "USD",
      "billing_cycle": "monthly",
      "features": ["Up to 100 students", "Basic support"],
      "active_subscribers": 45,
      "is_popular": false,
      "is_retired": false,
      "created_at": "2026-01-01T00:00:00Z"
    }
  ]
}
```

**Errors**: 401, 403

### POST /plans
Creates a new plan tier.

**Request**:
```json
{
  "name": "Enterprise",
  "price": 299.99,
  "currency": "USD",
  "billing_cycle": "monthly",
  "features": ["Unlimited students", "Priority support", "Custom integrations"],
  "is_popular": false
}
```

**Response 201**: Created plan object

**Errors**: 400 (validation), 401, 403

### PUT /plans/{id}
Updates a plan tier.

**Request**:
```json
{
  "name": "Enterprise Plus",
  "price": 349.99,
  "features": ["Unlimited students", "Priority support", "Custom integrations", "SLA"]
}
```

**Response 200**: Updated plan object

**Errors**: 400, 401, 403, 404, 409 (has active subscribers for destructive changes)

### DELETE /plans/{id}
Retires a plan tier (soft delete).

**Response 204**: No content

**Errors**: 401, 403, 404, 409 (has active subscribers)

## Subscriptions Endpoints

### GET /subscriptions
Lists all subscriptions across tenants.

**Query Parameters**:
- `page`, `limit`, `status`, `plan_id`, `tenant_id`

**Response 200**: Paginated list of subscriptions with tenant info

**Errors**: 401, 403

### POST /subscriptions/{id}/change-plan
Changes a tenant's plan with proration preview.

**Request**:
```json
{
  "new_plan_id": 3,
  "effective_date": "2026-05-01"  // optional, defaults to immediate
}
```

**Response 200**:
```json
{
  "proration": {
    "credit_amount": 15.50,
    "charge_amount": 84.49,
    "net_amount": 68.99,
    "currency": "USD"
  },
  "effective_date": "2026-05-01T00:00:00Z"
}
```

**Errors**: 400, 401, 403, 404

### POST /subscriptions/{id}/cancel
Cancels a subscription.

**Request**:
```json
{
  "reason": "customer_request",
  "effective_immediately": false
}
```

**Response 204**: No content

**Errors**: 400, 401, 403, 404

## Finance Endpoints

### GET /finance/summary
Returns financial KPIs.

**Response 200**:
```json
{
  "mrr": 12500.00,
  "arr": 150000.00,
  "currency": "USD",
  "outstanding_receivables": 2500.00,
  "monthly_refunds": 500.00,
  "failed_overdue_invoices": 12,
  "revenue_by_plan": [
    {"plan": "Basic", "amount": 3000.00},
    {"plan": "Premium", "amount": 9500.00}
  ]
}
```

**Errors**: 401, 403

### GET /finance/invoices
Lists invoices with filtering.

**Query Parameters**:
- `page`, `limit`, `status`, `date_from`, `date_to`, `tenant_id`

**Response 200**: Paginated invoices

**Errors**: 401, 403

### GET /finance/invoices/{id}/pdf
Downloads invoice PDF.

**Response**: PDF file with appropriate headers

**Errors**: 401, 403, 404

### POST /finance/invoices/export
Exports filtered invoices as CSV.

**Request**: Same filters as GET /finance/invoices

**Response**: CSV file download

**Errors**: 401, 403

## Analytics Endpoints

### GET /analytics/growth
Returns 12-month growth data.

**Response 200**:
```json
{
  "months": [
    {
      "month": "2025-05",
      "tenants": 120,
      "active_users": 2400,
      "students": 12000
    }
  ]
}
```

**Errors**: 401, 403

### GET /analytics/geography
Returns geographic distribution.

**Response 200**:
```json
{
  "countries": [
    {
      "country": "United States",
      "tenants": 80,
      "students": 8000
    }
  ]
}
```

**Errors**: 401, 403

### GET /analytics/leaderboard
Returns top tenants by usage.

**Query Parameters**:
- `metric` (students|users|storage), default: students
- `limit` (int), default: 10

**Response 200**: Leaderboard entries

**Errors**: 401, 403

## Settings Endpoints

### GET /settings
Returns all platform settings.

**Response 200**:
```json
{
  "platform_name": "SchoolLedger",
  "support_email": "support@schoolledger.com",
  "default_currency": "USD",
  "default_timezone": "UTC",
  "tagline": "Empowering Education",
  "tax_rate": 0.1,
  "trial_length_days": 30,
  "invoice_prefix": "SL-",
  "enforce_2fa": true,
  "enforce_sso": false,
  "auto_suspend_after_failed_payments": 3,
  "weekly_security_digest": true,
  "email_templates": {
    "welcome": {...},
    "trial_ending": {...}
  }
}
```

**Errors**: 401, 403

### PUT /settings
Updates platform settings.

**Request**: Partial settings object

**Response 200**: Updated settings

**Errors**: 400, 401, 403

### GET /team
Lists platform team members.

**Response 200**:
```json
{
  "data": [
    {
      "id": 1,
      "name": "Admin User",
      "email": "admin@example.com",
      "platform_role": "Owner",
      "two_factor_enabled": true,
      "last_login_at": "2026-04-21T10:00:00Z",
      "created_at": "2026-01-01T00:00:00Z"
    }
  ]
}
```

**Errors**: 401, 403

### POST /team/invite
Invites a new team member.

**Request**:
```json
{
  "email": "newadmin@example.com",
  "platform_role": "Admin"
}
```

**Response 204**: No content

**Errors**: 400, 401, 403, 409

### DELETE /team/{id}
Removes a team member.

**Response 204**: No content

**Errors**: 401, 403, 404, 409 (cannot remove last Owner)

### PUT /team/{id}/role
Changes a team member's role.

**Request**:
```json
{
  "platform_role": "Finance"
}
```

**Response 204**: No content

**Errors**: 400, 401, 403, 404

### GET /api-keys
Lists API keys.

**Response 200**:
```json
{
  "data": [
    {
      "id": 1,
      "label": "Billing Integration",
      "key_prefix": "sl_ak_1a2b",
      "last_used_at": "2026-04-20T15:30:00Z",
      "expires_at": null,
      "revoked_at": null,
      "created_at": "2026-04-01T00:00:00Z"
    }
  ]
}
```

**Errors**: 401, 403

### POST /api-keys
Creates a new API key.

**Request**:
```json
{
  "label": "New Integration",
  "expires_at": "2027-04-21T00:00:00Z"  // optional
}
```

**Response 201**:
```json
{
  "id": 2,
  "label": "New Integration",
  "key": "sl_ak_1a2b3c4d5e6f7g8h9i0j",  // Raw key shown only once
  "key_prefix": "sl_ak_1a2b",
  "expires_at": "2027-04-21T00:00:00Z",
  "created_at": "2026-04-21T10:00:00Z"
}
```

**Errors**: 400, 401, 403

### DELETE /api-keys/{id}
Revokes an API key.

**Response 204**: No content

**Errors**: 401, 403, 404

## Error Response Format

All error responses follow this structure:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Invalid input data",
    "details": {
      "email": ["Invalid email format"]
    }
  }
}
```

Common error codes:
- `UNAUTHORIZED` (401): Invalid or expired token
- `FORBIDDEN` (403): Insufficient permissions
- `NOT_FOUND` (404): Resource not found
- `VALIDATION_FAILED` (400): Invalid input
- `RATE_LIMITED` (429): Too many requests
- `CONFLICT` (409): Resource state conflict
