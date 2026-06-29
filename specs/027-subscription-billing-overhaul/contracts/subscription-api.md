# API Contract: Subscription Billing Overhaul

**Branch**: `027-subscription-billing-overhaul` | **Date**: 2026-04-13

---

## Changed Endpoints

### GET /api/subscription/current

**Change**: `recommendedPlanId` in the response now always returns the ID of the plan with the highest `sort_order` (i.e., the Enterprise plan). Previously it was dynamically computed from student count thresholds.

**Response shape** (unchanged):
```json
{
  "status": true,
  "message": "Success",
  "data": {
    "subscription": { ... } | null,
    "studentCount": 42,
    "recommendedPlanId": "enterprise",
    "isExpired": false,
    "isOverLimit": false,
    "daysUntilExpiry": 28
  }
}
```

---

### GET /api/subscription/poll/{transactionId}

**Change**: Short-circuits on terminal states. If the transaction status is already `paid`, `failed`, or `cancelled`, returns the cached status immediately without calling the Paynow gateway.

**Optimised behaviour**:

| `tx.status` | Action | `paid` | `paynowStatus` | `subscriptionStatus` |
|-------------|--------|--------|----------------|----------------------|
| `paid` | Return cached — no Paynow call | `true` | `"paid"` | `"active"` |
| `failed` | Return cached — no Paynow call | `false` | `"failed"` | `"failed"` |
| `cancelled` | Return cached — no Paynow call | `false` | `"cancelled"` | `"cancelled"` |
| `initiated` | Poll Paynow as before | varies | Paynow status string | varies |

**Response shape** (unchanged):
```json
{
  "status": true,
  "message": "Success",
  "data": {
    "paid": true,
    "paynowStatus": "Paid",
    "subscriptionStatus": "active"
  }
}
```

**Cancellation response example**:
```json
{
  "status": true,
  "message": "Success",
  "data": {
    "paid": false,
    "paynowStatus": "Cancelled",
    "subscriptionStatus": "cancelled"
  }
}
```

---

## Removed Endpoints

### POST /api/subscription/initiate-ecocash

**Status**: REMOVED from `Routes.php`. Route no longer registered.  
**Previously**: Initiated an EcoCash / OneMoney USSD push payment without browser redirect.  
**Reason**: EcoCash mobile-money (no redirect) feature is removed per FR-001.

---

## Unchanged Endpoints

The following endpoints are not modified:

| Method | Path | Notes |
|--------|------|-------|
| GET | /api/subscription/plans | Returns active plans — no change |
| GET | /api/subscription/history | Returns subscriptions + transactions — no change |
| POST | /api/subscription/initiate | Initiates Paynow web payment — no change |
| POST | /api/subscription/webhook | Paynow callback handler — no change |
| GET | /api/subscription/invoices | Lists invoices — no change |
| GET | /api/subscription/invoices/{id}/download | PDF download — no change |
| GET | /api/subscription/events | Paginated billing events — no change |

---

## Frontend API Layer Changes (`src/api/api.ts`)

**Removed function**:
```typescript
// REMOVED — EcoCash feature deleted
initiateEcocashSubscription(planId, billingCycle, phone, method, email)
```

**Removed types**:
```typescript
// REMOVED — no longer needed
interface InitiateEcocashResponse { ... }
```

All other API functions and types are unchanged.
