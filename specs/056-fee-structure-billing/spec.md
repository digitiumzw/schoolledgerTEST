# Feature Specification: School Fee Structure & Billing Engine

**Feature Branch**: `056-fee-structure-billing`  
**Created**: 2026-05-01  
**Status**: Ready for Review  
**Input**: User description: "The system must define a school fee structure that includes tuition and any other applicable charges. Fees can be configured as either fixed amounts charged monthly or per term, and are assigned to students based on class, category, or selected services. Based on these fee rules, the system generates student charges (invoices). Each invoice represents an amount owed by a student and is typically generated on a monthly or termly basis, depending on the configured billing cycle. Charge generation must be rule-based and is strictly a manual process that can only be initiated by an administrator from the billing tab. It must never run automatically. When the admin initiates the 'Generate Charges' process, the system runs a billing engine that identifies all eligible students according to the configured fee rules and creates the corresponding charges. The admin must select the billing period (monthly or termly) before generation. The system must prevent duplicate charges for the same student within the same billing period and notify the admin if any eligible students have not yet been billed."

## Clarifications

### Session 2026-05-01

- Q: Can the administrator freely choose between monthly and termly billing period type when initiating charge generation, or is the generation UI constrained by the school's configured billing cycle? → A: The system uses a single billing cycle configured school-wide. The charge generation tab must reflect only that cycle — if the school's billing cycle is monthly, only month+year period selection is shown and only monthly fee rules are processed; if termly, only term selection is shown and only termly rules are processed. The administrator cannot override the cycle at generation time.
- Q: Should individual fee rules carry their own billing_frequency field, or should all rules inherit the school-wide billing cycle? → A: Option A — Fee rules have no billing_frequency field. All rules are processed under whichever cycle the school has configured. Fee rules do not store or validate their own frequency.
- Q: Which roles may initiate charge generation? → A: Option B — Both `admin` and `bursar` roles can trigger the "Generate Charges" process.
- Q: How should the system determine the "current billing period" for the unbilled-student alert when the billing cycle is termly? → A: Option A — Derive from the active academic term in the school's configured calendar. For monthly schools, use the current calendar month+year. If no term is currently active (termly school), no alert is shown.
- Q: Which roles can create, edit, or delete fee rules? → A: Option A — Admin only. Bursar can view fee rules and generate charges but cannot modify the fee structure policy.
- Q: Should fee rule assignment support a "school-wide / all students" scope in addition to class, category, and service? → A: Option A — Yes. A school-wide scope is added so that universal charges (e.g., tuition) can be applied to all active students without requiring one rule per class.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Define Fee Rules in the Fee Structure (Priority: P1)

As a school administrator, I can create and manage a set of named fee rules within the school's fee structure. Each fee rule specifies a charge name (e.g., "Tuition", "Library Fee", "Sports Fee"), a fixed amount, and which students it applies to — either all active students school-wide, or a targeted subset by class, student category, or enrolled service. All fee rules are automatically processed under the school's single configured billing cycle. Fee rules form the foundation from which all student charges are generated.

**Why this priority**: Without defined fee rules there is nothing for the billing engine to work with. Every other story in this feature depends on at least one fee rule existing. This is the data-definition step that unlocks everything downstream.

**Independent Test**: Can be fully tested by navigating to the Fee Structure settings page, creating two fee rules with different criteria (one class-based, one service-based), saving them, reloading the page, and verifying both rules persist with all configured fields intact.

**Acceptance Scenarios**:

1. **Given** the fee structure has no rules yet, **When** admin creates a rule named "Tuition" with amount $150 and scope "School-wide", **Then** the rule is saved and appears in the fee rules list with scope shown as "All Students"
2. **Given** an existing fee rule, **When** admin edits the fee amount and saves, **Then** the updated amount is persisted and the original amount is no longer shown
3. **Given** admin attempts to save a fee rule without a name or without a fee amount, **Then** the system rejects the save with a validation error identifying the missing field
4. **Given** admin creates a fee rule assigned to "Student Category: Bursary", **When** the rule is saved, **Then** only students whose category is "Bursary" are eligible for this charge during generation
5. **Given** a fee rule exists, **When** admin deletes it, **Then** the rule is removed from the fee structure and will not be used in future charge generation runs; existing charges already generated from this rule are unaffected

