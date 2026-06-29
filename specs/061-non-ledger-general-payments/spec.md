# Feature Specification: Non-Ledger General Payments

**Feature Branch**: `061-non-ledger-general-payments`  
**Created**: 2026-05-04  
**Status**: Clarified  
**Input**: User description
: "When recording payments for user-defined categories, treat these payments as general payments and do not post them to the ledger. These payments must not reduce or affect the student's outstanding balance and not be included in any ledger calculations. On the receipt, do not display any balance adjustments. Only payments made under the three system-defined default categories should affect the student balance and be recorded in the ledger. Additionally, allow users to select multiple categories when recording a payment. However, enforce a rule that user-defined categories cannot be selected together with system-defined default categories in the same transaction."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Record a Non-Ledger General Payment (Priority: P1)

A bursar receives money from a student for a school-specific purpose that falls outside the three system-defined categories — Fees, Transport, and Transport + Fees (e.g., a fundraiser contribution, a school trip deposit, or a stationery fee). They record the payment under a user-defined category. The system saves the payment for record-keeping but does not change the student's outstanding balance, does not post to the financial ledger, and does not show a balance adjustment on the printed receipt.

**Why this priority**: This is the core requirement. Without it, user-defined category payments incorrectly reduce a student's balance, producing inaccurate financial statements.

**Independent Test**: Create a user-defined payment category, record a payment under it for a student with a known balance, then verify the student's balance is unchanged, the ledger is unaffected, and the generated receipt shows no balance fields.

**Acceptance Scenarios**:

1. **Given** a student has an outstanding balance of $200, **When** a bursar records a $50 payment under a user-defined category (e.g., "School Trip"), **Then** the student's outstanding balance remains $200.
2. **Given** a payment is recorded under a user-defined category, **When** ledger calculations run (balance queries, allocation engine), **Then** that payment is excluded from all ledger operations.
3. **Given** a receipt is generated for a user-defined category payment, **When** the receipt is viewed or printed, **Then** it does NOT show a "Balance Before", "Balance After", or any balance adjustment fields.
4. **Given** a payment is recorded under a user-defined category, **When** the payment is saved, **Then** it is stored with a clear marker distinguishing it as a non-ledger/general payment.

---

### User Story 2 - Record a Payment with Multiple Categories (Priority: P1)

A bursar needs to record a single payment from a student that covers multiple purposes simultaneously — for example, a student paying two different school levies in one transaction. The bursar enters one total amount received, then allocates it across the selected categories. The system generates one receipt listing all categories and their allocated amounts.

**Why this priority**: Multi-category payments eliminate the need for multiple separate transactions, reducing data entry burden and improving accuracy when a student pays a lump sum covering several charges.

**Independent Test**: Open the payment recording form, select two user-defined categories in one transaction, assign amounts to each, save, and confirm a single receipt is issued listing both categories, with the student's balance unchanged.

**Acceptance Scenarios**:

1. **Given** a bursar is recording a payment, **When** they select multiple user-defined categories, **Then** the form shows a total amount field and per-category split fields that must sum to the total.
2. **Given** a bursar selects only user-defined categories in a multi-category transaction, **When** the payment is saved, **Then** all category entries are treated as non-ledger and the student's balance is unaffected.
3. **Given** a bursar attempts to combine a system-defined category (e.g., "Fees") with a user-defined category in the same transaction, **When** they try to confirm, **Then** the system rejects the combination with a clear validation error message.
4. **Given** a bursar selects multiple system-defined categories alone (e.g., "Fees" + "Transport"), **When** the payment is saved, **Then** all entries are posted to the ledger normally and the student's balance is reduced accordingly.

---

### User Story 3 - Correct Receipt Display for System vs. Non-Ledger Payments (Priority: P2)

A bursar prints receipts for both ledger (system-category) payments and general (user-defined category) payments. The receipt layout automatically adjusts: ledger payments show the full balance summary (balance before, combined amount paid, balance after), while general payments show only the transaction record without any balance fields. For multi-category transactions, all category lines are listed on the receipt but the balance section uses the combined total.

**Why this priority**: Receipts are given to students and parents as official documents. Displaying incorrect balance information on a non-ledger receipt would cause confusion and disputes.

**Independent Test**: Generate a receipt for a system-category payment and confirm balance fields appear; generate a receipt for a user-defined category payment and confirm no balance fields appear.

**Acceptance Scenarios**:

1. **Given** a receipt is generated for a system-defined category payment (single or multi-category), **When** the receipt is rendered, **Then** it shows "Balance Before", a single combined "Amount Paid" equal to the sum of all category allocations, and "Balance After".
2. **Given** a receipt is generated for a user-defined category payment, **When** the receipt is rendered, **Then** none of "Balance Before", "Balance After", or balance adjustment lines are present.
3. **Given** a multi-category transaction containing only user-defined categories, **When** the receipt is generated, **Then** no balance section appears.

---

### Edge Cases

