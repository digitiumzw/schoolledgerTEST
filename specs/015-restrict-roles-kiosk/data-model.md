# Data Model: Restrict Tenant Roles and Kiosk-Only Access

## Existing Tables Affected

### `users`

No schema change. Existing `role` column allows any string; the constraint is enforced at the application layer.

**Changes**: Via data migration, rows with `role IN ('teacher', 'driver')` will have `status` set to `'inactive'`. These rows are preserved for audit history.

| Column | Change |
|--------|--------|
| `status` | Rows with role `teacher`/`driver` set to `inactive` (data-only, no schema change) |

---

### `transport_routes`

**New column**: `driver_staff_id` (nullable FK to `staff.id`).

Allows routes to be associated with a staff record (driver) independent of a user login account. The existing `driver_user_id` column is preserved (nullable) but will be nullified for any routes where the linked user account is deactivated.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `driver_staff_id` | VARCHAR(36) | YES | FK → `staff.id`; identifies the driver staff member for kiosk lookup |
| `driver_user_id` | VARCHAR(36) | YES (existing) | FK → `users.id`; retained but effectively deprecated for driver auth |

**Migration**: New file `2026-04-07-100000_Add_driver_staff_id_to_transport_routes.php`

---

## Application-Layer Constraints (No DB Schema Change)

### Tenant Account Limit

Enforced in `UserController::create()`:

- **Max accounts**: 5 per tenant (roles `admin` + `bursar` combined; excludes `super_admin`)
- **Allowed roles**: `['admin', 'bursar']` for tenant-scoped creation
- **Validation point**: `BaseApiController::VALID_ROLES` updated to `['super_admin', 'admin', 'bursar']`

---

## New Kiosk Flow: Driver Authentication

The driver kiosk does **not** require a new table. Authentication uses:

1. `tenants.settings` → `kiosk_code` (existing): resolves the tenant
2. `staff.employee_id` (existing): identifies the driver within that tenant
3. `staff.employment_status = 'active'` (existing): ensures only active staff can authenticate
4. `transport_routes.driver_staff_id` (new): maps the authenticated staff member to their routes

### Query Pattern (read-only kiosk lookup)

```
staff.employee_id  →  staff.id
                      ↓
         transport_routes.driver_staff_id  →  routes + roster
                      ↓
         transport_assignments (active, tenant-scoped)  →  students
```

---

## Entity Summary

| Entity | Table | Change |
|--------|-------|--------|
| User Account | `users` | Data: deactivate teacher/driver rows |
| Transport Route | `transport_routes` | Schema: add `driver_staff_id` |
| Driver Kiosk Session | (stateless, no table) | In-memory; cleared on idle timeout |
| Teacher Kiosk Session | (stateless, no table) | Existing — no change |
| Tenant | `tenants` | No change (kiosk_code already in settings) |
| Staff | `staff` | No change (employee_id already exists) |
