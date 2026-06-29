# Feature Specification: Payment & Billing UX Improvements

**Feature Branch**: `057-payment-billing-ux`  
**Created**: 2026-05-04  
**Status**: Draft  

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Ungenerated Charges Alert on Payments Page (Priority: P1)

An admin visits the Payments page and sees a prominent alert banner when there are fee-rule charges or transport charges that have not yet been generated for the current billing period. The alert prompts them to navigate to the appropriate generation flow. This prevents revenue leakage caused by forgotten charge generation.

**Why this priority**: Admins need to know immediately when billing actions are pending; missing charges directly impact school revenue and reconciliation accuracy.

**Independent Test**: Can be fully tested by confirming the alert appears when the unbilled-alert API returns a non-zero `unbilledStudentCount`, and disappears or updates after charges are generated.

**Acceptance Scenarios**:

1. **Given** there are fee-rule-eligible students with no generated charges for the current period, **When** an admin opens the Payments page, **Then** a visible alert is displayed stating that charges are pending and providing a call-to-action link or button to generate them.
2. **Given** there are transport assignments without a corresponding charge for the current period, **When** an admin opens the Payments page, **Then** a similar alert is shown for transport charges.
3. **Given** all charges have been generated for the current period, **When** an admin opens the Payments page, **Then** no alert is displayed.
4. **Given** the alert is visible, **When** the admin clicks the call-to-action, **Then** they are taken to the charge generation panel or the appropriate settings section.

---

### User Story 2 — Multi-Class Selection in Fee Rule Assignment Scope (Priority: P1)

When creating or editing a fee rule with a "Class" scope, the admin can select multiple classes from a list instead of being limited to a single class. The billing engine then applies the rule to students in any of the selected classes.

**Why this priority**: Schools commonly need the same fee rule to apply across a set of classes (e.g., all Form 4 classes), and the current single-select creates duplicate rules that are error-prone.

**Independent Test**: Create a fee rule scoped to two classes, generate charges, and verify that students from both classes receive the charge while students in other classes do not.

**Acceptance Scenarios**:

1. **Given** the scope type is "Class", **When** the admin opens the class selector in the fee rule form, **Then** they can select one or more classes.
2. **Given** multiple classes are selected, **When** the rule is saved, **Then** the stored rule correctly records all selected class IDs.
3. **Given** a rule with multiple classes is displayed in the fee rules table, **When** the admin views the Scope column, **Then** it shows the names of all selected classes (not raw IDs).
4. **Given** a previously saved single-class rule, **When** the admin edits it, **Then** the existing class selection is pre-populated and can be extended to include more classes.

---

### User Story 3 — Fee Rules Table Displays Class Names (Priority: P1)

In the fee rules table on the Settings page, the Scope column currently shows raw class IDs when the scope type is "Class". Instead, it should display the human-readable class name(s).

**Why this priority**: Raw IDs are meaningless to admins. Displaying names makes the rules table immediately understandable without requiring the admin to cross-reference another page.

**Independent Test**: Save a fee rule scoped to a named class and confirm the table's Scope column shows the class name instead of the class ID.

**Acceptance Scenarios**:

1. **Given** a fee rule with scope type "Class" and one or more class IDs stored, **When** the fee rules table renders, **Then** the Scope column shows the corresponding class name(s), not the ID(s).
2. **Given** a fee rule with scope type "School-wide", "Category", or "Service", **When** the table renders, **Then** those rows continue to display their existing scope label without change.
3. **Given** a class is deleted after a rule was created for it, **When** the table renders, **Then** the missing class is shown gracefully (e.g., "Unknown class" or the raw ID as a fallback).

---

### User Story 4 — Payment Category Semantics & Visual Distinction (Priority: P2)

Payment categories serve two distinct purposes: (1) as bookkeeping tags for user-defined categorisation, and (2) as charge-reduction rules for three hard-coded system defaults: **Transport**, **Fees**, and **Transport + Fees**. The system must clearly separate these two groups in all category selection UIs and enforce correct charge-reduction behaviour for the system defaults.

**Why this priority**: Mixing system and user-defined categories creates confusion and incorrect ledger logic. Visual distinction prevents admins from accidentally modifying system defaults.

**Independent Test**: Record a payment with the "Transport" category and verify that only transport charges are reduced; record with "Fees" and verify only fee-rule charges are reduced; record with a user-defined category and verify no charge-specific reduction occurs.

