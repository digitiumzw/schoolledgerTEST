# Implementation Plan: Restrict Tenant Roles and Kiosk-Only Access

**Branch**: `015-restrict-roles-kiosk` | **Date**: 2026-04-07 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/015-restrict-roles-kiosk/spec.md`

## Summary

Restrict tenant user accounts to **Administrator** and **Bursar** roles only, with a hard cap of five accounts per tenant. Remove teacher and driver login accounts. Drivers access the "My Routes" page via a new public kiosk (Employee ID only). Teachers continue to mark attendance via the existing student-attendance kiosk (already live). No new table is required; a migration adds `driver_staff_id` to `transport_routes` and deactivates stale teacher/driver accounts.

## Technical Context

**Language/Version**: PHP 8.1+ (backend) · TypeScript + React 18 (frontend)  
**Primary Dependencies**: CodeIgniter 4 (backend) · Vite + TailwindCSS + shadcn/ui + TanStack React Query (frontend)  
**Storage**: MySQL — existing `users`, `staff`, `transport_routes`, `transport_assignments` tables  
**Testing**: Manual via dev server + Postman / browser  
**Target Platform**: Web (Chrome/Firefox on shared kiosk terminals)  
**Project Type**: Web application (monorepo: backend/ + frontend/)  
**Performance Goals**: Kiosk Employee ID lookup < 500 ms  
**Constraints**: Kiosk endpoints must bypass JWTAuthFilter; all other API endpoints remain JWT-protected  
**Scale/Scope**: Per-tenant change; affects all tenants simultaneously

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Multi-Tenant Data Isolation | PASS | New driver kiosk queries resolve `tenant_id` via opaque `kiosk_code` (same pattern as StudentKioskController). All queries include `tenant_id`. |
| II. API-First Separation | PASS | Frontend uses `api.ts` for all calls; no direct DB access from React. |
| III. JWT Auth & Role-Based Access | EXCEPTION — justified | Two new public kiosk endpoints bypass JWTAuthFilter. This is the same justified exception as specs/006, 010, 011. Documented in Complexity Tracking. |
| IV. Immutable Migrations | PASS | Two new migration files; no existing files edited. |
| V. Financial Ledger Integrity | PASS | No ledger/charges/payments tables touched. |

## Project Structure

### Documentation (this feature)

```text
specs/015-restrict-roles-kiosk/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 — decisions and rationale
├── data-model.md        # Phase 1 — schema and entity changes
├── quickstart.md        # Phase 1 — testing guide
├── contracts/
│   └── api-endpoints.md # Phase 1 — new and modified API contracts
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── Config/
│   │   └── Routes.php                  # Add 2 new public kiosk routes
│   ├── Controllers/Api/
│   │   ├── BaseApiController.php       # Update VALID_ROLES constant
│   │   ├── AuthController.php          # Update local VALID_ROLES
│   │   ├── UserController.php          # Add account cap + role restriction logic
│   │   └── DriverKioskController.php   # NEW — driver kiosk endpoints
│   └── Database/Migrations/
│       ├── 2026-04-07-100000_Add_driver_staff_id_to_transport_routes.php  # NEW
│       └── 2026-04-07-110000_Deactivate_teacher_driver_accounts.php       # NEW

