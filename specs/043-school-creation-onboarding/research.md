# Research: School Creation & Admin Onboarding

**Feature**: `043-school-creation-onboarding`  
**Date**: 2026-04-27  
**Status**: Complete — all unknowns resolved

---

## 1. Temporary Password Generation

**Decision**: Use `bin2hex(random_bytes(12))` to produce a 24-character hex string as the temporary password, then hash it with `password_hash(..., PASSWORD_BCRYPT, ['cost' => 12])` before storing. The plain-text value is passed to `EmailService::sendWelcome()` once and never persisted.

**Rationale**: `random_bytes` is cryptographically secure (CSPRNG). 24 hex characters (96 bits of entropy) is sufficient for a single-use credential. Bcrypt with cost 12 matches the pattern already used in `UserModel::authenticate()` and `Api\AuthController::register()`.

**Alternatives considered**: `openssl_random_pseudo_bytes` — functionally equivalent but `random_bytes` is the PHP 7+ standard. UUID strings — lower entropy per character. Token table with hashed tokens — unnecessary complexity for a single-use password.

---

## 2. Credential Invalidation on First Login

**Decision**: Add two columns to `users` via a new migration:
- `is_temp_password` TINYINT(1) DEFAULT 0 — set to `1` when provisioned via school creation
- `onboarding_complete` TINYINT(1) DEFAULT 0 — set to `1` when onboarding wizard is submitted

**Rationale**: The `users` table already holds all credential state. Adding boolean flags is the minimal change that enables: (a) `AuthController::login()` to detect first login and include `is_temp_password` in the JWT payload / response, (b) `OnboardingController` to enforce the dashboard guard, (c) the optional password-change step to flip `is_temp_password` to `0`.

`is_temp_password` is set to `0` on first successful login regardless of whether the admin sets a new password during onboarding — the act of logging in invalidates the temporary credential. If the admin changes their password during the optional step, the `password` column is updated and `is_temp_password` is already `0`.

**Alternatives considered**: Separate `temp_credentials` table — adds a join for every login check; over-engineered for a boolean state. Token-based one-time URL — changes the email flow significantly; out of scope.

---

## 3. Onboarding Progress Persistence

**Decision**: Create a new `onboarding_progress` table with a `user_id` foreign key (not `tenant_id`) and a JSON `completed_steps` column storing an array of completed step identifiers, plus a `current_step` VARCHAR for resume behaviour.

**Rationale**: Progress is per-admin user, not per-tenant — a tenant could theoretically have the admin account replaced, and each admin has their own onboarding state. JSON for `completed_steps` avoids one column per step and is easy to extend. The existing `tenants.settings`, `tenants.academic_calendar`, and `tenants.fee_structure` JSON columns confirm this project's pattern for semi-structured onboarding data.

**Alternatives considered**: Storing progress in `users.settings` JSON — muddies the user model with wizard state. Storing a single `onboarding_step` integer — does not support non-linear navigation or skipped steps.

---

## 4. Tenant Status for Provisioned Schools

**Decision**: Provisioned tenants start with `status = 'pending'` (new ENUM value). The existing ENUM on `tenants.status` is `['active', 'suspended', 'trialing']`. A migration will add `'pending'` to this ENUM.

**Rationale**: The spec requires the school to be in a non-active state until onboarding is complete. `'trialing'` is already used for subscription state — reusing it for provisioning state creates ambiguity. `'pending'` clearly communicates "created but not yet activated". The `AuthController::login()` currently blocks `suspended` tenants; it must also block `pending` tenants with a different, actionable message directing the admin to complete onboarding.

**Alternatives considered**: Keep `status = 'active'` and use `onboarding_complete` flag alone — allows premature dashboard access; does not satisfy FR-019 (dashboard guard). Use a separate `provisioning_status` column — redundant with `status`.

---

## 5. Free Trial Auto-Enrollment

**Decision**: The unlimited-students plan uses `plan_id = 'unlimited'` (or the existing plan with `max_students IS NULL`). At onboarding completion, `SchoolProvisioningService::activateTenant()` queries `subscription_plans` for the plan where `max_students IS NULL AND is_active = 1`, inserts a `school_subscriptions` record with `status = 'active'`, `billing_cycle = 'monthly'`, `amount_paid_cents = 0`, `starts_at = NOW()`, `expires_at = DATE_ADD(NOW(), INTERVAL 3 MONTH)`, and `activated_at = NOW()`.

