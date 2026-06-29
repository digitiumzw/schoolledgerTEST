# Feature Specification: Subscription Billing Overhaul

**Feature Branch**: `027-subscription-billing-overhaul`  
**Created**: 2026-04-13  
**Status**: Draft  
**Input**: User description: "Remove the 'Pay with EcoCash / OneMoney (no redirect)' feature. As a user, I want the ability to upgrade or downgrade my plan. The recommended plan should be set to 'Enterprise.' When I click 'Subscribe,' the system should inform me that I will be redirected to Paynow to complete the payment and display all available payment methods. After being redirected to the Paynow website: If I cancel the transaction, the system should handle it and notify me that the transaction has been canceled. If the payment is successful, the system should notify me accordingly. All completed transactions should be displayed accurately and efficiently in the billing history, with an option to download the invoice. Additionally, fix and optimize the polling logic used by the backend to check the transaction status."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Subscribe or Change Plan via Paynow (Priority: P1)

A school administrator visits the Billing page to subscribe to a plan or switch to a higher or lower tier. They select a plan (monthly or annual) and click "Subscribe." A confirmation dialog appears telling them they will be redirected to Paynow and showing all the payment methods Paynow supports. The administrator confirms and is taken to the Paynow payment page. On successful payment, they are returned to the Billing page and shown a success banner. Their subscription status and plan name update immediately to reflect the new active plan.

**Why this priority**: Core monetisation flow — no subscription means no revenue and no access control. Every other story depends on a working subscribe path.

**Independent Test**: Can be fully tested by selecting any plan on the Billing page, confirming the redirect dialog, completing a sandbox payment, and verifying the success banner and updated subscription card — delivers a complete working payment flow.

**Acceptance Scenarios**:

1. **Given** the user is on the Billing page and has no active subscription, **When** they click "Subscribe" on any plan, **Then** a confirmation dialog appears that (a) states they will be redirected to Paynow, and (b) lists the payment methods available on Paynow (e.g., Visa, Mastercard, EcoCash web).
2. **Given** the confirmation dialog is open, **When** the user confirms, **Then** they are redirected to the Paynow payment page for the correct amount and billing cycle.
3. **Given** the user has completed payment on Paynow and been returned, **When** the Billing page loads, **Then** a "Payment Confirmed" success banner is shown and the Current Subscription card reflects the new active plan.
4. **Given** the user already has an active subscription, **When** they click "Subscribe" on a different plan, **Then** the same redirect flow applies and the old plan is superseded on successful payment.

---

### User Story 2 - Handle Cancelled Payment (Priority: P2)

A school administrator is redirected to Paynow but decides not to pay and cancels the transaction (either via the Paynow cancel button or by closing the page). On returning to SchoolLedger, the Billing page informs them clearly that the transaction was cancelled. No subscription change is made, and the previously active plan (if any) remains intact.

**Why this priority**: Without clear cancellation handling, the UI could show a misleading pending or error state that confuses users and generates unnecessary support tickets.

**Independent Test**: Can be fully tested by initiating a payment, cancelling on the Paynow page, returning to the Billing page, and verifying the cancellation banner and unchanged subscription state — delivers a complete graceful-cancellation experience.

**Acceptance Scenarios**:

1. **Given** the user initiated a Paynow payment and then cancelled on the Paynow website, **When** they are returned to the Billing page, **Then** a "Transaction Cancelled" notice is displayed.
2. **Given** the transaction was cancelled, **When** the Billing page loads, **Then** the subscription status is unchanged from before the attempt, and no pending state lingers.
3. **Given** the transaction was cancelled, **When** the user clicks "Subscribe" again on the same or a different plan, **Then** they can start a new payment attempt without errors.

---

### User Story 3 - Upgrade or Downgrade Plan (Priority: P2)

A school administrator with an active subscription wants to move to a higher-tier or lower-tier plan. The plan grid clearly indicates which action (Upgrade or Downgrade) will be taken for each plan relative to the current one. Attempting a downgrade when the current student count exceeds the target plan's student limit is blocked with a clear message. A valid upgrade or downgrade follows the same Paynow redirect flow as a fresh subscription.

**Why this priority**: Plan changes are essential for growing or cost-conscious schools. Blocking this flow would force administrators to contact support unnecessarily.

