# Feature Specification: Fee Structure Billing Cycle Configuration

**Feature Branch**: `047-fee-billing-cycle`  
**Created**: 2026-04-27  
**Status**: Draft  
**Input**: User description: "Set up the charge generation so that the school can choose either termly or monthly billing for students. This option should be configured within the fee structure."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configure Billing Cycle in Fee Structure (Priority: P1)

A school administrator opens the Fee Structure settings page and selects either **Termly** or **Monthly** as the billing cycle for student charges. The chosen cycle is saved as part of the fee structure configuration and persists for subsequent charge generation runs.

**Why this priority**: This is the foundational setting that controls how and when student charges are generated. Without it, the system has no explicit per-school billing cadence — it currently defaults silently to "termly" without the school making a deliberate choice. Everything else in this feature depends on this setting being selectable and saved.

**Independent Test**: Can be fully tested by navigating to Settings → Fee Structure, toggling between "Termly" and "Monthly", saving, then reloading the page and confirming the chosen cycle is retained. Delivers the core configuration capability independently.

**Acceptance Scenarios**:

1. **Given** the school has not previously configured a billing cycle, **When** an administrator opens the Fee Structure settings, **Then** the billing cycle selector defaults to "Termly" and is clearly labelled.
2. **Given** the administrator selects "Monthly" and saves the fee structure, **When** the page is reloaded, **Then** the billing cycle selector shows "Monthly".
3. **Given** the administrator selects "Termly" and saves, **When** the page is reloaded, **Then** the billing cycle selector shows "Termly".
4. **Given** the administrator attempts to save with no billing cycle selected, **Then** the system rejects the save and displays a validation error.

---

### User Story 2 - Charge Generation Respects the Configured Billing Cycle (Priority: P1)

When a school administrator triggers charge generation, the system reads the billing cycle from the fee structure and generates charges appropriate to that cycle. For **Termly** billing, one set of charges is created per term (existing behaviour). For **Monthly** billing, charges are divided into monthly installments automatically for the duration of the current term.

**Why this priority**: The billing cycle setting only delivers value when charge generation actually behaves differently based on it. This story is co-equal in priority to Story 1 — together they form the MVP of this feature.

**Independent Test**: Can be fully tested by setting the fee structure to "Monthly", then triggering charge generation for the current term. Each student should receive one charge per month within the term's date range, with each charge amount equal to the term fee divided by the number of months in the term. The total across all monthly charges per student should equal the full term fee.

**Acceptance Scenarios**:

1. **Given** the billing cycle is set to "Termly", **When** charges are generated for a term, **Then** each active student receives exactly one charge per fee category at the full configured amount (existing behaviour is preserved).
2. **Given** the billing cycle is set to "Monthly" and the current term spans 3 calendar months, **When** charges are generated, **Then** each active student receives 3 charges per fee category, each for one-third of the configured fee amount, with a distinct due date per month.
3. **Given** the billing cycle is "Monthly" and a term spans a non-whole number of months (e.g., 2.5 months), **Then** the system rounds up to 3 months, distributing the fee so that the total across all monthly charges equals the full term fee (last installment absorbs any rounding remainder).
4. **Given** the billing cycle is "Monthly", **When** charges are generated, **Then** each monthly charge's description clearly identifies the month it corresponds to (e.g., "Tuition – January 2026").
5. **Given** charges have already been generated for the current term under "Monthly" billing, **When** an administrator attempts to generate charges again for the same term, **Then** the system blocks the duplicate generation and reports that charges already exist.

---

### User Story 3 - Billing Cycle Label Shown During Charge Generation Review (Priority: P2)

Before confirming charge generation, the administrator sees a billing preview that clearly states the active billing cycle (Termly or Monthly), the number of installments, and the per-installment amount per student, so there are no surprises after generation.

**Why this priority**: Prevents accidental generation under the wrong billing mode. Provides transparency without blocking the core MVP flows.

**Independent Test**: Can be tested independently by opening the billing preview modal without completing charge generation. The preview should display the billing cycle, installment count, and per-installment breakdown regardless of whether charges are ultimately generated.

**Acceptance Scenarios**:

1. **Given** the billing cycle is "Termly", **When** the administrator opens the billing preview, **Then** the preview shows "Billing cycle: Termly" and displays one charge amount per student.
2. **Given** the billing cycle is "Monthly" and the term spans 3 months, **When** the administrator opens the billing preview, **Then** the preview shows "Billing cycle: Monthly (3 installments)" and the per-installment amount.
3. **Given** the billing cycle is "Monthly", **When** the administrator reviews the preview, **Then** the expected total is consistent with the monthly breakdown multiplied by the number of installments.

---

### Edge Cases

