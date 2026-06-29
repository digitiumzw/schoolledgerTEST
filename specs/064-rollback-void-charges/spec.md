# Feature Specification: Roll Back or Void Generated Charges

**Feature Branch**: `064-rollback-void-charges`  
**Created**: 2026-05-06  
**Status**: Draft  
**Input**: User description: "Add a feature that allows users to roll back or void the most recently generated charges. This functionality must handle transport charges and fee rule charges separately, allowing each type to be independently reversed or voided. Additionally, when generating charges, the system should include a clear and descriptive label in the charge description: For fee rule charges, use a format like: “TERM-2-2026 Fee Rules Charges”. For transport charges, use a format like: “TERM-2-JUNE-2026 Transport Charges”."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reverse Latest Fee Rule Charge Generation (Priority: P1)

A school administrator can identify the most recently generated fee rule charges and roll them back or void them without affecting transport charges or any earlier fee rule charge batches.

**Why this priority**: Fee rule charges are core school billing records. Administrators need a safe recovery path when charges are generated for the wrong term, wrong students, or wrong fee setup.

**Independent Test**: Can be fully tested by generating fee rule charges, then using the reversal action for fee rule charges only and confirming that those latest fee rule charges are no longer collectible while transport charges remain unchanged.

**Acceptance Scenarios**:

1. **Given** fee rule charges were generated most recently for a school term, **When** an administrator chooses to roll back fee rule charges, **Then** only the latest fee rule charge batch is reversed and previous fee rule batches are left unchanged.
2. **Given** fee rule charges and transport charges both exist for the same term, **When** an administrator reverses fee rule charges, **Then** transport charges remain active and payable.
3. **Given** no fee rule charge batch exists for the selected school context, **When** an administrator attempts a fee rule rollback, **Then** the system blocks the action and explains that there is no fee rule charge generation to reverse.
4. **Given** the latest fee rule charge batch has already been reversed, **When** an administrator attempts to reverse it again, **Then** the system prevents a duplicate reversal.

---

### User Story 2 - Reverse Latest Transport Charge Generation (Priority: P1)

A school administrator can identify the most recently generated transport charges and roll them back or void them independently from fee rule charges.

**Why this priority**: Transport billing is generated separately from fee rules and may follow a different period or student eligibility set. Administrators must be able to correct transport generation mistakes without disrupting standard fees.

**Independent Test**: Can be fully tested by generating transport charges, then using the reversal action for transport charges only and confirming that the latest transport charges are no longer collectible while fee rule charges remain unchanged.

**Acceptance Scenarios**:

1. **Given** transport charges were generated most recently for a school period, **When** an administrator chooses to roll back transport charges, **Then** only the latest transport charge batch is reversed and earlier transport batches are left unchanged.
2. **Given** fee rule charges and transport charges both exist for the same student, **When** transport charges are reversed, **Then** the student's fee rule charges remain active and payable.
3. **Given** no transport charge batch exists for the selected school context, **When** an administrator attempts a transport rollback, **Then** the system blocks the action and explains that there is no transport charge generation to reverse.
4. **Given** the latest transport charge batch has already been reversed, **When** an administrator attempts to reverse it again, **Then** the system prevents a duplicate reversal.

---

### User Story 3 - Confirm and Audit Charge Voids (Priority: P2)

Before reversing charges, a school administrator sees a clear confirmation showing the charge type, period label, number of charges, total amount, and impact on student balances. After confirmation, the action is traceable for audit purposes.

**Why this priority**: Reversing generated charges is financially sensitive. A confirmation step and audit visibility reduce accidental reversals and support accountability.

**Independent Test**: Can be tested by opening the rollback confirmation for each charge type, verifying the summary, completing the action, and confirming that the reversal appears in administrative history.

**Acceptance Scenarios**:

1. **Given** a latest fee rule charge batch exists, **When** the administrator opens the fee rule rollback confirmation, **Then** the summary displays the fee rule charge type, period label, charge count, total amount, and affected students.
2. **Given** a latest transport charge batch exists, **When** the administrator opens the transport rollback confirmation, **Then** the summary displays the transport charge type, period label, charge count, total amount, and affected students.
3. **Given** an administrator confirms a reversal, **When** the action completes, **Then** the system records who performed it, when it occurred, which charge type was affected, and which generated batch was reversed.
4. **Given** an administrator cancels the confirmation, **When** the cancellation completes, **Then** no charges or balances are changed.

---

### User Story 4 - Generate Charges with Descriptive Labels (Priority: P2)

When fee rule or transport charges are generated, each charge receives a descriptive label that identifies the term, period, year, and charge source so administrators and guardians can distinguish charge origins in ledgers and reports.

**Why this priority**: Clear descriptions reduce confusion in student ledgers, payment allocation, reconciliation, and support conversations.

**Independent Test**: Can be tested by generating fee rule and transport charges and confirming that each charge description follows the required format for its charge type.

**Acceptance Scenarios**:

1. **Given** an administrator generates fee rule charges for Term 2 of 2026, **When** charges are created, **Then** each fee rule charge description uses the format `TERM-2-2026 Fee Rules Charges`.
2. **Given** an administrator generates transport charges for June in Term 2 of 2026, **When** charges are created, **Then** each transport charge description uses the format `TERM-2-JUNE-2026 Transport Charges`.
3. **Given** generated charges are viewed in a student ledger or charge report, **When** the description is displayed, **Then** the label clearly distinguishes fee rule charges from transport charges.

---

