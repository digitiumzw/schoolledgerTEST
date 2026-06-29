# Data Model: Billing Plans Management

**Branch**: `026-billing-plans-management` | **Date**: 2026-04-12

---

## Existing Tables (modified)

### `subscription_plans`

No schema change. Data changes only:
- `id = 'free'` → set `is_active = 0` (via migration `2026-04-12-120000_Deactivate_free_plan.php`)
- `id = 'standard'` → rename to `id = 'starter'`, `name = 'Starter'` (via same migration)
- `id = 'advanced'` → rename to `id = 'growth'`, `name = 'Growth'` (via same migration)
- `id = 'enterprise'` → `name = 'Enterprise'` (unchanged)

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(50) PK | `starter`, `growth`, `enterprise` (active) |
| `name` | VARCHAR(100) | Display name |
| `description` | TEXT nullable | Human-readable description |
| `max_students` | INT UNSIGNED nullable | NULL = unlimited (Enterprise) |
| `monthly_price_cents` | INT UNSIGNED | Price in cents |
| `annual_price_cents` | INT UNSIGNED | Price in cents |
| `currency` | VARCHAR(3) | e.g. `USD` |
| `is_active` | TINYINT(1) | `0` = deactivated (free plan) |
| `sort_order` | INT | 1=starter, 2=growth, 3=enterprise |

### `school_subscriptions`

No schema change. FK references to old plan IDs (`standard`, `advanced`) updated by migration.

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(36) PK UUID | |
| `tenant_id` | VARCHAR(36) FK→tenants | JWT-sourced; all queries must filter by this |
| `plan_id` | VARCHAR(50) FK→subscription_plans | |
| `billing_cycle` | ENUM('monthly','annual') | |
| `status` | ENUM('pending','active','expired','superseded','cancelled') | |
| `starts_at` | DATETIME | |
| `expires_at` | DATETIME nullable | NULL = never expires (currently unused) |
| `amount_paid_cents` | INT UNSIGNED | Copied from transaction at activation |
| `currency` | VARCHAR(3) | |
| `activated_at` | DATETIME nullable | Set when status→active |
| `cancelled_at` | DATETIME nullable | Set when status→cancelled |

**State transitions**:
```
pending ──(payment confirmed)──► active ──(expiry date reached)──► expired
pending ──(payment failed/cancelled)──► cancelled
active  ──(new plan payment confirmed)──► superseded
active  ──(renewal payment confirmed)──► superseded (old) + new active row
```

### `subscription_payment_transactions`

No schema change. Existing rows with old plan IDs are historical; unaffected.

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(36) PK UUID | |
| `tenant_id` | VARCHAR(36) FK→tenants | |
| `subscription_id` | VARCHAR(36) FK→school_subscriptions | |
| `paynow_reference` | VARCHAR(100) nullable | Paynow's reference |
| `paynow_poll_url` | TEXT nullable | |
| `our_reference` | VARCHAR(100) UNIQUE | `SUB-{tenantId}-{timestamp}` |
| `amount_cents` | INT UNSIGNED | |
| `currency` | VARCHAR(3) | |
| `status` | ENUM('initiated','paid','failed','cancelled','disputed') | |
| `paynow_status_raw` | VARCHAR(50) nullable | Raw status string from Paynow |
| `paynow_hash_verified` | TINYINT(1) | 1 = webhook hash verified |
| `webhook_payload` | JSON nullable | Full webhook POST body |
| `initiated_at` | DATETIME | |
| `completed_at` | DATETIME nullable | |

---

## New Tables

### `subscription_invoices`

Created by migration `2026-04-12-100000_Create_subscription_invoices_table.php`.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | VARCHAR(36) | PK, not null | UUID |
| `tenant_id` | VARCHAR(36) | FK→tenants, not null | All queries filter by this |
| `subscription_id` | VARCHAR(36) | FK→school_subscriptions, not null | |
| `transaction_id` | VARCHAR(36) | FK→subscription_payment_transactions, not null | Source of truth for amount |
| `invoice_number` | VARCHAR(30) | UNIQUE, not null | `INV-{tenantId_short}-{YYYYMM}-{seq}` |
| `school_name` | VARCHAR(255) | not null | Copied from tenant at generation time |
| `plan_name` | VARCHAR(100) | not null | Copied from plan at generation time |
| `billing_cycle` | ENUM('monthly','annual') | not null | |
| `amount_cents` | INT UNSIGNED | not null | Copied from transaction; never recomputed |
| `currency` | VARCHAR(3) | not null | |
| `issued_at` | DATETIME | not null | Set when invoice record is created |
| `pdf_path` | VARCHAR(500) | nullable | Relative path under `writable/invoices/`; set on first download |
| `created_at` | DATETIME | nullable | |
| `updated_at` | DATETIME | nullable | |

