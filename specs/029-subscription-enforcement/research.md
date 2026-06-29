# Research: Subscription Enforcement & Plan Recommendation

## Decision 1: Enforcement Strategy — Where to Gate Access

**Decision**: Implement a reusable `SubscriptionGuard` component that wraps page content and renders a blocked-state UI when `hasActivePlan` is false. It is used inline inside each protected page component (not at the router level).

**Rationale**: Gating inside the page component (rather than at the `<Route>` level in `App.tsx` or inside `ProtectedRoute`) keeps the routing layer clean and avoids adding subscription-awareness to a component that is only responsible for auth/role checks. The blocked state can also include context-specific messaging per page. Component-level gating also avoids over-engineering a new router wrapper for what is effectively a UI concern.

**Alternatives considered**:
- Extending `ProtectedRoute` with subscription awareness — rejected; would couple auth routing to billing state, violating single-responsibility.
- A new `<SubscriptionRoute>` wrapper in `App.tsx` — rejected; requires touching the router for every route and blurs the boundary between auth and subscription concerns.
- Server-side HTTP 402/403 gating — rejected; the backend already enforces business rules; a frontend gate is sufficient for UX and is consistent with FR-010.

---

## Decision 2: Detecting "No Active Plan"

**Decision**: `hasActivePlan = subscription !== null && subscription.status === 'active'`. Derived inside `useSubscription`. A `pending` status (payment initiated, not confirmed) is treated as inactive.

**Rationale**: The `status` field on `SchoolSubscription` can be `active`, `expired`, `pending`, `cancelled`, or `superseded`. Only `active` constitutes a valid access grant. The existing `isExpired` field in `CurrentSubscriptionResponse` already handles the expired case server-side (status is updated to `expired` when the server detects expiry on the `/current` call), so checking `status === 'active'` is sufficient.

**Alternatives considered**:
- Using `!isExpired && subscription !== null` — rejected; does not cover `pending` or `cancelled` subscriptions that exist but are not active.

---

## Decision 3: Persistent App-Shell Banner — Extend SubscriptionStatusBanner

**Decision**: Add a new branch to the existing `SubscriptionStatusBanner` for the `!hasActivePlan` case (no subscription at all, or expired). This banner case is rendered with the highest priority — before the existing `isExpired` branch — since the two conditions overlap and the "no plan" message is more actionable than a pure "expired" message.

**Rationale**: `SubscriptionStatusBanner` is already mounted in `AppLayout` on every authenticated page. Extending it is the minimal-change path and keeps all subscription alerting in one place. A separate component would duplicate logic and require a second mount point.

**Alternatives considered**:
- A brand-new `NoSubscriptionBanner` component alongside `SubscriptionStatusBanner` — rejected; two banner components mounted at the same level risks layout conflicts and duplicates the `useSubscription` hook call.

---

## Decision 4: Plan Recommendation Algorithm

**Decision**: Client-side algorithm using the already-fetched `plans` array, sorted ascending by `sort_order`. Find the first plan where `plan.maxStudents === null || plan.maxStudents > studentCount`. This gives the lowest-tier plan that can accommodate the current student count. Expose as `recommendedPlanId` from `useSubscription`, overriding the server-provided value (which always returns the highest-tier plan).

**Rationale**: The server's `resolveRecommendedPlan()` currently hard-codes "always recommend the top plan" (see `SubscriptionController.php:682`). The client already has the full plan list and student count, so the smarter recommendation can be computed client-side without a backend change. This avoids a spec change to the server contract while delivering the correct UX.

**Boundary cases**:
- `studentCount === 0` → first plan (Starter) recommended.
- `studentCount >= max_students` of a finite plan → skip to next tier (treating at-limit as over-limit per spec FR-007).
- `studentCount > 349` (exceeds Growth limit) → Enterprise (unlimited, `maxStudents === null`) recommended.
- No active plans returned → `recommendedPlanId` returns `''` (no badge shown).

**Alternatives considered**:
- Updating server-side `resolveRecommendedPlan()` to be student-count-aware — viable but out of scope for a frontend-only change; deferred to a future backend refactor.

---

## Decision 5: Scope of Pages to Block

**Decision**: Block: Students, Payments, Classes, Attendance, Staff (`/staff`, `/staff/:id`), Transport (`/transport`, `/transport/routes/:id`), Settings, Staff Attendance (`/s-attendance`). Exempt: Dashboard (`/`), Billing (`/billing`), Help (`/help`), all kiosk routes, Login.

**Rationale**: The blocked pages are all operational data-entry or reporting surfaces. Dashboard is exempt because a user without a plan still needs orientation. Billing is exempt so they can subscribe. Help is exempt so they can seek support. Kiosk and Login are public routes.

---

## Decision 6: Loading State Handling

**Decision**: While `isLoadingCurrent` is true, `SubscriptionGuard` renders a skeleton/spinner rather than the blocked state. This prevents a flash of the "no plan" wall for users who do have an active subscription.

**Rationale**: The `subscription-current` query has a 2-minute stale time and refetches on window focus. On first load there is a brief loading window. Showing the block prematurely creates false urgency and a jarring UX.

---

## Resolution Summary

All NEEDS CLARIFICATION items from spec resolved. No blockers. Implementation is frontend-only — no new backend endpoints, no new migrations, no schema changes.
