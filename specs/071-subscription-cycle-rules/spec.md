# Feature Specification: Subscription Billing Cycle Transition Rules

**Feature Branch**: `071-subscription-cycle-rules`  
**Created**: 2026-05-11  
**Status**: Draft  
**Input**: User description: "The subscription rules should enforce a one-way billing cycle transition, where tenants are allowed to move from a monthly plan to an annual plan at any time, but once they are on an annual plan, they cannot switch back to monthly. Instead, while on an annual subscription, tenants can only upgrade or downgrade their plan tier (e.g., Basic → Premium) within the same annual cycle using prorated adjustments. This means if a tenant upgrades during an active annual subscription, the system calculates the price difference for the remaining period and charges only that amount, while keeping the original renewal date unchanged. By restricting annual-to-monthly transitions, you maintain predictable revenue and avoid the complexity of issuing credits or refunds for unused annual time. At the same time, allowing monthly-to-annual upgrades encourages longer commitments, and plan upgrades within the annual cycle give tenants flexibility without breaking the billing structure."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Monthly to Annual Plan Upgrade (Priority: P1)

A tenant administrator on a monthly billing cycle wants to switch to annual billing to benefit from potential cost savings and reduce administrative overhead. They can initiate this change at any time during their monthly subscription. The system calculates any necessary adjustments and transitions them to annual billing with a new annual renewal date.

**Why this priority**: This is the primary entry point for encouraging longer tenant commitments and improving revenue predictability. It enables the core one-way transition workflow and delivers immediate business value.

**Independent Test**: Can be fully tested by creating a tenant on a monthly plan, initiating an upgrade to annual billing, and verifying the subscription changes to annual with appropriate prorated calculations.

**Acceptance Scenarios**:

1. **Given** a tenant is on a monthly Basic plan with 15 days remaining in the current billing period, **When** the administrator initiates an upgrade to annual billing, **Then** the system calculates the prorated credit for unused monthly time, applies it toward the annual plan price, charges the difference, and sets the renewal date to 1 year from the original monthly period end date.

2. **Given** a tenant is on a monthly Premium plan at the start of a new billing period, **When** the administrator upgrades to annual billing, **Then** the system transitions immediately to annual billing, charges the full annual price (or prorated amount based on policy), and establishes a renewal date 1 year out.

3. **Given** a tenant is on a monthly plan, **When** the upgrade to annual is processed successfully, **Then** the system records the billing cycle change in the subscription history and prevents any future monthly plan selection.

---

### User Story 2 - Annual Plan Tier Upgrade with Proration (Priority: P1)

A tenant administrator on an annual Basic plan realizes they need Premium features mid-subscription. They want to upgrade their plan tier without waiting for renewal. The system calculates the price difference between Basic and Premium for the remaining subscription period and charges only that prorated amount, while keeping the original annual renewal date unchanged.

**Why this priority**: This provides flexibility for growing tenants to access higher-tier features immediately without breaking the billing structure or requiring full upfront payment for the new tier. It supports customer expansion revenue.

**Independent Test**: Can be fully tested by creating a tenant on an annual Basic plan, waiting a few months, then upgrading to Premium and verifying only the prorated difference is charged while the renewal date remains unchanged.

**Acceptance Scenarios**:

1. **Given** a tenant is 6 months into an annual Basic plan ($100/month, $1200/year) and wants to upgrade to Premium ($200/month, $2400/year), **When** the administrator initiates the tier upgrade, **Then** the system calculates the remaining 6 months at $100/month difference ($600), charges $600 immediately, grants immediate Premium access, and keeps the original renewal date unchanged.

2. **Given** a tenant on an annual plan upgrades their tier, **When** the prorated charge is calculated, **Then** the calculation uses the exact number of days remaining divided by 365 (or 366 for leap years), multiplied by the annual price difference.

3. **Given** a successful tier upgrade on an annual plan, **When** the upgrade is complete, **Then** the system logs the tier change with prorated amount in the billing history and sends a confirmation receipt to the tenant administrator.

---

### User Story 3 - Annual Plan Tier Downgrade (Priority: P1)

A tenant administrator on an annual Premium plan finds they no longer need all Premium features and want to downgrade to Basic. Since they are within an annual commitment, the system allows tier downgrades but handles them differently from upgrades—either deferring the change to renewal or applying the change immediately without refunds for the price difference.

**Why this priority**: This completes the tier flexibility story for annual subscribers. While downgrades don't generate immediate revenue, supporting them improves customer satisfaction and retention by allowing tenants to right-size their subscription.

**Independent Test**: Can be fully tested by creating a tenant on an annual Premium plan, initiating a downgrade to Basic, and verifying the change is applied according to the configured downgrade policy.

**Acceptance Scenarios**:

1. **Given** a tenant is on an annual Premium plan and initiates a downgrade to Basic, **When** the downgrade is processed with "effective immediately" policy, **Then** the tier changes to Basic immediately, no refund is issued for the remaining Premium time, and the renewal date remains unchanged with Basic pricing at next renewal.

2. **Given** a tenant is on an annual Premium plan and initiates a downgrade to Basic, **When** the downgrade is processed with "at renewal" policy, **Then** the system schedules the downgrade for the next renewal date, sends a confirmation, and processes the change at renewal to Basic pricing.

3. **Given** a downgrade is scheduled for renewal, **When** the administrator views their subscription details, **Then** they see both current tier (Premium) and pending tier (Basic) with the scheduled change date.

---

