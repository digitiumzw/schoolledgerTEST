# Research: Fee Campaign Payment in Record Payment Modal

**Feature**: 086-fee-campaign-payment-modal
**Date**: 2026-05-30

## Research Questions & Decisions

### Q1: Do any backend schema changes or new API endpoints need to be created?

**Decision**: No schema changes or new backend endpoints are required.

**Rationale**: The existing Fee Campaign module (Feature 059) already provides all necessary backend capabilities:
- `GET /api/fee-campaigns?status=active` — lists active campaigns (paginated, but can request a high limit for dropdown)
- `GET /api/students/:id/campaigns` — lists student's existing campaign memberships
- `POST /api/fee-campaigns/:id/students` — adds a student to a campaign
- `POST /api/fee-campaigns/:id/record-payment` — records a payment against a campaign

The existing `recordPayment` service method validates:
- Campaign exists and is active (tenant-scoped)
- Student is enrolled in the campaign
- Amount is positive and does not exceed remaining expected amount
- Updates `campaign_students.paid_amount` and `status` atomically within a transaction
- Creates a `payments` row with `fee_campaign_id` set, which is already excluded from ledger balance calculations

**Alternatives considered**:
- Create a new atomic "add-and-pay" backend endpoint: rejected because it adds backend complexity for a UI-convenience flow. The two existing sequential calls are sufficient, and the `recordPayment` endpoint already guards against campaign closure.
- Modify `recordPayment` to auto-enroll: rejected because it would change the contract of an existing endpoint, creating backwards-compatibility risk. The frontend-driven two-step approach is explicit and safe.

### Q2: How should the frontend handle the two-step submission (auto-enroll then pay)?

**Decision**: The frontend should call `addCampaignStudent` first, and on success call `recordCampaignPayment`. The submit button and form controls must remain in a loading state for the entire sequence.

**Rationale**: This matches the spec's FR-016 and FR-019 requirements. The existing `recordPayment` backend method returns 404 if the student is not enrolled, so the frontend must ensure enrollment first.

**Edge case handling**:
- If `addCampaignStudent` fails (e.g., campaign closed, student already in conflicting campaign), the payment is not attempted and the error is shown in the modal.
- If `addCampaignStudent` succeeds but `recordCampaignPayment` fails (e.g., network error), the student remains enrolled in the campaign but no payment is recorded. The admin can retry the payment without re-enrolling.
- The modal stays open on any error, allowing the admin to correct and retry.

### Q3: How should the campaign dropdown distinguish "student's existing campaigns" from "all active campaigns"?

**Decision**: The frontend will fetch both `getFeeCampaigns({ status: 'active', limit: 100 })` and `getStudentCampaigns(studentId)` concurrently when a student is selected and campaign mode is active. The dropdown will:
- Display all active campaigns
- Mark the student's existing campaigns with a "Member" badge
- Show contextual data (expectedAmount, paidAmount, remainingAmount) for member campaigns
- Allow selection of non-member campaigns (triggering auto-enroll on submit)

**Rationale**: This gives admins full visibility into all available campaigns while highlighting where the student already belongs. It also supports the "pay into a new campaign" use case.

### Q4: What loading-state pattern should be used for the sequential mutation?

**Decision**: Use a single `isSubmitting` flag that covers the entire sequence. Disable the submit button, show a spinner on the button, and overlay the modal with a loading indicator during both calls.

**Rationale**: Aligns with Constitution Principle XII (Mutation Loading States). The user must not be able to submit twice or close the modal while the operation is in-flight. A single flag is simpler than tracking two separate mutation states.

**Cache invalidation after success**:
- `queryClient.invalidateQueries({ queryKey: ['student-balance', studentId] })`
- `queryClient.invalidateQueries({ queryKey: ['payments-with-students'] })`
- `queryClient.invalidateQueries({ queryKey: ['dashboard', 'activity'] })`
- `queryClient.invalidateQueries({ queryKey: ['fee-campaigns'] })`
- `queryClient.invalidateQueries({ queryKey: ['student-campaigns', studentId] })`

### Q5: Should the amount input auto-populate with the campaign remaining balance?

**Decision**: Yes. When a campaign is selected, the amount input should pre-fill with the remaining expected amount (expectedAmount - paidAmount), but the admin can override it.

**Rationale**: This is a common UX pattern for payment workflows. It saves the admin from manual calculation while still allowing flexibility for partial or over-payments.

**Implementation**: The frontend computes `remainingAmount = expectedAmount - paidAmount` from the selected campaign data and sets it as the default amount value. If the campaign has no `expectedAmount` (edge case), the field remains empty.
