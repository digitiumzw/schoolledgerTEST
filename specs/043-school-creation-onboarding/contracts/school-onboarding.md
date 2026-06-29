# Contract: School-Side Onboarding API

**Feature**: `043-school-creation-onboarding`  
**Base path**: `/api/onboarding`  
**Auth**: `JWTAuthFilter` — role MUST be `admin`; `onboarding_complete = 0` (enforced per endpoint)  
**Response envelope**: `{ "status": "success"|"error", "data": {...}, "message": "..." }`

---

## Auth: POST /api/auth/login (updated response)

The existing login endpoint now includes two additional fields in the `user` object when the login belongs to a school admin:

```json
{
  "status": "success",
  "message": "Login successful",
  "data": {
    "token": "<jwt>",
    "user": {
      "id": "u-abc123",
      "tenantId": "t-def456",
      "email": "admin@greenwoodacademy.co.zw",
      "name": "",
      "role": "admin",
      "status": "active",
      "is_temp_password": true,
      "onboarding_complete": false
    }
  }
}
```

| New field | Type | Description |
|-----------|------|-------------|
| `is_temp_password` | boolean | `true` if the user was provisioned and has not yet changed their password |
| `onboarding_complete` | boolean | `false` until `POST /api/onboarding/complete` succeeds |

> The frontend `AuthContext` stores these flags. `App.tsx` redirects any admin with `onboarding_complete = false` to `/onboarding`.

---

## GET /api/onboarding/progress

Returns the current onboarding progress for the authenticated admin.

### Response — 200 OK

```json
{
  "status": "success",
  "message": "OK",
  "data": {
    "current_step": "contact",
    "completed_steps": ["password", "profile"],
    "school_name": "Greenwood Academy",
    "admin_email": "admin@greenwoodacademy.co.zw"
  }
}
```

| Field | Description |
|-------|-------------|
| `current_step` | Step to resume on |
| `completed_steps` | Array of already-completed step IDs |
| `school_name` | Pre-filled from `tenants.name` — read-only in wizard |
| `admin_email` | Pre-filled from `users.email` — read-only in wizard |

---

## POST /api/onboarding/progress

Saves progress for a completed wizard step. Can be called after each step to persist partial data.

### Request

```json
{
  "step": "profile",
  "data": {
    "admin_name": "Jane Moyo"
  }
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `step` | string | Yes | One of: `password`, `profile`, `contact`, `work-hours`, `academic-calendar`, `fee-structure` |
| `data` | object | Yes | Step-specific payload (see per-step schemas below) |

### Step Data Schemas

**`profile`**
```json
{ "admin_name": "Jane Moyo" }
```

**`contact`**
```json
{
  "contact_email": "info@greenwoodacademy.co.zw",
  "address": "15 Harare Drive, Harare, Zimbabwe"
}
```

**`work-hours`**
```json
{
  "staff_work_hours":   { "startTime": "08:00", "endTime": "17:00" },
  "student_work_hours": { "startTime": "08:00", "endTime": "15:30" }
}
```

**`academic-calendar`**
```json
{
  "terms": [
    { "name": "Term 1", "startDate": "2026-01-12", "endDate": "2026-04-03" },
    { "name": "Term 2", "startDate": "2026-05-05", "endDate": "2026-08-07" },
    { "name": "Term 3", "startDate": "2026-09-08", "endDate": "2026-11-27" }
  ],
  "schoolOpen": true
}
```

**`fee-structure`**
```json
{
  "defaultFees": [
    { "name": "Tuition", "amount": 250.00 }
  ],
  "classOverrides": []
}
```

### Response — 200 OK

```json
{
  "status": "success",
  "message": "Step saved.",
  "data": {
    "current_step": "contact",
    "completed_steps": ["password", "profile"]
  }
}
```

### Response — 422 Unprocessable Entity

```json
{
  "status": "error",
  "message": "Validation failed.",
  "errors": {
    "data.admin_name": "Admin name is required."
  }
}
```

---

## POST /api/onboarding/complete

Finalises onboarding. Validates all mandatory steps are complete, activates the tenant (`status = 'trialing'`), enrolls the 3-month unlimited trial, and sets `onboarding_complete = 1` on the user.

### Request

No body required. All data has been saved via `POST /api/onboarding/progress`.

### Response — 200 OK

```json
{
  "status": "success",
  "message": "Onboarding complete. Your school is now active.",
  "data": {
    "tenant_id": "t-def456",
    "tenant_status": "trialing",
    "subscription": {
      "plan_name": "Unlimited",
      "status": "active",
      "starts_at": "2026-04-27T09:15:00Z",
      "expires_at": "2026-07-27T09:15:00Z"
    },
    "onboarding_complete": true
  }
}
```

### Response — 422 Unprocessable Entity (incomplete steps)

```json
{
  "status": "error",
  "message": "Onboarding cannot be completed. The following steps are not yet finished.",
  "errors": {
    "missing_steps": ["contact", "fee-structure"]
  }
}
```

### Response — 500 Internal Server Error (no trial plan found)

```json
{
  "status": "error",
  "message": "Unable to enroll trial subscription. Please contact support.",
  "errors": {}
}
```

---

## POST /api/onboarding/change-password

Optional step — allows the admin to set a new permanent password during onboarding. Can be called when `step = 'password'` is submitted, or skipped entirely.

### Request

```json
{
  "new_password": "MyNewSecurePass1!",
  "confirm_password": "MyNewSecurePass1!"
}
```

| Field | Type | Required | Rule |
|-------|------|----------|------|
| `new_password` | string | Yes | Min 8 chars |
| `confirm_password` | string | Yes | Must match `new_password` |

### Response — 200 OK

```json
{
  "status": "success",
  "message": "Password updated successfully.",
  "data": {
    "is_temp_password": false
  }
}
```

### Response — 422 Unprocessable Entity

```json
{
  "status": "error",
  "message": "Validation failed.",
  "errors": {
    "confirm_password": "Passwords do not match."
  }
}
```
