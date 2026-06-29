# API Contract: Subscription Endpoints

**Feature**: `024-paynow-subscriptions`  
**Base path**: `/api/subscription`  
**Auth**: All routes require `Authorization: Bearer <jwt>` except where noted as **public**.  
**Tenant scope**: All responses are scoped to the `tenant_id` decoded from the JWT.

---

## Standard Response Envelope

All endpoints return JSON in the SchoolLedger standard envelope:

```json
{ "status": true|false, "message": "...", "data": <payload> }
```

Errors additionally include an `"errors"` field when validation details are available.

---

## GET /api/subscription/plans

Returns all active subscription plan definitions (for the plan selector UI).

**Auth**: Required (any role)  
**Request**: None

**Response 200**:
```json
{
  "status": true,
  "message": "Success",
  "data": [
    {
      "id": "free",
      "name": "Free",
      "description": "For schools with fewer than 50 students",
      "maxStudents": 49,
      "monthlyPriceCents": 0,
      "annualPriceCents": 0,
      "currency": "USD",
      "sortOrder": 1
    },
    {
      "id": "standard",
      "name": "Standard",
      "description": "For schools with fewer than 250 students",
      "maxStudents": 249,
      "monthlyPriceCents": 1500,
      "annualPriceCents": 15000,
      "currency": "USD",
      "sortOrder": 2
    },
    {
      "id": "advanced",
      "name": "Advanced",
      "description": "For schools with fewer than 350 students",
      "maxStudents": 349,
      "monthlyPriceCents": 2500,
      "annualPriceCents": 25000,
      "currency": "USD",
      "sortOrder": 3
    },
    {
      "id": "enterprise",
      "name": "Enterprise",
      "description": "For schools with 350 or more students",
      "maxStudents": null,
      "monthlyPriceCents": 4000,
      "annualPriceCents": 40000,
      "currency": "USD",
      "sortOrder": 4
    }
  ]
}
```

---

## GET /api/subscription/current

Returns the current active (or most recent) subscription for the authenticated tenant, plus the current student count and recommended plan.

**Auth**: Required (any role)  
**Request**: None

**Response 200** (active subscription exists):
```json
{
  "status": true,
  "message": "Success",
  "data": {
    "subscription": {
      "id": "uuid",
      "planId": "standard",
      "planName": "Standard",
      "billingCycle": "monthly",
      "status": "active",
      "startsAt": "2026-04-01T00:00:00Z",
      "expiresAt": "2026-05-01T00:00:00Z",
      "amountPaidCents": 1500,
      "currency": "USD",
      "activatedAt": "2026-04-01T08:32:00Z"
    },
    "studentCount": 87,
    "recommendedPlanId": "standard",
    "isExpired": false,
    "isOverLimit": false,
    "daysUntilExpiry": 21
  }
}
```

**Response 200** (no subscription):
```json
{
  "status": true,
  "message": "Success",
  "data": {
    "subscription": null,
    "studentCount": 12,
    "recommendedPlanId": "free",
    "isExpired": false,
    "isOverLimit": false,
    "daysUntilExpiry": null
  }
}
```

---

## POST /api/subscription/activate-free

Activates the Free plan for a tenant with fewer than 50 students. No payment required.

**Auth**: Required (role: `admin` or `super_admin`)  
**Request body**: None

**Response 201**:
```json
{
  "status": true,
  "message": "Free plan activated successfully",
  "data": {
    "subscriptionId": "uuid",
    "planId": "free",
    "status": "active"
  }
}
```

**Response 400** (student count ≥ 50):
```json
{
  "status": false,
  "message": "Your school has too many students for the Free plan. Please select a paid plan."
}
```

**Response 409** (already active):
```json
{
  "status": false,
  "message": "An active subscription already exists."
}
```

---

## POST /api/subscription/initiate

Initiates a paid subscription payment via Paynow. Creates a pending subscription and transaction, and returns the Paynow redirect URL.

**Auth**: Required (role: `admin` or `super_admin`)

**Request body**:
```json
{
  "planId": "standard",
  "billingCycle": "monthly"
}
```

