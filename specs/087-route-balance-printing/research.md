# Research: Route Balance and Printable Student List

**Feature**: 087-route-balance-printing  
**Date**: 2026-06-09

## Decision: Balance Computation Strategy

**Decision**: Use a new `LedgerService::getBalancesForStudentIds(array $studentIds, string $tenantId)` method that reuses the exact same SQL subquery pattern as `getAllBalances()`, but adds a `WHERE s.id IN (...)` filter scoped to the student IDs already fetched for the route.

**Rationale**:
- `getAllBalances()` already implements the constitution-compliant bulk subquery pattern (Principle V).
- Reusing the same subqueries ensures balance calculation consistency with the rest of the application.
- A targeted method avoids fetching balances for all students in the tenant when only route-assigned students are needed.
- No N+1 queries: one SQL query for all route students regardless of count.

**Alternatives considered**:
- Call `getStudentBalance()` in a loop inside `getRoute()`: Rejected — N+1 violation of Principle V.
- Call `getAllBalances()` and filter client-side: Rejected — violates Principle XI (unnecessary payload); also fetches all tenant students when only route students needed.
- Add a new dedicated endpoint `GET /transport/routes/:id/balances`: Rejected — adds endpoint surface area when the existing `getRoute()` can be enriched in-place; frontend already calls this endpoint.

## Decision: Print Implementation

**Decision**: Browser-native `window.print()` with a dedicated `@media print` CSS block that hides non-report UI and formats the student table for A4 paper.

**Rationale**:
- The spec explicitly requests browser print (no PDF generation).
- React-based print libraries (e.g., `react-to-print`) add dependencies and complexity for a simple list.
- A print-media CSS approach is zero-dependency and works across all browsers.
- The print content can be rendered inline in the same page component using a conditional print-only wrapper.

**Alternatives considered**:
- `react-to-print` library: Rejected — adds a dependency for trivial functionality; CSS `@media print` is sufficient.
- PDF generation via backend (e.g., `dompdf`): Rejected — spec explicitly requests browser print; adds significant backend complexity.
- Separate printable page route: Rejected — adds routing complexity; inline print content with CSS hiding is simpler.

## Decision: No Schema Changes

**Decision**: No database migrations. All data required (students, allocations, stops, charges, payments, adjustments) already exists in existing tables.

**Rationale**:
- Balances are computed at query time per Principle V.
- Stop and allocation data is already joined in `getRoute()`.
- The feature is purely a presentation-layer enrichment.

## Decision: No New API Routes

**Decision**: Enrich the existing `GET /transport/routes/:id` response in-place rather than adding a new endpoint.

**Rationale**:
- The frontend already calls this endpoint to render the route detail page.
- Adding new fields to an existing response is additive and backward-compatible.
- No frontend routing or API layer changes needed.
- The existing `TransportRoute` type can be extended with optional fields.

## Open Questions Resolved

| Question | Resolution | Source |
|----------|-----------|--------|
| Which balance field to display? | `totalBalance` from `LedgerService.getStudentBalance()` | Clarification session 2026-06-09 |
| Print format details? | Browser print with CSS `@media print` | Spec assumptions |
| Mobile print support? | Out of scope for v1 | Spec assumptions |
