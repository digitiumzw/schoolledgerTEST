# Feature Specification: Receipt Search and Cancel

**Feature Branch**: `085-receipt-search-cancel`  
**Created**: 2026-05-30  
**Status**: Draft  
**Input**: User description: "Add an option that allows users to search for payments using the receipt number. Add an option to cancel and invalidate a receipt. When a receipt is canceled, the associated payment should be automatically voided."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Search Payments by Receipt Number (Priority: P1)

A bursar or administrator needs to quickly locate a specific payment when a parent or staff member presents a receipt number (e.g., during a dispute, reconciliation, or refund request). The user opens the payments area, enters the receipt number into a dedicated search field, and the system returns the exact payment record along with the student and transaction details.

**Why this priority**: Without a targeted receipt search, users must scroll through paginated payment lists or use broad text search that matches unrelated fields. This wastes time and increases error rates during high-stakes financial inquiries.

**Independent Test**: Can be fully tested by entering a known receipt number into the search field and verifying that the exact payment is returned as the primary result, with student name, amount, date, and method visible.

**Acceptance Scenarios**:

1. **Given** a payment with receipt number `RCP-2026-001` exists for the current tenant, **When** the user types `RCP-2026-001` into the receipt search field and submits, **Then** the payment list shows exactly that payment with student details, amount, and date.
2. **Given** the user enters a partial receipt number `2026-001`, **When** the search executes, **Then** the system returns all payments whose receipt numbers contain that substring, ordered by most recent date.

---

### User Story 2 - Cancel and Void a Receipt (Priority: P1)

An administrator discovers that a payment was recorded in error (wrong amount, duplicate entry, or fraud). The administrator locates the payment via receipt number, opens the cancel action, enters a mandatory reason (e.g., "Duplicate entry — reversed"), and confirms. The system marks the payment as voided, recalculates the student's ledger balance to exclude the voided amount, and updates any charge statuses that were affected by the original payment allocation.

**Why this priority**: Financial accuracy is critical. The ability to correct mistakes without deleting audit history protects ledger integrity and maintains trust with parents and auditors.

**Independent Test**: Can be fully tested by creating a payment, noting the student's balance, canceling the receipt with a reason, and verifying that the student's balance increases by the voided amount and the payment status shows as voided.

**Acceptance Scenarios**:

1. **Given** a valid active payment with receipt number `RCP-2026-002`, **When** an authorized user submits a cancel request with reason `Incorrect amount recorded`, **Then** the payment is marked voided, the student's balance is recalculated, and a success confirmation is displayed.
2. **Given** a payment that has already been voided, **When** a user attempts to cancel it again, **Then** the system rejects the request with an error indicating the receipt is already canceled.

---

### User Story 3 - View Canceled Receipt with Invalid Indicator (Priority: P2)

A parent brings a printed receipt to the office months later. The staff member looks up the receipt number and sees that it has been canceled. The receipt view prominently displays a "CANCELED / INVALID" watermark or banner, voided date, and the reason for cancellation, ensuring no confusion about the payment's current validity.

**Why this priority**: Prevents accidental acceptance of voided receipts as proof of payment and supports transparent communication with parents and auditors.

**Independent Test**: Can be fully tested by viewing a voided receipt and confirming that the screen or printout shows the canceled state, void reason, and original payment details in a visually distinct format.

**Acceptance Scenarios**:

1. **Given** a receipt that was canceled on 2026-05-15 with reason `Bank chargeback`, **When** any user views the receipt by its number, **Then** the receipt displays a clear "CANCELED" banner, the void date, and the reason.
2. **Given** a receipt with multiple category lines (grouped payment), **When** it is canceled, **Then** all sibling lines are shown as voided and the combined total is struck through.

---

### Edge Cases

- **Grouped payment void**: A receipt may span multiple payment rows (multi-category grouped payment). Voiding the receipt must void all sibling rows sharing the same receipt number to keep the group atomic.
- **Already voided payment**: The system must guard against double-voiding and return a clear error.
- **Ledger recalculation after void**: When a payment is voided, any charges that were marked as paid or partially paid by that payment may need their statuses recalculated.
- **Unauthorized void attempt**: Users without the admin or bursar role must receive a 403-style denial if they attempt to cancel a receipt.
- **Missing void reason**: The system must require a non-empty reason before accepting a cancellation.
- **Receipt not found**: Searching for a non-existent receipt number must return an empty result set, not an error.
- **Negative balance after void**: If voiding a payment causes the student's balance to become negative (credit), the system must accurately reflect this.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Users MUST be able to search for payments using a dedicated receipt number field that supports exact and partial matching.
- **FR-002**: The system MUST return payment details including student name, amount, date, method, category, and receipt status (active or voided) for receipt search results.
- **FR-003**: Authorized users (admin and bursar roles) MUST be able to cancel a receipt, which marks the associated payment as voided.
- **FR-004**: The cancellation action MUST require a non-empty reason that is persisted with the voided payment record.
- **FR-005**: When a payment is voided, the system MUST recalculate the student's ledger balance so the voided amount is no longer counted as paid.
- **FR-006**: Backend APIs MUST return view-ready data for all feature screens, including any
  filtering, searching, pagination, sorting, aggregations, and computed values required by the
  frontend.
- **FR-007**: Frontend behavior MUST be limited to passing user-selected query parameters and
  rendering backend-prepared responses; it MUST NOT perform client-side data filtering,
  searching, sorting, pagination, aggregations, or business computations.
- **FR-008**: Every user action that triggers a data change (create, update, delete, submit,
  refresh, bulk-operation, status-change) MUST display a visible loading indicator from the
  moment the request is initiated until the response is fully received and the UI reflects
  the confirmed server state. Action-triggering controls MUST be disabled during in-flight
  requests to prevent duplicate submissions.
- **FR-009**: After any mutation completes, all React Query queries whose data was affected
  MUST be invalidated or updated so the next render reflects the latest server state. Stale
  cached values MUST NOT flash or re-appear after the mutation response is processed.
- **FR-010**: If the feature involves email communications, all email templates and views MUST
  use the same design system, layout, spacing, typography, styling, colors, and overall visual
  structure. New email types MUST reuse existing email view components and extend the base
  email template system rather than implementing independent layouts.


### Key Entities *(include if feature involves data)*

- **Payment**: A financial transaction recorded against a student. Key attributes include amount, date, method, category, receipt number, and void status (active or voided with reason).
- **Receipt**: The document representation of one or more payment rows. It is identified by receipt number and serves as the external proof of payment. Cancellation of a receipt voids all underlying payment rows.
- **Student Ledger**: The running balance of charges, payments, and adjustments for a student. Voiding a payment triggers a ledger recalculation to ensure accuracy.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can locate a specific payment by receipt number in under 5 seconds.
- **SC-002**: Receipt cancellation and ledger recalculation complete within 3 seconds of confirmation.
- **SC-003**: 100% of voided payments are excluded from student balance calculations and financial totals.
- **SC-004**: Canceled receipts display a clear visual invalid indicator on both screen and print views.
- **SC-005**: The receipt search endpoint returns only the requested page of results within the target response time at expected data volume.

## Assumptions

- Each payment already has a generated receipt number assigned at creation time.
- The receipt view is rendered from payment data; no separate receipt table exists.
- Multi-category grouped payments share a single receipt number and must be voided atomically.
- Voided payments are one-way (irreversible) for v1; un-voiding is out of scope.
- The existing role-based access system (admin, bursar) is reused for authorization.
- Mobile-optimized receipt cancellation is out of scope for v1.
