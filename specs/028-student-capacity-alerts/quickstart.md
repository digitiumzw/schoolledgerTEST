# Quickstart: Student Capacity Display & Near-Capacity Upgrade Alert

## What changes

| File | Change |
|------|--------|
| `frontend/src/hooks/useSubscription.ts` | Add `maxStudents`, `capacityPercent`, `remainingSlots`, `isNearCapacity` to returned object |
| `frontend/src/components/subscription/StudentCapacityCard.tsx` | **New** — progress-bar capacity widget |
| `frontend/src/components/subscription/SubscriptionStatusBanner.tsx` | Add near-capacity banner case (4th priority after expired, over-limit, expiry-soon) |
| `frontend/src/pages/Billing.tsx` | Render `<StudentCapacityCard>` between status alerts and the Current Subscription card; add near-capacity `<Alert>` for Billing page inline alert |

## No backend changes

`GET /api/subscription/current` and `GET /api/subscription/plans` already provide all required data.

## Dev setup

```bash
cd frontend
npm run dev
```

Log in as `admin` or `bursar`. Navigate to `/billing`.

## Testing the near-capacity state

The threshold is `studentCount / maxStudents >= 0.75`. To trigger it in development:

1. Use a seed school on the **Starter plan** (max 249 students).
2. Temporarily seed or create students until count ≥ 188 (75% of 249).
3. Reload `/billing` — the warning banner should appear.

Alternatively, temporarily lower `NEAR_CAPACITY_THRESHOLD` constant in `useSubscription.ts` to `0.1` to see the alert with a small student count.

## Key invariants

- Enterprise plan (`maxStudents === null`) → no capacity widget, no warning.
- `isOverLimit = true` → suppresses near-capacity warning (over-limit banner shown instead).
- `isExpired = true` → suppresses near-capacity warning (expiry banner shown instead).
