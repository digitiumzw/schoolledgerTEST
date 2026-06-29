# Feature Specification: Campaign Receipt & Payments Integration

**Feature Branch**: `062-campaign-receipt-payments`  
**Created**: 2026-05-05  
**Status**: Ready for Review  
**Input**: User description: "Allow users to manually add a student to a fee campaign. When a payment is recorded for a campaign fee, the system must generate a receipt and create a transaction snapshot. The payment and its details should also appear on the main payments page to ensure consistency between campaign fee tracking and the overall payments system."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manual Student Addition to Campaign (Priority: P1)

As a school administrator, I want to manually add an individual student to an existing fee campaign so that late enrollees, transfer students, or students who were missed during initial auto-assignment can be tracked within the same campaign without recreating it.

**Why this priority**: This is the gating capability — without the ability to add students manually, the campaign is forever locked to its initial membership snapshot. All subsequent stories (receipt generation, payments page visibility) depend on payments being recorded, which requires a student to be in the campaign first.

**Independent Test**: Can be fully tested by adding a student not currently in the campaign, then verifying the campaign's student list gains a new record with expected = campaign amount, paid = $0, status = "unpaid", and the campaign aggregate total updates accordingly.

**Acceptance Scenarios**:

1. **Given** an active campaign "Grade 7 Exam Fee" with 25 students, **When** the admin adds a student currently not in the campaign, **Then** a new tracking record is created for that student with expected = campaign amount, paid = $0, remaining = campaign amount, status = "unpaid", and the campaign shows 26 students.
2. **Given** an active campaign, **When** the admin attempts to add a student who is already assigned to the campaign, **Then** the system rejects the request with a clear "student already enrolled in this campaign" error and does not create a duplicate record.
3. **Given** a closed/archived campaign, **When** the admin attempts to add a student, **Then** the system rejects the request with a "campaign is closed" error — no additions are permitted to closed campaigns.
4. **Given** an active campaign, **When** the admin adds a student belonging to a different tenant, **Then** the system rejects the request with a 404 — tenant isolation is enforced.

---

### User Story 2 - Receipt Generation for Campaign Payment (Priority: P1)

As a school administrator, I want the system to automatically generate a receipt with a unique receipt number and a transaction snapshot whenever I record a payment against a student's campaign record, so that I have a printable proof-of-payment that matches the receipt format used for standard school fee payments.

**Why this priority**: Receipt generation and snapshots are the primary deliverables of this feature. Schools require receipts for every financial transaction — without them, campaign payments lack the paper trail required for accountability. This must exist alongside US1 for a viable MVP.

**Independent Test**: Can be fully tested by recording a campaign payment and verifying: (a) the payment row gains a unique receipt number, (b) a snapshot field is stored capturing student name, campaign name, amount, method, and date, (c) the receipt can be retrieved via the existing receipt endpoint and renders correctly with campaign-specific details.

**Acceptance Scenarios**:

