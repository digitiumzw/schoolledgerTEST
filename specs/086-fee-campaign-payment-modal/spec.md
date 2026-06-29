# Feature Specification: Fee Campaign Payment in Record Payment Modal

**Feature Branch**: `086-fee-campaign-payment-modal`  
**Created**: 2026-05-30  
**Status**: Draft  
**Input**: User description: "In the Record Payment modal, add a new option called Fee Campaign Payment. When an admin checks this option, display a dropdown containing all active fee campaigns for the current tenant. The admin must be able to select a fee campaign from the dropdown before submitting the payment. Upon submission: If the student is not already enrolled in the selected fee campaign, automatically add the student to that campaign. Record the payment using the Fee Campaign API instead of the standard payment API. If the student is already enrolled in one or more fee campaigns, the modal should allow the admin to select from the student's existing fee campaigns and record the payment against the chosen campaign."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pay into Campaign for Unenrolled Student (Priority: P1)

An admin opens the Record Payment modal, selects a student who is not yet enrolled in any fee campaigns, enables the "Fee Campaign Payment" option, selects an active fee campaign from the dropdown, enters payment details, and submits. The system automatically enrolls the student into the selected campaign and records the payment against it.

**Why this priority**: This is the primary new value proposition — eliminating the need for admins to navigate to the Fee Campaigns page separately to add a student before recording payment. It streamlines the payment workflow into a single modal interaction.

**Independent Test**: Can be fully tested by opening Record Payment modal for a student with no campaign memberships, selecting a campaign, submitting, and verifying the student appears in the campaign with the payment applied.

**Acceptance Scenarios**:

1. **Given** a student with no existing fee campaign memberships, **When** the admin enables "Fee Campaign Payment", selects an active campaign, enters amount and method, and submits, **Then** the student is automatically added to the campaign and the payment is recorded successfully, and a success message is shown.
2. **Given** a student with no existing fee campaign memberships, **When** the admin enables "Fee Campaign Payment" and the tenant has no active campaigns, **Then** the dropdown shows an empty state message and the submit button is disabled or shows a validation error.

---

### User Story 2 - Pay into Student's Existing Campaign (Priority: P1)

An admin opens the Record Payment modal for a student who is already enrolled in one or more active fee campaigns, enables the "Fee Campaign Payment" option, and selects one of the student's existing campaigns from the dropdown. The system records the payment against that campaign.

**Why this priority**: This covers the common recurring-payment scenario where parents make incremental payments toward a campaign they are already part of. It is equally critical to US1 for daily operational use.

**Independent Test**: Can be fully tested by opening Record Payment modal for a student already in an active campaign, selecting that campaign, submitting, and verifying the campaign's paid amount increases correctly.

**Acceptance Scenarios**:

1. **Given** a student enrolled in two active fee campaigns, **When** the admin enables "Fee Campaign Payment", **Then** the dropdown displays both existing campaigns with contextual info (campaign name, expected amount, amount paid so far, remaining balance).
2. **Given** the dropdown shows the student's existing campaigns, **When** the admin selects one campaign, enters an amount, and submits, **Then** the payment is recorded against that campaign, the student's campaign paid amount updates, and the payment receipt reflects the campaign name.

---

### User Story 3 - Campaign Payment Guardrails and Error Handling (Priority: P2)

The system prevents invalid campaign payments and provides clear feedback when things go wrong, such as attempting to pay against a closed campaign, selecting a campaign from another tenant, or encountering a network failure during auto-enrollment.

**Why this priority**: Error handling and guardrails are essential for data integrity and user trust, but they can be layered on top of the core payment flows once US1 and US2 are functional.

**Independent Test**: Can be fully tested by attempting to submit campaign payments in various error states (closed campaign, missing campaign selection, network failure) and verifying the appropriate error messages and HTTP status codes.

**Acceptance Scenarios**:

1. **Given** the admin selects a closed campaign, **When** they attempt to submit the payment, **Then** the submission is rejected with a clear error message stating the campaign is closed.
2. **Given** the auto-enrollment API returns an error (e.g., student already in a conflicting campaign), **When** the admin submits, **Then** the payment is not recorded and the modal displays the backend error message without leaving partial state.

---

### Edge Cases

