# Feature Specification: Generate Payment Financial Report

**Feature Branch**: `090-generate-payment-report`  
**Created**: 2026-06-15  
**Status**: Draft  
**Input**: User description: "Design and implement the Print/Generate Financial Report functionality on the Payment page."

## User Scenarios & Testing *(mandatory)*

### User Story 1 – Generate Term Financial Report (Priority: P1)

An administrator or bursar navigates to the Payments page, selects an academic term from a dropdown, and clicks **Generate Financial Report**. The system compiles all financial activity for that term—expected fees, payments received, outstanding balances, and adjustments—and produces a professionally formatted downloadable document.

**Why this priority**: This is the core value proposition. Schools operate on term-based cycles, and term-end financial reconciliation is a mandatory administrative task. Without it, staff must manually compile figures from multiple screens.

**Independent Test**: Can be fully tested by selecting any term with associated charges and payments, clicking Generate, and receiving a PDF containing accurate summary figures and a transaction breakdown.

**Acceptance Scenarios**:

1. **Given** the user is on the Payments page and at least one academic term exists, **When** the user selects a term and clicks Generate Financial Report, **Then** a PDF document is produced containing the school name, report title, selected term label, generation timestamp, financial summary, and detailed transaction list.
2. **Given** the selected term has no financial activity (no charges or payments), **When** the user generates the report, **Then** the PDF still renders with all sections present, showing zero totals and an empty transaction table with a descriptive message.

---

### User Story 2 – Generate Monthly Financial Report (Priority: P1)

An administrator or bursar needs a narrower financial snapshot for a specific calendar month (e.g., for board reporting or bank reconciliation). They select a month/year filter and generate the report.

**Why this priority**: Monthly reporting is a common operational need that exists independently of term boundaries. Transport fees and ad-hoc payments often align with calendar months rather than academic terms.

**Independent Test**: Can be fully tested by selecting a specific month with payment activity, generating the report, and verifying that only transactions within that month appear.

**Acceptance Scenarios**:

1. **Given** the user is on the Payments page, **When** the user selects a specific month and year and clicks Generate Financial Report, **Then** the PDF contains only charges and payments whose dates fall within that calendar month, with correct monthly totals.
2. **Given** the user has applied both a term filter and a month filter, **When** the user generates the report, **Then** the system uses the term as the primary period scope and the month as an additional restriction, or shows a clear message if the combination is invalid.

---

### User Story 3 – Filtered Subset Financial Report (Priority: P2)

An administrator wants a report scoped to a specific class, payment method, or student status before generating the PDF, so they can produce focused reports (e.g., "Transport fees collected via EcoCash in Term 2").

**Why this priority**: This extends the core feature with precision filtering. It reduces the need for manual post-processing of broad reports and supports audit and reconciliation workflows.

**Independent Test**: Can be fully tested by applying one or more filters (class, method, category) on the Payments page, generating the report, and confirming the PDF reflects only the filtered subset.

**Acceptance Scenarios**:

1. **Given** the user has selected a class filter (e.g., "Grade 10A") and a term, **When** the user generates the report, **Then** the PDF includes only students currently or historically enrolled in that class, with their respective charges and payments for the selected period.
2. **Given** the user has selected a payment method filter (e.g., "Bank Transfer"), **When** the user generates the report, **Then** the payment breakdown section reflects only payments made via that method, and the summary totals recalculate accordingly.

---

### Edge Cases

