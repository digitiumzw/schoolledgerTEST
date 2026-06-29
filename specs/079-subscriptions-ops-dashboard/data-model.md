# Data Model: Subscriptions Operations Dashboard

**Branch**: `079-subscriptions-ops-dashboard`  
**Date**: 2026-05-21

## Overview

No new database migrations are required for this feature. All enriched data is derived at query time from five existing platform tables.

---

## Existing Tables Used

### `school_subscriptions` (primary)

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(36) | UUID PK |
| `tenant_id` | VARCHAR(36) | FK → tenants.id |
| `plan_id` | VARCHAR(36) | FK → subscription_plans.id |
| `billing_cycle` | ENUM('monthly','annual') | |
| `status` | VARCHAR(32) | active, expired, cancelled, superseded, pending, trialing, trial |
| `starts_at` | DATETIME | Subscription start |
| `expires_at` | DATETIME NULL | Subscription end; NULL = open-ended |
| `cancelled_at` | DATETIME NULL | Set when cancelled |
| `activated_at` | DATETIME NULL | |
| `amount_paid_cents` | INT | Total paid for this subscription period |
| `pending_plan_id` | VARCHAR(36) NULL | Pending plan change |
| `pending_change_effective_at` | DATETIME NULL | |
| `pending_change_type` | VARCHAR(32) NULL | |
| `created_at` | DATETIME | |
| `updated_at` | DATETIME | |

### `subscription_plans`

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(36) | UUID PK |
| `name` | VARCHAR(100) | Plan display name |
| `description` | TEXT NULL | |
| `max_students` | INT NULL | NULL = unlimited |
| `monthly_price_cents` | INT | Stored in cents |
| `annual_price_cents` | INT | Stored in cents |
| `annual_discount_pct` | DECIMAL(5,2) | |
| `currency` | VARCHAR(3) | Default 'USD' |
| `is_active` | TINYINT(1) | 1 = available for new subscriptions |
| `sort_order` | INT | |

### `subscription_payment_transactions`

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(36) | UUID PK |
| `subscription_id` | VARCHAR(36) | FK → school_subscriptions.id (used for payment_status lookup) |
| `tenant_id` | VARCHAR(36) | |
| `amount_cents` | INT | |
| `status` | VARCHAR(32) | `initiated`, `completed`, `failed` |
| `created_at` | DATETIME | Used for latest-transaction ordering |

### `subscription_invoices`

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(36) | UUID PK |
| `tenant_id` | VARCHAR(36) | |
| `transaction_id` | VARCHAR(36) NULL | FK → subscription_payment_transactions.id |
| `amount_cents` | INT | |
| `issued_at` | DATETIME | Used for monthly revenue aggregation |

### `tenants`

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(36) | UUID PK |
| `name` | VARCHAR(255) NULL | School name |
| `email` | VARCHAR(255) NULL | Primary contact email |
| `status` | VARCHAR(32) | active, suspended, trialing |

---

## API Response Shapes (derived / enriched)

### `GET /api/platform/finance/summary` — extended response

```json
{
  "total_revenue": 12450.00,
  "pending_amount": 0.00,
  "failed_amount": 75.00,
  "invoice_count": 48,
  "mrr": 625.00,
  "failed_payments_count": 3,
  "renewals_due_count": 7,
  "monthly_churn_count": 2
}
```

**New field derivations**:
- `failed_payments_count`: Count of active subscriptions whose most recent payment transaction has `status = 'failed'`
- `renewals_due_count`: Count of `school_subscriptions` WHERE `status = 'active'` AND `expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 30 DAY)`
- `monthly_churn_count`: Count of `school_subscriptions` WHERE `YEAR(cancelled_at) = YEAR(NOW()) AND MONTH(cancelled_at) = MONTH(NOW())`

---

### `GET /api/platform/subscriptions` — extended row shape

```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "tenant_name": "Greenwood Academy",
  "tenant_email": "admin@greenwood.co.zw",
  "plan_id": "uuid",
  "plan_name": "Pro",
  "billing_cycle": "annual",
  "status": "active",
  "starts_at": "2025-01-01 00:00:00",
  "expires_at": "2026-01-01 00:00:00",
  "cancelled_at": null,
  "monthly_price": 25.00,
  "annual_price": 250.00,
  "max_students": 500,
  "payment_status": "completed",
  "alerts": ["expiring_soon"],
  "pending_plan_id": null,
  "pending_change_effective_at": null,
  "pending_change_type": null
}
```

**New fields**:
- `max_students` (INT | null): From `subscription_plans.max_students`. `null` = unlimited.
- `payment_status` (string | null): Status of the most recent `subscription_payment_transactions` row for this subscription. Values: `initiated`, `completed`, `failed`, `null` (no transaction recorded).
- `alerts` (string[]): Computed in PHP from other fields. Possible values:
  - `"payment_failed"` — when `payment_status = 'failed'`
  - `"expiring_soon"` — when `status = 'active'` AND `expires_at` within 30 days
  - `"trial_ending"` — when `status IN ('trialing', 'trial')`

---

### Extended query parameters for `GET /api/platform/subscriptions`

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | int | Existing |
| `limit` | int | Existing (max 100) |
| `status` | string | Existing — subscription lifecycle status |
| `q` | string | **New** — search by tenant name or email (LIKE) |
| `plan_id` | string | **New** — filter by subscription_plans.id |
| `billing_cycle` | string | **New** — `monthly` or `annual` |
| `payment_status` | string | **New** — `initiated`, `completed`, or `failed` |
| `expiring_soon` | boolean | **New** — when `1`/`true`, show only subscriptions expiring within 30 days |

---

## Frontend Type Changes (`frontend/src/admin/pages/Subscriptions.tsx`)

Extend the local `Subscription` type:

```typescript
type Subscription = {
  // existing fields...
  max_students: number | null;        // new
  payment_status: string | null;      // new
  alerts: string[];                   // new
};
```

No changes to `dashboard.ts` (platform types not stored there).

---

## Price Formatting Utility

Pure function, no data model changes:

```typescript
function formatPrice(cents: number, cycle: 'mo' | 'yr'): string {
  if (cents === 0) return 'Free';
  const amount = cents / 100;
  const formatted = Number.isInteger(amount)
    ? `$${amount}`
    : `$${amount.toFixed(2).replace(/\.?0+$/, '')}`;
  return `${formatted}/${cycle}`;
}
```

Produces: `$25/mo`, `$9.99/mo`, `$240/yr`, `Free`.