**Acceptance Scenarios**:

1. **Given** the payment category list is displayed (in modals or settings), **When** the admin views it, **Then** the three system defaults (Transport, Fees, Transport + Fees) are visually distinguished from user-defined categories (e.g., via a badge, different styling, or a section separator).
2. **Given** a payment is recorded with the "Transport" system category, **When** the payment is processed, **Then** only the student's outstanding transport charges are reduced by the payment amount.
3. **Given** a payment is recorded with the "Fees" system category, **When** the payment is processed, **Then** only the student's outstanding fee-rule charges are reduced.
4. **Given** a payment is recorded with the "Transport + Fees" system category, **When** the payment is processed, **Then** both transport charges and fee-rule charges are reduced.
5. **Given** a payment is recorded with a user-defined category, **When** the payment is processed, **Then** it is recorded as a general payment and no charge-type-specific reduction is applied.
6. **Given** the Payment Categories settings tab is open, **When** the admin views the list, **Then** the three system defaults are read-only and cannot be edited, deactivated, or deleted.

---

### User Story 5 — Structured Receipt Number Format (Priority: P2)

When the system generates a receipt number for a recorded payment, the format must follow `year.month.day.time.randomletter` (e.g., `2026.05.04.143022.K`). This replaces any existing unstructured or sequential receipt numbering.

**Why this priority**: A structured, human-parseable receipt number includes the date and a disambiguating suffix, making it useful for support, audits, and reconciliation without requiring a database lookup.

**Independent Test**: Record a payment and confirm the returned receipt number matches the pattern `YYYY.MM.DD.HHmmss.<single-uppercase-letter>`.

**Acceptance Scenarios**:

1. **Given** a payment is successfully recorded, **When** the system generates its receipt number, **Then** the format is `YYYY.MM.DD.HHmmss.X` where X is a random uppercase letter.
2. **Given** two payments recorded at the exact same second, **When** their receipt numbers are generated, **Then** the random letter suffix reduces collision probability (full uniqueness guaranteed by the primary key, not the receipt number alone).
3. **Given** a receipt is displayed to the admin or printed, **When** the receipt number is shown, **Then** it uses the formatted pattern above — not a database ID or sequential counter.

---

### User Story 6 — Payment Snapshot at Record Time (Priority: P2)

When a payment is recorded, the system stores a snapshot of the relevant student and payment data as it exists at that moment — including Class Name, Date, Amount, Balance before payment, and Payment Method. This snapshot is preserved even if underlying data (e.g., class name) changes later.

**Why this priority**: Financial records must be immutable and auditable. A receipt must accurately reflect conditions at the time of payment, not current values that may have changed.

**Independent Test**: Record a payment for a student in "Form 3A", then rename the class to "Form 3B", then retrieve the payment record — the snapshot must still show "Form 3A".

**Acceptance Scenarios**:

1. **Given** a payment is recorded, **When** it is stored, **Then** a snapshot is saved containing: student name, class name at time of payment, payment date, amount, balance before payment, payment method, and category.
2. **Given** the class of a student changes after a payment was recorded, **When** the historical payment is retrieved or its receipt is displayed, **Then** the class name shown is the one captured at the time of payment.
3. **Given** a payment snapshot exists, **When** it is displayed on a receipt or in the payment ledger, **Then** all snapshot fields are visible and correctly attributed.

---

### Edge Cases

- What happens when no classes exist yet and the admin tries to create a class-scoped fee rule?
- What happens if the unbilled-alert API is unavailable — does the Payments page still load without error?
- What if a student belongs to multiple classes in different periods — which class name is captured in the payment snapshot?
- What happens when a payment amount exactly equals the student's total transport charge — is the full charge marked as settled?
- What if a system default category name (e.g., "Transport") is already used by a user-defined category in the database?

## Requirements *(mandatory)*

### Functional Requirements

**Ungenerated Charges Alert**

- **FR-001**: The Payments page MUST display an alert when the unbilled-alert endpoint reports any unbilled fee-rule students for the current billing period.
- **FR-002**: The Payments page MUST display a separate or combined alert when there are transport assignments without generated charges for the current period.
- **FR-003**: The alert MUST include a call-to-action that navigates the admin to the charge generation interface.
- **FR-004**: The alert MUST be dismissed or absent when no ungenerated charges exist.

**Multi-Class Scope Selection**