**Independent Test**: Can be fully tested by logging in with a school on an active mid-tier plan, verifying upgrade/downgrade button labels on each plan card, attempting a blocked downgrade to verify the blocking message, and completing a valid upgrade — delivers a complete plan-change experience.

**Acceptance Scenarios**:

1. **Given** the user has an active subscription, **When** the plan grid is displayed, **Then** each plan card shows a contextual label: "Current Plan" (active plan), "Upgrade" (higher tier), or "Downgrade" (lower tier), and the Enterprise plan is visually marked as recommended.
2. **Given** the user attempts to downgrade and their student count exceeds the target plan's student limit, **When** they click "Downgrade," **Then** an inline alert explains the block, shows the current student count and the plan limit, and does not redirect to Paynow.
3. **Given** the user selects a valid downgrade or upgrade, **When** they confirm the redirect dialog and complete payment, **Then** the old subscription is replaced and the new plan is activated.

---

### User Story 4 - Billing History and Invoice Download (Priority: P3)

A school administrator can view a full, paginated list of their billing events (plan activations, upgrades, downgrades, renewals, payments confirmed). For each completed payment, an invoice is available to download as a PDF. The history loads efficiently even with many records.

**Why this priority**: Required for accounting and compliance, but does not block any payment or access-control flow.

**Independent Test**: Can be fully tested by viewing the Billing History section after at least one completed payment, verifying all event types appear with correct data, and downloading an invoice PDF — delivers a standalone auditable billing record.

**Acceptance Scenarios**:

1. **Given** the user has at least one completed payment, **When** they visit the Billing page, **Then** the Billing History section lists each event with its type, plan name, billing cycle, amount, and date.
2. **Given** a paid invoice exists, **When** the user clicks "Download Invoice" for that entry, **Then** a PDF invoice is downloaded with the correct plan, amount, school name, and invoice number.
3. **Given** more than one page of billing events exists, **When** the user navigates pages, **Then** the correct subset of events is displayed without a full-page reload.

---

### User Story 5 - Enterprise Plan as Recommended (Priority: P3)

The Enterprise plan is always highlighted as the recommended option on the plan selection grid, regardless of the school's current student count.

**Why this priority**: Drives higher-tier plan selection; low implementation effort but affects all plan-selector interactions.

**Independent Test**: Can be fully tested by opening the Billing page and verifying the Enterprise plan card carries the "Recommended" badge and no other card does — delivers a clear upsell signal requiring no full user journey.

**Acceptance Scenarios**:

1. **Given** the user opens the Billing page, **When** the plan grid renders, **Then** the Enterprise plan card displays a "Recommended" badge and no other plan card does.
2. **Given** the user is already on the Enterprise plan, **When** the plan grid renders, **Then** the Enterprise card shows both "Current Plan" and retains its recommended styling.

---

### Edge Cases

- What happens when the user's browser closes before returning from Paynow? The next time they open the Billing page the system should detect any pending transaction, poll Paynow for its status, and resolve the subscription accordingly.
- How does the system handle a Paynow webhook arriving before the user returns to the Billing page? The subscription must be activated exactly once regardless of whether the webhook or the poll endpoint confirms payment first.
- What if the user clicks "Subscribe" multiple times quickly before the redirect completes? Only one pending transaction should exist at a time; any previous initiated-but-unpaid transactions must be cancelled before creating a new one.
- What if the plan grid cannot be loaded (API error or empty database)? An appropriate error or empty state should be shown without crashing the page.
- What if the user tries to downgrade to their current plan? The system should treat it as a renewal and allow it.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST remove all EcoCash / OneMoney mobile-money payment UI elements, including the "Pay with EcoCash / OneMoney (no redirect)" button and the associated phone-number form.
- **FR-002**: The system MUST display a confirmation dialog when a user clicks "Subscribe," "Upgrade," or "Downgrade" on any plan card. The dialog MUST state that the user will be redirected to Paynow and list the payment methods available via Paynow.
- **FR-003**: After the user confirms the dialog, the system MUST redirect them to the Paynow payment page for the correct plan amount and billing cycle.
- **FR-004**: The system MUST set the Enterprise plan as the recommended plan on the plan selection grid, overriding any dynamic student-count-based recommendation logic.
- **FR-005**: The plan grid MUST display a contextual action label on each plan card relative to the user's current active subscription: "Current Plan," "Upgrade," "Downgrade," or "Subscribe" (when no active subscription exists).
- **FR-006**: The system MUST prevent downgrade attempts when the school's current student count exceeds the target plan's student limit, displaying a clear inline message that states the current student count and the plan's limit.
- **FR-007**: When the user returns from a successful Paynow payment, the system MUST display a "Payment Confirmed" success notification and immediately refresh the subscription status without requiring a manual page reload.
- **FR-008**: When the user returns after cancelling on Paynow, the system MUST detect the cancellation and display a "Transaction Cancelled" notification. No subscription change must be applied.
- **FR-009**: The backend polling endpoint MUST return immediately without calling the external payment gateway if the transaction is already in a terminal state (paid, failed, or cancelled).
- **FR-010**: The backend polling endpoint MUST NOT create duplicate subscription activations; if a subscription for the transaction is already active, the endpoint must return the current status without re-running the activation logic.
- **FR-011**: When a new payment is initiated, the system MUST cancel any existing pending or initiated transactions for the same tenant before creating a new one.
- **FR-012**: The system MUST record all subscription lifecycle events (plan activated, upgraded, downgraded, renewed, payment confirmed) in the billing history.
- **FR-013**: The billing history MUST be paginated and display event type, plan name, billing cycle, amount, and date for each entry.
- **FR-014**: For each completed transaction, the system MUST generate an invoice and provide a download link that delivers a PDF document.