- **No active term configured**: The report generation controls should be disabled or show a message indicating that no active term is available to scope the report.
- **Large data volume (10,000+ transactions)**: The system must generate the PDF without timeouts or memory exhaustion, streaming the response as it is produced.
- **Concurrent generation requests**: Multiple users generating reports simultaneously must not corrupt each other's output or leave orphaned temporary files.
- **Voided payments**: Voided payments must be excluded from totals or clearly marked as voided in the transaction breakdown, depending on the report type.
- **General (non-ledger) payments**: Payments marked as general (non-ledger) must be excluded from balance calculations but may be optionally listed in a separate section.
- **Tenant isolation**: A user from one school must never see financial data from another school, even if they manipulate the request parameters.
- **Unauthorized access**: Users without the bursar or admin role must receive an access-denied response when attempting to generate a financial report.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST allow authorized users (admin, bursar) to generate a financial report PDF from the Payments page.
- **FR-002**: The user MUST be able to scope the report by academic term, by calendar month, or by a combination of both.
- **FR-003**: The report MUST include a Financial Summary section displaying: total expected fees, total payments received, total outstanding balance, total discounts/waivers/adjustments, and collection rate (payments received ÷ expected fees).
- **FR-004**: The report MUST include a Payment Method Breakdown section showing the count and total amount per payment method (e.g., Cash, EcoCash, Bank Transfer).
- **FR-005**: The report MUST include a Detailed Transaction section listing every payment record within the selected period, showing: student name, class, payment date, amount, method, category, and receipt number.
- **FR-006**: The report MUST include a Charges Summary section listing expected fee charges within the period, grouped by category (e.g., Tuition, Transport, Levies).
- **FR-007**: The report MUST display the organization's/school's name and branding at the top of every page.
- **FR-008**: The report MUST include proper headers, footers, page numbers, and generation date on every page.
- **FR-009**: The generated PDF MUST be returned directly to the user's browser as a downloadable file; the system MUST NOT require the user to visit a separate URL or manually retrieve the file.
- **FR-010**: The system MUST generate the PDF on the backend and stream it to the frontend; no permanent server-side storage of generated PDFs is permitted.
- **FR-011**: If temporary files are used during generation, the system MUST delete them immediately after the stream is complete, even if the download is interrupted.
- **FR-012**: The report MUST be scoped strictly to the authenticated user's tenant; data from other tenants must never appear.
- **FR-013**: The frontend MUST display a loading indicator while the PDF is being generated, and the Generate button MUST be disabled during generation to prevent duplicate requests.
- **FR-014**: If the generation fails, the user MUST receive a clear error message and the loading indicator must be dismissed.
- **FR-015**: Backend APIs MUST return view-ready data for all feature screens, including any filtering, searching, pagination, sorting, aggregations, and computed values required by the frontend.
- **FR-016**: Frontend behavior MUST be limited to passing user-selected query parameters and rendering backend-prepared responses; it MUST NOT perform client-side data filtering, searching, sorting, pagination, aggregations, or business computations for the report content.
- **FR-017**: Every user action that triggers a data change (create, update, delete, submit, refresh, bulk-operation, status-change) MUST display a visible loading indicator from the moment the request is initiated until the response is fully received and the UI reflects the confirmed server state. Action-triggering controls MUST be disabled during in-flight requests to prevent duplicate submissions.
- **FR-018**: After any mutation completes, all React Query queries whose data was affected MUST be invalidated or updated so the next render reflects the latest server state. Stale cached values MUST NOT flash or re-appear after the mutation response is processed.

### Key Entities *(include if feature involves data)*

- **FinancialReport**: A generated document representing a snapshot of financial activity for a specific period. Attributes: report title, generation date, period label, school name, summary figures, transaction details, page count.
- **ReportPeriod**: The time scope of the report, defined by an academic term, a calendar month/year, or both. Determines which charges and payments are included.
- **PaymentTransaction**: An individual payment received from a student or guardian. Attributes: student identifier, amount, date, method, category, receipt number, void status.
- **StudentCharge**: A fee levied against a student's account. Attributes: student identifier, amount, category, charge type, generation date, due date, status.
- **LedgerAdjustment**: A manual debit or credit adjustment applied to a student balance. Attributes: student identifier, amount, type (debit/credit), reason, approved status.
- **PaymentMethodBreakdown**: An aggregation of payments grouped by method. Attributes: method name, transaction count, total amount.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can select a period and generate a complete financial report PDF in fewer than 5 seconds for a school with up to 5,000 payment records in the selected period.
- **SC-002**: The generated PDF file size must remain under 5 MB for a report covering 5,000 transactions.
- **SC-003**: Report financial totals (expected fees, payments received, outstanding balances) must match the corresponding live dashboard and payments page figures exactly, with zero variance.
- **SC-004**: 100% of generated PDFs must be successfully streamed to the browser and trigger a download prompt without requiring manual file retrieval.
- **SC-005**: Zero temporary PDF files must remain on the server 60 seconds after generation is initiated, verified via automated cleanup checks.
- **SC-006**: Users without the admin or bursar role must receive a 403 response when attempting to trigger report generation, with 100% consistency.
- **SC-007**: The report must render correctly in both print and digital viewing contexts, with readable fonts, proper table borders, and consistent page breaks.

## Assumptions

- Users generating reports have the admin or bursar role; read-only report viewing by teachers or parents is out of scope for this feature.
- The school logo and branding assets are already available on the server and accessible to the backend rendering process.
- Academic terms and calendar months are the only period scoping mechanisms required in the initial release; custom date ranges are out of scope for v1.
- The existing authentication and tenant isolation infrastructure will be reused without modification.
- The existing payments, charges, and ledger adjustment data models already enforce data integrity and will be queried directly for report assembly.
- Mobile PDF generation support is not required; the feature targets desktop browsers where administrators typically work.
- The report language matches the school's configured locale; multi-language report generation is out of scope for v1.
- Voided payments are excluded from summary totals by default but may be listed in an appendix; this behavior aligns with existing dashboard and reconciliation conventions.