- **FR-005**: The fee rule form MUST allow selection of one or more classes when the scope type is "Class".
- **FR-006**: The fee rule data model MUST support storing multiple class IDs for a single rule.
- **FR-007**: The billing engine MUST apply a class-scoped rule to all students enrolled in any of the selected classes.
- **FR-008**: The fee rule form MUST pre-populate existing class selections when editing a rule.

**Class Name Display in Fee Rules Table**

- **FR-009**: The Scope column of the fee rules table MUST display class name(s) rather than class ID(s) for class-scoped rules.
- **FR-010**: The system MUST resolve class IDs to names at display time, with a graceful fallback for deleted or unresolvable classes.

**Payment Category Semantics**

- **FR-011**: The three system default categories — Transport, Fees, and Transport + Fees — MUST be hard-coded and non-editable by any user.
- **FR-012**: System default categories MUST be visually distinguished from user-defined categories in all selection UIs and the settings management table.
- **FR-013**: Recording a payment with the "Transport" category MUST reduce only transport-type charges for that student.
- **FR-014**: Recording a payment with the "Fees" category MUST reduce only fee-rule-type charges for that student.
- **FR-015**: Recording a payment with the "Transport + Fees" category MUST reduce both transport and fee-rule charges for that student.
- **FR-016**: Recording a payment with a user-defined category MUST NOT apply any charge-type-specific reduction; the payment is applied as a general credit.
- **FR-017**: System default categories MUST NOT be deletable, deactivatable, or renameable through any UI or API endpoint.

**Receipt Number Format**

- **FR-018**: The system MUST generate receipt numbers in the format `YYYY.MM.DD.HHmmss.X` where X is a randomly selected uppercase letter (A–Z).
- **FR-019**: The generated receipt number MUST be stored on the payment record and displayed on printed or digital receipts.

**Payment Snapshot**

- **FR-020**: When a payment is recorded, the system MUST store a point-in-time snapshot including: class name, payment date, amount paid, balance before payment, payment method, and payment category.
- **FR-021**: The payment snapshot MUST be immutable after creation; subsequent changes to student or class data MUST NOT alter historical snapshots.
- **FR-022**: The snapshot data MUST be retrievable and displayed when viewing a payment record or generating a receipt.

### Key Entities

- **FeeRule**: Named billing instruction with scope type (school_wide, class, category, service) and one or more associated scope identifiers. Class scope now supports multiple IDs.
- **PaymentCategory**: Describes the purpose of a payment. Three system defaults (Transport, Fees, Transport + Fees) are hard-coded and control charge-reduction logic. User-defined categories are bookkeeping tags only.
- **Payment**: Financial transaction record. Gains a structured receipt number and an immutable snapshot field capturing student/class context at record time.
- **PaymentSnapshot**: Point-in-time record embedded in or associated with a Payment, capturing student name, class name, balance, amount, method, and category at the moment of recording.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin visiting the Payments page sees a charge alert within the normal page load time whenever unbilled charges exist; no manual refresh required.
- **SC-002**: 100% of payments recorded via the system have a receipt number matching the `YYYY.MM.DD.HHmmss.X` pattern.
- **SC-003**: Payment snapshots accurately reflect class name, balance, and method at the time of recording — verified by renaming a class after payment and confirming historical records are unchanged.
- **SC-004**: When a "Transport" category payment is recorded, only transport charges are reduced (zero fee-rule charges affected), and vice versa for "Fees".
- **SC-005**: The fee rules table Scope column shows class names (not IDs) for all class-scoped rules in 100% of rendered rows.
- **SC-006**: System default payment categories cannot be modified or deleted through any available UI workflow.

## Assumptions

- The existing `getFeeRuleUnbilledAlert` API endpoint is already implemented (Feature 056) and will be reused for the Payments page alert.
- Transport-charge unbilled detection may require a new or extended alert endpoint since the existing one covers only fee-rule charges.
- The `assignmentScopeId` field on `FeeRule` will be migrated from a single ID string to support multiple IDs; the migration strategy (e.g., comma-separated string, JSON array, or junction table) will be decided during planning.
- The payment snapshot is stored as a JSON blob or separate columns on the payments table; the exact schema will be determined during planning.
- System default categories (Transport, Fees, Transport + Fees) are currently partially implemented as front-end-only constants; this feature formalises them as server-side behaviour.
- Receipt number generation is a backend concern; the frontend displays whatever the backend returns.
- This feature does not change how charges are created, only how payments are applied against charge types.