### User Story 4 - Block Annual to Monthly Transition (Priority: P1)

A tenant administrator on an annual plan attempts to switch back to monthly billing due to cash flow concerns. The system prevents this transition and provides a clear explanation of the one-way billing cycle policy, directing them to tier downgrade options instead if they need to reduce costs.

**Why this priority**: This enforces the core business rule that protects predictable revenue and prevents the complexity of pro-rating annual commitments back to monthly. It's essential for maintaining the integrity of the one-way transition policy.

**Independent Test**: Can be fully tested by attempting to change an annual subscription to monthly and verifying the system blocks the request with an appropriate error message.

**Acceptance Scenarios**:

1. **Given** a tenant is on an annual Basic plan, **When** the administrator attempts to change billing cycle to monthly, **Then** the system rejects the request with HTTP 422 status, displays a clear message explaining annual subscriptions cannot be converted to monthly, and suggests tier downgrade as an alternative cost reduction option.

2. **Given** a blocked annual-to-monthly transition attempt, **When** the error is displayed, **Then** the message explains that this policy maintains predictable service levels and avoids complex refund calculations.

3. **Given** an API consumer attempts to programmatically change an annual subscription to monthly, **When** the request is received, **Then** the API returns a 422 error with error code "ANNUAL_TO_MONTHLY_BLOCKED" and a descriptive message.

---

### Edge Cases

- **What happens when a tenant attempts multiple tier changes within the same annual period?** The system should support multiple upgrades or downgrades, each calculating proration from the current tier to the new tier based on remaining time.

- **How does the system handle a tier upgrade on the last day of the annual subscription?** The prorated calculation should result in a minimal charge (1 day worth of difference), or the system may require waiting for renewal to avoid negligible transactions.

- **What happens if a payment fails for a prorated tier upgrade charge?** The tier upgrade should not be applied, the tenant remains on their current tier, and they are notified of the payment failure with an option to retry or use a different payment method.

- **How does the system handle timezone boundaries when calculating remaining days?** Calculations should be based on UTC or the tenant's configured timezone to ensure consistent day counts.

- **What happens when a tenant with a scheduled downgrade attempts to upgrade?** The scheduled downgrade should be cancelled, and the upgrade processed immediately with standard proration.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST enforce a one-way billing cycle transition policy where monthly → annual is permitted, but annual → monthly is permanently blocked.

- **FR-002**: System MUST allow plan tier upgrades (e.g., Basic → Premium) at any time during an active annual subscription.

- **FR-003**: System MUST allow plan tier downgrades (e.g., Premium → Basic) during an active annual subscription, with configurable timing (immediate or at renewal).

- **FR-004**: System MUST calculate prorated charges for tier upgrades based on the price difference between old and new tier, multiplied by the remaining subscription period in days divided by 365.

- **FR-005**: System MUST preserve the original annual renewal date unchanged when processing tier upgrades or downgrades.

- **FR-006**: System MUST block annual → monthly transition attempts and return a clear error message explaining the policy.

- **FR-007**: System MUST generate an immediate charge for prorated tier upgrade amounts and process payment before applying the tier change.

- **FR-008**: System MUST NOT issue refunds for tier downgrades on annual subscriptions; any price difference remains as prepaid credit or is forfeited based on policy.

- **FR-009**: System MUST maintain a complete audit trail of all billing cycle changes, tier changes, and prorated calculations.

- **FR-010**: System MUST provide clear visibility to administrators of their current tier, billing cycle, renewal date, and any scheduled changes.

### Key Entities *(include if feature involves data)*

- **Subscription**: Represents a tenant's active subscription including billing cycle (monthly/annual), current plan tier, start date, renewal date, and status.

- **Plan Tier**: Defines the subscription level (Basic, Premium, etc.) with associated pricing for monthly and annual billing cycles.

- **Billing Cycle**: The recurrence pattern of billing—monthly (12 times per year) or annual (1 time per year).

- **Subscription Change**: Records a modification to a subscription including change type (cycle_change, tier_upgrade, tier_downgrade), effective date, prorated amount calculated, payment status, and timestamp.

- **Prorated Charge**: A calculated charge representing the price difference for remaining subscription time when upgrading tiers mid-cycle.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Tenants on monthly plans can upgrade to annual billing at any time with a completed transaction rate of 95% or higher on first attempt.

- **SC-002**: Prorated tier upgrade calculations are accurate to the cent (0.00 precision) when verified against manual calculations using the same formula.

- **SC-003**: Annual subscription renewal dates remain unchanged in 100% of tier upgrade/downgrade scenarios.

- **SC-004**: Annual → monthly transition attempts are blocked 100% of the time with a clear, actionable error message.

- **SC-005**: The time from tier upgrade initiation to feature availability is under 5 seconds when payment processing succeeds.

- **SC-006**: All billing cycle and tier changes are recorded in the audit trail within 1 second of the change being applied.

- **SC-007**: Monthly-to-annual upgrade conversion rate increases by at least 15% within 3 months of feature release.

## Assumptions

- Tenants have a valid payment method on file before attempting tier upgrades that require immediate payment.

- Plan tiers have defined annual prices that are comparable (same currency, same billing period basis).

- The existing subscription management system tracks renewal dates and can calculate days remaining accurately.

- Payment processing integration supports immediate charges for prorated amounts.

- Timezone handling is consistent across the platform using UTC for calculations with localized display.

- Refund processing is intentionally not supported for annual subscription changes to maintain predictable revenue.