frontend/
├── src/
│   ├── App.tsx                         # Remove driver route; remove teacher from allowedRoles
│   ├── api/api.ts                      # Add 2 driver kiosk API functions
│   └── pages/
│       └── DriverKioskPage.tsx         # NEW — mirrors StudentKioskPage pattern
```

**Structure Decision**: Option 2 (Web application). Both `backend/` and `frontend/` require changes. Changes are minimal and targeted — no new directories beyond a new controller and page file.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Principle III — Public driver kiosk endpoints bypass JWTAuthFilter | Kiosk terminals have no authenticated session; drivers have no login accounts | Requiring JWT would force drivers to have accounts, which contradicts the feature goal |

---

## Implementation Work Items

### Backend — Part A: Role Restriction & Account Cap

**Files**: `BaseApiController.php`, `AuthController.php`, `UserController.php`

1. Update `BaseApiController::VALID_ROLES` from `['super_admin', 'admin', 'teacher', 'bursar', 'driver']` to `['super_admin', 'admin', 'bursar']`.
2. Update `AuthController` — find its local `VALID_ROLES` usage (line ~136) and update the same list.
3. In `UserController::create()`, after role validation, add:
   - If caller is not `super_admin`, verify `role` is in `['admin', 'bursar']`
   - Count active accounts for the tenant (roles `admin` + `bursar`); reject with `400` if count ≥ 5

### Backend — Part B: Schema Migrations

4. Create `2026-04-07-100000_Add_driver_staff_id_to_transport_routes.php`:
   - `up()`: `ALTER TABLE transport_routes ADD COLUMN driver_staff_id VARCHAR(36) NULL AFTER driver_user_id`; add FK constraint to `staff.id` (or omit FK if CI4 convention is soft references)
   - `down()`: `ALTER TABLE transport_routes DROP COLUMN driver_staff_id`

5. Create `2026-04-07-110000_Deactivate_teacher_driver_accounts.php`:
   - `up()`: `UPDATE users SET status = 'inactive' WHERE role IN ('teacher', 'driver')`
   - `down()`: No-op (document as irreversible in docblock — restoring which accounts were active is non-deterministic)

### Backend — Part C: Driver Kiosk Controller

6. Create `DriverKioskController.php` with two public methods:

   **`POST /api/kiosk/driver/validate`** (`validate()`):
   - Parse `kiosk_code` + `employee_id` from request body
   - Resolve tenant via `kiosk_code` (copy `resolveTenant()` helper from StudentKioskController)
   - Validate staff: `staff.employee_id = ?` AND `tenant_id = ?` AND `employment_status = 'active'`
   - Unified 403 for not-found/inactive (no enumeration)
   - Query `transport_routes` where `driver_staff_id = staff.id` AND `tenant_id = ?`
   - Return `driverName`, `employeeId`, `routes[]`

   **`GET /api/kiosk/driver/routes/:code`** (`roster()`):
   - Parse `employee_id` and `route_id` from query params
   - Resolve tenant from `:code`
   - Re-validate staff (same check as validate)
   - Verify `transport_routes.driver_staff_id = staff.id` for the requested route
   - Query `transport_assignments` (active, tenant-scoped) with student join
   - Return route details + roster

7. Register routes in `Routes.php` **before** the JWT group:
   ```php
   $routes->post('kiosk/driver/validate', 'DriverKioskController::validate');
   $routes->get('kiosk/driver/routes/(:any)', 'DriverKioskController::roster/$1');
   ```

### Frontend — Part A: Remove Driver/Teacher Login Paths

8. `App.tsx`:
   - Remove the `/driver` route block (lines ~298–303)
   - Remove `'teacher'` from `/attendance` allowedRoles (line ~314)
   - Remove the teacher redirect in `getDefaultRoute()` (line ~199)
   - Remove `DriverDashboard` import

9. `Settings.tsx` (User Accounts tab):
   - Remove `teacher` and `driver` from any role `<select>` options in the user creation/edit form

### Frontend — Part B: Driver Kiosk Page

10. Add two API functions in `api.ts`:
    ```typescript
    kioskDriverApi.validate(kioskCode: string, employeeId: string): Promise<DriverValidateResponse>
    kioskDriverApi.getRoster(kioskCode: string, employeeId: string, routeId: string): Promise<DriverRosterResponse>
    ```

11. Create `DriverKioskPage.tsx` mirroring `StudentKioskPage.tsx` structure:
    - **Idle state**: Employee ID entry form + school name header
    - **Routes state**: List of assigned routes (tap/click to view roster)
    - **Roster state**: Student list for selected route
    - **Idle timeout**: 2 minutes inactivity → reset to idle state
    - Route: `/kiosk/driver/:code` (public, added to `App.tsx`)

12. Register the kiosk route in `App.tsx` as a public route (no `<ProtectedRoute>` wrapper), alongside the existing kiosk routes.

---

## Dependency Order

```
[4] DB migrations (driver_staff_id)
    ↓
[5] DB migration (deactivate accounts)
    ↓
[1,2,3] Backend role restriction (independent of migrations but logically after)
    ↓
[6,7] DriverKioskController + routes (depends on driver_staff_id column existing)
    ↓
[8,9] Frontend login path cleanup (independent)
    ↓
[10,11,12] Driver kiosk frontend (depends on backend endpoints)
```

Migrations 4 and 5 can run in sequence. Backend and frontend changes within each group are independent of each other.
