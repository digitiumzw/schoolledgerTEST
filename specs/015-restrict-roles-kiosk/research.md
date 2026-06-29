# Research: Restrict Tenant Roles and Kiosk-Only Access

## Role Restriction

**Decision**: Remove `teacher` and `driver` from `VALID_ROLES` in `BaseApiController` and `AuthController`. Reduce allowed tenant roles to `['admin', 'bursar']` (plus platform-level `super_admin`).

**Rationale**: Both constants currently include `teacher` and `driver`. Changing the single `VALID_ROLES` constant in `BaseApiController` propagates to `UserController::create`, `UserController::update`, and any other controller that references it. `AuthController` also needs its own local `VALID_ROLES` updated (line 136 references it locally).

**Alternatives considered**: Keeping the roles but preventing tenant admins from selecting them — rejected because it adds a two-tier validation complexity and leaves stale role values in the DB schema with no enforcer.

---

## Account Cap Enforcement

**Decision**: Add a five-account-per-tenant check inside `UserController::create()` before the insert. Count active users in the tenant with roles in `['admin', 'bursar']`.

**Rationale**: The check must be at the API layer (Principle III: backend enforces, frontend is not the sole guard). The `UserModel::getByTenant()` already returns all users by tenant, so a `COUNT` query or a simple `->where('tenant_id')->findAll()` count is sufficient.

**Alternatives considered**: DB-level constraint — not feasible portably; would also bypass the descriptive error message.

---

## Deactivating Existing Teacher/Driver Accounts

**Decision**: Deliver a one-time data migration script (PHP Spark command or a migration with a `_data` suffix) that sets `users.status = 'inactive'` for all rows where `role IN ('teacher', 'driver')`. Do not hard-delete; preserve audit trail.

**Rationale**: Hard-deleting could cascade-break foreign keys (e.g., `transport_routes.driver_user_id`). Setting inactive blocks login (AuthController already checks status) without destroying history.

**Alternatives considered**: Hard-delete — rejected due to FK constraints and loss of audit history.

---

## Driver Kiosk: Linking Drivers to Routes

**Decision**: Add a `driver_staff_id` column (nullable, FK to `staff.id`) to `transport_routes` via a new migration. The driver kiosk will look up routes by matching `staff.employee_id` → `staff.id` → `transport_routes.driver_staff_id`.

**Rationale**: `transport_routes.driver_user_id` currently links to `users.id` for JWT-authenticated drivers. Since drivers will no longer have user accounts, we need a parallel FK to `staff.id`. Keeping `driver_user_id` (nullable) allows backward-compatible nullification without breaking existing data.

**Alternatives considered**: Using `driver_name` as a text match for employee lookup — rejected; unreliable and not unique. Re-using `driver_user_id` to store staff IDs — rejected; column name would be misleading and the FK target differs.

---

## Driver Kiosk: Public Endpoint Pattern

**Decision**: Create a new `DriverKioskController` following the existing `StudentKioskController` pattern exactly. Endpoints are registered before the JWT group in `Routes.php` so they bypass `JWTAuthFilter`. Authentication is: `kiosk_code` (from tenant settings) + `employee_id` (staff table). The kiosk_code is already stored in `tenants.settings` as `kiosk_code`.

**Rationale**: The `StudentKioskController` is the established precedent (specs/011). It uses opaque kiosk_code resolution to avoid exposing tenant UUIDs, and validates employee_id from the staff table. The same security model applies here.

**Alternatives considered**: Reusing `StudentKioskController` with a mode parameter — rejected; separating concerns prevents unintentional scope creep between driver and teacher kiosk behaviors.

---

## Teacher Kiosk: Existing Infrastructure

**Decision**: No new backend endpoints needed for teacher access. The existing `StudentKioskController` endpoints already handle teacher authentication via employee_id and attendance submission. The existing `StudentKioskPage.tsx` already serves this flow.

**Rationale**: The teacher kiosk is already implemented (specs/011). The only change needed is removing the teacher's standard login account — the kiosk flow is already complete.

**Impact**: Remove the `teacher` role from the login flow and the `ProtectedRoute` for `/attendance`. The teacher kiosk page at `/kiosk/student-attendance/:code` replaces it.

---

## Frontend Changes

**Decision**: 
1. Remove `teacher` and `driver` options from any role selector in Settings/Users UI.
2. Remove the `ProtectedRoute` for `/driver` and `/attendance` (teacher-only) from `App.tsx` — these pages are no longer accessible via login.
3. Add a new `DriverKioskPage.tsx` (parallel to `StudentKioskPage.tsx`) at route `/kiosk/driver/:code`.
4. The teacher redirect logic in `App.tsx` (line 199: `if (user.role === 'teacher')`) is removed since teachers no longer log in.

**Rationale**: Removing the routes prevents accidental direct URL access. The driver kiosk page follows the same component pattern as the student attendance kiosk page (idle screen → employee ID entry → route display → timeout).

---

## Constitution Compliance Notes

- **Principle I**: All new driver kiosk backend queries will use tenant_id from the kiosk_code resolution (same as StudentKioskController).
- **Principle III Exception**: The two new public endpoints (`POST /api/kiosk/driver/validate`, `GET /api/kiosk/driver/routes/:code`) are intentionally exempt from JWTAuthFilter, following the established kiosk exception pattern documented in specs/006, 010, 011. This will be recorded in the Complexity Tracking table.
- **Principle IV**: Schema changes (adding `driver_staff_id`, deactivating accounts) will be new migration files.