---

### User Story 2 - Generate Student Charges via the Billing Engine (Priority: P1)

As a school administrator, I can navigate to the billing tab and initiate the "Generate Charges" process. I select a billing period — either a specific month (for monthly fees) or a specific term (for term-based fees) — and the system's billing engine evaluates all active fee rules, identifies every eligible student for each rule, and creates the corresponding charge records. I can see a summary of how many charges were created and for how many students once the process completes.

**Why this priority**: Charge generation is the core revenue-recognition action in the system. Without this story there is no way for the school to bill students, making the entire fee structure configuration worthless.

**Independent Test**: Can be fully tested by defining at least one fee rule, triggering "Generate Charges" for a billing period, and verifying that each eligible student has exactly one new charge record matching the rule's amount and the selected billing period.

**Acceptance Scenarios**:

1. **Given** fee rules exist and active students match those rules, **When** admin opens the billing tab and clicks "Generate Charges", **Then** a billing period selector is shown before any charges are created
2. **Given** the school's billing cycle is configured as "Monthly" and admin opens the generation panel, **Then** only a month+year period selector is shown — no term selector is offered
3. **Given** admin selects "April 2026" as the billing month and confirms, **Then** the billing engine creates one charge per eligible student per active monthly fee rule for April 2026 and reports the total count of charges created
4. **Given** the school's billing cycle is "Termly" and admin opens the generation panel, **Then** only a term selector is shown — no month+year selector is offered
5. **Given** the generation completes, **When** admin views the results screen, **Then** the system shows the number of charges created, the billing period selected, and the total value of charges generated
6. **Given** the system is unattended at any time, **When** no admin has initiated "Generate Charges", **Then** no new charges are created automatically under any circumstance

---

### User Story 3 - Duplicate Prevention & Unbilled Student Alerts (Priority: P2)

As a school administrator, when I initiate charge generation for a billing period that has already been partially or fully billed, the system prevents creating duplicate charges for students who already have a charge for that period and that fee rule. After generation, the system clearly identifies any eligible students who could not be billed (e.g., due to a data issue) or who were skipped, so I can resolve those cases.

**Why this priority**: Duplicate charges directly harm families and create reconciliation problems in the ledger. Unbilled-student notification prevents revenue gaps. Both safeguards are essential to trust and correctness, but the core generation (US2) must work first.

**Independent Test**: Can be tested by running charge generation for a billing period, then immediately running it again for the same period. The second run must produce zero new charges and display a message indicating charges already exist for those students and period.

**Acceptance Scenarios**:

1. **Given** charges for April 2026 "Tuition" have already been generated for Grade 1 students, **When** admin triggers generation again for the same period, **Then** the system skips all students who already have a "Tuition" charge for April 2026 and reports "X students already billed — skipped"
2. **Given** some eligible students have charges for the period and some do not, **When** generation runs, **Then** only the unbilled students receive new charges; billed students are not charged again
3. **Given** generation completes and some eligible students were not billed due to missing assignment data, **When** admin views the generation result, **Then** those students are listed by name with a reason (e.g., "No class assigned") so admin can investigate
4. **Given** admin has not yet run generation for the current billing period, **When** admin views the billing tab, **Then** a notification appears indicating the number of eligible students who have not yet been billed for the current period

---

### User Story 4 - Assign Fees by Service Enrollment (Priority: P2)

As a school administrator, I can define fee rules that apply to students enrolled in specific school services (e.g.after-care, lunch programme) rather than to all students in a class or category. When charges are generated, only students actively enrolled in the named service for the billing period receive the corresponding charge.

**Why this priority**: Service-based fees (transport, meals, etc.) apply to a subset of students who have opted in, not to the whole class or category. Without this assignment dimension, the fee structure cannot represent optional charges, forcing admins to manage them outside the system.

**Independent Test**: Can be tested by creating a fee rule for "Transport Fee" assigned to the "Transport" service, enrolling two students in transport and leaving one unenrolled, generating charges, and verifying only the two enrolled students receive the transport charge.

**Acceptance Scenarios**:

