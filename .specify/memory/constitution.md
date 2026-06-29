<!--
SYNC IMPACT REPORT
==================
Version change: 1.3.0 → 1.4.0
Modified principles: None
Added sections:
  - Principle XIII: Email Design System Consistency — new principle requiring
    all email templates and views to use the same design system, layout, spacing,
    typography, styling, colors, and overall visual structure; mandates reuse of
    existing email view components and extension of base email template system.
Removed sections: None
Templates requiring updates:
  - .specify/templates/plan-template.md — Updated Constitution Check guidance
    to include email design system consistency ✅
  - .specify/templates/spec-template.md — Updated requirements guidance to
    include email design system requirements ✅
  - .specify/templates/tasks-template.md — Updated task guidance for email
    design system work ✅
  - CLAUDE.md — Updated runtime architecture guidance for email design ✅
Follow-up TODOs: None
-->

# SchoolLedger Constitution

## Core Principles

### I. Multi-Tenant Data Isolation (NON-NEGOTIABLE)

Every database query that touches tenant-owned data MUST be filtered by `tenant_id`. The
`tenant_id` MUST be sourced exclusively from the decoded JWT payload — never from request
body or query parameters. No endpoint MAY return records belonging to a different tenant.
Violations constitute a critical security defect and MUST block any merge.

**Rationale**: SchoolLedger is a multi-tenant SaaS product. Cross-tenant data leakage is a
privacy breach and a regulatory risk. The JWT-sourced `tenant_id` is the only trustworthy
isolation boundary because it is signed server-side and cannot be forged by a client.

### II. API-First Separation of Concerns

The frontend (React SPA) MUST communicate with the backend exclusively through the REST API
at `/api`. The frontend MUST NOT access the database directly or embed backend business logic.
The frontend MUST only consume, bind, and display data structures already prepared by backend
APIs. The backend MUST NOT serve frontend assets or embed presentation logic. The API surface is
the only contractual boundary between the two layers.

**Rationale**: Maintaining a clean API boundary enables independent evolution of frontend and
backend, makes contracts auditable, and ensures mobile or third-party clients can consume the
same backend without changes.

### III. JWT Authentication & Role-Based Access

Every API route under `/api/*` (except `/auth/login` and `/auth/register`) MUST pass through
`JWTAuthFilter`. The decoded payload MUST supply `tenant_id` and `role` for all downstream
authorization decisions. Backend controllers MUST enforce role checks; the frontend `<ProtectedRoute>`
enforces the same roles for UI access but MUST NOT be the sole enforcement layer. Roles are:
`super_admin`, `admin`, `teacher`, `bursar`.

**Rationale**: Defense-in-depth requires enforcement at the API layer regardless of what the
frontend renders. A compromised or bypassed frontend MUST NOT grant unauthorized data access.

### IV. Immutable Migrations

Schema changes MUST be implemented as new migration files in `app/Database/Migrations/`. Existing
migration files MUST NOT be edited after they have been applied to any environment. Every schema
change MUST be reversible via a corresponding `down()` method unless the change is provably
irreversible (e.g., a destructive drop) — in which case the irreversibility MUST be documented
in the migration's class docblock.

**Rationale**: Migration immutability ensures reproducible database state across all environments
(local, staging, production). Editing applied migrations breaks the migration history and can cause
silent divergence between environments.

### V. Financial Ledger Integrity

The balance for any student MUST be computed as `SUM(charges) - SUM(payments)` and MUST be
derived at query time — never cached as a mutable stored column. The `getAllBalances()` bulk
optimization pattern (single subquery rather than N per-student queries) MUST be preserved in all
ledger-touching code. New ledger queries MUST follow the same subquery pattern to avoid N+1
performance regressions.

**Rationale**: A denormalized or mutable balance column is a source of truth conflict; recomputing
from source records ensures correctness after any correction or reversal. The subquery optimization
exists to prevent performance degradation at scale.

### VI. REST API Standards & Consistent Responses