1. **Given** a student assigned to a campaign with expected = $50, paid = $0, **When** the admin records a $50 payment with method "Cash", **Then** the payment row is saved with a unique receipt number (in the system's standard receipt number format), a transaction snapshot containing student name, campaign name, payment amount, payment method, payment date, and balance information is persisted, and the payment status on the campaign record updates to "fully_paid".
2. **Given** a campaign payment was recorded, **When** the admin fetches the receipt via the receipt endpoint using the payment ID, **Then** the receipt displays the campaign name (in place of a generic fee category), receipt number, student name, amount paid, payment method, payment date, and the campaign record's remaining balance after payment.
3. **Given** a partial campaign payment of $20 against an expected $50, **When** the receipt is retrieved, **Then** the receipt correctly shows amount paid = $20 and outstanding balance = $30.
4. **Given** a campaign payment is being recorded, **When** the database insert for the payment or snapshot fails mid-transaction, **Then** neither the campaign record update nor the payment insert is committed — full atomicity is preserved.

---

### User Story 3 - Campaign Payments Visible on Main Payments Page (Priority: P1)

As a school administrator, I want payments recorded against fee campaigns to appear on the main payments page alongside standard fee and transport payments, so that I have a single consolidated view of all financial transactions without having to switch between campaign detail pages and the general payments ledger.

**Why this priority**: Consistency between the campaign module and the overall payments system is an explicit requirement. Without this, the payments page is incomplete and could mislead administrators conducting financial reviews. This is P1 because it is a direct deliverable stated in the feature request.

**Independent Test**: Can be fully tested by recording a campaign payment and then navigating to the main payments page, verifying the payment appears in the list with correct student name, amount, date, method, receipt number, and a visible indicator that it originates from a campaign.

**Acceptance Scenarios**:

1. **Given** a campaign payment of $30 has been recorded for a student, **When** an admin views the main payments page (filtered to that student or the full list), **Then** the payment row appears in the list showing: student name, amount ($30), payment method, payment date, receipt number, and the campaign name as the payment category or source label.
2. **Given** the main payments page, **When** campaign payments and standard fee payments both exist, **Then** the page displays both in the same list, ordered by date, with no visual duplication — each payment appears exactly once.
3. **Given** a campaign payment row on the main payments page, **When** the admin clicks to view the receipt, **Then** the full receipt (with campaign-specific details from the snapshot) is displayed — the same receipt generated at the time of recording the payment.
4. **Given** a tenant with both campaign payments and standard payments, **When** another tenant's admin views their payments page, **Then** only their own payments are visible — cross-tenant data does not leak.

---

### Edge Cases

- What happens when a student is added to a campaign but then the campaign is closed before any payment is made? → The student's record is frozen at "unpaid"; the closed campaign shows in the student's history as unpaid. No payments can be added after closure.
- What happens if a duplicate receipt number is generated? → The system follows the existing receipt number generation strategy (timestamp + sequence), which ensures uniqueness per tenant; the unique constraint prevents duplicates.
- What happens when a receipt is fetched for a campaign payment that has no snapshot? → The system falls back gracefully to live data (student name, campaign name) as it does for standard payment receipts with missing snapshots.
- What happens when the admin records a campaign payment of exactly $0? → The system rejects zero-amount payments with a validation error, consistent with the existing payment validation rules.
- What happens if a student is added to a campaign and immediately removed before any payment? → The remove-student flow (from the existing campaign spec FR-007) handles this — deletion is allowed without a confirmation prompt since no payments exist.

## Requirements *(mandatory)*

### Functional Requirements

**Manual Student Addition**

- **FR-001**: System MUST allow an admin to manually add an individual student to an existing active campaign from the campaign detail view, creating a new tracking record with expected = campaign amount, paid = $0, status = "unpaid".
- **FR-002**: System MUST reject the addition if the student is already assigned to the campaign, returning a clear duplicate-enrollment error.
- **FR-003**: System MUST reject the addition if the campaign status is "closed", returning a clear "campaign is closed" error.
- **FR-004**: System MUST enforce tenant isolation — a student may only be added to a campaign belonging to the same tenant.

**Receipt & Snapshot Generation**

- **FR-005**: System MUST generate a unique receipt number for every campaign payment using the same receipt number format applied to standard fee and transport payments.
- **FR-006**: System MUST create a transaction snapshot at the time of payment recording, capturing: student name, campaign name, payment amount, payment method, payment date, campaign expected amount, paid amount before this payment, and remaining balance after this payment.
- **FR-007**: System MUST persist the snapshot alongside the payment record so it can be retrieved independently of live campaign or student data (immutable audit record).
- **FR-008**: System MUST perform the campaign record update, payment insert (with receipt number and snapshot), and any balance updates within a single atomic database transaction.

**Receipt Retrieval**

- **FR-009**: System MUST allow retrieval of a campaign payment receipt via the existing receipt endpoint, returning: receipt number, student name, campaign name (as the fee source label), amount paid, payment method, payment date, and outstanding balance after payment.
- **FR-010**: System MUST NOT display a student general ledger balance on campaign receipts — the balance shown must be the campaign-specific remaining balance.

**Payments Page Integration**

- **FR-011**: Campaign payment rows MUST appear on the main payments page alongside standard fee and transport payments, visible to admins and bursars.
- **FR-012**: Each campaign payment row on the main payments page MUST display: student name, amount, payment method, payment date, receipt number, and the campaign name as the payment source label.
- **FR-013**: Campaign payments MUST NOT be duplicated on the main payments page — each payment appears exactly once regardless of how it was recorded.

**Data Isolation**

- **FR-014**: Campaign payments MUST NOT affect the student's standard fee balance or transport balance calculations in any way.
- **FR-015**: System MUST enforce tenant isolation across all new endpoints — data from one tenant must never be accessible by another.

### Key Entities

- **Campaign Student Record** (existing, extended): Gains no new fields; the manual addition flow simply creates a new record via the existing data structure. Key attributes: student reference, campaign reference, expected amount, paid amount, status, tenant reference.
- **Payment** (existing, extended): Already has a `fee_campaign_id` foreign key (from feature 059) linking campaign payments back to their originating campaign. This feature ensures receipt number and snapshot fields are also populated for campaign payments, and that these rows surface correctly on the main payments listing.
- **Transaction Snapshot**: An immutable serialised record of the payment context stored as a structured field on the payment row. Captures: student name, campaign name, amounts (expected, paid before, paid now, remaining after), payment method, payment date. Used to render receipts without querying live data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can add a student to an active campaign in under 3 clicks from the campaign detail view and the new record is immediately visible without a page reload.
- **SC-002**: Every campaign payment produces a receipt number and snapshot atomically — zero payments exist in the system without a corresponding receipt number.
- **SC-003**: A receipt retrieved for any campaign payment accurately reflects the amounts, student, and campaign details captured at the time of payment — correct even if the campaign or student data is later edited.
- **SC-004**: Campaign payments are visible on the main payments page within the same response that lists standard payments — no additional API calls or page navigation required.
- **SC-005**: Campaign payments produce zero impact on the student's fee balance or transport balance — all existing balance calculation tests continue to pass after this feature is implemented.
- **SC-006**: All new and modified API endpoints enforce tenant isolation — cross-tenant data access returns 404 in all automated integration tests.

## Assumptions

- The primary user is a school administrator or bursar with an existing authenticated session (JWT + role-based access).
- The existing fee campaign infrastructure (feature 059 — `fee_campaigns`, `campaign_students`, `payments.fee_campaign_id`) is already deployed and functional. This feature enhances it rather than replacing it.
- The existing receipt endpoint and receipt number generation logic (from feature 057) are reused without modification to the generation strategy.
- The existing snapshot format for standard payments is extended (or paralleled) for campaign payments — the receipt UI already knows how to render snapshots and is extended to handle campaign-specific fields.
- The main payments page already queries the payments table; campaign payments appear there automatically once the payment row is inserted with the correct fields — no separate API endpoint is required for this visibility.
- Manual student addition is performed by administrators and bursars; read-only roles (e.g., teachers) cannot perform this action.
- Per-student custom campaign amounts (overriding the campaign's default) are out of scope for this feature — the added student always inherits the campaign's standard required amount.
