# Feature Specification: Paynow Subscription Packages

**Feature Branch**: `024-paynow-subscriptions`  
**Created**: 2026-04-10  
**Status**: Draft  
**Input**: User description: "Implement a subscription feature integrated with the Paynow gateway. The system should support four subscription packages based on the number of students: 1. Free package for schools with fewer than 50 students. 2. Package for schools with fewer than 250 students. 3. Package for schools with fewer than 350 students. 4. Package for schools with more than 350 students. Each package should have both monthly and annual pricing options."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - School Selects and Activates a Subscription Plan (Priority: P1)

A school administrator logs into SchoolLedger and navigates to the subscription/billing section. They view available packages, see the one recommended based on their current student count, choose monthly or annual billing, and initiate payment via Paynow. On successful payment, their subscription is activated and they can continue using the system.

**Why this priority**: This is the core revenue flow. Without it, the entire subscription feature has no value. All other stories depend on a subscription existing.

**Independent Test**: Can be fully tested by creating a school account, going through the plan selection UI, completing a Paynow payment in test mode, and verifying the subscription is recorded as active.

**Acceptance Scenarios**:

1. **Given** a school administrator is logged in and has no active subscription, **When** they visit the subscription page, **Then** they see all four packages with both monthly and annual pricing clearly displayed, and the package matching their student count is highlighted as recommended.
2. **Given** a school administrator selects a paid package and chooses monthly billing, **When** they initiate payment via Paynow and the payment succeeds, **Then** their subscription is activated with the correct plan, billing cycle, and expiry date recorded.
3. **Given** a school administrator with fewer than 50 students, **When** they visit the subscription page, **Then** the Free package is pre-selected and they can activate it without initiating a payment.
4. **Given** a Paynow payment is initiated, **When** the payment fails or is cancelled, **Then** no subscription is activated and the administrator is shown a clear error/retry option.

---

### User Story 2 - Annual Billing Discount is Applied (Priority: P2)

A school administrator chooses annual billing for a paid plan and can clearly see the discounted annual price compared to paying monthly for 12 months, motivating the upgrade to annual.

**Why this priority**: Annual pricing is a key monetization lever and must be accurately represented and enforced during checkout. It also affects renewal logic.

**Independent Test**: Can be fully tested by selecting a paid plan with annual billing and verifying the amount charged through Paynow matches the defined annual price (not 12× the monthly price).

**Acceptance Scenarios**:

1. **Given** a school selects a paid package, **When** they toggle between monthly and annual billing, **Then** the displayed price updates to reflect the correct rate for each billing cycle.
2. **Given** a school activates an annual subscription, **When** payment is confirmed, **Then** the subscription expiry is set 12 months from activation and the annual price is recorded.

---

### User Story 3 - Subscription Status Enforced on System Access (Priority: P3)

When a school's subscription expires or they exceed the student limit for their current plan, they are notified and restricted from features that require an active or upgraded plan.

**Why this priority**: This enforces the business model. Without enforcement, schools have no incentive to subscribe or upgrade.

**Independent Test**: Can be tested by manually expiring a subscription in the database and verifying that the relevant features are inaccessible with a clear subscription prompt displayed.

**Acceptance Scenarios**:

1. **Given** a school's subscription has expired, **When** they log in or access a restricted feature, **Then** they see a clear notification that their subscription has expired and a prompt to renew.
2. **Given** a school on a plan for fewer than 250 students has added 250 or more students, **When** they attempt to add another student or access a feature tied to their plan limit, **Then** they are notified that they have exceeded their plan's student limit and prompted to upgrade.
3. **Given** a school is on the Free plan and reaches 50 students, **When** they attempt to add a 50th student, **Then** they are blocked and shown a prompt to upgrade to a paid plan.

---

### User Story 4 - Subscription Upgrade or Plan Change (Priority: P4)

A school administrator can upgrade their subscription to a higher tier at any time. The system handles the transition and prorates or adjusts billing accordingly via Paynow.

**Why this priority**: Schools grow and need to move between plans. This story ensures long-term retention and revenue growth.

**Independent Test**: Can be tested by activating a lower-tier plan and then initiating an upgrade, verifying the new plan takes effect and payment is processed for the difference or new cycle.

**Acceptance Scenarios**:

