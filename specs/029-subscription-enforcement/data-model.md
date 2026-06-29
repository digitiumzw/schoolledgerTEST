# Data Model: Subscription Enforcement & Plan Recommendation

> This feature is **frontend-only**. No new database tables or migrations are introduced.
> All data originates from existing backend endpoints and is derived/transformed client-side.

---

## Existing Entities (consumed, not modified)

### SubscriptionPlan *(from `GET /api/subscription/plans`)*

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | e.g. `'starter'`, `'growth'`, `'enterprise'` |
| `name` | `string` | Display name |
| `description` | `string` | Short plan description |
| `maxStudents` | `number \| null` | Student cap; `null` = unlimited (Enterprise) |
| `monthlyPriceCents` | `number` | Price in cents for monthly billing |
| `annualPriceCents` | `number` | Price in cents for annual billing |
| `currency` | `string` | e.g. `'USD'` |
| `sortOrder` | `number` | Ascending tier rank: 1 = Starter, 2 = Growth, 3 = Enterprise |

### SchoolSubscription *(from `GET /api/subscription/current`)*

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | UUID |
| `planId` | `string` | FK to `SubscriptionPlan.id` |
| `planName` | `string` | Denormalised plan name |
| `billingCycle` | `'monthly' \| 'annual'` | |
| `status` | `'active' \| 'expired' \| 'pending' \| 'cancelled' \| 'superseded'` | Only `'active'` grants access |
| `startsAt` | `string \| null` | ISO 8601 |
| `expiresAt` | `string \| null` | ISO 8601; `null` for unlimited |
| `amountPaidCents` | `number` | |
| `currency` | `string` | |
| `activatedAt` | `string \| null` | ISO 8601 |

### CurrentSubscriptionResponse *(full payload of `GET /api/subscription/current`)*

| Field | Type | Notes |
|-------|------|-------|
| `subscription` | `SchoolSubscription \| null` | `null` = school has never subscribed or all subs are non-active |
| `studentCount` | `number` | Enrolled students for this tenant |
| `recommendedPlanId` | `string` | Server-computed (currently always top plan); overridden client-side |
| `isExpired` | `boolean` | Server computed: active sub exists but `expires_at` < now |
| `isOverLimit` | `boolean` | `studentCount >= plan.maxStudents` |
| `daysUntilExpiry` | `number \| null` | Days until current active sub expires |

---

## Derived State (frontend only, lives in `useSubscription` hook)

### EnforcementState

Computed from `CurrentSubscriptionResponse` after each query refresh.

| Derived Field | Type | Formula |
|---------------|------|---------|
| `hasActivePlan` | `boolean` | `subscription !== null && subscription.status === 'active'` |
| `recommendedPlanId` | `string` | First plan (by `sortOrder` asc) where `plan.maxStudents === null \|\| plan.maxStudents > studentCount`; falls back to highest-tier plan id if none found |

### CapacityState *(already computed in 028, preserved)*

| Derived Field | Type | Formula |
|---------------|------|---------|
| `maxStudents` | `number \| null` | From active plan's `maxStudents` |
| `capacityPercent` | `number \| null` | `Math.round((studentCount / maxStudents) * 100)` |
| `remainingSlots` | `number \| null` | `maxStudents - studentCount` |
| `isNearCapacity` | `boolean` | `capacityPercent >= 75 && maxStudents !== null && !isOverLimit && !isExpired` |

---

## State Transitions

### Subscription Status → Enforcement Outcome

```
subscription === null
  OR subscription.status ∈ {'expired', 'pending', 'cancelled', 'superseded'}
    → hasActivePlan = false → pages blocked, no-plan banner shown

subscription.status === 'active'
    → hasActivePlan = true  → pages rendered normally, banner hidden
```

### Plan Recommendation Boundary Table

| Student Count | Recommended Plan | Reasoning |
|---------------|-----------------|-----------|
| 0–249 | Starter (`maxStudents: 249`) | Lowest plan that fits (count < 249) |
| 250 | Growth (`maxStudents: 349`) | count >= 249 → Starter at/over limit |
| 250–349 | Growth (`maxStudents: 349`) | Lowest plan that fits |
| 350 | Enterprise (`maxStudents: null`) | count >= 349 → Growth at/over limit |
| 350+ | Enterprise (`maxStudents: null`) | Only unlimited plan accommodates |

> **Rule**: `maxStudents > studentCount` (strict greater-than), not `>=`, so a school at exactly the limit is directed to the next tier — consistent with how `isOverLimit` is computed in the backend (`studentCount >= max_students`).

---

## No Schema Changes

This feature introduces no new database tables, columns, or migrations. All data is already present in the existing `subscription_plans`, `school_subscriptions`, and `tenants` tables and is served through the existing `GET /api/subscription/current` and `GET /api/subscription/plans` endpoints.
