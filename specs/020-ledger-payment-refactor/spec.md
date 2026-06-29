# Feature Specification: Ledger and Payment System Refactor

**Feature Branch**: `020-ledger-payment-refactor`
**Created**: 2026-04-08
**Status**: Draft
**Input**: Refactor the ledger system and the payment logic, including charges and payments. Identify any existing issues and improve the overall logic related to: The payment flow, Charge generation, Reconciliation, Payment reports, and any other related components. Ensure the system is more reliable, consistent, and maintainable.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reliable Charge Generation (Priority: P1)

A bursar selects a term, previews which students will be billed and what amounts, then confirms to generate charges in bulk. If charge generation fails partway through, the entire batch is rolled back. The bursar can see a clear history of all billing runs and undo a run only when no payments have been made against it.

**Why this priority**: Charge generation is the entry point to all financial activity. Inconsistencies here cascade into incorrect balances, disputed charges, and incorrect reports. Fixing this is the foundation for everything else.

**Independent Test**: Can be fully tested by triggering charge generation for a term, verifying all eligible students receive correct charges, and confirming that a simulated mid-batch failure leaves zero charges for that batch.

**Acceptance Scenarios**:

1. **Given** active students exist for a term with a configured fee structure, **When** a bursar generates charges, **Then** every eligible student receives exactly one charge per fee category with the correct amount, and a billing run record is created linking all charges.
2. **Given** a billing run exists with no associated payments, **When** a bursar undoes that run, **Then** all charges in the batch are soft-deleted and the billing run status is updated to voided.
3. **Given** a billing run exists where at least one charge has a recorded payment, **When** a bursar attempts to undo the run, **Then** the undo is rejected with a clear message indicating which students have payments.
4. **Given** a bursary reduction is configured for a student, **When** charges are generated, **Then** the charge amount reflects the reduced amount based on the bursary percentage.
5. **Given** a charge generation attempt fails mid-batch, **When** the system rolls back, **Then** no partial charges remain and the billing run is marked failed.

---

### User Story 2 - Accurate and Auditable Payment Recording (Priority: P1)

A bursar records a payment for a student specifying the amount, date, payment method, and category. The system immediately updates the student's balance and allocates the payment against the oldest outstanding charges first (FIFO). The full payment history is visible with timestamps and method details.

**Why this priority**: Payment recording directly affects the accuracy of every student's balance. Errors here result in financial discrepancies that are difficult to trace.

**Independent Test**: Record a payment for a student with two outstanding charges. Verify the older charge is fully or partially satisfied before the newer one, and that the student's displayed balance decreases correctly.

**Acceptance Scenarios**:

1. **Given** a student has outstanding charges, **When** a bursar records a payment, **Then** the payment is saved with a unique reference, the student's balance decreases by the payment amount, and the oldest pending charge status updates to `partial` or `paid`.
2. **Given** a payment is recorded, **When** the payment amount exceeds the total outstanding charges, **Then** all charges are marked `paid` and any surplus is reflected in the balance (credit position).
3. **Given** a bursar provides an invalid amount (zero or negative), **When** submitting the payment, **Then** the system rejects it with a clear validation message before saving.
4. **Given** a transport payment is recorded with a route reference, **When** the system processes it, **Then** it only reduces transport-related charges and does not affect the tuition fee balance.
5. **Given** a payment has been recorded, **When** a bursar views the student's payment history, **Then** each payment shows: date, amount, method, category, and who recorded it.

---

### User Story 3 - Clear and Consistent Balance Display (Priority: P1)

Any authorized user viewing a student's account sees a single, unambiguous balance figure that accounts for all charges, payments, credits, and debit adjustments. The balance recalculates automatically whenever a financial event occurs.

**Why this priority**: Balance is the most visible output of the ledger system. Inconsistencies in how it's computed or displayed undermine trust in the entire financial module.

**Independent Test**: Create charges, record a partial payment, apply a credit adjustment, and verify the displayed balance equals: Total Charges + Approved Debits - Total Payments - Approved Credits.

**Acceptance Scenarios**:

1. **Given** a student has charges, payments, and approved adjustments, **When** viewing their account, **Then** the balance equals: (sum of active charges) + (sum of approved debit adjustments) - (sum of payments) - (sum of approved credit adjustments).
2. **Given** both fee-structure and transport charges and payments exist, **When** viewing the balance, **Then** each category's balance is shown separately and a consolidated total is displayed.
3. **Given** a new payment is recorded, **When** any user views the student's balance, **Then** the updated balance is reflected immediately without requiring a manual refresh.
4. **Given** a voided adjustment exists, **When** the balance is calculated, **Then** the voided adjustment has no effect on the result.

---

### User Story 4 - Balance Adjustments and Reconciliation (Priority: P2)

A bursar can apply a credit (e.g., fee waiver, overpayment correction) or debit (e.g., penalty, late fee) adjustment to a student's account with a mandatory reason. All adjustments are logged in an audit trail showing who made the change, when, and why.

