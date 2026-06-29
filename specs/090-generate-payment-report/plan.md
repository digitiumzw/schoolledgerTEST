# Implementation Plan: Generate Payment Financial Report

**Branch**: `090-generate-payment-report` | **Date**: 2026-06-15 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/090-generate-payment-report/spec.md`

## Summary

Implement backend PDF generation and frontend download for a **Financial Summary Report** on the Payments page. The user selects a period (academic term, calendar month, or both), optionally applies filters (class, payment method, category), and clicks **Generate Financial Report**. The backend compiles charges, payments, adjustments, and ledger balances into a professionally formatted PDF using Dompdf, streams it directly to the browser for download, and immediately cleans up any temporary files. No generated PDFs are stored permanently on the server. The frontend adds a Generate Report button with loading state, disabled during generation, and error handling.

## Technical Context

**Language/Version**: PHP 8.1+ / CodeIgniter 4 / MySQL  
**Primary Dependencies**: dompdf/dompdf (already installed via composer), React 18 / TypeScript / Vite / TanStack Query  
**Storage**: MySQL (existing charges, payments, ledger_adjustments, students, classes, tenants tables). PDFs are generated in-memory; no new tables or schema changes required.  
**Testing**: curl endpoint tests (Principle X); PHP lint; TypeScript `tsc --noEmit`; targeted ESLint  
**Target Platform**: Linux server / modern desktop browsers  
**Project Type**: Web application (backend + frontend SPA)  
**Performance Goals**: PDF generation < 5s for 5,000 transactions in selected period  
**Constraints**: No permanent file storage; max PDF size 5MB at 5,000 transactions; tenant isolation enforced at DB query level  
**Scale/Scope**: Single tenant school with up to ~10,000 students and associated payment records

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Multi-Tenant Data Isolation | PASS | All report queries MUST filter by `tenant_id` from JWT. No tenant_id in request body. |
| II. API-First Separation of Concerns | PASS | PDF generation is a backend endpoint; frontend only initiates download via API. |
| III. JWT Authentication & Role-Based Access | PASS | Route protected by JWTAuthFilter; controller enforces `bursar`/`admin`/`super_admin` role check. |
| IV. Immutable Migrations | PASS | No schema changes required; report is derived from existing tables. |
| V. Financial Ledger Integrity | PASS | Report totals MUST use LedgerService eligible charge/payment filters and subquery pattern, matching existing dashboard computations exactly. |
| VI. REST API Standards & Consistent Responses | N/A* | PDF endpoint returns binary `application/pdf` stream, not JSON envelope. This is a justified exception because the entire purpose of the endpoint is file delivery; a JSON wrapper would break browser download behavior. Error paths (validation, auth) still return JSON envelopes via respondError. |
| VII. Code Quality & Maintainability | PASS | FinancialReportService will be a single-responsibility service; PDF view template will reuse existing invoice_template CSS patterns. |
| VIII. Defensive Security | PASS | All input parameters (termId, month, year, classId, method, category) validated and sanitized. |
| IX. Error Handling & Observability | PASS | Generation errors logged; user receives toast error in frontend. |
| X. API Endpoint Testing (curl) | PASS | curl tests will cover happy path (PDF download), unauthorized access (403), invalid period (400), tenant isolation. |
| XI. Backend-Driven Data & Performance Discipline | PASS | All report data aggregation (charges, payments, adjustments, balances, method breakdowns) computed in backend SQL queries. Frontend passes only filter parameters. |
| XII. Mutation Loading States & Stale-Data Prevention | PASS | Generate button shows loading spinner and is disabled during generation. No React Query cache invalidation needed since PDF generation is a read-only, non-mutating operation. |
| XIII. Email Design System Consistency | N/A | This feature does not involve email communications. |

*Exception for Principle VI documented in Complexity Tracking below.

## Project Structure

### Documentation (this feature)

```text
specs/090-generate-payment-report/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── Controllers/
│   │   └── Api/
│   │       ├── PaymentController.php        # Add generateReportPdf() method
│   │       └── BaseApiController.php        # Existing response helpers
│   ├── Services/
│   │   ├── FinancialReportService.php       # NEW: report data assembly + PDF generation
│   │   └── LedgerService.php                # Existing: eligible charge/payment filters
│   ├── Models/
│   │   ├── PaymentModel.php                 # Existing: getFilteredWithStudents, getStatsForTenant
│   │   └── ChargeModel.php                  # Existing: term-scoped charge queries
│   ├── Config/
│   │   └── Routes.php                       # Add GET /api/payments/report/pdf route
│   └── Views/
│       └── reports/
│           └── financial_report_template.php  # NEW: Dompdf HTML template
└── public/
    └── 1765028860800.jpg                    # Existing school logo asset

