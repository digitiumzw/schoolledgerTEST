# Feature Specification: Student Capacity Display & Near-Capacity Upgrade Alert

**Feature Branch**: `028-student-capacity-alerts`  
**Created**: 2026-04-13  
**Status**: Draft  
**Input**: User description: "as a user i need to see the capacity of the students that i have and what are left depending on the current plan and if its less than 25% capacity it should notify user to upgrade his plan soon before reaching capacity"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Student Capacity on Billing Page (Priority: P1)

An admin or bursar navigates to the Billing page and immediately sees a capacity summary showing how many students are currently enrolled, the maximum allowed by their active plan, and how many slots remain. The information is presented clearly so the user can assess headroom at a glance without having to count records manually.

**Why this priority**: This is the foundational visibility requirement — the alert in P2 depends on it, and users need this data whether or not they are near the limit. Delivering it alone already provides measurable value.

**Independent Test**: Can be fully tested by visiting the Billing page with an active subscription and verifying that enrolled student count, plan maximum, and remaining slots are displayed accurately. Delivers value independently as a capacity transparency feature.

**Acceptance Scenarios**:

1. **Given** a school has an active Starter plan (max 249 students) and 120 enrolled students, **When** an admin opens the Billing page, **Then** the page displays "120 students enrolled", "249 student limit", and "129 slots remaining".
2. **Given** a school is on the Enterprise plan (unlimited students), **When** an admin opens the Billing page, **Then** the capacity widget shows the enrolled count with a label indicating the plan has no student limit (no remaining-slots figure is shown).
3. **Given** a school has no active subscription, **When** an admin opens the Billing page, **Then** the capacity widget is not shown or displays a message indicating subscription status is required.

---

### User Story 2 - Near-Capacity Warning Notification (Priority: P2)

When the school's enrolled student count reaches or exceeds 75% of the plan's maximum (i.e., 25% or fewer slots remain), a prominent warning banner appears on the Billing page — and optionally on any page that already displays the global `SubscriptionStatusBanner` — prompting the admin to upgrade their plan before capacity is exhausted.

**Why this priority**: Proactive alerting prevents the school from being blocked from enrolling new students unexpectedly. It depends on P1 (the capacity data) being available and correctly computed.

**Independent Test**: Can be fully tested by setting the enrolled student count to 75% or more of the plan limit and verifying the upgrade banner appears with correct messaging and a link to the plan upgrade flow.

**Acceptance Scenarios**:

1. **Given** a school has 188 of 249 Starter slots used (75.5% — less than 25% remaining), **When** any admin-role user loads the Billing page, **Then** a warning banner is displayed reading approximately "You are approaching your student capacity. Upgrade your plan to avoid disruption." with a link/button to the plan upgrade section.
2. **Given** a school has 187 of 249 slots used (75.1%), **When** the page loads, **Then** the warning banner is still shown (threshold is at ≥75% used / ≤25% remaining).
3. **Given** a school has 186 of 249 slots used (74.7% — more than 25% remaining), **When** the page loads, **Then** no near-capacity warning banner is shown.
4. **Given** the `isOverLimit` flag is already true (plan limit fully reached), **When** the page loads, **Then** the existing "student limit reached" banner takes priority and the near-capacity warning is suppressed to avoid duplicate alerts.
5. **Given** a school is on the Enterprise plan (unlimited), **When** the page loads, **Then** no near-capacity warning is shown regardless of enrolled count.

---

### User Story 3 - Global Near-Capacity Banner in App Shell (Priority: P3)

The near-capacity warning also appears in the app-wide `SubscriptionStatusBanner` component (already rendered in the main layout) so that admins are alerted even when they are not on the Billing page.

**Why this priority**: Lower priority because the Billing-page alert (P2) is already the primary call-to-action destination. The global banner improves visibility but is not required for the core user need.

**Independent Test**: Can be fully tested by confirming the near-capacity condition triggers the banner in the app shell on a non-Billing page (e.g., the Dashboard), and that clicking its link navigates to the Billing page.

**Acceptance Scenarios**:

1. **Given** a school is near capacity (≤25% slots remaining) and the user is on the Dashboard page, **When** the page renders, **Then** the `SubscriptionStatusBanner` shows a near-capacity warning with a "Upgrade plan" link pointing to `/billing`.
2. **Given** the subscription is expired (existing banner state), **When** the page renders, **Then** the expiry banner takes the highest priority and the near-capacity banner is not shown simultaneously.

---

### Edge Cases

