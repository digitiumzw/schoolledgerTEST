# Data Model: Fix Driver Kiosk Bugs and URI Format

No database schema changes are required for this feature.

All changes are confined to:
- Frontend routing configuration (`App.tsx`)
- Frontend page component state management (`DriverKioskPage.tsx`)

The existing data entities and backend API contracts are unchanged.

## Existing entities (referenced, not modified)

**Transport Route** (`transport_routes` table)
- `id` — primary key
- `route_name` — display name shown to driver
- `driver_staff_id` — FK to `staff.id`; used to verify route ownership
- `tenant_id` — multi-tenancy filter

**Staff** (`staff` table)
- `id` — primary key
- `employee_id` — the code the driver enters at the kiosk
- `employment_status` — must be `active` to authenticate
- `tenant_id` — multi-tenancy filter

**Transport Assignment** (`transport_assignments` table)
- `route_id` — FK to `transport_routes.id`
- `student_id` — FK to `students.id`
- `status` — must be `active` to appear in roster
- `tenant_id` — multi-tenancy filter

## Frontend state changes (DriverKioskPage)

The following new state variable is added to `DriverKioskPage`:

| State variable | Type | Purpose |
|---|---|---|
| `routeError` | `string` | Holds error message shown in the routes view when a roster load fails. Distinct from `idError` which is shown in the idle/login view. |

The `KioskView` type gains a new value:

| New value | Meaning |
|---|---|
| `"loading"` | Page is performing initial kiosk code validation before showing the employee ID form. |