- What happens when a user-defined category is later deleted or renamed — are existing non-ledger payment records preserved?
- How does the system handle a payment of $0 under a user-defined category?
- What if a user-defined category has the same name as a system-defined category? The system-defined status must be determined by the `system` flag, not by name matching.
- What happens when a multi-category payment is partially voided or refunded — how are the non-ledger entries handled?
- Can a single transaction contain multiple system-defined categories (e.g., "Fees" + "Transport")? If so, the ledger must handle combined posting correctly — confirmed as allowed per clarification.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST distinguish between system-defined payment categories and user-defined payment categories using an immutable `system` flag on each category record.
- **FR-002**: System MUST NOT post payments recorded under user-defined categories to the financial ledger.
- **FR-003**: System MUST NOT reduce or modify a student's outstanding balance when a payment is recorded under a user-defined category.
- **FR-004**: System MUST exclude user-defined category payments from all ledger queries, balance calculations, and payment allocation operations.
- **FR-005**: Receipt generation MUST omit all balance-related fields (balance before, balance after, balance adjustment) for payments made under user-defined categories.
- **FR-006**: Receipt generation MUST continue to display balance fields for payments made under system-defined categories: "Balance Before", a single combined "Amount Paid" (sum of all category allocations), and "Balance After". Individual category lines MAY be listed on the receipt for transparency, but the balance section MUST use the combined total.
- **FR-007**: The payment recording interface MUST allow users to select more than one category for a single payment transaction. When multiple categories are selected, the interface MUST present a total amount field and a per-category allocation field for each selected category. The backend MUST validate that the sum of all per-category allocations equals the declared total amount, and MUST reject the request with a validation error if they do not match. The frontend MUST also enforce this constraint before submission.
- **FR-008**: System MUST reject any transaction that mixes user-defined categories with system-defined categories, returning a clear validation error.
- **FR-009**: A transaction containing only system-defined categories MUST be processed through the ledger as normal, regardless of how many system categories are selected. All system-category payments reduce the single unified student outstanding balance; there are no separate balance pools per category.
- **FR-010**: A transaction containing only user-defined categories MUST be treated entirely as a non-ledger general payment.
- **FR-011**: Each payment record MUST store a marker or attribute that identifies whether it was posted to the ledger, enabling auditable distinction between ledger and non-ledger payments.
- **FR-012**: The system MUST store each category line of a multi-category payment in a way that preserves individual category attribution, and MUST generate a single receipt document that lists all selected categories and their respective amounts for the transaction.

### Key Entities

- **Payment Category**: Represents a named purpose for a payment. Has a `system` flag that is `true` for the three built-in categories (Fees, Transport, Transport + Fees) and `false` for all user-defined categories. The `system` flag is immutable. All three system categories reduce the same unified student outstanding balance — there are no separate fee/transport balance pools.
- **Payment**: A financial transaction recorded against a student. Carries one or more category attributions. Gains a `is_ledger_payment` marker (or equivalent) to distinguish ledger vs. non-ledger entries.
- **Payment Line / Category Entry**: A sub-record within a multi-category payment that attributes a portion of the total amount to a specific category.
- **Receipt**: A printable document generated per payment transaction (not per category). For multi-category payments, a single receipt lists all selected categories and their allocated amounts. The balance summary section (Balance Before / Amount Paid / Balance After) appears only for system-category (ledger) transactions and uses the combined total amount paid, not a per-category breakdown.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A student's outstanding balance is unchanged after recording any number of payments exclusively under user-defined categories, verifiable by querying the balance before and after.
- **SC-002**: 100% of user-defined category payments are excluded from all ledger queries and balance allocation runs, verifiable by integration tests covering each ledger query path.
- **SC-003**: A receipt generated for a user-defined category payment contains zero balance-related fields, verifiable by inspecting receipt output structure.
- **SC-004**: The payment recording form rejects mixed system/user-defined category selections with a validation error before submission, verifiable by attempting a mixed selection and confirming the error is surfaced.
- **SC-005**: A multi-category transaction containing only system-defined categories is posted to the ledger exactly as a single-category system payment would be, with no regression in balance accuracy.
- **SC-006**: All existing single-category system-defined category payments continue to behave identically to pre-feature behaviour (no ledger regression), confirmed by existing integration tests passing unchanged.
- **SC-007**: A multi-category payment submission where per-category allocations do not sum to the declared total is rejected by the backend with a validation error, verifiable by submitting a mismatched payload and confirming a 422 or equivalent error response.

## Assumptions

- The three system-defined default categories are: **Fees**, **Transport**, and **Transport + Fees**. These are identified by the `system: true` flag, not by name.
- The existing `system` flag on `PaymentCategory` (introduced in feature 057) is the authoritative source for determining ledger vs. non-ledger treatment.
- Multi-category payments use a total-amount + per-category-split entry model: the bursar enters one total and allocates it across selected categories. The backend may store this as one payment record with line items or as multiple linked records — the storage strategy is a planning-phase decision.
- Voiding or refunding non-ledger payments is out of scope for this feature; existing void behaviour is unchanged.
- The feature applies to all tenant types; there are no tenant-specific overrides for ledger vs. non-ledger behaviour.
- Driver kiosk payment recording is out of scope; only the main bursar payment form is in scope.
- Historical payments recorded under user-defined categories before this feature was deployed are assumed to have been incorrectly posted to the ledger; correcting historical data is out of scope.

## Clarifications

### Session 2026-05-04

- Q: What are the exact names/identities of the three system-defined categories that affect the ledger? → A: "Fees", "Transport", and "Transport + Fees" — identified by the `system` flag, not by name.
- Q: When "Transport + Fees" is posted to the ledger, does it credit separate fee/transport balance pools or a single unified student balance? → A: Unified — the full amount reduces the single combined outstanding student balance, consistent with the existing ledger model.
- Q: For a multi-category payment, should the system generate one receipt covering all categories or one receipt per category? → A: Single receipt — one receipt document lists all selected categories and amounts for the transaction.
- Q: How should amounts be entered for a multi-category payment — separate per-category fields, one total with splits, or one lump total? → A: One total amount with per-category split fields; splits must sum to the total before submission.
- Q: For a multi-category system-category payment, does the receipt show one combined "Amount Paid" or per-category line amounts in the balance section? → A: One combined total — the balance section shows a single "Amount Paid" equal to the sum of all allocations; category lines may be listed separately for transparency.
- Q: Should per-category split amount validation be enforced server-side or frontend-only? → A: Server-side — the backend MUST validate that allocations sum to the total and reject mismatches; frontend also validates for UX.