- What is shown when `max_students` is `null` (Enterprise / unlimited plan)? → No capacity bar or near-capacity warning; only the enrolled count is shown.
- What happens if `studentCount` is 0 and the plan has a limit? → Capacity bar shows 0% used; no warning shown.
- What if the plan limit is exactly reached (`studentCount === maxStudents`)? → The existing `isOverLimit` banner takes precedence; near-capacity warning is suppressed.
- What if the school subscription transitions from active to expired mid-session? → Existing expiry banner takes precedence; capacity display reflects the last-known state until a refresh.
- What if `currentData` is still loading? → Capacity widget shows a loading skeleton; no banner is shown until data resolves.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Billing page MUST display the school's currently enrolled student count, the plan's maximum student limit, and the number of remaining slots when an active plan with a finite `max_students` is in effect.
- **FR-002**: The Billing page MUST display only the enrolled student count (with a label indicating no limit) when the active plan has an unlimited student allowance (`max_students` is null).
- **FR-003**: The system MUST compute remaining capacity as `max_students − studentCount` and express the usage percentage as `(studentCount / max_students) × 100`.
- **FR-004**: When usage percentage is ≥ 75% (i.e., ≤ 25% slots remaining) and `isOverLimit` is false and the plan has a finite limit, the system MUST display a near-capacity warning directing the user to upgrade their plan.
- **FR-005**: The near-capacity warning MUST include a direct navigation action (link or button) that takes the user to the plan upgrade section of the Billing page.
- **FR-006**: When `isOverLimit` is already true, the near-capacity warning MUST be suppressed in favour of the existing over-limit alert to prevent duplicate messages.
- **FR-007**: When `isExpired` is true, the near-capacity warning MUST be suppressed in favour of the existing expiry alert.
- **FR-008**: The `SubscriptionStatusBanner` component used in the global app shell MUST show the near-capacity warning (with the same suppression rules as FR-006 and FR-007) so admins are alerted outside the Billing page.
- **FR-009**: No new backend endpoint is required; the feature MUST derive all capacity data from the existing `GET /api/subscription/current` response fields (`studentCount`, `isOverLimit`, and the plan's `maxStudents` via the subscription data).
- **FR-010**: The capacity display and alert MUST be visible only to users with roles that can access the Billing page (admin, super_admin, bursar); other roles are unaffected.

### Key Entities

- **SubscriptionPlan**: Represents a billing tier. Key attribute for this feature: `maxStudents` (integer or null for unlimited). Sourced from `GET /api/subscription/plans` and embedded in the current-subscription response.
- **CurrentSubscriptionResponse**: The payload returned by `GET /api/subscription/current`. Relevant fields: `studentCount` (number of enrolled students for this tenant), `isOverLimit` (boolean), `isExpired` (boolean), `subscription.planId` (to cross-reference plan limit). Already consumed by `useSubscription` hook.
- **CapacityState** *(derived, frontend only)*: Computed values — `usedPercentage`, `remainingSlots`, `isNearCapacity` (true when `usedPercentage >= 75` and plan is finite and not over-limit). Lives in the `useSubscription` hook or a dedicated `useCapacity` helper.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin visiting the Billing page can read the current enrolled student count, plan limit, and remaining slots within 2 seconds of page load (subject to API response time).
- **SC-002**: The near-capacity warning banner appears on the Billing page in 100% of cases where `studentCount / maxStudents ≥ 0.75` and the plan is finite and active.
- **SC-003**: The near-capacity warning is suppressed in 100% of cases where `isOverLimit` is true or `isExpired` is true, ensuring no duplicate or conflicting alerts are shown.
- **SC-004**: The global `SubscriptionStatusBanner` displays the near-capacity warning on non-Billing pages under the same conditions as SC-002, with zero additional API calls (data is reused from the existing cached query).
- **SC-005**: Schools on unlimited (Enterprise) plans see no capacity-related warnings or bars, reducing noise for users who are unaffected by student limits.

## Assumptions

- The existing `GET /api/subscription/current` API already returns `studentCount` and `isOverLimit`; no backend changes are needed for the core capacity data.
- The near-capacity threshold is fixed at 75% usage (≤ 25% remaining). This value may be made configurable in a future iteration but is hardcoded for this feature.
- The capacity widget and alert target users with the `admin`, `super_admin`, or `bursar` role — consistent with existing Billing page access control.
- The `SubscriptionStatusBanner` is already rendered in the main app layout on every authenticated page; this feature extends it rather than creating a new global component.
- Enterprise (unlimited) plan is identified by `maxStudents === null`; this convention is already established in the codebase.
- Mobile responsiveness follows existing TailwindCSS patterns; no separate mobile design is required.