### Key Entities

- **Subscription Plan**: Represents a purchasable tier with a name, student limit, monthly price, annual price, sort order, and recommended flag. Enterprise is always marked recommended.
- **School Subscription**: Records an active, pending, expired, superseded, or cancelled subscription period for a tenant, tied to a plan and billing cycle with start and expiry timestamps.
- **Subscription Transaction**: Records a Paynow payment attempt including initiation timestamp, poll URL, Paynow reference, status (initiated → paid / failed / cancelled), and completion time.
- **Invoice**: A financial document generated on confirmed payment, linked to a subscription and transaction, downloadable as PDF with school name, plan, amount, billing cycle, and invoice number.
- **Billing Event**: An immutable audit record of a subscription lifecycle event with event type, plan name, billing cycle, amount, currency, and timestamp.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can select a plan, see the Paynow redirect confirmation dialog, and be redirected to Paynow in under 3 seconds from clicking "Subscribe."
- **SC-002**: After returning from a successful Paynow payment, the subscription status on the Billing page updates within 5 seconds without requiring a manual page refresh.
- **SC-003**: After returning from a cancelled Paynow payment, the cancellation notice appears within 5 seconds and no subscription state changes are visible to the user.
- **SC-004**: Billing history for a tenant with up to 100 events loads and renders in under 2 seconds.
- **SC-005**: Invoice PDF download completes in under 5 seconds for any generated invoice.
- **SC-006**: 100% of completed payment transactions result in exactly one activated subscription — no duplicate activations occur regardless of whether confirmation arrives via webhook or polling.
- **SC-007**: The Enterprise plan "Recommended" badge is visible on the plan grid for 100% of page loads across all tenants.
- **SC-008**: 100% of downgrade attempts where the tenant's student count exceeds the target plan limit are blocked before reaching Paynow.

## Assumptions

- Only the Paynow web-redirect payment flow is retained; EcoCash / OneMoney mobile-money (USSD push) is removed entirely from both the frontend and the backend API.
- Paynow is the sole payment gateway; no other payment provider is in scope for this feature.
- The "Enterprise" plan is the highest sort-order plan in the database; no new database record needs to be created — the recommended flag is set by hardcoding the plan ID or by using the existing sort-order field.
- Returning from Paynow always lands on the Billing page with query parameters that indicate outcome (e.g., `?payment=complete&txId=...` for success, `?payment=cancelled` for cancellation); the PAYNOW_RETURN_URL environment variable must be configured per deployment environment.
- Administrators and bursars are the only roles that can initiate subscription changes; no role-access changes are needed.
- The existing invoice generation and PDF rendering infrastructure remains unchanged; this feature surfaces it correctly in the billing history UI.
- Mobile responsiveness is required for the Billing page; native mobile app support is out of scope.
- A school with no active subscription can still view the plan grid and initiate a new subscription.