1. **Given** a school is on the under-250-students plan, **When** they choose to upgrade to the under-350-students plan, **Then** a new Paynow payment is initiated for the new plan's price and upon success the plan is updated.
2. **Given** a school upgrades mid-cycle, **When** the upgrade is confirmed, **Then** the new plan's limits apply immediately and the expiry is set based on the new billing cycle start.

---

### Edge Cases

- What happens when a school's student count falls below the threshold of their current paid plan (e.g., can they downgrade)?
- How does the system handle a Paynow webhook that arrives out of order or is duplicated?
- What happens if a school's student count is exactly at a tier boundary (e.g., exactly 50, 250, or 350 students)?
- How does the system behave if Paynow is temporarily unavailable during payment initiation?
- What happens to data access when a subscription is in a pending payment state (payment initiated but not yet confirmed)?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST define four subscription tiers: Free (0–49 students), Standard (50–249 students), Advanced (250–349 students), and Enterprise (350+ students).
- **FR-002**: System MUST offer both monthly and annual billing options for all paid tiers (Standard, Advanced, Enterprise).
- **FR-003**: System MUST display all available subscription packages with their student limits and both pricing options on a subscription/billing management page.
- **FR-004**: System MUST automatically recommend the appropriate package based on the school's current registered student count.
- **FR-005**: System MUST initiate payment for paid subscriptions exclusively through the Paynow payment gateway.
- **FR-006**: System MUST activate a school's subscription only after receiving confirmed payment confirmation from Paynow.
- **FR-007**: System MUST record each subscription's plan, billing cycle (monthly or annual), start date, and expiry date.
- **FR-008**: System MUST enforce student count limits per plan, preventing schools from adding students beyond their plan's maximum without upgrading.
- **FR-009**: System MUST notify school administrators when their subscription is within 7 days of expiry and again upon expiry.
- **FR-010**: System MUST allow school administrators to upgrade their plan at any time, triggering a new Paynow payment for the new plan.
- **FR-011**: System MUST allow schools with fewer than 50 students to activate the Free plan without initiating any payment.
- **FR-012**: System MUST handle Paynow payment failure gracefully, not activating any subscription and presenting a clear retry path.
- **FR-013**: System MUST store a record of each payment transaction linked to the school and subscription period.
- **FR-014**: System MUST [NEEDS CLARIFICATION: specify pricing amounts for each paid tier and billing cycle — e.g., monthly/annual prices in USD or local currency for Standard, Advanced, Enterprise].

### Key Entities

- **SubscriptionPlan**: Represents a tier definition — name, student limit, monthly price, annual price.
- **SchoolSubscription**: Represents an active or historical subscription for a school — linked school, selected plan, billing cycle, start date, expiry date, status (active/expired/pending).
- **PaymentTransaction**: Represents a payment event — linked school, subscription, amount, currency, Paynow reference, status (pending/successful/failed), timestamp.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A school administrator can select a plan, complete Paynow payment, and have their subscription activated within 3 minutes end-to-end.
- **SC-002**: 100% of subscription activations are preceded by a confirmed Paynow payment record — no free access to paid features without payment.
- **SC-003**: Schools exceeding their plan's student limit are blocked from adding further students with a visible upgrade prompt within 1 second of hitting the limit.
- **SC-004**: Subscription expiry notifications are delivered to administrators at least 7 days before expiry with zero missed notifications.
- **SC-005**: Annual plan pricing represents a measurable saving versus 12 monthly payments, and the correct amount is charged every time without manual override.
- **SC-006**: Payment failures result in zero erroneous subscription activations across all test and production scenarios.

## Assumptions

- School administrators have internet access and a Paynow-compatible payment method (mobile money or card).
- The Paynow gateway supports both a test/sandbox mode and a production mode; initial integration will use the sandbox.
- Pricing amounts (in local currency) for each tier and billing cycle will be confirmed by the product owner before implementation begins — placeholder values will be used in development.
- Downgrading to a lower plan tier is out of scope for the initial release; only upgrades are supported.
- The system already has an authenticated school administrator account model — subscription management is an extension of the existing admin area.
- Annual pricing is defined as a fixed discounted amount (not auto-calculated as a percentage of monthly price) to allow pricing flexibility.
- Subscription renewal is manual (administrator-initiated) in v1; automatic renewal is out of scope.
- Only one active subscription per school is allowed at a time.