All API endpoints MUST follow REST naming conventions: plural nouns for resource collections
(e.g., `/api/students`, `/api/payments`), HTTP verbs for actions (`GET` to read, `POST` to
create, `PUT`/`PATCH` to update, `DELETE` to remove). Endpoint paths MUST use lowercase
kebab-case (e.g., `/api/fee-structures`).

Every successful API response MUST use a consistent JSON envelope:

```json
{ "status": "success", "data": { ... }, "message": "..." }
```

Every error response MUST use a matching envelope:

```json
{ "status": "error", "message": "...", "errors": { ... } }
```

All controllers MUST use `BaseApiController::respondSuccess` and
`BaseApiController::respondError` helpers to enforce this format. No controller MAY
construct ad-hoc response structures.

**Rationale**: A predictable response shape simplifies frontend parsing, reduces
integration bugs, and makes API contract testing straightforward. REST naming conventions
ensure the API surface is intuitive and self-documenting.

### VII. Code Quality & Maintainability

- Code MUST be clean, readable, and self-explanatory.
- Variable and function names MUST be clear and descriptive.
- Code duplication MUST be eliminated; follow the DRY principle.
- Functions MUST be small and focused on a single responsibility.
- Composition MUST be preferred over inheritance.
- Dead or unused code MUST be removed immediately upon discovery.
- Each file MUST have one clear, well-defined purpose.

**Rationale**: Maintainable code reduces onboarding friction, minimizes defect density,
and keeps velocity sustainable over time. Small, focused units are easier to test, review,
and refactor.

### VIII. Defensive Security

- User input MUST never be trusted. All inputs MUST be sanitized and validated before use.
- Passwords MUST never be stored in plain text; use a strong hashing algorithm
  (e.g., `password_hash` with `PASSWORD_BCRYPT`).
- Secrets (API keys, DB credentials, JWT keys) MUST be managed via environment variables
  and MUST NOT appear in version-controlled files.
- The application MUST protect against common vulnerabilities: XSS (escape output), CSRF
  (token verification on state-changing requests), and SQL injection (parameterized queries
  or ORM-bound methods exclusively).

**Rationale**: Security flaws in a multi-tenant SaaS product handling student and financial
data carry severe regulatory and reputational risk. Defense at the input boundary is the most
cost-effective mitigation layer.

### IX. Error Handling & Observability

- All errors MUST be handled explicitly; silent failures are prohibited.
- Internal error details (stack traces, file paths, SQL statements) MUST NOT be exposed to
  API consumers. Return a generic user-facing message and an appropriate HTTP status code.
- Errors MUST be logged with sufficient context for debugging: timestamp, request ID (if
  available), error class, message, and relevant entity identifiers.
- The error response format defined in Principle VI MUST be used for every error path.

**Rationale**: Explicit error handling prevents undefined behavior. Separating user-facing
messages from internal logs protects sensitive information while still enabling efficient
debugging and incident response.

### X. API Endpoint Testing (via curl)

Every feature MUST include endpoint-level tests executed via curl to verify end-to-end behavior across the backend stack (controller → service → database). Tests MUST be run AFTER the feature is fully implemented, not before or during development.

These tests MUST cover:

- The happy path for each new endpoint or business operation.
- At least one error/edge-case path (e.g., invalid input, unauthorized access, missing resource).
- Multi-tenant isolation where tenant-scoped data is involved.

Each test MUST:

- Issue HTTP requests using curl URL requests exclusively (no internal test frameworks, no direct model/service calls).
- Assert expected HTTP status codes.
- Validate key parts of the response body (e.g., using jq or similar tools where applicable).

**Rationale**: Direct HTTP-level testing via curl ensures that the system behaves correctly from an external consumer's perspective, validating routing, middleware, authentication, and full request/response handling without relying on internal test frameworks. Running tests only after implementation prevents false positives from incomplete code and ensures the final implementation is fully validated.

### XI. Backend-Driven Data & Performance Discipline

All data loading, filtering, searching, pagination, sorting, aggregations, and business
computations MUST be handled by backend APIs. The frontend MUST NOT perform client-side
filtering, searching, sorting, pagination, aggregate calculations, ledger/statistical
computations, or data reshaping beyond trivial presentation formatting such as labels,
dates, currency display, and conditional rendering.

