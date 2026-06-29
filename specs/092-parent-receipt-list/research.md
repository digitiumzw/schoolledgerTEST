# Research: Parent Receipt List

**Feature**: 092-parent-receipt-list
**Date**: 2026-06-25

## R1: Public Endpoint Security Model

**Decision**: The receipt list endpoint will be public (no JWT required), consistent with the existing `GET /api/receipts/:id` endpoint. Student ID is used as the public scope key.

**Rationale**: Parents scan QR codes on physical receipts to view them online. They are not authenticated users and do not have JWT tokens. The existing individual receipt endpoint already follows this public access model. Student IDs in SchoolLedger are globally unique (format: `s{timestamp}_{8hexchars}`), making them non-guessable and safe to use as public scope keys.

**Alternatives considered**:
- Require parent authentication: Rejected — parents are not users in the system; they would need accounts, which doesn't match the QR code use case.
- Use a separate receipt token: Rejected — adds complexity without meaningful security benefit since the student ID is already non-guessable and the data is read-only receipt summaries.
- Use the payment ID as scope: Rejected — the feature requires listing all receipts for a student, not just one. Scoping by student ID is the natural fit.

## R2: Multi-Category Grouping Strategy

**Decision**: Reuse the existing `basePaymentHistoryBuilder` pattern from `PaymentModel`, which uses a correlated subquery to sum amounts for grouped payments and `GROUP_CONCAT` for category labels. Apply `applyPaymentTransactionDisplayCondition` to show only one row per grouped transaction (the MIN(id) row).

**Rationale**: The existing `basePaymentHistoryBuilder` already solves the multi-category grouping problem with correlated subqueries for `amount` and `category`. The `applyPaymentTransactionDisplayCondition` ensures only one row per grouped transaction appears. This is the same pattern used by the authenticated payments history endpoint (`getFilteredWithStudents`), ensuring consistency.

**Alternatives considered**:
- Write a new query from scratch: Rejected — duplicates existing logic, violates DRY.
- Fetch all rows and group in PHP: Rejected — N+1 pattern, inefficient, violates backend-driven data principle.

## R3: Pagination Approach

**Decision**: Use `normalisePaginationParams()` from `BaseApiController` with default limit=20, max limit=100. Return pagination metadata via `buildPaginationMeta()`.

**Rationale**: The existing `normalisePaginationParams()` helper validates page/limit inputs, rejects invalid values with 400 errors, and returns page/limit/offset. This is the standard pagination pattern used across all list endpoints in the application. Default limit of 20 is consistent with the spec's success criteria.

**Alternatives considered**:
- Infinite scroll without pagination metadata: Rejected — violates backend-driven data principle; the spec explicitly requests pagination.
- Custom pagination logic: Rejected — `normalisePaginationParams()` already handles validation and edge cases.

## R4: Frontend Navigation Flow

**Decision**: Add a "View All Receipts" button to `ReceiptPage.tsx` that navigates to `/receipts/student/:studentId`. The new `ReceiptListPage` renders a paginated list. Clicking a receipt entry navigates to `/receipt/:id` (existing `ReceiptPage`). Browser back returns to the list.

**Rationale**: React Router's built-in navigation preserves history, so browser back works naturally. The `ReceiptPage` already has the receipt data loaded, which includes `studentId` — no additional API call is needed to determine the student. The list page uses React Query for data fetching with `keepPreviousData` for smooth pagination transitions.

**Alternatives considered**:
- Modal overlay instead of separate page: Rejected — the spec says "single interface" and "scrollable, paginated list", which is better served by a dedicated page.
- Pass student name via URL params: Rejected — the backend response includes student summary data in the list response, so no additional data passing is needed.

## R5: Student Name Resolution in List Endpoint

**Decision**: The list endpoint will join the `students` table to return the student's name and admission number in a `student` object alongside the receipt list, similar to the existing `ReceiptController::show()` response structure.

**Rationale**: The spec requires the list page header to display the student's name and total receipt count. Including this in the list response avoids an additional API call. The `basePaymentHistoryBuilder` already joins `students` and `classes` tables.

**Alternatives considered**:
- Separate API call for student info: Rejected — unnecessary additional request; the data is available in the same query.
- Omit student name from list response: Rejected — the spec explicitly requires it in the page header.

## R6: Voided Payment Display

**Decision**: Include voided payments in the list with `isVoided: true` flag. The frontend renders them with a "VOIDED" badge and strikethrough styling on the amount, consistent with the individual receipt page's voided treatment.

**Rationale**: The existing `formatForApi()` method already includes `isVoided`, `voidedAt`, `voidReason`, and `voidedBy` fields. The individual receipt page already has visual treatment for voided payments (red "CANCELED / INVALID" banner, strikethrough, opacity). The list view will use a simpler indicator (badge + strikethrough) appropriate for a list entry.

**Alternatives considered**:
- Exclude voided payments: Rejected — the spec explicitly requires including them with visual distinction.
- Separate voided section: Rejected — voided payments should appear in chronological position with a visual flag, not in a separate section.
