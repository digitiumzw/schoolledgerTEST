# Feature Specification: Fee Campaign

**Feature Branch**: `059-fee-campaign`  
**Created**: 2026-05-04  
**Status**: Ready for Review  
**Input**: User description: "Implement a separate feature called a Fee Campaign (or event-based fee tracking module) to track specific fee categories (e.g., Grade 7 exam fees) without using the standard billing or charge system."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create & Auto-Assign Fee Campaign (Priority: P1)

As a school administrator, I want to create a fee campaign that targets a specific group of students (e.g., all Grade 7 students) with a fixed required amount, so that the system automatically assigns every eligible student to the campaign and I can immediately begin tracking who has paid and who has not.

**Why this priority**: This is the foundational capability — without campaign creation and auto-assignment, no other feature (payment recording, reporting) can function. It delivers immediate value by replacing manual spreadsheet tracking of event-based fees.

**Independent Test**: Can be fully tested by creating a campaign for a class, verifying all active students in that class receive an individual campaign record with expected amount and zero paid, then confirming the campaign list view shows accurate counts.

**Acceptance Scenarios**:

1. **Given** 25 active students enrolled in Grade 7, **When** an admin creates a "Grade 7 Exam Fee" campaign targeting Grade 7 with an amount of $50, **Then** 25 individual campaign records are created, each showing expected = $50, paid = $0, remaining = $50, status = "unpaid".
2. **Given** a campaign targeting Grade 7 exists with 25 records, **When** a new student is enrolled into Grade 7 after campaign creation, **Then** the new student is NOT automatically added to the campaign (manual addition required — see US3).
3. **Given** a tenant with no active students in Grade 5, **When** an admin creates a campaign targeting Grade 5, **Then** the campaign is created with zero assigned students and the admin sees a clear "No eligible students" message.
4. **Given** a campaign already exists with name "Grade 7 Exam Fee" for this tenant, **When** an admin attempts to create another campaign with the same name, **Then** the system rejects the request with a duplicate-name validation error.

---

### User Story 2 - Record Payment Against Campaign (Priority: P1)

As a school administrator, I want to record a payment from a student and allocate it directly to their fee campaign record, so that the payment updates the student's campaign balance while also appearing in the general payments ledger for accounting purposes.

**Why this priority**: Payment recording is the core transactional flow — without it the campaign is just a read-only list. This must exist alongside US1 for a viable MVP.

**Independent Test**: Can be fully tested by recording a full or partial payment for a student's campaign record and verifying the campaign record updates correctly (paid amount, remaining, status) AND the payment appears in the student's general payment history.

**Acceptance Scenarios**:

1. **Given** a student with campaign expected = $50, paid = $0, **When** the admin records a $50 payment against this campaign, **Then** the campaign record updates to paid = $50, remaining = $0, status = "fully_paid", AND a payment row is inserted into the general payments table with a reference linking it to this campaign.
2. **Given** a student with campaign expected = $50, paid = $0, **When** the admin records a $20 partial payment, **Then** the campaign record updates to paid = $20, remaining = $30, status = "partially_paid".
3. **Given** a student with campaign expected = $50, paid = $20, **When** the admin records another $30 payment, **Then** the campaign record updates to paid = $50, remaining = $0, status = "fully_paid".
4. **Given** a student with campaign expected = $50, paid = $50 (fully paid), **When** the admin attempts to record an additional payment against this campaign, **Then** the system rejects the payment with an overpayment validation error.
5. **Given** a student with campaign expected = $50, paid = $20, **When** the admin records a $40 payment (exceeds remaining), **Then** the system rejects the payment with an overpayment validation error.

---

### User Story 3 - Campaign Dashboard & Student Status View (Priority: P1)

As a school administrator, I want to view a campaign dashboard that shows aggregate progress (total collected, outstanding) and allows me to drill into individual student statuses (fully paid, partially paid, unpaid), so that I can quickly identify which students still owe fees.

**Why this priority**: Visibility is essential for the campaign to replace spreadsheet tracking. Without a dashboard, the admin cannot monitor progress, which is the stated primary goal of the feature.

