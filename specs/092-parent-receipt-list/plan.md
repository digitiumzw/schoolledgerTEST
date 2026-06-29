# Implementation Plan: Parent Receipt List

**Branch**: `092-parent-receipt-list` | **Date**: 2026-06-25 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/092-parent-receipt-list/spec.md`

## Summary

Add a "View All Receipts" button to the existing public individual receipt page (`/receipt/:id`). When clicked, navigate to a new public receipt list page (`/receipts/student/:studentId`) that displays all payment receipts for that student in a paginated, scrollable list sorted by payment date descending. A new public backend endpoint `GET /api/receipts/student/:studentId` returns backend-prepared, paginated receipt summaries with multi-category grouping and voided status flags. The frontend renders the list using the existing application design system (TailwindCSS, shadcn/ui, card-based layout).

## Technical Context

**Language/Version**: PHP 8.1+ (backend), TypeScript / React 18 (frontend)
**Primary Dependencies**: CodeIgniter 4, MySQL (backend); Vite, TanStack React Query, TailwindCSS, shadcn/ui (frontend)
**Storage**: MySQL — existing `payments` table, `students` table, `classes` table
**Testing**: curl-based endpoint tests (Constitution Principle X)
**Target Platform**: Web (mobile-responsive public pages)
**Project Type**: Web application (CodeIgniter 4 REST API + React SPA)
**Performance Goals**: First page loads in under 2 seconds for students with up to 500 payment records
**Constraints**: Public endpoint (no JWT) — must not leak cross-student or cross-tenant data; student ID is globally unique (random hex suffix) and serves as the public scope key
**Scale/Scope**: 1 new backend endpoint, 1 new backend model method, 1 modified backend controller, 1 new frontend page, 1 modified frontend page, 1 new frontend API method, 1 new frontend hook

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Check

1. **Principle I (Multi-Tenant Isolation)**: The new public endpoint does NOT use JWT-sourced `tenant_id`. Instead, it resolves `tenant_id` from the student record identified by the globally-unique `student_id` path parameter. All queries are scoped by both `student_id` AND the resolved `tenant_id`. No cross-tenant data leakage is possible because: (a) student IDs contain random hex suffixes making them non-guessable, (b) all queries filter by `tenant_id` resolved from the student record, (c) only payment records matching both `student_id` and `tenant_id` are returned. **PASS** — justified exception to JWT-sourced tenant_id, documented in Complexity Tracking.

2. **Principle II (API-First Separation)**: Frontend communicates only through the REST API. No direct database access. **PASS**.

3. **Principle III (JWT Authentication)**: The new endpoint is intentionally public (no JWT required), consistent with the existing `GET /api/receipts/:id` endpoint. Parents scan QR codes without logging in. Route is registered outside the `JWTAuthFilter` group, same as the existing receipts route. **PASS** — justified exception, documented in Complexity Tracking.

4. **Principle IV (Immutable Migrations)**: No schema changes required. The feature reuses existing `payments`, `students`, and `classes` tables. **PASS**.

5. **Principle V (Financial Ledger Integrity)**: The feature is read-only. No balance computation or mutation is involved. Receipt summaries display snapshotted amounts, not recomputed balances. **PASS**.

6. **Principle VI (REST API Standards)**: New endpoint follows REST conventions: `GET /api/receipts/student/:studentId` — plural noun, GET verb, kebab-case. Uses `BaseApiController::success()` response envelope. **PASS**.

7. **Principle VII (Code Quality)**: New model method reuses existing `basePaymentHistoryBuilder` pattern. New controller method is thin and delegates to model. Frontend hook encapsulates data fetching. **PASS**.

8. **Principle VIII (Defensive Security)**: Student ID is validated as non-empty. Pagination params validated via `normalisePaginationParams()`. Parameterized queries used exclusively (Query Builder). No raw SQL injection vectors. **PASS**.

9. **Principle IX (Error Handling)**: 404 for invalid/missing student. 400 for invalid pagination params. Consistent error envelope via `BaseApiController::error()`. **PASS**.

10. **Principle X (API Endpoint Testing)**: curl tests will cover happy path (list with multiple receipts), pagination (page 2), single receipt student, invalid student ID (404), invalid pagination params (400), and voided payment inclusion. **PASS**.

11. **Principle XI (Backend-Driven Data & Performance)**: All pagination, sorting, grouping, and metadata computed backend-side. Frontend only passes `page` and `limit` query params and renders the response. The query reuses the existing `basePaymentHistoryBuilder` with its correlated subquery for multi-category grouping and `applyPaymentTransactionDisplayCondition` for deduplication. Existing index `idx_payments_tenant_student` (or equivalent) covers the student+tenant scan. **PASS**.

12. **Principle XII (Mutation Loading States)**: This feature is read-only (no mutations). Navigation between pages uses standard React Query loading states with skeleton placeholders. **PASS** — N/A for mutations, but loading states are implemented for data fetching.

13. **Principle XIII (Email Design System)**: No email communications involved. **PASS** — N/A.

## Project Structure

### Documentation (this feature)

```text
specs/092-parent-receipt-list/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── receipt-list-api.md
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── Controllers/Api/
│   │   └── ReceiptController.php       # MODIFIED — add listByStudent() method
│   ├── Models/
│   │   └── PaymentModel.php            # MODIFIED — add getReceiptListForStudent() method
│   └── Config/
│       └── Routes.php                  # MODIFIED — add GET /receipts/student/(:segment)

frontend/
├── src/
│   ├── api/
│   │   └── api.ts                      # MODIFIED — add getReceiptList() method
│   ├── pages/
│   │   ├── ReceiptPage.tsx             # MODIFIED — add "View All Receipts" button
│   │   └── ReceiptListPage.tsx         # NEW — paginated receipt list page
│   ├── hooks/
│   │   └── useReceiptList.ts           # NEW — React Query hook for receipt list
│   └── App.tsx                         # MODIFIED — add /receipts/student/:studentId route
```

**Structure Decision**: Web application structure (Option 2). Backend changes are minimal — one new method in `ReceiptController` and `PaymentModel`, plus one new route. Frontend changes follow existing patterns: new page component, new hook, API method addition, and route registration.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Principle I: tenant_id not JWT-sourced | Public endpoint has no JWT; tenant_id is resolved from the student record identified by the globally-unique student_id path parameter | Requiring JWT would break the QR-code scanning use case — parents are not authenticated users |
| Principle III: public route (no JWT) | Parents/guardians scan QR codes to view receipts without logging in; the receipt list must be accessible from the individual receipt page without authentication | Requiring authentication would prevent parents from accessing the receipt list entirely |
