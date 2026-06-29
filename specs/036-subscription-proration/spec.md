# Feature Specification: Subscription Proration for Mid-Cycle Upgrades

**Feature Branch**: `036-subscription-proration`  
**Created**: 2026-04-16  
**Status**: Draft  
**Input**: User description: "When a customer upgrades their subscription plan mid-cycle, the system should: Calculate the unused portion of the current plan, Credit that unused value, Charge the user a prorated amount for the new plan for the remainder of the billing cycle"

## User Scenarios & Testing *(mandatory)*

<!--
  IMPORTANT: User stories should be PRIORITIZED as user journeys ordered by importance.
  Each user story/journey must be INDEPENDENTLY TESTABLE - meaning if you implement just ONE of them,
  you should still have a viable MVP (Minimum Viable Product) that delivers value.
  
  Assign priorities (P1, P2, P3, etc.) to each story, where P1 is the most critical.
  Think of each story as a standalone slice of functionality that can be:
  - Developed independently
  - Tested independently
  - Deployed independently
  - Demonstrated to users independently
-->

### User Story 1 - Upgrade Subscription with Proration (Priority: P1)

As a customer, I want to upgrade my subscription plan mid-cycle and have the system automatically calculate and apply prorated credits and charges, so I pay fairly for only the time I use each plan.

**Why this priority**: This is the core value of the feature - enabling fair billing for plan upgrades without requiring customer service intervention. This directly impacts revenue and customer satisfaction.

**Independent Test**: Can be fully tested by initiating a plan upgrade mid-billing cycle and verifying that: (1) the unused portion of the current plan is calculated correctly, (2) a credit is applied, (3) a prorated charge for the new plan is created, and (4) the customer is charged the net amount.

**Acceptance Scenarios**:

1. **Given** a customer on a $100/month plan with 15 days remaining in the billing cycle, **When** they upgrade to a $200/month plan, **Then** the system calculates a $50 credit for unused time on the old plan and a $100 charge for the remaining 15 days on the new plan, resulting in a net charge of $50.

2. **Given** a customer on an annual $1000/year plan with 6 months remaining, **When** they upgrade to a $1500/year plan, **Then** the system calculates a $500 credit and a $750 prorated charge for the remaining period, resulting in a net charge of $250.

---

### User Story 2 - View Proration Breakdown (Priority: P2)

As a customer, I want to see a clear breakdown of how my prorated charges and credits were calculated before confirming the upgrade, so I can understand and trust the billing.

**Why this priority**: Transparency builds customer trust and reduces support inquiries. This provides visibility without blocking the core upgrade functionality.

**Independent Test**: Can be fully tested by requesting a plan upgrade and verifying that a detailed breakdown showing: days remaining, unused value calculation, new plan prorated cost, and net amount is displayed before confirmation.

**Acceptance Scenarios**:

1. **Given** a customer viewing the upgrade confirmation screen, **When** they review the proration details, **Then** they see: days remaining in current cycle, unused value credit amount, new plan's prorated charge, and the net amount to be charged.

---

### User Story 3 - Handle Downgrade Scenarios (Priority: P3)

As a customer, if I choose to downgrade my plan mid-cycle, I want the system to handle the proration correctly, applying appropriate credits for the difference.

**Why this priority**: Downgrades are less frequent than upgrades but still important for a complete proration system. This ensures consistency in billing logic across all plan changes.

**Independent Test**: Can be fully tested by initiating a plan downgrade mid-billing cycle and verifying that the customer receives a credit for the price difference that can be applied to future invoices.

**Acceptance Scenarios**:

1. **Given** a customer on a $200/month plan with 15 days remaining, **When** they downgrade to a $100/month plan, **Then** the system calculates a $100 credit for the unused premium time and applies it to their account for future use.

### Edge Cases

- **Upgrade on billing cycle day**: When a customer upgrades exactly on their billing date, no proration should occur - they start fresh on the new plan.
- **Upgrade to same-priced plan**: When a customer switches to a plan with identical pricing, the proration should result in zero net charge.
- **Failed payment for prorated charge**: When the prorated charge fails (e.g., insufficient funds), the upgrade should not be completed and the customer should remain on their current plan.
- **Multiple upgrades in one cycle**: When a customer upgrades multiple times within a single billing cycle, each upgrade should be calculated independently from the current plan at that moment.
- **Refund threshold exceeded**: When a downgrade results in a credit exceeding certain thresholds, the system should handle it according to the refund policy (e.g., apply to future invoices vs. immediate refund).

## Requirements *(mandatory)*

<!--
  ACTION REQUIRED: The content in this section represents placeholders.
  Fill them out with the right functional requirements.
-->

### Functional Requirements

- **FR-001**: System MUST calculate the unused portion of the current subscription plan based on days remaining in the billing cycle when a customer initiates a plan change.
- **FR-002**: System MUST create a credit for the unused value of the current plan, calculated as: (Plan Price / Days in Cycle) * Days Remaining.
- **FR-003**: System MUST calculate a prorated charge for the new plan for the remaining days in the current billing cycle.
- **FR-004**: System MUST charge the customer the net amount (Prorated New Plan Charge - Unused Value Credit).
- **FR-005**: System MUST display a proration breakdown to the customer before confirming the upgrade, showing: days remaining, credit amount, new plan charge, and net amount.
- **FR-006**: System MUST handle both upgrades (higher priced plans) and downgrades (lower priced plans) using consistent proration logic.
- **FR-007**: System MUST apply any resulting credits to the customer's account for use against future invoices.
- **FR-008**: System MUST process the prorated charge immediately upon upgrade confirmation.
- **FR-009**: System MUST revert the upgrade if the prorated charge payment fails, keeping the customer on their original plan.
- **FR-010**: System MUST record all proration calculations and transactions for audit and customer support purposes.

### Key Entities *(include if feature involves data)*

- **Subscription**: Represents a customer's active plan, including: plan details, billing cycle start/end dates, current status, and associated payment method.
- **Plan**: Represents a subscription tier, including: name, price, billing interval (monthly/annual), and features.
- **Proration Calculation**: Represents the computed values for a plan change, including: original plan, new plan, days remaining, unused value credit, new plan prorated charge, net amount, and timestamp.
- **Credit**: Represents a credit applied to a customer's account, including: amount, reason (proration), expiration (if applicable), and remaining balance.
- **Prorated Charge**: Represents an immediate charge for the remaining billing cycle, including: amount, associated subscription, and payment status.

## Success Criteria *(mandatory)*

<!--
  ACTION REQUIRED: Define measurable success criteria.
  These must be technology-agnostic and measurable.
-->

### Measurable Outcomes

- **SC-001**: Proration calculations are accurate to the cent for 100% of upgrade transactions.
- **SC-002**: Customers can view and understand the proration breakdown within 10 seconds of viewing the upgrade confirmation screen.
- **SC-003**: Support tickets related to billing confusion for plan changes are reduced by 40% within 3 months of launch.
- **SC-004**: 95% of plan upgrades are completed without manual intervention from customer support.

## Assumptions

- Billing cycles are calculated based on calendar days (not business days).
- Proration is calculated using the formula: (Price / Total Days in Cycle) * Days Remaining.
- The existing subscription and billing system already tracks plan details, billing cycles, and payment methods.
- Customers have a valid payment method on file before initiating an upgrade.
- Credits from downgrades are applied to future invoices and do not expire.
- The system supports both monthly and annual billing intervals.
- Out-of-scope: Immediate cash refunds for downgrade credits - credits are account-bound only.
- Out-of-scope: Proration for usage-based billing components - only fixed-price plan proration is covered.
