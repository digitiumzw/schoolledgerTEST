# Feature Specification: Subscription Enforcement & Plan Recommendation

**Feature Branch**: `029-subscription-enforcement`  
**Created**: 2026-04-13  
**Status**: Draft  
**Input**: User description: "When a user does not have an active plan, the system should disable all essential operations and continuously prompt the user to subscribe to a plan. Additionally, based on the number of students the user has, the system should recommend the most appropriate subscription plan."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Essential Operations Blocked Without Active Subscription (Priority: P1)

When an admin or bursar logs in and there is no active subscription (i.e., the school has never subscribed, or the subscription has expired and not been renewed), the system prevents them from performing any essential operation — such as enrolling students, recording payments, managing classes, or editing fee structures. Instead of silently failing, every blocked entry point shows a clear, persistent prompt explaining that a subscription is required and providing a direct path to subscribe.

**Why this priority**: This is the core enforcement mechanism. Without it, the system has no gate around paid functionality. All other stories depend on a subscription existing.

**Independent Test**: Can be fully tested by revoking or expiring a school's subscription and verifying that navigating to Students, Payments, Classes, Attendance, and Settings pages all result in a blocked state with a subscribe prompt, while the Billing page remains fully accessible.

**Acceptance Scenarios**:

1. **Given** a school has no active subscription, **When** an admin navigates to the Students page, **Then** the page content is replaced (or overlaid) by a "No active plan" message with a "Subscribe now" call-to-action linking to the Billing page, and no student records or add-student controls are accessible.
2. **Given** a school has no active subscription, **When** a bursar navigates to the Payments page, **Then** the payment recording interface is blocked and a subscribe prompt is shown.
3. **Given** a school has no active subscription, **When** an admin attempts to access Classes, Attendance, or Settings, **Then** all of these pages display the same blocked state.
4. **Given** a school has no active subscription, **When** an admin navigates to the Billing page, **Then** the Billing page loads fully without any block, so the user can subscribe.
5. **Given** a school has an active subscription, **When** any user navigates to any protected page, **Then** no subscription block is shown and the page renders normally.
6. **Given** a school's subscription has just expired, **When** any user navigates to a protected page, **Then** the expired-subscription block is shown (same enforcement gate as no-subscription).

---

### User Story 2 - Persistent Subscribe Prompt Across the Application (Priority: P2)

When a school has no active subscription, in addition to blocking page content, the application continuously surfaces a persistent, prominently-placed prompt — such as a full-width banner in the app shell — on every authenticated page. This ensures the user is never unaware of the subscription requirement, regardless of which page they land on after login.

**Why this priority**: The page-level block (P1) protects individual features, but without a persistent app-level prompt the user may not understand why content is missing or what to do. P2 ensures the call-to-action is always visible.

**Independent Test**: Can be fully tested independently by verifying that the app-shell subscription banner appears on every authenticated page (including the Dashboard) when no active subscription exists, and that it links to the Billing page.

**Acceptance Scenarios**:

1. **Given** a school has no active subscription, **When** an admin loads any authenticated page, **Then** a prominent banner (distinct from existing expiry/over-limit banners) appears at the top of every page reading approximately "You don't have an active plan. Subscribe to unlock all features." with a "Subscribe now" link to `/billing`.
2. **Given** a school has no active subscription, **When** an admin visits the Billing page, **Then** the persistent banner is still shown (the page is not blocked, but the user is still reminded to subscribe).
3. **Given** a school has an active subscription, **When** any user visits any page, **Then** the no-subscription banner is not shown.
4. **Given** the subscription has expired (previously active, now expired), **When** any user visits any page, **Then** the same persistent banner appears, distinct from the "expiring soon" warning.

---

### User Story 3 - Student-Count-Based Plan Recommendation (Priority: P3)

When a school without an active plan visits the Billing page (or views the plan selector anywhere), the system analyses the school's current enrolled student count and highlights the subscription plan that best fits their actual usage — specifically, the lowest-tier plan whose student limit is equal to or greater than their current student count. This recommendation is surfaced as a visual badge or highlight on the relevant plan card.

**Why this priority**: Reduces decision friction for new subscribers. It depends on P1 (user reaching the Billing page) and enriches the subscription experience, but does not block any functionality on its own.

**Independent Test**: Can be fully tested by setting a school's student count to a known value (e.g., 200 students) and verifying that the plan card for "Starter" (limit 249) is marked as recommended, while Growth and Enterprise are not. Also verifiable when student count exceeds 249, confirming "Growth" becomes recommended, and when count exceeds 349, "Enterprise" becomes recommended.

**Acceptance Scenarios**:

1. **Given** a school has 200 enrolled students and no active plan, **When** an admin opens the Billing page, **Then** the "Starter" plan card (max 249 students) is visually highlighted as "Recommended for you" and the other plan cards are not highlighted.
2. **Given** a school has 270 enrolled students and no active plan, **When** an admin opens the Billing page, **Then** the "Growth" plan card (max 349 students) is highlighted as recommended (Starter does not fit — student count exceeds its limit).
3. **Given** a school has 400 enrolled students and no active plan, **When** an admin opens the Billing page, **Then** the "Enterprise" plan card (unlimited) is highlighted as recommended.
4. **Given** a school has 0 enrolled students and no active plan, **When** an admin opens the Billing page, **Then** the "Starter" plan (lowest tier) is highlighted as recommended.
5. **Given** a school already has an active subscription, **When** an admin opens the Billing page, **Then** the recommendation logic still runs, but the plan appropriate for the current student count is highlighted (consistent behaviour whether subscribed or not).

---

### Edge Cases

