# Feature Specification: Fix Ledger Balance Filtering

**Feature Branch**: `063-fix-ledger-balance`  
**Created**: 2026-05-05  
**Status**: Draft  
**Input**: User description: "Fix the ledger system so that the student balance is calculated using only specific charge types and payment categories: Include only charge types 'fee_structure' and 'transport'. Include only payments with categories: Fees, Transport + Fees, and Transport Fee. The student balance should be calculated as: Current Balance = (Total Charges + Debit Adjustments + Opening Balance) − (Total Payments + Credit Adjustments). Ensure that all components in this formula are filtered to include only the specified charge types and payment categories for the particular student."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Accurate Student Balance (Priority: P1)

As a school administrator or bursar, I want each student's displayed balance to include only approved ledger charges, approved payment categories, and related adjustments so that financial decisions are based on the correct school-fee and transport obligations.

**Why this priority**: The current balance is a critical financial figure used for collections, receipts, parent communication, and reporting. Incorrect inclusion of unrelated charges or payments can overstate or understate student debt.

**Independent Test**: Can be fully tested by preparing one student with eligible and ineligible charges, eligible and ineligible payments, debit adjustments, credit adjustments, and opening balance, then confirming the displayed balance matches the required formula using only eligible components.

**Acceptance Scenarios**:

1. **Given** a student has charge records of multiple types, **When** the student balance is calculated, **Then** only charges with type `fee_structure` or `transport` contribute to Total Charges.
2. **Given** a student has payments across multiple categories, **When** the student balance is calculated, **Then** only payments categorized as Fees, Transport + Fees, or Transport Fee contribute to Total Payments.
3. **Given** a student has eligible charges, eligible payments, debit adjustments, credit adjustments, and opening balance, **When** the balance is calculated, **Then** the result equals `(Total Charges + Debit Adjustments + Opening Balance) − (Total Payments + Credit Adjustments)`.

---

### User Story 2 - Exclude Non-Ledger Financial Activity (Priority: P2)

As a bursar, I want general or unrelated financial activity to be excluded from the student balance so that non-school-fee transactions do not affect debt collection and account status.

**Why this priority**: Schools may record payments or charges that should not reduce or increase the official student ledger balance. Excluding them prevents incorrect account statuses.

**Independent Test**: Can be tested by adding non-eligible charge types and payment categories for a student and confirming the student balance remains unchanged.

**Acceptance Scenarios**:

1. **Given** a student has charges that are not `fee_structure` or `transport`, **When** their balance is recalculated, **Then** those charges are ignored.
2. **Given** a student has payments outside Fees, Transport + Fees, and Transport Fee, **When** their balance is recalculated, **Then** those payments are ignored.

---

### User Story 3 - Maintain Student-Specific Balance Isolation (Priority: P3)

As an administrator, I want each student's balance to use only that student's eligible financial records so that balances are not affected by transactions belonging to other students.

**Why this priority**: Student balance integrity depends on strict record isolation. Cross-student inclusion would create severe financial inaccuracies.

**Independent Test**: Can be tested by creating eligible financial records for multiple students and confirming each student's balance reflects only their own qualifying records.

**Acceptance Scenarios**:

1. **Given** two students have separate eligible charges, payments, adjustments, and opening balances, **When** each balance is calculated, **Then** each result includes only records belonging to that student.

---

### Edge Cases

- Student has no eligible charges, payments, adjustments, or opening balance; balance should be zero.
- Student has only an opening balance; balance should equal the opening balance.
- Student has only eligible payments and no eligible charges or debit-side components; balance should reflect a credit position according to existing balance display conventions.
- Student has both eligible and ineligible records on the same date; eligibility should be determined by charge type or payment category, not by date ordering.
- Payment category names must match the approved categories consistently even when other categories contain similar wording.
- Adjustments must be included only when they belong to the same student and ledger scope as the approved charge and payment categories.
- Recalculation should produce the same result each time when no underlying student financial records have changed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST calculate each student's current balance using the formula `(Total Charges + Debit Adjustments + Opening Balance) − (Total Payments + Credit Adjustments)`.
- **FR-002**: System MUST include in Total Charges only charge records for the selected student whose charge type is `fee_structure` or `transport`.
- **FR-003**: System MUST exclude all charge records for the selected student whose charge type is not `fee_structure` or `transport`.
- **FR-004**: System MUST include in Total Payments only payment records for the selected student categorized as Fees, Transport + Fees, or Transport Fee.
- **FR-005**: System MUST exclude all payment records for the selected student whose category is not Fees, Transport + Fees, or Transport Fee.
- **FR-006**: System MUST include Debit Adjustments only when they apply to the selected student and the same eligible ledger scope represented by the approved charge types and payment categories.
- **FR-007**: System MUST include Credit Adjustments only when they apply to the selected student and the same eligible ledger scope represented by the approved charge types and payment categories.
- **FR-008**: System MUST include Opening Balance only for the selected student and only for the same eligible ledger scope represented by the approved charge types and payment categories.
- **FR-009**: System MUST ensure eligible records from other students never contribute to the selected student's balance.
- **FR-010**: System MUST apply the same balance filtering rules everywhere a student balance is displayed, summarized, or used for account status decisions.
- **FR-011**: System MUST preserve existing non-balance financial records without deleting, rewriting, or reclassifying them solely to satisfy this calculation.
- **FR-012**: System MUST produce a deterministic balance for the same student and unchanged financial data.

### Key Entities *(include if feature involves data)*

- **Student**: The learner whose financial balance is being calculated.
- **Charge**: A debit-side financial obligation assigned to a student; only charges typed `fee_structure` or `transport` are eligible for this balance.
- **Payment**: A credit-side financial record made for a student; only payments categorized as Fees, Transport + Fees, or Transport Fee are eligible for this balance.
- **Debit Adjustment**: A student-specific increase to the eligible ledger balance.
- **Credit Adjustment**: A student-specific decrease to the eligible ledger balance.
- **Opening Balance**: A student-specific starting balance that contributes to the eligible ledger calculation.
- **Student Balance**: The calculated current amount owed or credited for one student after applying the required formula and filters.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For test students containing mixed eligible and ineligible records, 100% of calculated balances match the required formula using only the approved charge types and payment categories.
- **SC-002**: For students with only ineligible charges and payments, the calculated balance is unaffected by those records in 100% of validation cases.
- **SC-003**: Balance results remain consistent across all user-visible balance locations for the same student and unchanged financial data.
- **SC-004**: A balance recalculation for a student completes within the existing acceptable response time for viewing student financial information.
- **SC-005**: Finance users can verify a student's balance from the component totals without manual correction or category filtering outside the system.

## Assumptions

- The approved charge types are exactly `fee_structure` and `transport`.
- The approved payment categories are exactly Fees, Transport + Fees, and Transport Fee.
- Existing category and charge-type labels remain the authoritative way to determine ledger eligibility.
- Opening balances and adjustments already have enough information to associate them with a specific student and eligible ledger scope.
- This feature changes balance calculation rules only; it does not change how financial records are created, named, displayed individually, or stored.
