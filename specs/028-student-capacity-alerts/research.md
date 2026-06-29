# Research: Student Capacity Display & Near-Capacity Upgrade Alert

## Decision 1: Data Source for Capacity

**Decision**: Reuse `GET /api/subscription/current` — no new endpoint.  
**Rationale**: Already returns `studentCount`, `isOverLimit`, `isExpired`. Plan `maxStudents` is in `GET /api/subscription/plans` (already cached by `useSubscription`). Crossing these two cached queries gives all needed values at zero extra network cost.  
**Alternatives considered**: New `/api/subscription/capacity` endpoint — rejected; adds backend work for data already available client-side.

## Decision 2: Where to Derive Capacity State

**Decision**: Extend `useSubscription` hook with four new computed values: `maxStudents`, `capacityPercent`, `remainingSlots`, `isNearCapacity`.  
**Rationale**: All consumers (Billing page, SubscriptionStatusBanner) already import `useSubscription`. Centralising derivation in the hook avoids duplicated threshold logic.  
**Alternatives considered**: Separate `useCapacity` hook — rejected; adds indirection for a single formula.

## Decision 3: Near-Capacity Threshold

**Decision**: `isNearCapacity = capacityPercent >= 75 && maxStudents !== null && !isOverLimit && !isExpired`  
**Rationale**: Matches FR-004. 75% used = ≤25% remaining as stated in spec. Suppression of `isOverLimit`/`isExpired` keeps alert hierarchy clean.

## Decision 4: Capacity UI Widget

**Decision**: New `StudentCapacityCard` component using shadcn/ui `Progress` bar inside a `Card`.  
**Rationale**: Progress bar communicates fill level at a glance. Keeps `Billing.tsx` clean and widget independently testable.  
**Alternatives considered**: Inline JSX in Billing — rejected; harder to test and clutters the page component.

## Decision 5: Global Banner Placement

**Decision**: Extend existing `SubscriptionStatusBanner` with a new branch for `isNearCapacity`.  
**Rationale**: The banner already handles expired/over-limit/expiry-soon. Adding near-capacity as a fourth case is consistent and requires no new layout component.

## Resolution Summary

All NEEDS CLARIFICATION items resolved. No blockers. Implementation is frontend-only.