Backend APIs MUST return only the exact records, fields, metadata, and summaries required by
the frontend view. Endpoints serving lists, reports, dashboards, histories, or analytics MUST
provide server-side pagination and explicit metadata such as page, limit, total, applied filters,
sort order, and precomputed summaries where applicable.

Database access MUST be optimized for scale:

- Queries MUST use appropriate indexes for tenant filters, joins, search fields, sort fields,
  and date/status filters introduced by the feature.
- N+1 query patterns are prohibited; use joins, subqueries, batch loading, eager loading, or
  pre-aggregation as appropriate.
- Repeated or expensive computations MUST be cached, snapshotted, or pre-aggregated when the
  data freshness requirements allow it.
- Bulk operations MUST be preferred over loops of individual database reads or writes.
- API response structures MUST minimize payload size and avoid returning records that the
  frontend will discard.

Performance work MUST be supported by query reasoning, profiling, explain-plan evidence,
payload-size review, or curl timing evidence for high-volume endpoints. Frontend performance
optimizations such as memoization MAY be used for rendering efficiency, but they MUST NOT replace
backend responsibility for data preparation.

**Rationale**: SchoolLedger handles tenant-scoped financial, attendance, academic, and reporting
data that can grow substantially. Keeping data processing on the backend enables database-level
optimization, stable API contracts, smaller payloads, predictable response times, and thin
frontend components that render authoritative server-prepared results.

### XII. Mutation Loading States & Stale-Data Prevention

Every user action that triggers a data change — including create, update, delete, submit,
refresh, bulk-operation, and status-change requests — MUST display a visible loading indicator
(spinner, skeleton, or disabled-with-loader state) from the moment the request is initiated
until the response is fully received and the UI reflects the confirmed server state.

During an in-flight mutation:

- Affected components MUST show a loading state; they MUST NOT continue to display the
  previous data as if it were current.
- Action-triggering controls (buttons, forms, menus) MUST be disabled or show a loading
  variant to prevent duplicate submissions.
- Stale cached values MUST NOT flash or re-appear after the mutation response is processed.

After a mutation completes:

- All React Query queries whose data was affected MUST be invalidated or updated so that the
  next render reflects the latest server state. Use `queryClient.invalidateQueries` or
  `queryClient.setQueryData` as appropriate — never rely on stale cache to represent
  post-mutation state.
- Optimistic updates MAY be used to improve perceived performance, but MUST be rolled back
  to the confirmed server value on error; they MUST NOT persist unconfirmed state beyond
  the mutation lifecycle.
- Loading and success/error transitions MUST be smooth and visually consistent across the
  application; abrupt or invisible state changes that leave the user uncertain whether an
  action completed are prohibited.

Every custom hook that wraps a mutation MUST expose `isPending` (or equivalent) so that
calling components can wire it directly to loading UI without re-implementing tracking logic.

**Rationale**: Users performing financial, attendance, and student-management operations need
immediate, trustworthy feedback that their action was received and applied. Showing stale data
or allowing duplicate submissions erodes trust in a system that manages sensitive records.
Consistent loading states reduce uncertainty, prevent data corruption from duplicate writes,
and ensure every component reflects authoritative server state after each operation.

### XIII. Email Design System Consistency

All email templates and views MUST use the same design system, layout, spacing, typography, styling,
colors, and overall visual structure to maintain consistency across all application emails. Every
email MUST follow the established email design patterns including header layout, footer structure,
brand colors, typography hierarchy, button styling, and responsive behavior.

Email templates MUST reuse existing email view components, CSS classes, and layout structures rather
than creating new styling patterns. New email types MUST reference and extend the base email
template system rather than implementing independent layouts.

**Rationale**: Consistent email appearance reinforces brand identity, improves user recognition,
and reduces maintenance overhead. A unified design system ensures all communications from
SchoolLedger present a professional, cohesive experience regardless of the specific email type
or purpose.

## Technology Stack & Conventions