**Validation**:
- `planId`: required, must exist in `subscription_plans`, must not be `free`
- `billingCycle`: required, `monthly` or `annual`

**Response 201**:
```json
{
  "status": true,
  "message": "Payment initiated",
  "data": {
    "subscriptionId": "uuid",
    "transactionId": "uuid",
    "redirectUrl": "https://www.paynow.co.zw/payment/link/...",
    "ourReference": "SUB-tenant123-1744286400"
  }
}
```

**Response 400** (validation failure):
```json
{
  "status": false,
  "message": "Validation failed",
  "errors": { "planId": "Invalid plan selected." }
}
```

**Response 422** (Paynow initiation failed):
```json
{
  "status": false,
  "message": "Payment gateway error. Please try again.",
  "errors": { "gateway": "Paynow returned: ..." }
}
```

---

## POST /api/subscription/webhook

Receives Paynow payment status callbacks. Verifies the Paynow hash, updates the transaction, and activates the subscription on confirmed payment.

**Auth**: **PUBLIC** — no JWT required (Paynow server-to-server callback)  
**Security**: Paynow hash verification (MD5 of ordered fields + integration key)

**Request**: `application/x-www-form-urlencoded` (Paynow POST format)
```
reference=SUB-tenant123-1744286400&paynowreference=12345678&amount=15.00&status=Paid&hash=ABCDEF...
```

**Response 200** (success or already processed):
```
Received
```
*(Paynow expects plain text "Received" to acknowledge the webhook)*

**Response 400** (hash verification failed):
```
Invalid hash
```

**Behaviour**:
1. Look up `subscription_payment_transactions` by `our_reference = reference`.
2. Verify hash. Reject if invalid.
3. If `status = Paid` and transaction not yet `paid`:
   - Update transaction to `paid`, set `completed_at`.
   - Activate the linked `school_subscriptions` row: `status = active`, set `starts_at` and `expires_at`.
   - Set any previous `active` subscription for same tenant to `superseded`.
4. If `status` is `Failed` or `Cancelled`: update transaction accordingly. Do not activate subscription.
5. If already processed (`paid`): return 200 silently (idempotent).

---

## GET /api/subscription/history

Returns all past subscription periods and payment transactions for the authenticated tenant.

**Auth**: Required (role: `admin`, `super_admin`, or `bursar`)

**Response 200**:
```json
{
  "status": true,
  "message": "Success",
  "data": {
    "subscriptions": [
      {
        "id": "uuid",
        "planId": "standard",
        "planName": "Standard",
        "billingCycle": "monthly",
        "status": "expired",
        "startsAt": "2026-03-01T00:00:00Z",
        "expiresAt": "2026-04-01T00:00:00Z",
        "amountPaidCents": 1500,
        "currency": "USD"
      }
    ],
    "transactions": [
      {
        "id": "uuid",
        "ourReference": "SUB-tenant123-...",
        "paynowReference": "12345678",
        "amountCents": 1500,
        "currency": "USD",
        "status": "paid",
        "initiatedAt": "2026-03-01T07:00:00Z",
        "completedAt": "2026-03-01T07:05:00Z"
      }
    ]
  }
}
```

---

## Error Codes Summary

| HTTP Status | Meaning |
|-------------|---------|
| 200 | Success |
| 201 | Resource created |
| 400 | Validation error or bad request |
| 401 | JWT missing or expired |
| 403 | Insufficient role |
| 409 | Conflict (e.g., active subscription already exists) |
| 422 | Unprocessable — downstream gateway error |
| 500 | Internal server error |

---

## Route Registration Summary (Routes.php)

```php
$routes->group('subscription', function ($routes) {
    $routes->get('plans',           'SubscriptionController::plans');
    $routes->get('current',         'SubscriptionController::current');
    $routes->get('history',         'SubscriptionController::history');
    $routes->post('activate-free',  'SubscriptionController::activateFree');
    $routes->post('initiate',       'SubscriptionController::initiate');
});

// Public webhook — outside JWT filter (see Filters.php except list)
$routes->post('api/subscription/webhook', 'App\Controllers\Api\SubscriptionController::webhook');
```