- **No active campaigns**: The tenant has no active fee campaigns. The dropdown should show an appropriate empty state, and the submit button should be disabled.
- **Student already fully paid in all campaigns**: The dropdown still shows existing campaigns, but the expected amount context shows zero remaining. The admin can still record an overpayment if the system allows it.
- **Campaign closes between selection and submission**: Backend validation must catch this race condition and return an appropriate error.
- **Amount exceeds expected campaign amount**: The system should warn but allow the payment (similar to current balance-exceeds behavior in standard payments), recording it as an overpayment.
- **User toggles campaign mode off mid-form**: The modal should revert to standard category/multi-category selection and clear the campaign selection state.
- **Network failure during auto-enroll**: The payment must not be recorded, and the modal must remain open with an error so the admin can retry.
- **Duplicate submission**: The submit button and modal controls must be disabled while the auto-enrollment and payment requests are in-flight to prevent double-charging.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Record Payment modal MUST display a "Fee Campaign Payment" toggle/checkbox that switches the form into campaign payment mode.
- **FR-002**: When campaign payment mode is active, the standard category selector and multi-category "Split across categories" toggle MUST be hidden or disabled to prevent mixed payment types.
- **FR-003**: When campaign payment mode is active, the modal MUST display a dropdown containing all active fee campaigns for the current tenant.
- **FR-004**: If the selected student has existing active campaign memberships, those campaigns MUST be visually distinguished in the dropdown (e.g., with a badge or label) and contextual data MUST be shown (expected amount, paid amount, remaining balance).
- **FR-005**: The modal MUST allow selection of any active campaign regardless of the student's current enrollment status in that campaign.
- **FR-016**: On submission, if the student is not already enrolled in the selected campaign, the system MUST first call the add-student-to-campaign endpoint and, on success, then call the record-campaign-payment endpoint.
- **FR-017**: On submission, if the student is already enrolled in the selected campaign, the system MUST call the record-campaign-payment endpoint directly.
- **FR-018**: The amount input SHOULD auto-populate or suggest the campaign's remaining expected amount when a campaign is selected, while still allowing manual override.
- **FR-019**: The modal MUST display a loading indicator and disable submit/action controls during the entire in-flight sequence (auto-enrollment + payment recording).
- **FR-020**: After a successful campaign payment, the modal MUST invalidate React Query cache keys for the affected student balance, campaign data, payment history, and dashboard activity.
- **FR-021**: Backend MUST validate that the selected campaign is active and belongs to the requesting user's tenant before processing any auto-enrollment or payment.
- **FR-022**: Backend MUST return a clear HTTP 422 error with a descriptive message if a payment is attempted against a closed campaign.
- **FR-023**: Backend MUST ensure tenant isolation for all campaign lookup, student enrollment, and payment recording operations.
- **FR-024**: If auto-enrollment fails, the backend MUST NOT record the payment, and the frontend MUST display the error without closing the modal.
- **FR-025**: The payment receipt generated after submission MUST include the campaign name in its details.
- **FR-006**: Backend APIs MUST return view-ready data for all feature screens, including any filtering, searching, pagination, sorting, aggregations, and computed values required by the frontend.
- **FR-007**: Frontend behavior MUST be limited to passing user-selected query parameters and rendering backend-prepared responses; it MUST NOT perform client-side data filtering, searching, sorting, pagination, aggregations, or business computations.
- **FR-008**: Every user action that triggers a data change (create, update, delete, submit, refresh, bulk-operation, status-change) MUST display a visible loading indicator from the moment the request is initiated until the response is fully received and the UI reflects the confirmed server state. Action-triggering controls MUST be disabled during in-flight requests to prevent duplicate submissions.
- **FR-009**: After any mutation completes, all React Query queries whose data was affected MUST be invalidated or updated so the next render reflects the latest server state. Stale cached values MUST NOT flash or re-appear after the mutation response is processed.

### Key Entities *(include if feature involves data)*

- **FeeCampaign**: A fundraising or fee collection initiative with name, expected amount, due date, scope, and status (active/closed). Belongs to a tenant.
- **CampaignStudent**: A link between a student and a fee campaign, tracking expected amount, paid amount, and payment status (unpaid/partially_paid/fully_paid).
- **Payment**: A financial transaction linked to a student. In campaign mode, the payment carries a `fee_campaign_id` and is processed through the campaign-specific payment endpoint rather than the standard ledger allocation flow.
- **Student**: The central identity entity whose campaign memberships and payment history are affected.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can record a fee campaign payment in 3 clicks or fewer after selecting a student and enabling campaign mode.
- **SC-002**: Auto-enrollment plus payment recording completes in a single form submission without requiring additional confirmation dialogs or navigation away from the modal.
- **SC-003**: A successfully recorded campaign payment appears correctly in the campaign detail page (updated paid amount and status), the student's payment history, and the generated receipt.
- **SC-004**: The system prevents payments against closed campaigns, returning a clear user-facing error within 500ms of submission.
- **SC-005**: Backend endpoints return appropriate HTTP status codes (400 for missing campaign, 422 for closed campaign, 404 for invalid student or campaign, 401 for unauthenticated, 403 for unauthorized role) for all error scenarios.

## Assumptions

- The Fee Campaign module (Feature 059) is fully implemented and operational, including the `recordCampaignPayment`, `addCampaignStudent`, and `getStudentCampaigns` endpoints.
- The Record Payment modal (`RecordPaymentModal.tsx`) is extensible to accommodate a new payment mode toggle and conditional campaign dropdown.
- Users with access to the Record Payment modal (admin, bursar roles) already have sufficient permissions to interact with fee campaigns.
- Only one fee campaign can be selected per payment submission; multi-campaign payments are out of scope.
- Auto-enrollment does not trigger any additional approval workflow, notification, or charge generation beyond the campaign's standard behavior.
- The existing standard payment category flow remains unchanged when campaign payment mode is not active.