**Backend**: PHP 8.1+ · CodeIgniter 4 · MySQL
- All controllers extend `BaseApiController` and use its `respondSuccess` / `respondError` helpers.
- All routes are declared in `app/Config/Routes.php`; no route registration elsewhere.
- CORS and JWT middleware are registered in `app/Config/Filters.php` — global filters for `/api/*`.
- JWT configuration lives in `app/Config/Jwt.php`; the secret MUST reside in `.env` as
  `JWT_SECRET_KEY` and MUST NOT be committed to version control.

**Frontend**: React 18 · TypeScript · Vite · TailwindCSS · shadcn/ui
- All API calls MUST go through the Axios instance in `src/api/api.ts`; no ad-hoc fetch calls.
- Server state MUST use TanStack React Query exclusively; local UI state uses `useState`.
- Forms MUST use React Hook Form + Zod for validation.
- Complex business logic MUST be extracted to custom hooks in `src/hooks/` rather than kept
  inline in page components.
- Frontend code MUST NOT filter, search, sort, paginate, aggregate, or compute business data
  client-side. It may only pass user-selected query parameters to backend APIs and render the
  backend-prepared response.

**Environment**: Secrets and environment-specific values MUST live in `.env` files (not committed).
Frontend API base URL is configured in `src/api/api.ts`.

## Development Workflow

- **Branching**: Feature work MUST be done on a dedicated branch named `###-feature-name`.
- **Schema changes**: Create a new migration file; run `php spark migrate` to apply; never edit
  existing migrations.
- **Consistency gate**: Before merging any PR, verify:
  1. All new queries include `tenant_id` filtering (Principle I).
  2. No business logic has been added to the frontend layer (Principle II).
  3. New routes are protected by `JWTAuthFilter` unless intentionally public (Principle III).
  4. Any schema change is a new migration, not an edit (Principle IV).
  5. Ledger balance is computed from source records; bulk queries use the subquery pattern
     (Principle V).
  6. All endpoints follow REST naming conventions and use the consistent JSON response
     envelope via `respondSuccess` / `respondError` (Principle VI).
  7. No code duplication, dead code, or oversized functions introduced (Principle VII).
  8. All user inputs are validated and sanitized; no secrets in source (Principle VIII).
  9. All errors are handled explicitly; no internal details leak to API consumers
     (Principle IX).
  10. Integration tests are run AFTER feature implementation via curl URL requests only;
      tests cover happy path, error path, and tenant isolation (Principle X).
  11. All loading, filtering, searching, pagination, sorting, aggregations, and computations are
      backend-driven; APIs return minimal view-ready payloads; database queries avoid N+1 patterns
      and include appropriate indexes/caching/batching evidence where needed (Principle XI).
  12. Every create/update/delete/submit/refresh action displays a loading indicator until the
      request completes; affected React Query caches are invalidated or updated after mutations;
      no stale data flashes; action controls are disabled during in-flight requests; optimistic
      updates are rolled back on error (Principle XII).
  13. All email templates and views use the same design system, layout, spacing, typography, styling,
      colors, and overall visual structure; new email types reuse existing email view components
      and extend the base email template system rather than implementing independent layouts
      (Principle XIII).
- **Code review**: Every PR MUST include a Constitution Check section in its description
  confirming compliance with each principle above, or explicitly documenting a justified
  exception in the Complexity Tracking table.

## Governance

This constitution supersedes all other development practices and informal conventions. Amendments
require:
1. A written proposal documenting the change, motivation, and migration plan for existing code.
2. Explicit approval before the amendment is merged.
3. Updating this file with an incremented version and a new Sync Impact Report comment.

**Versioning policy**:
- MAJOR bump: removal or backward-incompatible redefinition of an existing principle.
- MINOR bump: new principle or section added, or materially expanded guidance.
- PATCH bump: clarifications, wording fixes, non-semantic refinements.

**Compliance review**: All PRs and spec plans MUST include a Constitution Check. Violations that
are not explicitly justified in a Complexity Tracking table MUST block merge.

Runtime development guidance is in `CLAUDE.md` at the repository root.

**Version**: 1.4.0 | **Ratified**: 2026-04-03 | **Last Amended**: 2026-05-26