**Independent Test**: Can be fully tested by creating a campaign with mixed payment statuses and verifying the dashboard shows correct aggregates and the student list can be filtered by status.

**Acceptance Scenarios**:

1. **Given** a campaign with 25 students: 10 fully paid, 5 partially paid, 10 unpaid, **When** the admin opens the campaign detail view, **Then** the dashboard displays: total expected = $1,250, total collected = $600, total outstanding = $650, and counts per status.
2. **Given** the campaign detail view, **When** the admin filters by "unpaid" status, **Then** only the 10 unpaid students are displayed.
3. **Given** a student's profile page, **When** the admin views the student's fee information, **Then** a dedicated "Fee Campaigns" section shows each campaign the student belongs to with their individual status, expected amount, paid amount, and remaining balance — clearly separated from the standard billing/charges section.

---

### User Story 4 - Manage Campaign Members (Priority: P2)

As a school administrator, I want to manually add or remove individual students from a campaign after it has been created, so that I can handle late enrollments, transfers, or exemptions without recreating the entire campaign.

**Why this priority**: While auto-assignment covers the initial setup, real-world scenarios require ongoing adjustment. This is a P2 because the MVP can function without it — admins can work around it by creating a new campaign.

**Independent Test**: Can be fully tested by adding a student to an existing campaign and removing another, then verifying the campaign totals update accordingly.

**Acceptance Scenarios**:

1. **Given** a campaign with 25 students, **When** the admin manually adds a student not currently in the campaign, **Then** a new campaign record is created for that student with expected = campaign amount, paid = $0, remaining = campaign amount, status = "unpaid", and the campaign count becomes 26.
2. **Given** a student who has made no payments against a campaign, **When** the admin removes the student from the campaign, **Then** the student's campaign record is deleted and the campaign totals adjust.
3. **Given** a student who has made a partial payment ($20) against a campaign, **When** the admin attempts to remove the student, **Then** the system warns that removing a student with recorded payments requires confirmation, and the payment record in the general ledger remains intact.

---

### User Story 5 - Close & Archive Campaign (Priority: P3)

As a school administrator, I want to close a completed campaign so it no longer appears in the active campaign list, while preserving all historical data for audit purposes.

**Why this priority**: Archival is a housekeeping concern. The system works fine with open campaigns — this is polish for long-term usability.

**Independent Test**: Can be fully tested by closing a campaign and verifying it moves to an archived list, no further payments can be recorded against it, and historical data remains accessible.

**Acceptance Scenarios**:

1. **Given** a campaign where all students are fully paid, **When** the admin closes the campaign, **Then** the campaign status changes to "closed", it disappears from the active list, and appears in the archived list.
2. **Given** a campaign with some unpaid students, **When** the admin closes the campaign, **Then** the system warns about outstanding balances and requires explicit confirmation before closing.
3. **Given** a closed campaign, **When** the admin views the archived campaign, **Then** all student records, payment history, and aggregate data remain visible in read-only mode.

---

### Edge Cases

- What happens when a campaign targets a scope (e.g., a class) with zero active students? → Campaign is created with zero records; a clear empty-state message is shown.
- What happens if a student is removed from a class after being assigned to a campaign targeting that class? → The student retains their campaign record (campaign assignment is independent of class membership once created).
- What happens when a payment is recorded for exactly $0? → The system rejects zero-amount payments with a validation error.
- How does the system handle a campaign for the same fee name but a different academic session? → Each campaign is unique by (tenant, name); the admin must use distinct names or close/archive the previous one.
- What happens if a student belongs to multiple active campaigns? → Each campaign is independent; the student has separate records and balances for each campaign. The student profile shows all campaigns.
- What happens when a campaign payment is recorded but the general payment insert fails? → Both operations occur within a single transaction; if either fails, neither is committed.

## Requirements *(mandatory)*

### Functional Requirements

**Campaign Management**

- **FR-001**: System MUST allow an admin to create a fee campaign by specifying: name, description, target scope (school-wide, specific class, or specific classes), required amount per student, and optional due date.
- **FR-002**: System MUST auto-assign all active students matching the target scope at the moment of campaign creation, creating an individual payment-tracking record per student.
- **FR-003**: System MUST prevent duplicate campaign names within the same tenant.
- **FR-004**: System MUST allow an admin to edit campaign metadata (name, description, due date) but NOT the target amount once any payment has been recorded.
- **FR-005**: System MUST allow an admin to close/archive a campaign, preventing further payments while preserving all historical data.