**Rationale**: The migration `2026-04-12-120000_Deactivate_free_plan.php` shows a `free` plan exists in `subscription_plans`. The spec requires an **unlimited students** free trial, which maps to a plan where `max_students IS NULL`. Querying by `max_students IS NULL` is more robust than hardcoding a plan ID that may change. `INTERVAL 3 MONTH` is the MySQL equivalent of calendar-month arithmetic (satisfies SC-006).

**Alternatives considered**: Hardcode `plan_id = 'unlimited'` — brittle if plan IDs change. Compute expiry in PHP with `date('Y-m-d H:i:s', strtotime('+3 months'))` — functionally equivalent; MySQL native is cleaner for a single INSERT.

---

## 6. Platform "Create School" Flow vs. Existing `TenantsController::store()`

**Decision**: Extend `TenantsController::store()` rather than add a new endpoint. The current `store()` requires `name`, `email`, and `subdomain`. The new flow requires only `name` and `email` — subdomain will be auto-generated from the school name (slugified, de-duplicated with a suffix). The method will be refactored to delegate to a new `SchoolProvisioningService::provision()` method.

**Rationale**: Adding a second "create tenant" endpoint would duplicate validation logic and split the resource definition. The existing route `POST /api/platform/tenants` is already defined and consumed by `Schools.tsx`. Extending it preserves the REST contract.

**Auto-subdomain generation**: `strtolower(preg_replace('/[^a-z0-9]+/', '-', $name))`, truncated to 60 chars, with a uniqueness loop appending `-2`, `-3`, etc.

**Alternatives considered**: New endpoint `POST /api/platform/schools` — breaks REST convention (tenants is the canonical resource name). Require subdomain from the UI — contradicts the spec's "only school name and admin email" requirement.

---

## 7. School-Side Login and Onboarding Routing

**Decision**: Extend `Api\AuthController::login()` to include `is_temp_password` and `onboarding_complete` in the response `user` object. The frontend `AuthContext` stores these flags. `App.tsx` adds a route guard: if `is_temp_password = true` OR `onboarding_complete = false` and the user role is `admin`, redirect to `/onboarding`. All other school-side routes under `<ProtectedRoute>` check `onboarding_complete = true` before rendering.

**Rationale**: This follows the existing pattern where `AuthContext` stores user state and `App.tsx` enforces routing via `<ProtectedRoute>`. No new auth mechanism is needed.

**Backend onboarding routes** are added under `/api/onboarding/*` using `JWTAuthFilter`, scoped to `admin` role only:
- `GET  /api/onboarding/progress` — fetch current progress
- `POST /api/onboarding/progress` — save step progress
- `POST /api/onboarding/complete` — finalise onboarding, activate tenant, enroll trial
- `POST /api/onboarding/change-password` — optional password change step

---

## 8. Welcome Email

**Decision**: Reuse the existing `EmailService::sendWelcome()` method. The signature already accepts `schoolName` and `tempPassword`. A `views/emails/welcome.php` template already exists.

**Rationale**: No new email infrastructure needed. The `sendWelcome` method wraps CodeIgniter's built-in `email` service. If sending throws a `RuntimeException`, `SchoolProvisioningService` catches it, logs the failure, and returns a partial-success response to the platform controller — the tenant and user records are already committed. A resend mechanism will call `sendWelcome` again via a new `POST /api/platform/tenants/:id/resend-welcome` endpoint.

**Alternatives considered**: Queue the email asynchronously — CI4 has no built-in queue; out of scope. Retry inside the service — risk of long request duration; better surfaced to platform user.

---

## 9. Dashboard Guard Against URL Bypass (FR-019)

**Decision**: Frontend guard in `App.tsx` — any route rendered inside `<ProtectedRoute role="admin">` checks `user.onboarding_complete`. If `false`, the component redirects to `/onboarding` using React Router's `<Navigate>`. Backend guard in `OnboardingController::complete()` — sets `onboarding_complete = 1` only once; subsequent calls are idempotent.

**Rationale**: Frontend guard covers SC-008 for normal navigation. Backend guard ensures the activation is atomic and can't be replayed. No server-side session or middleware is needed because JWT is stateless — the `onboarding_complete` flag in the DB is the source of truth read by `GET /api/auth/me`.

---

## 10. Existing Subscription Plan ID for Unlimited Trial

**Decision**: Query at activation time: `SELECT id FROM subscription_plans WHERE max_students IS NULL AND is_active = 1 LIMIT 1`. If no such plan exists, `SchoolProvisioningService` throws a provisioning exception and rolls back tenant activation (but preserves pending state).

**Rationale**: Decouples the feature from a hardcoded plan ID. Makes the feature resilient to future plan restructuring. The null-student-cap convention is already present in the schema (`max_students INT UNSIGNED NULL`).
