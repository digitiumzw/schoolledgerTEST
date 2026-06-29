# Feature Specification: Fix Student Balance & KPI Accuracy

**Feature Branch**: `002-fix-student-balance`  
**Created**: 2026-05-03  
**Status**: Draft  
**Input**: User description: "Fix the Students table balance column so it displays accurate balance information. Balance must use Total Charges − Total Payments for each student, including school fees, transport charges, and any other charges. KPI cards on the Students page must display accurate data: Active Students, Total Across All Statuses, Owing Fees, Total Fees Owed, and On Financial Aid."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Accurate Balance per Student in Table (Priority: P1)

An administrator or bursar opens the Students page and views the balance column in the student list. Each student's balance accurately reflects all charges levied against them minus all payments made — regardless of how many pages of students exist.

**Why this priority**: Balance accuracy is the foundational data that every other financial decision relies on. Inaccurate balances mislead staff and parents, causing incorrect fee collection and disputes.

**Independent Test**: Navigate to the Students page, select any student with known charges and payments, and confirm the balance column matches the independently verified outstanding amount.

**Acceptance Scenarios**:

1. **Given** a student has school fees of $500 and a transport charge of $100, and has paid $400, **When** the Students table is loaded, **Then** that student's balance column displays $200.
2. **Given** a student has no outstanding charges or has fully paid, **When** the Students table is loaded, **Then** that student's balance column shows $0 or a "Paid up" indicator.
3. **Given** a student has approved financial adjustments (e.g., a fee waiver or a correction debit), **When** the Students table is loaded, **Then** the balance column reflects those adjustments in the displayed amount.
4. **Given** a charge has been voided or deleted, **When** the Students table is loaded, **Then** the voided charge does NOT contribute to the student's balance.

---

### User Story 2 - Accurate KPI Cards Across All Students (Priority: P1)

A school administrator views the summary KPI cards at the top of the Students page. Every card — Active Students, Total Across All Statuses, Owing Fees, Total Fees Owed, On Financial Aid — reflects accurate counts and amounts for the entire student population, not just the students visible on the current page.

**Why this priority**: KPI cards are used for financial planning, collections follow-up, and board reporting. Cards driven by a single page of results give a false picture of school finances.

**Independent Test**: On a school with multiple pages of students, navigate to page 2 of the student list. Verify the KPI card totals remain identical to what was shown on page 1 (they must always reflect all students, not just the current page).

**Acceptance Scenarios**:

1. **Given** 200 active students spread across 4 pages, **When** the Students page loads on page 1, **Then** the Active Students KPI shows 200, not 50 (the number on page 1 alone).
2. **Given** 60 students have outstanding balances but only 15 are on the current page, **When** the page is loaded, **Then** the Owing Fees KPI shows 60 and the percentage is calculated against the full active student count.
3. **Given** the total outstanding fees across all students is $15,000, **When** viewing any page of the student list, **Then** the Total Fees Owed KPI shows $15,000 and the average owed per student is calculated from that full amount.
4. **Given** 30 students receive financial aid, **When** the Students page is viewed, **Then** the On Financial Aid KPI reflects 30 regardless of which page is displayed.

---

### User Story 3 - Correct "Owing Fees" Percentage (Priority: P2)

A bursar wants to understand what proportion of active students owe fees, displayed as both a count and a percentage in the KPI card.

**Why this priority**: Percentage context helps management gauge the severity of fee collection issues. An inaccurate percentage can trigger or dismiss collection campaigns incorrectly.

**Independent Test**: Know the exact count of active students with a balance greater than zero, and verify the KPI card shows that count and the correct percentage of total active students.

**Acceptance Scenarios**:

1. **Given** 200 active students and 60 with an outstanding balance, **When** viewing the Students page, **Then** the Owing Fees card shows "60" and "30%" (60 ÷ 200).
2. **Given** a student's balance drops to zero after a payment is recorded, **When** the Students page is refreshed, **Then** the Owing Fees count decreases by one and the percentage updates accordingly.

---

### User Story 4 - Average Fees Owed Display (Priority: P2)

A finance manager wants to see the average outstanding balance per student who owes fees, displayed in the Total Fees Owed KPI card.

**Why this priority**: Average per-student debt helps forecast collection timelines and set realistic payment plan thresholds.

**Independent Test**: Compute the average manually (Total Fees Owed ÷ count of students with outstanding balance) and confirm it matches the KPI card display.

**Acceptance Scenarios**:

1. **Given** 60 students owe a combined total of $12,000, **When** viewing the Total Fees Owed KPI, **Then** the card displays an average of $200 per student.
2. **Given** no students have outstanding balances, **When** viewing the Total Fees Owed KPI, **Then** the card shows $0 total and does not display a misleading average.

