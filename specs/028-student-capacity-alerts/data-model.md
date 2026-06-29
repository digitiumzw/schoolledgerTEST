# Data Model: Student Capacity Display & Near-Capacity Upgrade Alert

## Existing Entities Used (no schema changes)

### SubscriptionPlan *(backend table: `subscription_plans`)*

| Field | Type | Relevance |
|-------|------|-----------|
| `id` | string | Plan identifier |
| `name` | string | Display name |
| `max_students` | INT UNSIGNED \| NULL | Capacity ceiling; NULL = unlimited |

### SchoolSubscription *(backend table: `school_subscriptions`)*

| Field | Type | Relevance |
|-------|------|-----------|
| `plan_id` | string | Links to SubscriptionPlan |
| `status` | string | `active`, `expired`, `cancelled`, `superseded`, `pending` |

### CurrentSubscriptionResponse *(API response shape, no table)*

| Field | Type | Relevance |
|-------|------|-----------|
| `studentCount` | number | Total enrolled students for this tenant |
| `isOverLimit` | boolean | True when `studentCount >= maxStudents` |
| `isExpired` | boolean | True when active subscription has passed `expires_at` |
| `subscription.planId` | string | Used to cross-reference `maxStudents` from plans list |

---

## Derived Frontend State (no persistence)

### CapacityState *(computed in `useSubscription`)*

| Field | Derivation | Purpose |
|-------|-----------|---------|
| `maxStudents` | `plans.find(p => p.id === subscription?.planId)?.maxStudents ?? null` | Plan ceiling; null for unlimited |
| `capacityPercent` | `maxStudents !== null ? Math.round((studentCount / maxStudents) * 100) : null` | Percentage used |
| `remainingSlots` | `maxStudents !== null ? maxStudents - studentCount : null` | Slots left |
| `isNearCapacity` | `capacityPercent !== null && capacityPercent >= 75 && !isOverLimit && !isExpired` | Triggers warning |

---

## State Transitions & Alert Priority

```
isExpired = true
  → Show: Expired banner (highest priority — blocks all others)

isOverLimit = true (and !isExpired)
  → Show: Over-limit banner

isNearCapacity = true (and !isOverLimit && !isExpired)
  → Show: Near-capacity warning banner  ← NEW

daysUntilExpiry <= 7 (and !isNearCapacity && !isOverLimit && !isExpired)
  → Show: Expiry-soon banner

none of the above
  → Show: nothing
```