- What if the school has no students yet and no plan? → Recommend the lowest available plan (Starter) as the default.
- What if the student count exactly equals a plan's `max_students`? → That plan is at-limit; recommend the next tier up, since capacity-enforcement logic treats `studentCount >= max_students` as over-limit.
- What if all plans are unavailable (no active plans returned by the API)? → The plan selector shows an appropriate empty state; the subscribe prompt still appears but no specific plan can be recommended.
- What if subscription data is still loading? → The page-level block shows a loading skeleton, not the subscribe prompt, to avoid a flash of incorrect state.
- What if a user is on the Billing page and subscribes successfully (payment confirmed)? → The persistent banner and page blocks are immediately lifted without requiring a manual page reload (subscription cache is invalidated on payment confirmation).
- What if a `super_admin` account has no subscription? → Enforcement applies equally to all roles that access protected pages; `super_admin` is not exempt.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST detect the absence of an active subscription by checking whether `GET /api/subscription/current` returns `subscription: null` or a subscription with `status: 'expired'`.
- **FR-002**: When no active subscription is detected, the system MUST prevent access to all essential operational pages — specifically: Students, Payments, Classes, Attendance, Staff, Transport, and Settings — by overlaying or replacing their content with a "No active plan" blocked state.
- **FR-003**: The blocked state on each essential-operations page MUST include a clear message explaining the subscription requirement and a direct call-to-action (link or button) navigating to the Billing page (`/billing`).
- **FR-004**: The Billing page MUST remain fully accessible at all times, regardless of subscription status, so users can subscribe or renew.
- **FR-005**: When no active subscription is present, the application shell MUST display a persistent, full-width banner on every authenticated page that prompts the user to subscribe, distinct from existing expiry and over-limit banners.
- **FR-006**: The persistent no-subscription banner MUST include a direct link to `/billing` and MUST remain visible until the subscription status transitions to active (i.e., payment is confirmed and subscription cache is refreshed).
- **FR-007**: The system MUST determine the recommended subscription plan by finding the lowest-tier plan (smallest `sort_order`) whose `max_students` value is greater than the school's current `studentCount`, or the highest-tier plan if no finite-limit plan accommodates the student count.
- **FR-008**: The recommended plan MUST be visually distinguished on the plan selector (e.g., "Recommended" badge) both on the Billing page and in any other surface that renders plan cards.
- **FR-009**: The recommendation MUST update dynamically if the student count changes (on next subscription data refresh) without requiring a page reload.
- **FR-010**: The enforcement gate MUST be enforced exclusively on the frontend; the existing backend API already enforces business rules independently, so no new backend enforcement endpoint is required for this feature.
- **FR-011**: The blocked state and persistent banner MUST be suppressed for public/kiosk routes (`/kiosk/*`, `/login`) that do not require a subscription.
- **FR-012**: The Help page MUST remain accessible without a subscription so users can seek support.

### Key Entities

- **CurrentSubscriptionResponse**: Returned by `GET /api/subscription/current`. The key field for enforcement is `subscription` (null or an object with `status`). Also provides `studentCount` and `recommendedPlanId` (currently always the top plan — this feature overrides the recommendation logic client-side to be student-count-aware).
- **SubscriptionPlan**: Represents a billing tier with `id`, `name`, `maxStudents` (integer or null), `sortOrder`, and price fields. Sourced from `GET /api/subscription/plans`. Used by the recommendation algorithm to find the minimum-viable plan for the current student count.
- **EnforcementState** *(derived, frontend only)*: A boolean flag `hasActivePlan` derived from `subscription !== null && subscription.status === 'active'`. Consumed by the app shell banner and each protected page to decide whether to render normal content or the blocked state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of essential-operations pages (Students, Payments, Classes, Attendance, Staff, Transport, Settings) display the blocked state within one render cycle when `hasActivePlan` is false, with zero data from the blocked page leaking through to the user.
- **SC-002**: The persistent no-subscription banner appears on every authenticated page (including Dashboard) within 2 seconds of page load when no active plan exists.
- **SC-003**: The Billing page and Help page load fully without any block in 100% of cases, regardless of subscription status.
- **SC-004**: The plan recommendation correctly identifies the minimum-suitable plan in 100% of test cases across all student-count boundaries (0–249 → Starter, 250–349 → Growth, 350+ → Enterprise).
- **SC-005**: When a payment is confirmed and the subscription becomes active, the enforcement blocks and persistent banner disappear within the next subscription data refresh cycle (≤ 2 minutes by default cache TTL, or immediately on manual refresh).
- **SC-006**: No additional API calls beyond the existing `GET /api/subscription/current` and `GET /api/subscription/plans` are introduced by this feature.

## Assumptions

- "No active plan" is defined as: `subscription === null` OR `subscription.status === 'expired'`. A `pending` subscription (payment initiated but not confirmed) also counts as no active plan.
- Essential operations subject to enforcement are: Students, Payments, Classes, Attendance, Staff, Transport, and Settings. The Dashboard (Index), Billing, and Help pages are exempt from blocking.
- The recommendation algorithm is implemented client-side using the already-fetched plan list and student count, overriding the server-side `recommendedPlanId` (which currently always returns the top-tier plan).
- Kiosk routes (`/kiosk/*`) and the Login page are public and exempt from all enforcement gates.
- The existing `useSubscription` hook and `SubscriptionStatusBanner` are extended; no new global state provider is required.
- Plan tiers and their student-count boundaries match the current seeded data: Starter (≤249), Growth (≤349), Enterprise (unlimited). If plans change, the recommendation algorithm adapts dynamically from the API response.
- Mobile responsiveness follows existing TailwindCSS patterns used throughout the application.
