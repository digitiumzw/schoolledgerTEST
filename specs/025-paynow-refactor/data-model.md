# Data Model: Paynow Integration Refactor

**Feature**: 025-paynow-refactor
**Date**: 2026-04-10

---

## Schema Impact

**No new migrations required.** All fields used in this refactor already exist in `subscription_payment_transactions` (migration `2026-04-10-120000_Create_subscription_transactions_table`).

---

## Entity: SubscriptionTransaction (`subscription_payment_transactions`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | VARCHAR(36) | UUID primary key |
| `tenant_id` | VARCHAR(36) | FK → tenants.id |
| `subscription_id` | VARCHAR(36) | FK → school_subscriptions.id |
| `our_reference` | VARCHAR(100) | Unique; format `SUB-{tenantId}-{timestamp}` |
| `paynow_reference` | VARCHAR(100) | **Bug B-2 fix target**: must be stored from webhook `paynowreference` field |
| `paynow_poll_url` | TEXT | Stored from `$response->pollUrl()` after initiation |
| `amount_cents` | INT UNSIGNED | Amount in cents (e.g. 5000 = $50.00) |
| `currency` | VARCHAR(3) | Default `USD`; decorative only (not sent to Paynow SDK) |
| `status` | ENUM | `initiated` → `paid` / `failed` / `cancelled` / `disputed` |
| `paynow_status_raw` | VARCHAR(50) | Raw status string from webhook (e.g. `Paid`) |
| `paynow_hash_verified` | TINYINT(1) | Set to 1 after hash passes verification |
| `webhook_payload` | JSON | Full POST body from Paynow callback |
| `initiated_at` | DATETIME | Set at transaction creation |
| `completed_at` | DATETIME | Set when status reaches terminal state |
| `created_at` | DATETIME | CI4 auto timestamp |
| `updated_at` | DATETIME | CI4 auto timestamp |

### State Machine

```
                  ┌─────────────────────────────┐
                  │         initiated            │
                  └──────────────┬──────────────┘
                                 │ webhook / poll
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
           paid             failed            cancelled
        (terminal)         (terminal)         (terminal)
```

### Key Lookups

- `findByOurReference(string $ref)` — used by webhook to match callback to transaction
- `findByPaynowReference(string $ref)` — available for reconciliation once `paynow_reference` is correctly stored

---

## Entity: SchoolSubscription (`school_subscriptions`)

No schema changes. The subscription entity's state transitions are driven by the transaction state:

| Subscription status | Trigger |
|---------------------|---------|
| `pending` | Created when `POST /api/subscription/initiate` is called |
| `active` | Set when corresponding transaction reaches `paid` |
| `cancelled` | Set when transaction reaches `failed` or `cancelled` |
| `superseded` | Set on previous active subscription when a new one activates (upgrade path) |

### Subscription expiry calculation

| Billing cycle | Expiry |
|--------------|--------|
| `monthly` | `now + 1 month` |
| `annual` | `now + 12 months` |

Expiry is always computed from activation time (`$now`) — not from the previous subscription's expiry.

---

## Data Flow: Webhook to Activation (corrected)

```
Paynow POSTs to /api/subscription/webhook:
  {
    reference:       "SUB-<tenantId>-<ts>",
    paynowreference: "PAYNOW-XXXX",         ← must be stored (Bug B-2)
    amount:          "50.00",
    status:          "Paid",
    hash:            "UPPERCASE_SHA512"
  }

1. verifyHash($post)           → reject if invalid (Bug B-1 fix: no $receivedHash param)
2. findByOurReference(ref)     → resolve transaction
3. if tx.status == 'paid'      → skip (idempotency guard)
4. store paynow_status_raw, paynow_hash_verified=1, webhook_payload
5. if status == 'Paid':
     store paynow_reference = post['paynowreference']  ← Bug B-2 fix
     mark tx.status = 'paid', tx.completed_at = now
     activate subscription
6. if status in ['Failed','Cancelled']:
     mark tx.status accordingly
     cancel subscription
```
