# Data Model: Paynow Subscription Packages

**Feature**: `024-paynow-subscriptions`  
**Phase**: 1 — Design  
**Date**: 2026-04-10

---

## Overview

Three new tables are introduced. No existing tables are modified except that `StudentController` will read the active subscription to enforce student-count limits (no schema change to existing tables).

```
subscription_plans                 (seed data — one row per tier)
    │
    └──< school_subscriptions      (one active row per tenant)
              │
              └──< subscription_payment_transactions  (one row per payment event)
```

---

## Table: `subscription_plans`

Stores the four tier definitions. Seeded once; not tenant-owned.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `VARCHAR(50)` | PK | Slug identifier: `free`, `standard`, `advanced`, `enterprise` |
| `name` | `VARCHAR(100)` | NOT NULL | Human-readable name: "Free", "Standard", etc. |
| `description` | `TEXT` | NULL | Optional marketing description |
| `max_students` | `INT UNSIGNED` | NULL | Inclusive upper limit on active student count. NULL = unlimited (Enterprise) |
| `monthly_price_cents` | `INT UNSIGNED` | NOT NULL DEFAULT 0 | Monthly price in smallest currency unit (e.g., cents) |
| `annual_price_cents` | `INT UNSIGNED` | NOT NULL DEFAULT 0 | Annual price in smallest currency unit |
| `currency` | `VARCHAR(3)` | NOT NULL DEFAULT 'USD' | ISO 4217 currency code |
| `is_active` | `TINYINT(1)` | NOT NULL DEFAULT 1 | Soft-disable a plan without deleting it |
| `sort_order` | `INT` | NOT NULL DEFAULT 0 | Display order (ascending) |
| `created_at` | `DATETIME` | NULL | CI4 timestamp |
| `updated_at` | `DATETIME` | NULL | CI4 timestamp |

**Indexes**: PK on `id`. Index on `is_active`.  
**Validation rules**: `monthly_price_cents` and `annual_price_cents` ≥ 0; `max_students` > 0 or NULL.

---

## Table: `school_subscriptions`

One row per subscription period per tenant. Multiple rows exist over time (history). Only one row per tenant may have `status = 'active'` at a time.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `VARCHAR(36)` | PK | UUID v4 |
| `tenant_id` | `VARCHAR(36)` | NOT NULL, FK → `tenants.id` | Tenant this subscription belongs to |
| `plan_id` | `VARCHAR(50)` | NOT NULL, FK → `subscription_plans.id` | Which tier |
| `billing_cycle` | `ENUM('monthly','annual')` | NOT NULL | Billing frequency |
| `status` | `ENUM('pending','active','expired','superseded','cancelled')` | NOT NULL DEFAULT 'pending' | Lifecycle state |
| `starts_at` | `DATETIME` | NOT NULL | When subscription became / becomes active |
| `expires_at` | `DATETIME` | NULL | When subscription expires (NULL for Free/lifetime) |
| `amount_paid_cents` | `INT UNSIGNED` | NOT NULL DEFAULT 0 | Actual amount paid (0 for Free) |
| `currency` | `VARCHAR(3)` | NOT NULL DEFAULT 'USD' | Currency of payment |
| `activated_at` | `DATETIME` | NULL | Timestamp of Paynow payment confirmation |
| `cancelled_at` | `DATETIME` | NULL | Timestamp of cancellation (if applicable) |
| `created_at` | `DATETIME` | NULL | CI4 timestamp |
| `updated_at` | `DATETIME` | NULL | CI4 timestamp |

**Indexes**: PK on `id`. Index on `(tenant_id, status)` — primary query pattern. Index on `expires_at` for expiry notification queries.

**State transitions**:
```
pending ──(Paynow confirmed)──► active ──(expires_at reached)──► expired
                                       ──(upgrade initiated)──► superseded
                                       ──(admin cancels)──► cancelled
```

**Invariant**: At most one row per `tenant_id` with `status = 'active'`. Enforced at application layer in `SchoolSubscriptionModel`.