1. **Given** admin creates a fee rule named "Transport Fee" assigned to service "Transport", **When** charges are generated for a billing period, **Then** only students with an active transport assignment for that period receive the transport charge
2. **Given** a student's transport assignment ends before the billing period starts, **When** charges are generated for that period, **Then** the student does not receive a transport charge for that period
3. **Given** a student is enrolled in multiple services (e.g., Transport and After-Care), **When** charges are generated, **Then** the student receives a separate charge for each applicable service fee rule

---

### Edge Cases

- **No eligible students for a fee rule**: When a fee rule is configured but no active students match its assignment criteria, generation should skip that rule gracefully and report zero charges created for it rather than failing.
- **Student enrolled in multiple classes**: If a student is associated with more than one class (e.g., transition period), the billing engine must apply class-scoped fee rules only once per rule per student per billing period, never duplicating charges from multiple class matches. School-wide rules are unaffected by this scenario as they target the student directly.
- **Fee rule deleted after charges already generated**: Deleting a fee rule must not retroactively alter or delete charges already created from it; those charges remain valid historical records.
- **Billing period type mismatch (invalid state)**: Since the billing period selector type is determined by the school's configured cycle, a mismatch between the period type submitted and the school's configured cycle MUST be rejected by the API as an invalid request.
- **Student added to class after charge generation**: If a new student is added to a class after charges have already been generated for the current billing period, re-running generation for the same period should bill that student while skipping all already-billed students.
- **Zero-amount fee rules**: A fee rule with an amount of $0 should be rejected at creation time, as it would produce meaningless charge records.
- **Concurrent generation runs**: If two admins simultaneously trigger charge generation for the same billing period, the system must ensure only one set of charges is created (database-level deduplication constraint rather than application-level timing dependency).

## Requirements *(mandatory)*

### Functional Requirements

#### Fee Rule Definition

- **FR-001**: System MUST allow users with `admin` role to create fee rules within the fee structure, each containing: a unique name, a fixed monetary amount greater than zero, and an assignment scope (school-wide, class, student category, or service); fee rules carry no per-rule billing frequency — all rules are governed by the school's single configured billing cycle
- **FR-002**: System MUST allow users with `admin` role to edit any fee rule's name, amount, and assignment scope at any time
- **FR-003**: System MUST allow users with `admin` role to delete fee rules; deletion MUST NOT affect charges already generated from the deleted rule
- **FR-004**: System MUST validate that every fee rule has a non-empty name, a positive fixed amount, and at least one assignment scope before saving
- **FR-005**: System MUST display all configured fee rules to both `admin` and `bursar` roles; create, edit, and delete actions MUST be visible and accessible to `admin` only
- **FR-006**: System MUST support four assignment scope types: **school-wide** (applies to all active students in the school regardless of class or category), **by class** (applies to all active students enrolled in the specified class), **by student category** (applies to all active students in the specified category), and **by service** (applies to all active students with a current enrollment in the specified service)
- **FR-007**: System MUST scope all fee rule records to the school's tenant; no tenant may read or modify another tenant's fee rules

#### Billing Engine & Charge Generation

- **FR-008**: System MUST provide a "Generate Charges" action exclusively within the billing tab, accessible only to users with `admin` or `bursar` role; all other roles MUST NOT be able to initiate charge generation
- **FR-009**: The charge generation tab MUST display a billing period selector whose type (month+year or term) is determined exclusively by the school's configured billing cycle — a monthly school sees only month+year options; a termly school sees only term options; the administrator cannot override the period type at generation time
- **FR-010**: System MUST NEVER trigger charge generation automatically; it is a strictly manual, admin-initiated process
- **FR-011**: When the administrator confirms generation, the billing engine MUST evaluate all active fee rules for the tenant and process all of them against the selected billing period; no per-rule frequency filtering is applied since all rules share the school's single billing cycle
- **FR-012**: For each matching fee rule, the billing engine MUST identify all eligible students based on the rule's assignment scope active as of the billing period
- **FR-013**: The billing engine MUST create one charge record per eligible student per matching fee rule for the selected billing period
- **FR-014**: The billing engine MUST complete the entire generation run within a single database transaction; if the transaction fails, no partial charges must be persisted
- **FR-015**: System MUST display a generation summary to the administrator upon completion, showing: number of charges created, number of students billed, total monetary value of charges generated, and the billing period used

