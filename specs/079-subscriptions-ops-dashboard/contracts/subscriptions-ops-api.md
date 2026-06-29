# API Contract: Subscriptions Operations Dashboard

**Branch**: `079-subscriptions-ops-dashboard`  
**Date**: 2026-05-21  
**Base URL**: `GET /api/platform/` (all routes protected by `platform-jwt-auth` filter)

---

## 1. GET /api/platform/finance/summary

**Auth**: Platform JWT required. Role: Owner, Admin, or Finance (`canViewFinance`).

### Request
No parameters.

### Response — Extended

```json
{
  "status": "success",
  "data": {
    "total_revenue": 12450.00,
    "pending_amount": 150.00,
    "failed_amount": 75.00,
    "invoice_count": 48,
    "mrr": 625.00,
    "failed_payments_count": 3,
    "renewals_due_count": 7,
    "monthly_churn_count": 2
  },
  "message": "OK"
}
```

### New Fields

| Field | Type | Description |
|-------|------|-------------|
| `failed_payments_count` | int | Count of active subscriptions whose most recent `subscription_payment_transactions` row has `status = 'failed'` |
| `renewals_due_count` | int | Count of active subscriptions with `expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 30 DAY)` |
| `monthly_churn_count` | int | Count of subscriptions with `cancelled_at` in the current calendar month |

### Error Responses

| Status | When |
|--------|------|
| 401 | Missing or invalid platform JWT |
| 403 | Platform user role does not have finance access |

---

## 2. GET /api/platform/subscriptions

**Auth**: Platform JWT required. Role: any authenticated platform user.

### Request — Extended Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | int | no | 1 | Page number |
| `limit` | int | no | 25 | Rows per page (max 100) |
| `status` | string | no | — | Lifecycle status: `active`, `expired`, `cancelled`, `pending`, `superseded`, `trialing`, `trial` |
| `q` | string | no | — | Search: matches `t.name LIKE '%q%' OR t.email LIKE '%q%'` |
| `plan_id` | string (UUID) | no | — | Filter by exact `subscription_plans.id` |
| `billing_cycle` | string | no | — | `monthly` or `annual` |
| `payment_status` | string | no | — | `initiated`, `completed`, or `failed` — matches most recent transaction |
| `expiring_soon` | `1` / `true` | no | — | When truthy: only subscriptions with `expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 30 DAY)` |

### Response

```json
{
  "status": "success",
  "data": [
    {
      "id": "abc123",
      "tenant_id": "t001",
      "tenant_name": "Greenwood Academy",
      "tenant_email": "admin@greenwood.co.zw",
      "plan_id": "p001",
      "plan_name": "Pro",
      "billing_cycle": "annual",
      "status": "active",
      "starts_at": "2025-01-15 00:00:00",
      "expires_at": "2026-01-15 00:00:00",
      "cancelled_at": null,
      "monthly_price": 25.00,
      "annual_price": 250.00,
      "max_students": 500,
      "payment_status": "completed",
      "alerts": ["expiring_soon"],
      "pending_plan_id": null,
      "pending_change_effective_at": null,
      "pending_change_type": null,
      "created_at": "2025-01-15 00:00:00",
      "updated_at": "2025-01-15 00:00:00"
    }
  ],
  "message": "OK",
  "meta": {
    "page": 1,
    "limit": 25,
    "total": 47,
    "last_page": 2,
    "active_count": 32
  }
}
```

### Row Fields — New

| Field | Type | Description |
|-------|------|-------------|
| `max_students` | int \| null | From `subscription_plans.max_students`. `null` = unlimited |
| `payment_status` | string \| null | Status of the most recent payment transaction for this subscription. Values: `initiated`, `completed`, `failed`. `null` if no transaction exists |
| `alerts` | string[] | Computed array of alert codes: `payment_failed`, `expiring_soon`, `trial_ending` |

### Alert Code Derivation Rules

| Code | Condition |
|------|-----------|
| `payment_failed` | `payment_status === 'failed'` |
| `expiring_soon` | `status === 'active'` AND `expires_at` is non-null AND within 30 days of now |
| `trial_ending` | `status IN ('trialing', 'trial')` |

### Error Responses

| Status | When |
|--------|------|
| 401 | Missing or invalid platform JWT |

---

## 3. POST /api/platform/subscriptions/:id/cancel (unchanged)

No changes to this endpoint. Documented here for reference.

**Auth**: Role: Owner, Admin, or Finance (`canManageSubscriptions`).  
**Response**: `{ "status": "success", "data": null, "message": "Subscription cancelled" }`  
**Error**: 404 if subscription not found; 403 if insufficient role.

---

## 4. POST /api/platform/subscriptions/:id/change-plan (unchanged)

No changes to this endpoint. Documented here for reference.

**Auth**: Role: Owner, Admin, or Finance (`canManageSubscriptions`).  
**Body**: `{ "plan_id": "<uuid>" }`  
**Response**: Updated subscription row.  
**Error**: 404 if not found; 422 if transition blocked (e.g., annual → monthly); 403 if insufficient role.

---

## 5. POST /api/platform/subscriptions/assign (unchanged)

No changes to this endpoint. Documented here for reference.

**Auth**: Role: Owner, Admin, or Finance (`canManageSubscriptions`).  
**Body**: `{ "tenant_id": "", "plan_id": "", "billing_cycle": "monthly|annual", "starts_at": "YYYY-MM-DD", "expires_at": "YYYY-MM-DD" }`  
**Response**: Newly created subscription row (HTTP 201).  
**Error**: 422 for invalid dates or blocked transitions; 404 for unknown tenant/plan; 403 for insufficient role.

---

## Frontend Integration Notes

### `platform.ts` — `getSubscriptions` param type extension

```typescript
export const getSubscriptions = (params: {
  page?: number;
  limit?: number;
  status?: string;
  q?: string;           // new
  plan_id?: string;     // new
  billing_cycle?: string; // new
  payment_status?: string; // new
  expiring_soon?: boolean; // new
} = {}) => { ... }
```

### `Subscriptions.tsx` — React Query key must include all filter params

```typescript
queryKey: ["platform-subscriptions", page, statusFilter, search, planFilter, cycleFilter, paymentStatusFilter, expiringSoon]
```

### Debounce

Search input (`q`) is debounced 400 ms before being included in the query key and request. Other filter selects trigger immediately on change (reset `page` to 1).
