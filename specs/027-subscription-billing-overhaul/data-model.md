# Data Model: Subscription Billing Overhaul

**Branch**: `027-subscription-billing-overhaul` | **Date**: 2026-04-13

> No schema migrations are required for this feature. All entities below are pre-existing. This document records the relevant fields and state transitions for the files being modified.

---

## Existing Entities (no changes)

### subscription_plans

| Field | Type | Notes |
|-------|------|-------|
| id | string (PK) | Unique plan identifier (e.g., `'starter'`, `'growth'`, `'enterprise'`) |
| name | string | Display name |
| description | string\|null | Short description |
| max_students | int\|null | Student cap; null = unlimited |
| monthly_price_cents | int | Price in cents for monthly billing |
| annual_price_cents | int | Price in cents for annual billing |
| currency | string | ISO currency code (default: USD) |
| is_active | bool | Whether plan appears in the public listing |
| sort_order | int | Determines tier order; **highest = top tier (Enterprise)** |

**Used by `resolveRecommendedPlan()` change**: Query for the plan with `MAX(sort_order)` and return its `id`.

---

### school_subscriptions

| Field | Type | Notes |
|-------|------|-------|
| id | string (PK, UUID) | |
| tenant_id | string (FK) | Always from JWT |
| plan_id | string (FK) | References subscription_plans.id |
| billing_cycle | enum | `'monthly'` \| `'annual'` |
| status | enum | `'pending'` \| `'active'` \| `'expired'` \| `'superseded'` \| `'cancelled'` |
| starts_at | datetime | |
| expires_at | datetime\|null | Null until activated |
| amount_paid_cents | int | |
| currency | string | |
| activated_at | datetime\|null | |
| cancelled_at | datetime\|null | |

**State transitions**:
```
pending ──[payment confirmed]──► active
pending ──[new attempt initiated]──► cancelled
active  ──[new plan activated]──► superseded
active  ──[expires_at passed, detected in current()]──► expired
```

---

### subscription_payment_transactions

| Field | Type | Notes |
|-------|------|-------|
| id | string (PK, UUID) | |
| tenant_id | string (FK) | Always from JWT |
| subscription_id | string (FK) | References school_subscriptions.id |
| paynow_reference | string\|null | Paynow's transaction reference |
| paynow_poll_url | string\|null | URL to poll for status |
| our_reference | string | Format: `SUB-{tenantId}-{timestamp}` |
| amount_cents | int | |
| currency | string | |
| status | enum | `'initiated'` \| `'paid'` \| `'failed'` \| `'cancelled'` \| `'disputed'` |
| paynow_status_raw | string\|null | Raw status string from Paynow SDK (e.g., `'Paid'`, `'Cancelled'`, `'Sent'`) |
| paynow_hash_verified | bool | Set by webhook handler |
| webhook_payload | json\|null | Raw webhook POST body |
| initiated_at | datetime | |
| completed_at | datetime\|null | |

**Terminal states** (poll endpoint short-circuits on these): `'paid'`, `'failed'`, `'cancelled'`

**Cancellation detection**: When `paynow_status_raw` is `'Cancelled'` (case-insensitive), the frontend should show the cancellation banner rather than the "processing" banner.

---

### subscription_invoices

| Field | Type | Notes |
|-------|------|-------|
| id | string (PK, UUID) | |
| tenant_id | string (FK) | |
| subscription_id | string (FK) | |
| transaction_id | string (FK) | |
| invoice_number | string | Format: `INV-{tenantId}-{YYYYMM}-{SEQ}` |
| school_name | string | |
| plan_name | string | |
| billing_cycle | enum | `'monthly'` \| `'annual'` |
| amount_cents | int | |
| currency | string | |
| issued_at | datetime | |
| pdf_path | string\|null | Server-side PDF path (not exposed to client) |

---

### billing_events

| Field | Type | Notes |
|-------|------|-------|
| id | string (PK, UUID) | |
| tenant_id | string (FK) | |
| event_type | enum | `'payment_confirmed'` \| `'plan_activated'` \| `'plan_upgraded'` \| `'plan_downgraded'` \| `'subscription_renewed'` \| `'subscription_expired'` |
| plan_name | string\|null | |
| billing_cycle | enum\|null | |
| amount_cents | int\|null | |
| currency | string\|null | |
| subscription_id | string\|null | |
| transaction_id | string\|null | |
| occurred_at | datetime | |

---

## Frontend State Shapes (modified)

### `useSubscription` hook return (simplified — EcoCash fields removed)

```typescript
interface UseSubscriptionReturn {
  plans: SubscriptionPlan[];
  subscription: SchoolSubscription | null;
  studentCount: number;
  recommendedPlanId: string;       // Now always the enterprise plan ID from API
  isExpired: boolean;
  isOverLimit: boolean;
  daysUntilExpiry: number | null;
  selectedCycle: 'monthly' | 'annual';
  setSelectedCycle: (cycle: 'monthly' | 'annual') => void;
  isLoadingPlans: boolean;
  isLoadingCurrent: boolean;
  loadingPlanId: string | null;
  downgradeBlockedState: DowngradeBlockedState | null;
  clearDowngradeBlocked: () => void;
  initiatePaidSubscription: (planId: string, cycle: 'monthly' | 'annual') => Promise<void>;
  // REMOVED: ecocashState, ecocashInstructions, initiateEcocash
}
```

### `Billing.tsx` PollState (extended — cancellation added)

```typescript
type PollState = 'idle' | 'polling' | 'paid' | 'pending' | 'cancelled' | 'error';
```

### `SubscribeConfirmDialog` props

```typescript
interface SubscribeConfirmDialogProps {
  open: boolean;
  planName: string;
  price: string;             // Pre-formatted price string (e.g., "$15/month")
  cycle: 'monthly' | 'annual';
  actionLabel: string;       // 'Subscribe' | 'Upgrade' | 'Downgrade'
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}
```