#### Duplicate Prevention

- **FR-016**: System MUST prevent duplicate charges by rejecting any charge record for a student, fee rule, and billing period combination that already exists
- **FR-017**: When a student already has a charge for a given fee rule and billing period, the billing engine MUST skip that student for that rule and include the count of skipped students in the generation summary
- **FR-018**: Duplicate detection MUST be enforced at the database level (unique constraint) in addition to application-level checks to handle concurrent generation attempts

#### Unbilled Student Alerts

- **FR-019**: After each generation run, the system MUST list any eligible students who could not be billed, along with the reason they were skipped (e.g., missing class assignment, data conflict)
- **FR-020**: System MUST display a notification on the billing tab indicating the number of eligible students who have no charges for the current billing period; for monthly schools the current period is the current calendar month+year; for termly schools the current period is the currently active academic term from the school's academic calendar; if no active term exists for a termly school, no alert is shown
- **FR-021**: The unbilled-student alert MUST be recalculated each time the billing tab is loaded and MUST reflect the current state of charges and fee rule eligibility at that moment

### Key Entities *(include if feature involves data)*

- **FeeRule**: A named billing instruction within a school's fee structure. Key attributes: name, amount (fixed), assignment_scope_type (school_wide | class | category | service), assignment_scope_id (FK to the relevant class, category, or service; NULL when scope is school_wide), tenant_id, is_active. No per-rule billing frequency — all rules are processed under the school's configured billing cycle. Relates to Charge records generated from it.
- **Charge**: An amount owed by a student for a specific billing period. Gains a `fee_rule_id` FK linking it to the originating rule. Key attributes: student_id, fee_rule_id, billing_period (month+year or term_id), amount, created_at, tenant_id. The unique constraint on (student_id, fee_rule_id, billing_period) enforces deduplication.
- **BillingPeriod**: A value object representing the target period for a generation run. For monthly billing: a month (1–12) and year. For term-based billing: a reference to an existing academic term. Not persisted independently; embedded in charge records.
- **GenerationResult**: A transient summary returned to the administrator after a generation run. Contains: charges_created count, students_billed count, students_skipped count (with reasons), total_amount, billing_period used. Not persisted; computed from the generation transaction.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An administrator can create, edit, and delete fee rules from the fee structure settings page without leaving the page, completing each action in under 30 seconds
- **SC-002**: The billing engine generates charges for 500 eligible students across 5 fee rules within a single billing period in under 20 seconds
- **SC-003**: Zero duplicate charges exist for any (student, fee rule, billing period) combination across all tenants — enforced by database-level unique constraint
- **SC-004**: Charge generation is triggered by administrator action 100% of the time; automated triggering is impossible by system design
- **SC-005**: The generation summary report is displayed to the administrator within 2 seconds of the transaction completing and accurately reflects the number of charges created and skipped
- **SC-006**: The unbilled-student notification on the billing tab reflects the accurate count of eligible-but-uncharged students within 3 seconds of page load

## Assumptions

- The existing `charges` table and charge generation infrastructure (`POST /api/charges/generate`) will be extended rather than replaced; new fee rule functionality layers on top of the existing ledger model
- Fee rules are always fixed monetary amounts; percentage-based or sliding-scale fees are out of scope for this release
- Student "categories" referenced in fee rule assignment are the existing student classification attributes already present in the system (e.g., bursary status, day scholar, boarder)
- "Services" available for fee rule assignment are limited to services already tracked in the system (e.g., transport assignments); new service types are out of scope for this release
- The billing tab described in the feature is an existing section of the admin interface; this feature adds the "Generate Charges" action and fee rule management to that tab
- A fee rule applies only to students who are active at the time of generation; inactive, withdrawn, or suspended students are excluded regardless of their class or category assignment
- Fee rule billing frequency (monthly vs. per-term) must align with the selected billing period type at generation time; mixed-frequency generation in a single run is not supported
- Historical charges generated before this feature is introduced do not have a `fee_rule_id` reference and are not retroactively linked
- Only one "Generate Charges" operation should be run per billing period; partial re-runs (to pick up newly enrolled students) are supported via the duplicate-prevention skip logic