- What happens when a term starts and ends in the same month under monthly billing? The system should generate a single monthly charge (1 installment) equal to the full fee.
- What happens when the school switches from Termly to Monthly mid-year after charges have already been generated for one term? Existing charges for already-generated terms are unaffected; the new cycle applies only to the next charge generation run.
- What happens when fee amounts result in a non-divisible monthly split (e.g., $100 over 3 months)? The system distributes $33.33 for the first two months and $33.34 for the last, ensuring the total is exactly $100.
- What happens when a student's bursary discount is applied under monthly billing? The discount is applied to the total fee first, and then the discounted amount is divided into monthly installments.
- What happens when the fee structure is changed (billing cycle or fee amounts) after monthly charges have already been generated for the current term? The existing charges are not retroactively modified; only future generation runs use the new settings.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The fee structure configuration MUST include a billing cycle field that accepts exactly two values: `termly` or `monthly`.
- **FR-002**: The billing cycle selector MUST be displayed prominently within the Fee Structure settings page, clearly labelled, with an explanation of what each option means for charge generation.
- **FR-003**: The system MUST persist the billing cycle as part of the fee structure record for the school (tenant), scoped per tenant with no cross-tenant leakage.
- **FR-004**: When the billing cycle is `termly`, the charge generation process MUST behave exactly as it does today — one charge per fee category per student per term.
- **FR-005**: When the billing cycle is `monthly`, the charge generation process MUST split each fee category into monthly installments for the duration of the current term, calculated as: `monthly_amount = round(term_fee / months_in_term, 2)`, with the final installment absorbing any cent-level rounding difference.
- **FR-006**: The number of monthly installments MUST be derived from the term's configured start and end dates in the academic calendar, rounding up to the nearest whole month when the term does not span whole months.
- **FR-007**: Each monthly charge MUST carry a distinct due date set to the 1st of its respective month (or the term start date for the first installment if it falls mid-month), and a description that identifies the month (e.g., "Tuition – March 2026").
- **FR-008**: The billing preview shown to administrators before charge generation MUST display the active billing cycle, the number of installments (if monthly), and the per-installment amount per student.
- **FR-009**: Class-specific fee overrides and bursary discounts MUST be applied correctly under both billing cycles — bursary discounts are applied to the full term fee before monthly splitting.
- **FR-010**: The system MUST prevent duplicate charge generation for the same term under monthly billing, using the same duplicate-detection mechanism already in place for termly billing.
- **FR-011**: The billing cycle setting MUST only be modifiable by users with administrator-level or higher access for the school.

### Key Entities

- **Fee Structure**: The per-tenant configuration that governs how fees are applied. Gains a `billingCycle` field (`termly` | `monthly`). Existing fields: `structureType`, `termsPerYear`, `defaultFees`, `classOverrides`.
- **Charge**: A debit record created for a student. For monthly billing, one charge is created per fee category per month within the term, linked to the same `termId` as today and annotated with the billing month.
- **Term**: An academic period with a `start` and `end` date in the academic calendar, used to derive the number of monthly installments.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An administrator can change the billing cycle from Termly to Monthly (or vice versa) and save the fee structure in under 30 seconds, without leaving the Fee Structure settings page.
- **SC-002**: When monthly billing is active and charges are generated for a 3-month term with 2 fee categories and 50 students, the system produces exactly 300 charge records (50 students × 2 categories × 3 months), all within one generation batch, in under 15 seconds.
- **SC-003**: The total of all monthly charges per student per fee category equals the configured term fee amount to the cent, with zero rounding loss across the installment set.
- **SC-004**: The billing preview correctly reflects the billing cycle and installment breakdown before any charges are committed, giving administrators full visibility prior to confirmation.
- **SC-005**: Switching billing cycle does not alter or delete any previously generated charges; historical charge records remain intact and unmodified.
- **SC-006**: All charge generation guard rails (duplicate prevention, calendar completeness checks, bursary discounts, class overrides) continue to function correctly under both billing cycles.

## Assumptions

- The school's academic term dates (start and end) are already configured in the academic calendar before charge generation; the number of monthly installments is derived from those dates. Schools with no term dates configured cannot generate charges under either billing cycle (existing guard is retained).
- "Monthly" billing in this feature means dividing the term's fee into equal monthly payments within the term — it does not introduce a perpetual monthly billing schedule independent of terms.
- The existing `structureType` field on the fee structure (`termly`/`monthly`/`annual`) already exists in the data model but is not currently wired into charge generation logic. This feature makes `structureType` (renamed semantically to `billingCycle` in user-facing copy) the authoritative control for charge generation behaviour. The value `annual` is out of scope and will remain unsupported for charge generation in this release.
- Mobile-specific UI changes to the billing cycle selector are out of scope for this release; the existing responsive layout of the Fee Structure settings page is sufficient.
- Existing termly charge records in the database do not need to be migrated or restructured; the `billing_cycle` context is inferred from how charges were generated and does not require a new database column on the charges table.