**Student Assignment**

- **FR-006**: System MUST allow an admin to manually add a student to an existing campaign, creating a new tracking record with the campaign's required amount.
- **FR-007**: System MUST allow an admin to remove a student from a campaign, with a confirmation prompt if the student has any recorded payments.
- **FR-008**: System MUST NOT automatically add or remove students from a campaign after initial creation (campaign membership is a point-in-time snapshot).

**Payment Recording**

- **FR-009**: System MUST allow an admin to record a payment against a specific student's campaign record, specifying amount and payment method.
- **FR-010**: System MUST reject payments that would cause the student's paid total to exceed the campaign's expected amount (no overpayments).
- **FR-011**: System MUST insert a corresponding row into the general payments table for every campaign payment, with a reference field linking it back to the campaign.
- **FR-012**: System MUST update the student's campaign record status automatically: "unpaid" (paid = 0), "partially_paid" (0 < paid < expected), "fully_paid" (paid = expected).
- **FR-013**: System MUST execute campaign record update and general payment insert within a single database transaction.

**Campaign Visibility & Reporting**

- **FR-014**: System MUST display a campaign list view showing each campaign's name, target scope, total expected, total collected, total outstanding, and student counts by status.
- **FR-015**: System MUST display a campaign detail view listing all assigned students with their individual status, expected amount, paid amount, and remaining balance.
- **FR-016**: System MUST allow filtering the campaign student list by payment status (all, fully paid, partially paid, unpaid).
- **FR-017**: System MUST display a "Fee Campaigns" section on the student profile showing all campaigns the student belongs to, with per-campaign status and amounts, clearly separated from the standard billing section.

**Data Isolation**

- **FR-018**: System MUST enforce tenant isolation — a campaign and its records are scoped exclusively to the tenant that created them.
- **FR-019**: Campaign payments MUST NOT affect the student's standard charge-based balance calculation (fee balance, transport balance). Campaign balances are tracked independently.

### Key Entities

- **Fee Campaign**: Represents an event-based fee collection initiative. Key attributes: name, description, target scope type, target scope ID(s), required amount per student, status (active/closed), due date, tenant reference, creation metadata.
- **Campaign Student Record**: Represents an individual student's payment-tracking entry within a campaign. Key attributes: student reference, campaign reference, expected amount, paid amount, remaining balance, payment status (unpaid/partially_paid/fully_paid), tenant reference.
- **Payment (existing)**: The general payments table gains an optional campaign reference field so that campaign payments appear in the standard payment history while being traceable back to their originating campaign.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An admin can create a fee campaign and have all eligible students auto-assigned within 5 seconds (for up to 500 students).
- **SC-002**: Recording a campaign payment updates both the campaign record and the general payments table atomically — zero data inconsistency.
- **SC-003**: The campaign dashboard accurately reflects aggregate totals (expected, collected, outstanding) and per-student status at all times.
- **SC-004**: Campaign payments are fully isolated from the standard billing workflow — no impact on fee balance or transport balance calculations.
- **SC-005**: The student profile clearly displays all campaign memberships and their statuses, allowing an admin to assess a student's complete fee picture in one view.
- **SC-006**: Closing a campaign prevents any further payment recording while all historical data remains accessible for audit.

## Assumptions

- The primary user is a school administrator with an existing authenticated session (JWT + role-based access).
- The existing class and student data structures (students.class_id, student status) are sufficient to resolve campaign target scopes without additional data.
- Campaign payments do NOT generate charges in the charges table — they are recorded only in the payments table with a campaign reference. This keeps campaigns completely separate from the charge-based ledger.
- A campaign's required amount is uniform for all students (per-student custom amounts are out of scope for v1).
- Campaigns do not recur automatically — each campaign is a one-time event. If the school wants to run the same fee again next year, they create a new campaign.
- Export/reporting beyond the in-app dashboard (e.g., PDF or CSV export of campaign data) is out of scope for v1.
