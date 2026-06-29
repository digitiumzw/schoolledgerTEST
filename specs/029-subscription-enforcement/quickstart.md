# Quickstart: Subscription Enforcement & Plan Recommendation

## What This Feature Does

1. **Blocks essential operations** when no active subscription is present — Students, Payments, Classes, Attendance, Staff, Transport, and Settings pages show a "No Active Subscription" wall instead of content.
2. **Shows a persistent banner** on every authenticated page when no active plan is detected, prompting the user to subscribe.
3. **Recommends the right plan** on the Billing page based on how many students the school has enrolled, rather than always defaulting to the highest-tier plan.

---

## Files Changed

### Modified
| File | Change |
|------|--------|
| `frontend/src/hooks/useSubscription.ts` | Add `hasActivePlan` derived field; replace server `recommendedPlanId` with client-computed algorithm |
| `frontend/src/components/subscription/SubscriptionStatusBanner.tsx` | Add highest-priority `!hasActivePlan` banner case; retire standalone `isExpired` branch |

### New
| File | Purpose |
|------|---------|
| `frontend/src/components/subscription/SubscriptionGuard.tsx` | Reusable gate component — shows blocked state when `hasActivePlan` is false |

### Pages modified (SubscriptionGuard applied)
`Students.tsx`, `StudentProfile.tsx`, `Payments.tsx`, `Classes.tsx`, `Attendance.tsx`,
`Staff.tsx`, `StaffProfilePage.tsx`, `StaffAttendance.tsx`, `Transport.tsx`,
`RouteDetailPage.tsx`, `Settings.tsx`

---

## Dev Setup

No backend changes. No new environment variables. No migrations.

```bash
# Start the dev server (if not already running)
cd frontend && bun run dev
```

---

## Manual Testing

### Test 1 — Verify enforcement (no subscription)

1. In the database, ensure the school's active subscription row has `status = 'expired'` or delete it.
2. Log in as an admin.
3. Navigate to `/students` → should see the "No Active Subscription" block, not student data.
4. Navigate to `/billing` → should load the Billing page normally (not blocked).
5. Verify the persistent banner appears at the top of every page visited.

### Test 2 — Verify unblocking after subscription

1. From the blocked state, click "Subscribe Now" → lands on `/billing`.
2. Subscribe to a plan and confirm payment (use sandbox/test mode).
3. After payment confirmation, navigate back to `/students` → page should load normally.
4. The persistent banner should no longer appear.

### Test 3 — Plan recommendation

1. Set the school's student count to 200 (or seed 200 active students).
2. Open the Billing page.
3. Confirm the "Starter" plan card has the "Recommended" badge; Growth and Enterprise do not.
4. Change student count to 270 → refresh → confirm "Growth" is now recommended.
5. Change to 400 → confirm "Enterprise" is recommended.

### Test 4 — Loading state (no flash)

1. Throttle the network to "Slow 3G" in browser dev tools.
2. Reload the app while logged in with an active subscription.
3. During the loading window, verify no "No Active Subscription" block or banner flashes before the data resolves.

---

## Key Invariants to Preserve

- The Billing page (`/billing`) MUST never be wrapped in `SubscriptionGuard`.
- The Help page (`/help`) MUST never be wrapped in `SubscriptionGuard`.
- Kiosk routes (`/kiosk/*`) and `/login` are public — no subscription checks.
- `SubscriptionGuard` returns children unchanged (no added DOM wrapper) when `hasActivePlan` is true.
- The `isNearCapacity` and `daysUntilExpiry` banner cases (from feature 028) must still work when a subscription IS active.
