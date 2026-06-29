# Feature Specification: Billing Plans Management

**Feature Branch**: `026-billing-plans-management`  
**Created**: 2026-04-12  
**Status**: Draft  
**Input**: User description: "In the billing section, include only three packages. Remove the free plan, and rename the remaining packages with appropriate names. user should be able to view current plan, upgrade/downgrade, download invoices, the billing history should only show important billing"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Current Plan and Billing Overview (Priority: P1)

A school administrator opens the billing section and immediately sees their active subscription plan — including the plan name, student limit, billing cycle, next renewal date, and current status. They can tell at a glance whether their subscription is active, expiring soon, or lapsed.

**Why this priority**: This is the foundational view of the billing section. Every other action (upgrade, download invoice) starts from this screen. Without it, no other billing capability is accessible or useful.

**Independent Test**: Can be fully tested by logging in as a school administrator with an active subscription and verifying that the billing overview page displays the correct plan name, student limit, billing cycle, renewal date, and status badge.

**Acceptance Scenarios**:

1. **Given** a school administrator is logged in with an active subscription, **When** they navigate to the billing section, **Then** they see their current plan name, student limit, billing cycle (monthly/annual), next renewal date, and an "Active" status indicator.
2. **Given** a school administrator's subscription expires within 7 days, **When** they view the billing section, **Then** the plan status shows an "Expiring Soon" warning with the exact days remaining.
3. **Given** a school administrator's subscription has expired, **When** they view the billing section, **Then** the plan status shows "Expired" and a prominent call-to-action to renew or upgrade is displayed.
4. **Given** a school with no active subscription, **When** they visit the billing section, **Then** they are shown all three available plans with a prompt to subscribe.

---

### User Story 2 - Upgrade or Downgrade Subscription Plan (Priority: P2)

A school administrator can change their current subscription plan — either upgrading to a higher tier as the school grows, or downgrading to a lower tier. The system guides them through selecting the new plan and completing payment as needed.

**Why this priority**: Schools grow and shrink over time. Enabling plan changes directly from the billing section removes friction and reduces support requests for plan adjustments.

**Independent Test**: Can be fully tested by activating a mid-tier plan, then upgrading to the top-tier plan via the billing section, confirming a Paynow payment, and verifying the new plan is immediately reflected on the billing overview.

**Acceptance Scenarios**:

1. **Given** a school administrator is on the Starter plan, **When** they click "Change Plan", **Then** they see all three plans with their current plan highlighted and upgrade/downgrade options clearly labeled.
2. **Given** a school administrator selects a higher-tier plan and confirms, **When** Paynow payment succeeds, **Then** the new plan is immediately activated, the billing overview reflects the updated plan, and the old plan is superseded.
3. **Given** a school administrator selects a lower-tier plan (downgrade), **When** they confirm, **Then** the system warns them if their current student count exceeds the lower plan's limit, and proceeds only after acknowledgement.
4. **Given** a school administrator initiates a plan change and payment fails, **When** the failure is confirmed, **Then** the existing plan remains unchanged and the administrator is shown a clear error with a retry option.
5. **Given** a school administrator attempts to downgrade but their student count exceeds the target plan's limit, **When** they proceed, **Then** they are blocked with a message explaining the conflict and the number of students that must be removed first.

---

### User Story 3 - Download Invoices (Priority: P3)

A school administrator can access a list of their past invoices from the billing section and download any individual invoice as a document for record-keeping or accounting purposes.

**Why this priority**: Schools need documentation of payments for auditing, accounting, and governance. Invoice download is a standard billing expectation and reduces support load for invoice requests.

**Independent Test**: Can be fully tested by completing at least one Paynow payment, navigating to the billing section, locating the generated invoice in the list, and downloading it — verifying it contains the correct plan, amount, date, and school details.

**Acceptance Scenarios**:

1. **Given** a school administrator has at least one completed payment, **When** they navigate to the billing section, **Then** they see a list of invoices sorted by date (most recent first), each showing the date, plan name, billing cycle, and amount.
2. **Given** a school administrator clicks "Download" on an invoice, **When** the request is processed, **Then** a properly formatted invoice document is downloaded containing the school name, plan name, billing cycle, payment date, amount, and a unique invoice reference number.
3. **Given** a school administrator has no payment history, **When** they view the invoices section, **Then** a message indicates that no invoices are available yet.

---

### User Story 4 - View Condensed Billing History (Priority: P4)

A school administrator can view a focused billing history that shows only significant billing events — such as successful payments, plan activations, upgrades, downgrades, and subscription renewals — without being cluttered by low-value system events.

**Why this priority**: Billing history needs to be actionable and readable. Cluttered logs with every background event reduce trust and make it hard to find important records.

**Independent Test**: Can be fully tested by performing a subscription activation, an upgrade, and a renewal, then verifying the billing history shows exactly those three events with clear labels and no extraneous system noise.

**Acceptance Scenarios**:

1. **Given** a school administrator views the billing history, **When** the list loads, **Then** it shows only these event types: successful payments, plan activations, plan upgrades, plan downgrades, subscription renewals, and subscription expirations — in reverse chronological order.
2. **Given** a billing event occurs (e.g., payment confirmed), **When** the administrator next views the billing history, **Then** the new event appears at the top of the list with a human-readable label, the plan name, amount (if applicable), and date/time.
3. **Given** there are more than 20 billing events, **When** the administrator views the history, **Then** the list is paginated or shows a "Load more" option — the most recent 20 events are shown by default.

---

### Edge Cases

- What happens when a school tries to downgrade to a plan whose student limit is below their current registered student count?
- How does the system handle a Paynow payment for a plan change that arrives after a duplicate webhook?
- What happens if an invoice PDF cannot be generated due to a temporary system error?
- What if a school has no billing history at all — how is the billing section displayed?
- What happens when a school is mid-billing-cycle and upgrades — does the renewal date reset or carry over?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST define exactly three paid subscription tiers: **Starter** (up to 249 students), **Growth** (up to 349 students), and **Enterprise** (350+ students). The free plan is removed entirely.
- **FR-002**: System MUST offer both monthly and annual billing options for all three subscription tiers.
- **FR-003**: System MUST display a billing overview page showing the school's current plan name, student limit, billing cycle, subscription status, and next renewal date.
- **FR-004**: System MUST allow school administrators to initiate a plan upgrade or downgrade from the billing section at any time.
- **FR-005**: System MUST enforce student count limits during downgrades — a downgrade is blocked if the school's current student count exceeds the target plan's student limit, and the administrator is shown a clear explanation.
- **FR-006**: System MUST process all plan changes (upgrades and downgrades) through the Paynow payment gateway where payment is required.
- **FR-007**: System MUST activate the new plan immediately upon confirmed Paynow payment for a plan change.
- **FR-008**: System MUST leave the existing plan unchanged if a plan-change payment fails or is cancelled, and present a clear error with a retry option.
- **FR-009**: System MUST generate an invoice for every successful payment, containing: school name, invoice reference number, plan name, billing cycle, payment date, and amount paid.
- **FR-010**: System MUST allow school administrators to download any of their invoices as a document from the billing section.
- **FR-011**: System MUST display a billing history list containing only significant events: successful payments, plan activations, upgrades, downgrades, renewals, and expirations — ordered by most recent first.
- **FR-012**: System MUST paginate the billing history list, displaying a maximum of 20 events per page with navigation to older events.
- **FR-013**: System MUST display a subscription status indicator (Active, Expiring Soon, Expired) on the billing overview, with "Expiring Soon" shown when fewer than 7 days remain.
- **FR-014**: System MUST notify school administrators when their subscription is within 7 days of expiry and again on the expiry date.
- **FR-015**: System MUST display all three plans with their student limits and pricing when a school has no active subscription, with a clear call-to-action to subscribe.

### Key Entities

- **SubscriptionPlan**: Represents a tier definition — name (Starter, Growth, Enterprise), student limit, monthly price, annual price.
- **SchoolSubscription**: Represents a school's active or historical subscription — linked school, selected plan, billing cycle, start date, expiry date, status (active / expiring-soon / expired).
- **PaymentTransaction**: Represents a Paynow payment event — linked school, subscription, invoice reference, amount, billing cycle, status (pending / successful / failed), timestamp.
- **Invoice**: Represents a downloadable billing record — linked payment transaction, school name, plan name, billing cycle, payment date, amount, unique reference number.
- **BillingEvent**: Represents a significant billing history entry — event type (payment / activation / upgrade / downgrade / renewal / expiration), linked school, plan name, amount (if applicable), timestamp.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A school administrator can view their current plan details, status, and next renewal date within 2 seconds of opening the billing section.
- **SC-002**: A school administrator can complete a plan upgrade or downgrade — from selecting the new plan to confirmed activation — in under 3 minutes end-to-end.
- **SC-003**: 100% of plan activations and changes are linked to a confirmed Paynow payment record — no plan is changed without a successful payment.
- **SC-004**: Every successful payment results in a downloadable invoice being available within 1 minute of payment confirmation.
- **SC-005**: The billing history list contains zero low-value system noise events; only the defined significant event types are shown.
- **SC-006**: Downgrade attempts that would violate student count limits are blocked 100% of the time with a user-readable explanation.
- **SC-007**: Subscription expiry notifications are delivered to administrators at least 7 days before expiry with zero missed notifications.

## Assumptions

- The Free plan (0–49 students) defined in the previous subscription spec (`024-paynow-subscriptions`) is removed; schools that previously used the free plan will be prompted to choose one of the three paid plans.
- Pricing amounts (in local currency) for Starter, Growth, and Enterprise tiers (monthly and annual) will be confirmed by the product owner before implementation; placeholder values are used during development.
- This spec supersedes and replaces the plan structure defined in `024-paynow-subscriptions` with respect to the number and names of subscription tiers.
- Invoice downloads are generated as PDF documents.
- Downgrading is permitted as long as the student count constraint is met, overriding the out-of-scope assumption from the previous spec.
- Subscription renewal remains manual (administrator-initiated) in this version; automatic renewal is out of scope.
- Only one active subscription per school is allowed at a time.
- School administrators are the only role with access to billing section actions (view plan, change plan, download invoices).