---

### Edge Cases

- What happens when a student has charges but zero payments recorded? (Balance = total charges, shown as fully owed)
- What happens when a student has no charges and no payments? (Balance = $0, treated as paid up)
- What happens when approved adjustments result in a negative balance (overpayment / credit)? (Display as credit; do not count the student in "Owing Fees")
- What happens when filtering the student list by class or status — do KPI cards reflect the filtered subset or all students? (KPIs must reflect all students; filters apply to the table list only)
- What happens when a charge is soft-deleted after being included in prior balance calculations? (Deleted charges must be excluded from balance going forward)
- How does pagination affect KPI totals? (Pagination applies only to the table rows; KPI totals are always drawn from the full student population)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The balance displayed for each student in the Students table MUST equal the sum of all active (non-voided, non-deleted) charges levied against that student minus the sum of all payments recorded for that student.
- **FR-002**: The balance calculation MUST include all charge categories linked to a student: school fee structure charges, transport charges, and any other charge types associated with that student.
- **FR-003**: The balance calculation MUST incorporate approved financial adjustments — credit adjustments reduce the balance; debit adjustments increase it.
- **FR-004**: Voided, soft-deleted, or cancelled charges MUST be excluded from the balance calculation.
- **FR-005**: KPI card metrics (Active Students, Total Across All Statuses, Owing Fees, Total Fees Owed, On Financial Aid) MUST be calculated from the complete student population for the tenant, not from the subset of students visible on the current paginated page.
- **FR-006**: The Active Students KPI MUST show the count of students whose enrolment status is currently "active".
- **FR-007**: The Total Across All Statuses KPI MUST show the total count of all students regardless of status.
- **FR-008**: The Owing Fees KPI MUST show the count of active students with a balance greater than zero, along with the percentage that count represents of all active students.
- **FR-009**: The Total Fees Owed KPI MUST show the sum of all positive outstanding balances across all students, along with the average outstanding balance per student who owes fees.
- **FR-010**: The On Financial Aid KPI MUST show the count of students who have any form of financial aid, reflecting the full student population, not a paginated subset.
- **FR-011**: When a student's balance changes (new payment or charge recorded), the Students page must reflect the updated balance and updated KPI values upon the next page load or data refresh.

### Key Entities

- **Student**: An individual enrolled in the school; carries an outstanding balance derived from their charges and payments.
- **Charge**: A fee levied against a student (school fees, transport, other). May be voided or soft-deleted, in which case it is excluded from balance.
- **Payment**: A payment transaction recorded against a student that reduces their balance.
- **Financial Adjustment**: An approved credit or debit that modifies a student's balance outside of the normal charge/payment flow (e.g., fee waivers, refunds, late fees, corrections).
- **KPI Card**: A summary metric shown at the top of the Students page, reflecting tenant-wide statistics independent of pagination state.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For any selected student, the balance shown in the Students table matches the balance computed by independently summing that student's charges minus payments adjusted for approved credits/debits, with zero discrepancy (exact match to two decimal places).
- **SC-002**: KPI card values (Owing Fees count, Total Fees Owed, Active Students) are identical on every page of the paginated student list when the underlying data has not changed between page navigations.
- **SC-003**: After recording a new payment for a student, the student's balance in the table and the KPI totals update to reflect the payment on the next page load or refresh.
- **SC-004**: The Owing Fees percentage displayed is within 0.1% of the manually calculated ratio: (students with balance > 0) ÷ (total active students) × 100.
- **SC-005**: The Total Fees Owed average displayed is within $0.01 of the manually calculated value: (sum of all positive balances) ÷ (count of students with balance > 0).
- **SC-006**: All KPI cards are internally consistent — the Owing Fees count never exceeds the Active Students count; the Total Fees Owed amount is derived from the exact set of students counted by the Owing Fees card.

## Assumptions

- Financial adjustments (credits and debits) exist in the system as an approved mechanism for corrections, waivers, and penalties; the balance formula must incorporate all approved adjustments.
- Filtering the student list (by class, status, search term) does not change KPI card values — KPI cards always reflect the full tenant-wide student population, not the filtered view.
- The "On Financial Aid" metric is based on the student's recorded financial aid/bursary status, not on their adjusted balance; a student is counted as "on financial aid" if their aid status is anything other than "none".
- Balances are expressed in the local currency rounded to two decimal places.
- Students with a zero or negative balance (credit/overpayment) are NOT counted in the "Owing Fees" metric.
- Pagination applies to the student rows in the table only; KPI summaries are always computed from a separate full-population query.