**Why this priority**: Adjustments handle edge cases that charges and payments cannot — corrections, write-offs, and penalties. A reliable audit trail is essential for financial accountability.

**Independent Test**: Apply a credit adjustment to a student, verify the balance updates correctly, void the adjustment, and confirm the balance reverts. Check the audit log shows both events.

**Acceptance Scenarios**:

1. **Given** a bursar submits a credit adjustment with a reason, **When** approved, **Then** the student's balance decreases by that amount and an audit log entry is created.
2. **Given** a debit adjustment is applied, **When** viewing the student's account, **Then** the balance increases and the adjustment appears in the transaction history.
3. **Given** an adjustment has been applied, **When** a bursar voids it with a reason, **Then** the adjustment status changes to `voided`, the balance reverts, and the void action is recorded in the audit log.
4. **Given** a refund is processed for a student, **When** the refund is created, **Then** a corresponding credit adjustment is automatically created and linked to the refund record.
5. **Given** a user views the audit log, **When** filtering by student, **Then** all financial events (charges generated, payments recorded, adjustments applied, voids) appear in chronological order.

---

### User Story 5 - Payment and Ledger Reports (Priority: P2)

Finance staff can generate reports on payment collection, outstanding balances by class or grade, revenue by category, and aged balances (overdue 30/60/90+ days). Reports can be filtered by term and academic year.

**Why this priority**: Reports allow management to track financial health, identify non-paying students, and close out terms accurately. Currently, no aged balance or reconciliation summary report exists.

**Independent Test**: Generate a payment collection report for a given term. Verify it shows total charges, total collected, collection rate percentage, and lists students with outstanding balances grouped by overdue period.

**Acceptance Scenarios**:

1. **Given** a term is selected, **When** generating a payment collection report, **Then** the report shows: total charges generated, total payments received, collection rate (%), and number of fully paid vs. outstanding students.
2. **Given** the finance team views the aged balance report, **When** selecting a term, **Then** students are grouped into: current (not yet due), 1-30 days overdue, 31-60 days overdue, 61-90 days overdue, and 90+ days overdue.
3. **Given** a revenue-by-category filter is applied, **When** a term and category are selected, **Then** the report shows total charges and total collected per category (Tuition, Development, Sports, etc.).
4. **Given** a report is generated, **When** viewing results, **Then** each row shows the student name, class, total charged, total paid, and outstanding balance.

---

### User Story 6 - Consistent Charge Type Classification (Priority: P3)

All charges and payments in the system use a single, consistent classification scheme (charge type) rather than overlapping boolean flags. Historical data is migrated to the new scheme without loss of information.

**Why this priority**: The current dual-flag system (`is_fee_structure`, `is_transport`, `charge_type` ENUM) creates confusion and potential bugs when new categories are added. Standardizing reduces future maintenance overhead.

**Independent Test**: Generate a new transport charge and a tuition charge. Verify both are classified correctly using only the `charge_type` field, and that existing balance calculation logic produces the same results as before migration.

**Acceptance Scenarios**:

1. **Given** an existing charge with `is_fee_structure=1`, **When** the schema is migrated, **Then** `charge_type` is set to `fee_structure` and the boolean flags are no longer used in any query.
2. **Given** a new payment is recorded after migration, **When** FIFO allocation runs, **Then** it uses `charge_type` (not `is_fee_structure`) to match payment to charges.
3. **Given** the migrated system is in production, **When** any report or balance query is executed, **Then** results are numerically identical to pre-migration results.

---

### Edge Cases

- What happens when a student is made inactive mid-term after charges have already been generated?
- How does the system handle a payment recorded against a student who has no outstanding charges (pure credit balance)?
- What happens if two billing runs are accidentally triggered for the same term simultaneously?
- How does the system handle a charge amount of zero (e.g., fully bursaried student)?
- What if a term is deleted after charges have been generated against it?
- How are payments handled when the payment date is in a different term than the charge due date?
- What happens when voiding a billing run that includes charges with partial payments?

---

## Requirements *(mandatory)*

### Functional Requirements

**Payment Flow**

- **FR-001**: The system MUST record each payment with a unique reference identifier, amount, date, method, category, student, and the user who recorded it.
- **FR-002**: The system MUST allocate payments against outstanding charges using FIFO (oldest charge first) within the matching charge type.
- **FR-003**: The system MUST prevent recording a payment with a zero or negative amount.
- **FR-004**: The system MUST validate that the payment method is one of the accepted methods before saving.
- **FR-005**: The system MUST update affected charge statuses (`pending` → `partial` → `paid`) atomically within the same transaction as the payment record.
- **FR-006**: The system MUST isolate transport payments from fee-structure charge allocation and vice versa.
- **FR-007**: The system MUST prevent duplicate payment submission caused by rapid re-submission (idempotency check or debounce).

**Charge Generation**

