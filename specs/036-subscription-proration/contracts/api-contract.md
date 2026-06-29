# API Contract: Subscription Proration

**Feature**: 036-subscription-proration  
**Base URL**: `/api/subscription`  
**Authentication**: JWT Bearer token required (except webhook)

---

## Endpoints

### POST /api/subscription/calculate-proration

Calculates proration for a potential plan change. Returns breakdown without creating any records.

**Authorization**: `admin`, `super_admin`

**Request Body**:
```json
{
  "targetPlanId": "string",      // Required: UUID of plan to switch to
  "billingCycle": "monthly"      // Optional: "monthly" | "annual" (defaults to current cycle)
}
```

**Response 200 OK**:
```json
{
  "success": true,
  "data": {
    "calculationId": "uuid",
    "originalPlan": {
      "id": "uuid",
      "name": "Basic Plan",
      "priceCents": 10000,
      "currency": "USD"
    },
    "newPlan": {
      "id": "uuid", 
      "name": "Pro Plan",
      "priceCents": 20000,
      "currency": "USD"
    },
    "billingCycle": "monthly",
    "cycleDates": {
      "startDate": "2026-04-01",
      "endDate": "2026-04-30",
      "daysInCycle": 30,
      "daysRemaining": 15
    },
    "proration": {
      "unusedValueCreditCents": 5000,
      "proratedChargeCents": 10000,
      "netAmountCents": 5000,
      "isUpgrade": true,
      "isDowngrade": false
    },
    "breakdown": {
      "dailyRateOriginalCents": 333,
      "dailyRateNewCents": 667,
      "formula": "(price / days) * remaining"
    }
  }
}
```

**Response 400 Bad Request**:
```json
{
  "success": false,
  "error": "Validation failed",
  "errors": {
    "targetPlanId": "Invalid plan selected"
  }
}
```

**Response 422 Unprocessable**:
```json
{
  "success": false,
  "error": "Downgrade blocked",
  "data": {
    "downgradeBlocked": true,
    "studentCount": 150,
    "planLimit": 100
  }
}
```

---

### POST /api/subscription/upgrade-with-proration

Initiates a plan upgrade/downgrade with proration. Creates pending subscription and processes payment.

**Authorization**: `admin`, `super_admin`

**Request Body**:
```json
{
  "calculationId": "uuid",       // Required: From calculate-proration response
  "paymentMethod": "paynow"      // Optional: "paynow" | "ecocash" | "onemoney" (default: paynow)
}
```

**Response 201 Created**:
```json
{
  "success": true,
  "message": "Upgrade initiated",
  "data": {
    "subscriptionId": "uuid",
    "transactionId": "uuid",
    "redirectUrl": "https://paynow.co.zw/...",
    "ourReference": "SUB-tenant-timestamp",
    "prorationApplied": {
      "creditUsedCents": 5000,
      "amountToChargeCents": 5000
    }
  }
}
```

**Response 409 Conflict** (calculation expired):
```json
{
  "success": false,
  "error": "Calculation expired",
  "message": "Please recalculate proration"
}
```

---

### GET /api/subscription/credits

Returns active credit balance for the tenant.

**Authorization**: `admin`, `super_admin`, `bursar`

**Response 200 OK**:
```json
{
  "success": true,
  "data": {
    "totalCreditsCents": 5000,
    "currency": "USD",
    "credits": [
      {
        "id": "uuid",
        "initialAmountCents": 5000,
        "remainingAmountCents": 5000,
        "reason": "downgrade_proration",
        "createdAt": "2026-04-15T10:30:00Z",
        "expiresAt": null
      }
    ]
  }
}
```

---

### GET /api/subscription/proration-history

Returns history of all proration calculations for the tenant.

**Authorization**: `admin`, `super_admin`, `bursar`

**Query Parameters**:
- `page` (int, default: 1)
- `perPage` (int, default: 20, max: 50)

**Response 200 OK**:
```json
{
  "success": true,
  "data": {
    "calculations": [
      {
        "id": "uuid",
        "originalPlanName": "Basic Plan",
        "newPlanName": "Pro Plan",
        "billingCycle": "monthly",
        "netAmountCents": 5000,
        "status": "confirmed",
        "createdAt": "2026-04-15T10:30:00Z",
        "confirmedAt": "2026-04-15T10:35:00Z"
      }
    ],
    "total": 15,
    "page": 1,
    "perPage": 20
  }
}
```

---

## Webhook Integration

The existing webhook endpoint `/api/subscription/webhook` is extended to handle prorated upgrades:

### Payment Success Flow

1. Webhook receives `status: paid` for prorated transaction
2. System:
   - Activates new subscription
   - Supersedes old subscription
   - Records billing event `plan_upgraded` or `plan_downgraded`
   - If net credit, creates `subscription_credits` record
3. Old subscription status set to `superseded`

### Payment Failure Flow

1. Webhook receives `status: failed` or `cancelled`
2. System:
   - Cancels pending new subscription
   - Releases any held credit
   - Keeps original subscription active
   - Records billing event `upgrade_failed`

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `PRORATION_CALCULATION_EXPIRED` | 409 | Calculation older than 30 minutes |
| `INSUFFICIENT_CREDIT` | 400 | Credit balance check failed |
| `DOWNGRADE_BLOCKED` | 422 | Student count exceeds new plan limit |
| `PAYMENT_FAILED` | 422 | Prorated charge payment failed |
| `PLAN_NOT_FOUND` | 400 | Target plan doesn't exist |
| `NO_ACTIVE_SUBSCRIPTION` | 400 | Cannot prorate without active subscription |

---

## State Machine

```
CALCULATED → CONFIRMED → PAID → ACTIVE
    ↓           ↓         ↓
CANCELLED   EXPIRED   FAILED
```

- `CALCULATED`: Initial state from `calculate-proration`
- `CONFIRMED`: User confirmed upgrade
- `PAID`: Payment webhook received
- `ACTIVE`: New subscription activated
- `CANCELLED`: User cancelled before payment
- `EXPIRED`: Calculation > 30 min old
- `FAILED`: Payment failed
