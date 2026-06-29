# Research: Backend Payments Pagination

**Feature**: 073-backend-payments-pagination  
**Date**: 2026-05-13

## Decision 1: Keep payments history behind backend-prepared paginated endpoints

**Decision**: Use backend-prepared payment history responses for the main payments table and student payment history views. Each response must include only the requested rows plus pagination metadata and server-computed summaries.

**Rationale**: The feature requires the frontend to stop loading full payment history for filtering, searching, pagination, sorting, or authoritative metrics. The existing `GET /api/payments/with-students` path already supports part of this pattern and should be strengthened rather than replaced wholesale.

**Alternatives considered**:

- **Continue using client-side processing**: Rejected because it does not scale and produces incomplete search/filter results when only one page is loaded.
- **Create a separate reporting-only module**: Rejected because the payments page and related history features need direct operational table data, not a separate reporting experience.

## Decision 2: Centralize payment query rules in backend model/service logic

**Decision**: Keep filtering, sorting, pagination, count, and summary rules centralized in backend payment query logic, with reusable helpers for applying the same tenant, filter, and classification conditions across row, count, and summary queries.

**Rationale**: Summary values must match the filtered dataset exactly. Duplicated query conditions across methods are a high-risk source of mismatched totals, especially with ledger exclusions, fee campaign payments, general payments, class filters, and student joins.

**Alternatives considered**:

- **Duplicate filtering logic in each controller method**: Rejected because it increases inconsistency risk and makes future payment filters harder to maintain.
- **Let the frontend recompute summaries from visible rows**: Rejected because visible-page summaries do not represent the full filtered dataset.

## Decision 3: Use bounded aggregate queries for payment summaries

**Decision**: Payment summary responses should be computed by bounded aggregate queries that reuse the active payment query filters and avoid per-payment or per-student loops.

**Rationale**: The constitution requires avoiding N+1 patterns and preserving financial ledger integrity. Payment summary cards and related payment history metrics must remain accurate while minimizing database hits.

**Alternatives considered**:

- **Compute totals from returned page rows**: Rejected because summaries must represent the full filtered result set.
- **Cache mutable balances as stored values**: Rejected because the constitution requires balances to be derived from source records.

## Decision 4: Add or verify supporting indexes through new migrations only when needed

**Decision**: During implementation, inspect existing indexes and add missing support through new immutable migrations for common payment access patterns such as tenant/date ordering, tenant/student/date history, tenant/method/date, tenant/category/date, tenant/receipt lookup, payment group lookup, and joins to student/class filters.

**Rationale**: The feature's performance targets require efficient large-dataset access. Any schema change must follow immutable migration rules and should be justified by query shape or measurement.

**Alternatives considered**:

- **No index changes**: Rejected as risky for 50,000+ payment histories if current indexes do not support the required searches and sorts.
- **Editing existing migrations**: Rejected by the constitution.

## Decision 5: Preserve existing API response envelope and frontend state patterns

**Decision**: New or revised endpoints must use the existing success/error response envelope. Frontend consumption should continue through the central API client and server-state query hooks while only doing presentation formatting locally.

**Rationale**: The project constitution requires the REST API boundary and consistent responses. The frontend can still format dates/currency and manage UI state, but it must not decide authoritative record inclusion or summary values.

**Alternatives considered**:

- **Ad-hoc endpoint response shapes**: Rejected because they break frontend consistency and contract testing.
- **Direct frontend access to backend internals**: Rejected by API-first separation of concerns.

## Decision 6: Validate through curl after implementation

**Decision**: Final validation must include curl checks for happy path, invalid filters, unauthenticated access, role/tenant isolation, and large-result pagination behavior.

**Rationale**: The constitution requires endpoint-level tests via curl after implementation. This feature changes backend contracts and authorization-sensitive financial data access.

**Alternatives considered**:

- **Rely only on frontend manual testing**: Rejected because it does not validate the API contract or tenant isolation.
