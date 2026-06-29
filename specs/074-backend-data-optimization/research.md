# Research: Backend Data Optimization

**Feature**: 074-backend-data-optimization  
**Date**: 2026-05-14

## Decision 1: Standardize on backend-prepared paginated view responses

**Decision**: Use a shared response shape for in-scope lists and reports: `data` or domain rows, `pagination`, `filters`, `sort`, and `summary` where applicable.

**Rationale**: The feature goal is not only to move paging to the backend, but to prevent frontend reimplementation of filtering, sorting, slicing, and business calculations. A consistent response shape lets the frontend render directly and makes curl validation predictable.

**Alternatives considered**:

- Keep each endpoint's current ad-hoc shape: rejected because it makes frontend cleanup and validation inconsistent.
- Return only rows and make the frontend calculate totals: rejected by the feature requirements.

## Decision 2: Extend existing endpoints where contracts are already established

**Decision**: Preserve current resource paths where backend pagination already exists, especially `/api/students-optimized`, `/api/staff-attendance`, `/api/staff-attendance/report`, `/api/staff-attendance/departments`, `/api/class-attendance`, and `/api/payments/student/{studentId}`. Add parameters/metadata to those contracts as needed instead of creating duplicate endpoint families.

**Rationale**: Existing frontend code and prior features already consume these routes. Extending them minimizes migration risk while still meeting the backend-prepared requirement.

**Alternatives considered**:

- Create a new `/api/views/*` namespace: rejected because it duplicates existing API surface and increases maintenance.
- Replace all endpoints at once: rejected as higher-risk and unnecessary for user-visible behavior preservation.

## Decision 3: Add or harden backend-prepared class directory and roster endpoints

**Decision**: Convert Classes page behavior to backend-driven responses for active/archived tabs, search, pagination, and summary metrics. Class rosters must also return backend-paginated student rows with pagination and summary metadata.

**Rationale**: Current `Classes.tsx` loads active and archived classes, merges/deduplicates them, filters by search, and calculates stats in the browser. This directly violates the feature goal and is a clear target for backend preparation.

**Alternatives considered**:

- Keep class lists small and client-side: rejected because the feature explicitly includes Classes page and scalability.
- Only add search to existing class list: rejected because stats and active/archive slicing would still be client-derived.

## Decision 4: Keep authoritative financial and attendance computations in domain services/models

**Decision**: Use existing ledger, student, attendance, and class-attendance service/model patterns for computations. Financial values must continue using source records and eligible payment/charge rules. Attendance summaries must continue using effective attendance records, leave-aware working-day rules, and correction/supersession rules.

**Rationale**: Constitution Principle V requires ledger balances to be derived from source records and bulk-optimized. Existing prior features already introduced specialized services for student identity, ledger calculations, staff attendance reports, and class attendance effective registers.

**Alternatives considered**:

- Store computed balances/rates as mutable columns: rejected by ledger integrity and consistency requirements.
- Compute in frontend hooks after fetching raw rows: rejected by the feature requirements.

## Decision 5: Use bounded page sizes and explicit validation for all in-scope filters

**Decision**: All list/report endpoints must validate page, limit, sort fields, sort order, date ranges, status values, and domain filters. Limits should be bounded; invalid values return a consistent API error.

**Rationale**: Backend-driven filtering increases server responsibility. Bounded and validated inputs protect performance, prevent accidental full-table responses, and satisfy defensive security.

**Alternatives considered**:

- Silently coerce every invalid value: rejected because it hides caller bugs and makes validation harder.
- Allow unlimited exports through list endpoints: rejected; exports should be separate explicit workflows if needed.

## Decision 6: Optimize using measurement-backed indexes and batched aggregation

**Decision**: Add new migrations only for missing indexes proven useful for the target queries. Prefer joined or aggregated queries, subqueries, and batch lookups over per-row loops. Cache slow-changing lookup lists such as class metadata where safe and invalidate/refresh after mutations.

**Rationale**: The feature requires minimizing database hits but the constitution warns against speculative performance work. Planning should identify likely index candidates, while implementation must confirm via query shape/timing evidence.

**Alternatives considered**:

- Add broad indexes to every filtered column: rejected as speculative and potentially harmful to writes.
- Cache all summaries: rejected for ledger and attendance correctness; source-derived values must remain authoritative.

## Decision 7: Treat frontend date preset resolution as UI state, not business computation

**Decision**: Frontend may translate a user-selected date preset into explicit request parameters, but it must not compute authoritative attendance totals, rates, statuses, filtered rows, or summary metrics.

**Rationale**: Date preset selection is presentation/input convenience. The backend remains responsible for applying the range and computing results.

**Alternatives considered**:

- Move all date preset expansion to backend: optional but not required for correctness; can be added if contract consistency benefits outweigh UI complexity.
- Allow frontend to derive attendance summaries from returned records: rejected.

## Decision 8: Validation strategy is curl-first after implementation

**Decision**: Quickstart validation will require curl requests after implementation for each primary endpoint category: student, classes, class roster, staff attendance records, staff attendance reports, class attendance register/summary, payment history, invalid input, unauthorized access, and tenant isolation.

**Rationale**: Constitution Principle X mandates curl URL request testing after implementation. The feature is API-bound, so endpoint validation is the most direct proof.

**Alternatives considered**:

- Rely only on TypeScript and PHP lint: rejected because they do not validate API behavior or database scoping.
- Internal integration tests only: rejected by the constitution's curl endpoint testing requirement.
