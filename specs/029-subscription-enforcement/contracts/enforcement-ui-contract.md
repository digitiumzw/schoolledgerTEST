# UI Contract: Subscription Enforcement & Plan Recommendation

> This feature is frontend-only. The contracts here document the component interfaces
> and behavioural expectations that must be preserved across implementation.

---

## Component: `SubscriptionGuard`

**File**: `frontend/src/components/subscription/SubscriptionGuard.tsx` *(new)*

### Props

```ts
interface SubscriptionGuardProps {
  children: React.ReactNode;
}
```

### Behaviour Contract

| Condition | Rendered Output |
|-----------|-----------------|
| `isLoadingCurrent === true` | Loading skeleton (spinner or pulse skeleton, not blocked state) |
| `hasActivePlan === true` | `children` rendered as-is |
| `hasActivePlan === false` | Blocked state UI (see below) |

### Blocked State Requirements

The blocked state MUST include:
1. A recognisable icon (e.g. lock or ban symbol).
2. A headline: "No Active Subscription".
3. A sub-message: "Subscribe to a plan to access this feature."
4. A primary CTA button/link labelled "Subscribe Now" that navigates to `/billing`.
5. The blocked state MUST NOT render any of the `children` content — zero data leakage.

### Usage Pattern

```tsx
<SubscriptionGuard>
  <PageContent />
</SubscriptionGuard>
```

Applied inside these page components (not at route level):
- `Students.tsx`
- `StudentProfile.tsx`
- `Payments.tsx`
- `Classes.tsx`
- `Attendance.tsx`
- `Staff.tsx`
- `StaffProfilePage.tsx`
- `StaffAttendance.tsx`
- `Transport.tsx`
- `RouteDetailPage.tsx`
- `Settings.tsx`

**Exempt pages** (must NOT use `SubscriptionGuard`): `Index.tsx` (Dashboard), `Billing.tsx`, `Help.tsx`, all kiosk pages, `Login.tsx`.

---

## Component: `SubscriptionStatusBanner` *(modified)*

**File**: `frontend/src/components/subscription/SubscriptionStatusBanner.tsx`

### Banner Priority Order (top to bottom — first matching case wins)

| Priority | Condition | Banner Variant | Message |
|----------|-----------|---------------|---------|
| 1 | `!hasActivePlan` (no subscription or expired/pending) | `destructive` | "You don't have an active plan. Subscribe to unlock all features." + "Subscribe now" link to `/billing` |
| 2 | `isOverLimit` | `destructive` | (existing) "Student limit reached. Upgrade your plan to add more students." |
| 3 | `isNearCapacity` | `warning` (amber) | (existing) "Approaching student capacity…" |
| 4 | `daysUntilExpiry !== null && daysUntilExpiry <= 7` | `warning` (yellow) | (existing) "Subscription expires in N days." |
| — | None of the above | `null` — no banner rendered | — |

> **Note**: The existing `isExpired` early-return in `SubscriptionStatusBanner` (line 12–25) is REPLACED by the higher-priority `!hasActivePlan` check. The expired and no-subscription cases now share a single banner message.

### Loading State

While `isLoadingCurrent === true`, the banner MUST NOT render (return `null`), to prevent a flash of the no-plan banner for subscribed users.

---

## Hook: `useSubscription` *(modified)*

**File**: `frontend/src/hooks/useSubscription.ts`

### New / Modified Return Values

| Field | Type | Change |
|-------|------|--------|
| `hasActivePlan` | `boolean` | **NEW** — `subscription !== null && subscription.status === 'active'` |
| `recommendedPlanId` | `string` | **MODIFIED** — now client-computed (lowest-tier plan accommodating current student count), no longer forwarded from server response |

### Recommendation Algorithm (pseudo-code)

```ts
const sortedPlans = [...plans].sort((a, b) => a.sortOrder - b.sortOrder);
const recommended = sortedPlans.find(
  p => p.maxStudents === null || p.maxStudents > studentCount
);
recommendedPlanId = recommended?.id ?? sortedPlans[sortedPlans.length - 1]?.id ?? '';
```

### Existing Fields (unchanged)

`plans`, `subscription`, `studentCount`, `maxStudents`, `capacityPercent`, `remainingSlots`,
`isNearCapacity`, `isExpired`, `isOverLimit`, `daysUntilExpiry`, `selectedCycle`,
`setSelectedCycle`, `isLoadingPlans`, `isLoadingCurrent`, `loadingPlanId`,
`downgradeBlockedState`, `clearDowngradeBlocked`, `setDowngradeBlocked`, `initiatePaidSubscription`

---

## API Contract (unchanged)

No new endpoints. The following existing endpoints are consumed without modification:

| Endpoint | Purpose | Cache Key |
|----------|---------|-----------|
| `GET /api/subscription/current` | Subscription status + student count | `['subscription-current']` |
| `GET /api/subscription/plans` | Plan list with limits and pricing | `['subscription-plans']` |

---

## Behaviour: Cache Invalidation on Subscription Activation

When a payment is confirmed (poll result `paid: true` in `Billing.tsx`), the following query keys MUST be invalidated:
- `['subscription-current']`
- `['subscription-history']`
- `['subscription-invoices']`
- `['subscription-events']`

This is already implemented in `Billing.tsx` and must be preserved. Upon invalidation, `hasActivePlan` will become `true` within the next render, lifting all blocks automatically.