- **FR-008**: The system MUST preview the billing run (students, amounts, breakdown) before a bursar confirms generation.
- **FR-009**: The system MUST generate all charges for a billing run within a single atomic transaction; if any charge fails, the entire run is rolled back.
- **FR-010**: The system MUST link every charge to a `billing_run_id` when generated via a billing run.
- **FR-011**: The system MUST skip students who already have charges for the selected term in the active billing run.
- **FR-012**: The system MUST apply bursary discounts at generation time and record the original and reduced amounts.
- **FR-013**: The system MUST prevent simultaneous billing runs for the same term by the same tenant.
- **FR-014**: Charge undo MUST be blocked if any payment has been allocated against charges in that billing run.
- **FR-015**: Zero-amount charges MUST NOT be generated (skip silently and log the skip reason).

**Reconciliation**

- **FR-016**: The system MUST support credit and debit adjustments with a mandatory reason field.
- **FR-017**: Every adjustment MUST be recorded in the audit log with: actor, timestamp, amount, type, and reason.
- **FR-018**: Voiding an adjustment MUST require a void reason and MUST be recorded in the audit log.
- **FR-019**: A refund MUST automatically create a linked credit adjustment so it is reflected in the balance.
- **FR-020**: The balance formula MUST be: `Active Charges + Approved Debits - Payments - Approved Credits`, applied consistently everywhere.
- **FR-021**: The system MUST expose a single, authoritative balance endpoint; no other component may compute balance independently with a different formula.

**Payment Reports**

- **FR-022**: The system MUST provide a payment collection report filterable by term showing: total charged, total collected, collection rate (%), and per-student breakdown.
- **FR-023**: The system MUST provide an aged balance report grouping outstanding balances into: current, 1-30, 31-60, 61-90, 90+ days overdue, based on charge due dates.
- **FR-024**: The system MUST provide a revenue-by-category report filterable by term and category.
- **FR-025**: All reports MUST respect multi-tenancy (only data for the authenticated tenant's school is returned).

**Consistency and Maintenance**

- **FR-026**: The system MUST standardize on `charge_type` ENUM for all charge classification; boolean flags (`is_fee_structure`, `is_transport`) MUST be retired.
- **FR-027**: Term tracking MUST use `term_id` as the primary reference; redundant string fields (`term`, `academic_session`) MUST be removed from active query paths.
- **FR-028**: The `month` field on payments MUST be derived from the `date` field on read; it MUST NOT be stored as a separate column.

### Key Entities

- **Billing Run**: A record of a bulk charge generation event, linking to a term, the user who triggered it, its status, and all charges it produced.
- **Charge**: A fee levied against a student for a specific term, with a type, amount, due date, status, and link to a billing run.
- **Payment**: A financial transaction recording money received from or on behalf of a student, with method, category, amount, and date.
- **Ledger Adjustment**: A manual correction (credit or debit) applied to a student's balance with a mandatory reason and full audit trail.
- **Refund**: A structured reversal of an overpayment or excess charge, linked to both the original payment and a credit adjustment.
- **Balance**: The computed financial position of a student, derived from: charges, payments, and approved adjustments — never stored independently.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A billing run for 500 students completes fully (or rolls back completely on failure) — no partial charge batches exist after any outcome.
- **SC-002**: A student's balance is identical across all views (student profile, reports, balance list) within the same request cycle — zero discrepancy.
- **SC-003**: Recording a payment and viewing the updated balance requires no manual refresh — the change is visible in under 2 seconds.
- **SC-004**: All financial events (charges, payments, adjustments, voids) appear in the audit log within the same transaction that created them — 100% audit coverage.
- **SC-005**: Payment collection reports and aged balance reports are generated for a term within 5 seconds for up to 1,000 students.
- **SC-006**: Zero instances of orphaned charges (charges with no billing run link when generated via billing run) after the refactor.
- **SC-007**: The balance formula produces the same numeric result as the pre-refactor system for all existing student records after migration — verified by automated comparison.
- **SC-008**: All active queries use `charge_type` exclusively for charge classification — no query references the retired boolean flag columns.

---

## Assumptions

- The existing `charges`, `payments`, `ledger_adjustments`, `refunds`, and `billing_runs` tables are preserved; the refactor adds/removes columns via new migrations rather than rebuilding tables from scratch.
- Multi-tenancy enforcement (filtering all queries by `tenant_id`) remains unchanged — this refactor does not alter the tenancy model.
- The FIFO payment allocation strategy (oldest charge first) is the correct and intended behaviour — no change to allocation strategy is required.
- Transport payments and fee-structure payments remain logically separated after the refactor; only the implementation mechanism changes (from dual booleans to `charge_type`).
- The `is_fee_structure` and `is_transport` boolean columns will be kept in the database schema temporarily (set to nullable) to allow a safe migration window, then removed in a follow-up migration.
- Frontend balance caching via React Query (5-minute TTL) is acceptable; the refactor does not require server-side balance caching.
- The billing run preview endpoint already exists (`GET /billing/preview`) and requires implementation rather than design from scratch.
- Role permissions remain as-is: bursars record payments and generate charges; admins and super_admins can access reports and reconciliation; teachers have read-only balance access.
- No changes to the authentication or JWT structure are part of this refactor.
- Report data export (CSV/PDF) is out of scope for this refactor; reports are displayed in-app only.