---

## Table: `subscription_payment_transactions`

Audit trail of every payment event (initiation, success, failure).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `VARCHAR(36)` | PK | UUID v4 |
| `tenant_id` | `VARCHAR(36)` | NOT NULL, FK → `tenants.id` | Tenant (for tenant-scoped queries) |
| `subscription_id` | `VARCHAR(36)` | NOT NULL, FK → `school_subscriptions.id` | Subscription this payment belongs to |
| `paynow_reference` | `VARCHAR(100)` | NULL | Paynow internal reference returned on initiation |
| `paynow_poll_url` | `TEXT` | NULL | Paynow poll URL for manual status checks |
| `our_reference` | `VARCHAR(100)` | NOT NULL | Our internal reference (e.g., `SUB-{tenant_id}-{timestamp}`) |
| `amount_cents` | `INT UNSIGNED` | NOT NULL | Amount charged (in cents) |
| `currency` | `VARCHAR(3)` | NOT NULL DEFAULT 'USD' | ISO 4217 currency |
| `status` | `ENUM('initiated','paid','failed','cancelled','disputed')` | NOT NULL DEFAULT 'initiated' | Payment status |
| `paynow_status_raw` | `VARCHAR(50)` | NULL | Raw status string from Paynow (e.g., "Paid", "Failed") |
| `paynow_hash_verified` | `TINYINT(1)` | NOT NULL DEFAULT 0 | Whether webhook hash was verified successfully |
| `webhook_payload` | `JSON` | NULL | Full webhook payload for audit/debugging |
| `initiated_at` | `DATETIME` | NOT NULL | When the transaction was initiated |
| `completed_at` | `DATETIME` | NULL | When the terminal status was reached |
| `created_at` | `DATETIME` | NULL | CI4 timestamp |
| `updated_at` | `DATETIME` | NULL | CI4 timestamp |

**Indexes**: PK on `id`. Index on `(tenant_id, status)`. Index on `our_reference` (unique). Index on `paynow_reference`.

**Idempotency**: Webhook handler checks `paynow_reference` uniqueness before processing. Duplicate webhooks are silently ignored (return HTTP 200 without re-activating).

---

## Entity Relationships

```
tenants (existing)
  │ 1
  │
  │ ∞
school_subscriptions
  │ * tenant_id → tenants.id
  │ * plan_id   → subscription_plans.id
  │
  │ 1
  │
  │ ∞
subscription_payment_transactions
    * tenant_id        → tenants.id
    * subscription_id  → school_subscriptions.id

subscription_plans (independent seed table)
  ↑ referenced by school_subscriptions.plan_id
```

---

## Key Validation Rules (application layer)

1. A `school_subscriptions` row may only be set to `active` if no other row for the same `tenant_id` is already `active`.
2. `expires_at` MUST be set for `monthly` and `annual` subscriptions; it is NULL only for the Free plan.
3. `amount_paid_cents` for a Free plan subscription MUST be 0.
4. A new `school_subscriptions` row MAY only be created for a tenant whose current active subscription's `plan_id` is equal to or lower tier than the requested plan (upgrades only; downgrade blocked in v1).
5. `subscription_payment_transactions.our_reference` is unique across all rows.

---

## Seed Data (`subscription_plans`)

```sql
INSERT INTO subscription_plans (id, name, description, max_students, monthly_price_cents, annual_price_cents, currency, is_active, sort_order)
VALUES
  ('free',       'Free',       'For schools with fewer than 50 students',         49,   0,     0,     'USD', 1, 1),
  ('standard',   'Standard',   'For schools with fewer than 250 students',        249,  1500,  15000, 'USD', 1, 2),
  ('advanced',   'Advanced',   'For schools with fewer than 350 students',        349,  2500,  25000, 'USD', 1, 3),
  ('enterprise', 'Enterprise', 'For schools with 350 or more students',           NULL, 4000,  40000, 'USD', 1, 4);
```

*Prices are placeholder values in USD cents. Update before go-live.*