**Indexes**: `tenant_id`, `transaction_id` (UNIQUE), `invoice_number` (UNIQUE)

**Validation rules**:
- One invoice per `transaction_id` (UNIQUE constraint).
- `amount_cents` must be > 0 (paid subscriptions only; free plan invoices are never generated).
- `issued_at` is set at record creation time and never updated.

---

### `billing_events`

Created by migration `2026-04-12-110000_Create_billing_events_table.php`.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | VARCHAR(36) | PK, not null | UUID |
| `tenant_id` | VARCHAR(36) | FK→tenants, not null | All queries filter by this |
| `event_type` | ENUM('payment_confirmed','plan_activated','plan_upgraded','plan_downgraded','subscription_renewed','subscription_expired') | not null | Allowlisted significant types only |
| `plan_name` | VARCHAR(100) | nullable | Name of the plan at the time of the event |
| `billing_cycle` | ENUM('monthly','annual') | nullable | Applicable for payment/activation events |
| `amount_cents` | INT UNSIGNED | nullable | Populated for `payment_confirmed` events |
| `currency` | VARCHAR(3) | nullable | Populated when `amount_cents` present |
| `subscription_id` | VARCHAR(36) | nullable | FK→school_subscriptions (soft reference — no CASCADE) |
| `transaction_id` | VARCHAR(36) | nullable | FK→subscription_payment_transactions (soft reference) |
| `occurred_at` | DATETIME | not null | Business timestamp of the event |
| `created_at` | DATETIME | nullable | |
| `updated_at` | DATETIME | nullable | |

**Indexes**: `(tenant_id, occurred_at DESC)` composite for history pagination query.

**Event writing rules**:

| Trigger | Event type | Who writes |
|---------|-----------|------------|
| Paynow webhook or poll confirms `paid` + subscription activated | `payment_confirmed` then `plan_activated` | `SubscriptionController::activateSubscription()` via `BillingEventService` |
| Existing active plan superseded + new higher-tier plan activated | `plan_upgraded` | Same as above, detected by sort_order comparison |
| Existing active plan superseded + new lower-tier plan activated | `plan_downgraded` | Same as above |
| Subscription renewal (new active row for same plan) | `subscription_renewed` | Same as above |
| Expiry job / expiry checked at login | `subscription_expired` | Future expiry command (out of scope for this feature) — field exists for completeness |

---

## Entity Relationships

```
tenants (1)──────────────────────────────(many) school_subscriptions
                                                        │
                                                        ├──(many) subscription_payment_transactions
                                                        │                   │
                                                        │                   └──(1) subscription_invoices
                                                        │
                                                        └──(many) billing_events (soft FK)

subscription_plans (1)──(many) school_subscriptions
```

---

## Frontend TypeScript Interfaces (new/extended)

```ts
// New
export interface SubscriptionInvoice {
  id: string;
  invoiceNumber: string;
  planName: string;
  billingCycle: 'monthly' | 'annual';
  amountCents: number;
  currency: string;
  issuedAt: string;
  downloadUrl: string;
}

export interface BillingEvent {
  id: string;
  eventType:
    | 'payment_confirmed'
    | 'plan_activated'
    | 'plan_upgraded'
    | 'plan_downgraded'
    | 'subscription_renewed'
    | 'subscription_expired';
  planName: string | null;
  billingCycle: 'monthly' | 'annual' | null;
  amountCents: number | null;
  currency: string | null;
  occurredAt: string;
}

export interface BillingEventsResponse {
  events: BillingEvent[];
  total: number;
  page: number;
  perPage: number;
}

export interface InvoiceListResponse {
  invoices: SubscriptionInvoice[];
}
```
