# Research: Admin Platform Console

**Feature**: 040-admin-console  
**Date**: 2026-04-21  
**Status**: Complete

## Platform-scoped JWT authentication

**Decision**: Add a `scope` field to JWT payloads and a new `PlatformJWTAuthFilter` that validates `scope: "platform"` and `platform_role`. Tenant JWTs continue to use existing `JWTAuthFilter` and are rejected at platform routes.

**Rationale**: Keeps a single JWT library and secret while cleanly separating two auth realms. Adding `scope` is backward-compatible for tenant tokens. Using a separate filter avoids complex conditional logic in the existing tenant filter.

**Alternatives considered**:
- Separate JWT secret/issuer for platform: would duplicate configuration and increase operational overhead.
- Role-based flag in existing tenant users table: risks privilege escalation and confuses tenant vs platform identity.

## Cross-tenant aggregation endpoints

**Decision**: Create a new `/api/platform/*` route group in `app/Config/Routes.php`. Each controller in `Controllers/Platform/` operates without `tenant_id` filtering and explicitly validates platform JWT scope and role.

**Rationale**: Clear namespace separation prevents accidental cross-tenant exposure in tenant controllers. CodeIgniter 4 route groups make the prefix and middleware application straightforward.

**Alternatives considered**:
- Add `?platform=1` query params to existing controllers: would make authorization logic messy and error-prone.
- Separate microservice: overkill for the required data volume; would complicate deployment and transactions.

## Platform admin identity storage

**Decision**: New `platform_users` table with columns: id, name, email, password_hash, platform_role (enum), two_factor_secret, last_login_at, created_at, updated_at. Password hashing uses CodeIgniter's `Password::hash()`.

**Rationale**: Isolates platform admin credentials from tenant users, preventing any cross-realm authentication. Simple table schema follows existing user patterns.

**Alternatives considered**:
- Store in existing `users` table with `is_platform` flag: could lead to accidental tenant exposure and complicates queries.
- External identity provider (OAuth/OIDC): adds external dependency; not justified for a small admin team.

## Platform settings storage

**Decision**: New `platform_settings` table using key-value schema: `key` (VARCHAR, unique), `value` (JSON), `type` (enum: string|number|boolean|json), `updated_at`. Helper model `PlatformSetting` provides typed getters/setters.

**Rationale**: Flexible for future settings without schema migrations. JSON column supports complex values (email templates). Type column enables validation and casting.

**Alternatives considered**:
- Dedicated columns per setting: requires migration for every new setting; inflexible.
- Config files only: not editable via UI; requires server restart for changes.

## Role-based access control (RBAC)

**Decision**: Define roles as enum: Owner, Admin, Finance, Support. Implement a `PlatformPolicy` trait with methods like `canManageTenants($role)`, `canDeleteTenants($role)`, etc. Controllers call these methods before actions.

**Rationale**: Centralized policy logic makes audits and future changes easier. Enum ensures only valid roles are stored.

**Alternatives considered**:
- Permissions matrix table: over-engineering for four static roles; harder to maintain.
- Attribute-based access control (ABAC): unnecessary complexity for this use case.

## Impersonation flow

**Decision**: Add `/api/platform/auth/impersonate` endpoint requiring tenant_id and returning a short-lived JWT with `scope: "impersonation"`, `tenant_id`, and `impersonator_id`. Tenant app checks for this scope and renders a non-dismissible banner. Platform console can terminate via `/api/platform/auth/stop-impersonation`.

**Rationale**: Keeps impersonation within the JWT system with explicit scope. Short lifetime (max 30 min) reduces risk. Banner ensures transparency to tenant users.

**Alternatives considered**:
- Shared session storage: would couple the two applications and complicate scaling.
- Magic link tokens: harder to revoke and audit compared to JWT.

## Frontend API client architecture

**Decision**: Create a dedicated Axios instance in `admin-frontend/src/api/platform.ts` with base URL `http://localhost:8080/api/platform` and interceptors for platform JWT handling (attach token, handle 401/403). Use TanStack React Query for all server state; create custom hooks like `usePlatformTenants()`.

**Rationale**: Separate Axios instance prevents token leakage to tenant endpoints. React Query provides caching, retries, and optimistic updates out of the box.

**Alternatives considered**:
- Reuse existing `api.ts`: risks sending platform token to tenant endpoints.
- Fetch-only: would require re-implementing caching and error handling.

## CSV export performance

**Decision**: Implement server-side streaming using PHP's `fputcsv` and `Symfony\Component\HttpFoundation\StreamedResponse`. Apply filters before generating the cursor to limit rows. Include a progress bar on the frontend using fetch progress events.

**Rationale**: Streaming avoids loading 10k+ rows into memory. Progress feedback improves UX for large exports.

**Alternatives considered**:
- Client-side generation: would transfer massive dataset to browser; memory risk.
- Background job with email/download link: adds complexity and latency for most cases.

## Audit logging

**Decision**: New `platform_audit` table: id, actor_user_id, action, target_type, target_id, details (JSON), ip_address, user_agent, created_at. Create an `AuditService` to write entries from controllers and a middleware to log all platform requests.

**Rationale**: Centralized audit trail supports compliance and debugging. JSON details allow flexible context without schema changes.

**Alternatives considered**:
- Log files only: harder to query and correlate with users.
- Event sourcing: overkill; we only need immutable logs, not event replay.

## Testing strategy

**Decision**:
- Backend: PHPUnit feature tests for each Platform controller endpoint; include authorization matrix tests.
- Frontend: Vitest unit tests for custom hooks and components; React Testing Library integration tests for key user flows (login, tenant CRUD, impersonation).
- E2E: Skip for v1 due to complexity; rely on comprehensive backend+frontend coverage.

**Rationale**: Balanced coverage without excessive maintenance. Authorization matrix tests are critical for security.

**Alternatives considered**:
- Full Playwright/Cypress E2E suite: high maintenance cost; slower feedback.
- Manual testing only: insufficient for security-critical admin console.

## Deployment considerations

**Decision**: Deploy admin-frontend as a separate path/domain from tenant frontend to avoid cookie/token conflicts. Use the same backend instance; new platform routes are co-located.

**Rationale**: Avoids session confusion. Shared backend simplifies database access and migrations.

**Alternatives considered**:
- Same domain with path-based routing: risk of token leakage via misconfigured cookies.
- Separate backend instance: doubles infrastructure cost and introduces data consistency challenges.

## Security hardening

**Decision**:
- Enforce HTTPS in production for both frontend and backend.
- Set SameSite=Strict; Secure on JWT cookies if used.
- Rate-limit login and impersonation endpoints.
- Sanitize all CSV export data to prevent CSV injection.
- Mask API keys in storage and logs; show raw value only once upon creation.

**Rationale**: Defense-in-depth for a privileged admin surface.

**Alternatives considered**:
- Rely on Cloudflare WAF only: insufficient for application-level threats.
- IP allowlist: would reduce operational flexibility for remote admins.