frontend/
├── src/
│   ├── api/
│   │   └── api.ts                           # Add downloadFinancialReport() method
│   ├── pages/
│   │   └── Payments.tsx                     # Add Generate Report button + loading state
│   ├── types/
│   │   └── dashboard.ts                     # Add FinancialReportFilterParams type
│   └── components/
│       └── modals/
│           └── GenerateReportModal.tsx        # NEW: period/filter selection modal
```

**Structure Decision**: The backend follows the existing Service -> Controller -> View pattern. FinancialReportService encapsulates all report data assembly and PDF generation, keeping the controller thin. The frontend change is minimal: a button that triggers a direct file download via an Axios request with `responseType: 'blob'`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Principle VI exception -- PDF endpoint returns binary stream instead of JSON envelope | Browser `Content-Disposition: attachment` download requires raw PDF bytes in the response body. Wrapping PDF bytes in JSON would require frontend to manually decode base64 and trigger download via Blob/anchor, which adds complexity and breaks the "frontend only initiates, backend delivers" requirement. The existing invoice PDF endpoint (`/finance/invoices/{id}/pdf`) uses the same pattern. |

---

## Post-Design Constitution Check Re-evaluation

*Completed after Phase 1 design artifacts (data-model.md, contracts, quickstart.md).*

| Principle | Status | Post-Design Verification |
|-----------|--------|--------------------------|
| I. Multi-Tenant Data Isolation | PASS | Contract specifies `tenant_id` from JWT in ALL queries. No tenant_id in request body. |
| II. API-First Separation of Concerns | PASS | Frontend only passes filters; all report data assembly and PDF generation is backend-only. |
| III. JWT Authentication & Role-Based Access | PASS | Contract specifies JWT Bearer + `bursar`/`admin`/`super_admin` role enforcement. |
| IV. Immutable Migrations | PASS | data-model.md confirms zero schema changes required. |
| V. Financial Ledger Integrity | PASS | FinancialReportService will use LedgerService eligible filters; report totals must match dashboard exactly. |
| VI. REST API Standards | JUSTIFIED | Binary PDF stream exception is justified and mirrors existing `/finance/invoices/{id}/pdf` pattern. Error paths use JSON envelopes. |
| VII. Code Quality | PASS | Single-responsibility FinancialReportService; reusable Dompdf view template. |
| VIII. Defensive Security | PASS | All input parameters validated in contract; SQL injection prevented via parameterized queries in service layer. |
| IX. Error Handling | PASS | Contract documents all error statuses and messages. |
| X. API Endpoint Testing | PASS | quickstart.md defines 14 curl test cases covering happy path, errors, auth, tenant isolation, performance. |
| XI. Backend-Driven Data & Performance | PASS | All aggregations computed in backend SQL; no client-side computation. |
| XII. Mutation Loading States | PASS | Generate button loading state documented in contract and quickstart. No cache invalidation needed (read-only operation). |
| XIII. Email Design System | N/A | Not applicable to this feature. |

**Gate Result**: ALL principles pass or have justified exceptions. Proceed to `/speckit.tasks`.