### Edge Cases

- What happens when the latest charge generation contains charges for students who have already made payments? The reversal must not silently erase payment history; it must either void only unpaid portions or create an auditable balance adjustment that preserves payment records.
- What happens when only some charges in the latest batch can be reversed because of later financial activity? The system must present the affected and blocked items before confirmation and avoid partial reversal unless the administrator explicitly confirms the allowed subset.
- What happens when fee rule and transport charge batches were generated at the same time? The system must still identify the latest batch separately by charge type and allow independent reversal.
- What happens when a newer batch exists after the batch an administrator wants to reverse? The system must only allow reversal of the most recent non-reversed batch for that charge type.
- What happens when multiple administrators attempt to reverse the same latest batch concurrently? Only one reversal should succeed; subsequent attempts should show that the batch has already been reversed.
- What happens when charge generation is attempted after a rollback? The system should allow regeneration for the same charge type and period once the previous latest batch has been reversed, subject to normal duplicate-generation rules.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST classify generated charges by source type as either fee rule charges or transport charges for rollback and voiding purposes.
- **FR-002**: Users with appropriate finance or administrator permissions MUST be able to view the latest generated fee rule charge batch independently from the latest generated transport charge batch.
- **FR-003**: Users with appropriate finance or administrator permissions MUST be able to roll back or void the latest generated fee rule charge batch without changing transport charge batches.
- **FR-004**: Users with appropriate finance or administrator permissions MUST be able to roll back or void the latest generated transport charge batch without changing fee rule charge batches.
- **FR-005**: The system MUST restrict rollback or void actions to the most recent non-reversed generation batch for the selected charge type.
- **FR-006**: The system MUST prevent duplicate rollback or void actions against a batch that has already been reversed.
- **FR-007**: Before completing a rollback or void action, the system MUST show a confirmation summary including charge type, period label, number of charges, total amount, affected student count, and expected balance impact.
- **FR-008**: The system MUST preserve an auditable record of every rollback or void action, including actor, timestamp, charge type, affected batch, charge count, total amount, and reason if provided.
- **FR-009**: Reversed or voided charges MUST no longer be collectible and MUST no longer count as outstanding balances for students.
- **FR-010**: The system MUST preserve historical visibility of reversed or voided charges so financial reports and audits can distinguish active charges from reversed charges.
- **FR-011**: The system MUST protect payment history when reversing charges that have related payments or allocations; payment records must remain traceable after the charge reversal.
- **FR-012**: Fee rule charge generation MUST set each generated charge description using the pattern `TERM-{termNumber}-{year} Fee Rules Charges`, such as `TERM-2-2026 Fee Rules Charges`.
- **FR-013**: Transport charge generation MUST set each generated charge description using the pattern `TERM-{termNumber}-{monthName}-{year} Transport Charges`, such as `TERM-2-JUNE-2026 Transport Charges`.
- **FR-014**: Charge descriptions MUST use the school term, month where applicable, and year associated with the generation period rather than the date on which the generation action is performed.
- **FR-015**: The system MUST present clear success or failure feedback after each rollback or void attempt, including the charge type affected.
- **FR-016**: The rollback or void feature MUST respect tenant boundaries so users can only reverse charges belonging to their own school.

### Key Entities *(include if feature involves data)*

- **Generated Charge Batch**: A group of charges created by one charge generation action. Key attributes include charge source type, period label, generation time, generated-by user, charge count, total amount, and reversal status.
- **Charge**: A student billing item created from fee rules or transport billing. Key attributes include student, amount, description, source type, period, status, and relationship to a generated charge batch.
- **Charge Reversal**: An auditable record that a generated charge batch was rolled back or voided. Key attributes include affected batch, actor, timestamp, reason, total amount reversed, and affected charges.
- **Student Balance**: The financial position for a student, recalculated or adjusted so reversed charges no longer contribute to outstanding balances while payment history remains visible.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An authorized administrator can reverse the latest fee rule charge batch or latest transport charge batch independently in under 60 seconds from the charge management area.
- **SC-002**: In a test dataset with both fee rule and transport charges for the same term, reversing one charge type leaves 100% of the other charge type active and unchanged.
- **SC-003**: After a successful reversal, affected student outstanding balances decrease by exactly the active amount of the reversed charges, with no loss of payment history.
- **SC-004**: 100% of newly generated fee rule charges include descriptions matching `TERM-{termNumber}-{year} Fee Rules Charges`.
- **SC-005**: 100% of newly generated transport charges include descriptions matching `TERM-{termNumber}-{monthName}-{year} Transport Charges`.
- **SC-006**: Attempts to reverse a non-latest or already reversed charge batch are blocked with a clear explanation every time.
- **SC-007**: Every successful rollback or void action produces an audit record that identifies the user, timestamp, charge type, affected batch, and total amount reversed.

## Assumptions

- "Roll back" and "void" both mean making the most recently generated charges non-collectible while preserving financial history; the implementation may use either terminology in the interface as long as the meaning is clear.
- The target users are school administrators or finance users who already have permission to generate or manage charges.
- Fee rule charges and transport charges are generated through distinguishable processes or carry enough source information to identify their origin.
- The "most recently generated" batch is determined separately for each school and each charge source type.
- Transport charge labels include a month because transport billing may be generated monthly within a term; fee rule labels do not include a month unless a later feature extends fee rules to monthly labels.
- Existing historical charges do not need their descriptions backfilled; the descriptive label requirement applies to newly generated charges after this feature is implemented.
