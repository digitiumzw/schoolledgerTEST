# Research: Generate Payment Financial Report

**Date**: 2026-06-15  
**Feature**: Generate Payment Financial Report (090-generate-payment-report)

## Decision: PDF Generation Library

**Decision**: Use `dompdf/dompdf` (already installed in the project via composer).

**Rationale**:
- Already present in `backend/vendor/dompdf/` and actively used by `InvoiceService.php` for subscription invoice PDFs.
- No additional dependency or configuration required.
- Supports HTML5/CSS2.1 rendering, DejaVu Sans font for special characters, A4 portrait output.
- Existing `backend/app/Views/invoices/invoice_template.php` demonstrates the project's established Dompdf pattern: load HTML via `view()`, configure `Options`, render, and output bytes.

**Alternatives considered**:
- **TCPDF**: Would require new composer dependency and learning a different API. Rejected because Dompdf is already operational.
- **wkhtmltopdf**: Would require server-side binary installation and subprocess spawning. Rejected because it adds deployment complexity and is unnecessary for tabular financial reports.
- **mpdf**: Would require new dependency. Rejected because Dompdf already meets all requirements.

## Decision: In-Memory vs Temporary File Generation

**Decision**: Generate the PDF entirely in memory and stream directly to the response. Do not write to disk.

**Rationale**:
- Dompdf's `render()` + `output()` returns the PDF bytes as a string; no file I/O is required.
- Eliminates cleanup risk entirely (no temp files to delete).
- The spec explicitly requires "in-memory generation only" and "proper cleanup of any temporary files."
- If the spec later requires very large reports that exceed PHP memory limits, a temp-file approach with `tmpfile()` or `sys_get_temp_dir()` + `unlink()` could be considered, but for the stated scope (5,000 transactions / 5MB), in-memory is safe.

**Alternative rejected**: Writing to `/tmp/` and streaming via `readfile()`. This adds file cleanup responsibility and race-condition risk under concurrent requests.

## Decision: Report Data Aggregation Strategy

**Decision**: Reuse and extend existing backend query patterns rather than building new aggregation logic from scratch.

**Rationale**:
- `PaymentModel::getFilteredWithStudents()` and `PaymentModel::getFilteredSummary()` already provide tenant-scoped, filter-aware payment data with student joins.
- `PaymentModel::getStatsForTenant()` already computes summary statistics (by method, by category, totals).
- `LedgerService` already defines `ELIGIBLE_CHARGE_TYPES`, `ELIGIBLE_PAYMENT_CATEGORIES`, and fee/transport split logic. Report totals MUST use these same filters to achieve zero variance with dashboard figures (SC-003).
- `ReportController::paymentCollection()` and `ReportController::revenueByCategory()` demonstrate term-scoped aggregation patterns that can be extended.

**Implementation approach**:
- `FinancialReportService` will:
  1. Resolve the report period (term date range or calendar month range).
  2. Query charges within the period using existing `ChargeModel` methods or direct SQL with LedgerService eligible filters.
  3. Query payments within the period using existing `PaymentModel` methods with the same filter parameters the frontend already passes.
  4. Query ledger adjustments within the period.
  5. Compute aggregates: total expected fees, total payments, outstanding balance, method breakdown, category breakdown.
  6. Pass the assembled data array to the Dompdf view template.

## Decision: Frontend Download Mechanism

**Decision**: Use an Axios request with `responseType: 'blob'` followed by a programmatic anchor click to trigger the browser download.

**Rationale**:
- This is the standard pattern for file downloads from authenticated API endpoints.
- The existing `api.ts` Axios instance already has auth headers configured; using it preserves JWT authentication.
- A simple `<a href>` link would not send the Authorization header, causing 401.
- The frontend can show a loading state on the Generate button during the Axios request and handle errors gracefully.

**Alternative rejected**: Opening a new browser tab with the PDF URL. This would work for authenticated cookies but SchoolLedger uses JWT Bearer tokens in headers, which are not sent on plain navigation requests.

## Decision: PDF Template Design Approach

**Decision**: Create a new Dompdf HTML view template (`backend/app/Views/reports/financial_report_template.php`) that follows the visual language of the existing `invoice_template.php`.

**Rationale**:
- Consistent branding: same logo handling (base64 data URI from `FCPATH . '1765028860800.jpg'`), same DejaVu Sans font, same color palette (`#111` headings, `#6b7280` muted text).
- Professional layout: structured sections (header with school name/logo, report title, period info, generation date, summary cards, method breakdown table, charges table, detailed transactions table, footer with page numbers).
- The template will use HTML tables for layout stability in Dompdf (float-based layouts are unreliable in Dompdf).

## Decision: Period Resolution Logic

**Decision**: Report period is resolved server-side from the termId or month/year parameters.

**Rationale**:
- The existing `PaymentController::resolveCurrentTermRange()` and `PaymentController::normalisePaymentHistoryQuery()` already contain month/year validation and term calendar resolution.
- The report endpoint will reuse this logic: if `termId` is provided, resolve start/end dates from `tenants.academic_calendar`. If `month`+`year` are provided, use calendar month boundaries. If both are provided, intersect the ranges (term primary, month secondary).
- This keeps the frontend simple: it only passes the user's selection as query parameters.

## Decision: No New Database Indexes

**Decision**: No new indexes are required for the initial implementation.

**Rationale**:
- The existing `payments` table already has indexes on `tenant_id`, `date`, `student_id`, `method`, and `category` (added by prior features).
- The existing `charges` table has indexes on `tenant_id`, `student_id`, `charge_type`, and `term_id`.
- For the stated performance goal (< 5s for 5,000 transactions), existing indexes on tenant_id + date ranges are sufficient. If performance testing reveals query slowness, composite indexes on `(tenant_id, date, voided_at)` or `(tenant_id, term_id, charge_type)` could be added in a follow-up migration.

## Open Questions / None

All technical decisions are resolved. No [NEEDS CLARIFICATION] markers remain.
