# Research: Fix Driver Kiosk Bugs and URI Format

## Decision 1: Kiosk code validation on page load

**Decision**: Reuse `kioskApi.getKioskStatus(code)` (calls `GET /api/kiosk/status/:code`) for the initial driver kiosk load check.

**Rationale**: This function already exists in `frontend/src/api/api.ts` (line 1451) and is used by `KioskPage` (staff attendance kiosk). It validates any opaque kiosk code and returns `{ kioskEnabled, ... }`. No new backend endpoint is needed.

**Alternatives considered**: 
- Adding a dedicated `GET /api/kiosk/driver/status/:code` backend endpoint — rejected; it would duplicate existing logic for zero gain.
- Calling `kioskDriverApi.validate` with a dummy employee ID on load — rejected; this would be semantically wrong and generate misleading error messages.

---

## Decision 2: Route error state handling

**Decision**: Add a separate `routeError` state string to `DriverKioskPage`. Render it in the routes view alongside the route list. Do not reuse `idError` (which belongs to the idle view's employee ID form).

**Rationale**: `idError` is only rendered inside the idle/login form. When `handleRouteSelect` fails, calling `setIdError` stores an error that the driver can never see (the routes view has no `idError` display). Adding `routeError` (a distinct state variable) keeps the two concerns separate and makes both error surfaces independently testable.

**Alternatives considered**:
- Using a single error state and switching views to display it — rejected; it forces the driver back to the employee ID screen on a transient network error, losing their session context.
- Using a toast notification — rejected; kiosk terminals may not have visible notification areas; inline errors are more reliable on shared displays.

---

## Decision 3: Frontend route URL format change

**Decision**: Change the driver kiosk route in `App.tsx` from `/kiosk/driver/:code` to `/kiosk/:code/driver`.

**Rationale**: The student attendance kiosk uses `/kiosk/:code/students` (kiosk code first, type as path suffix). Adopting the same pattern for the driver kiosk makes all kiosk URLs consistent and easier for administrators to construct. The `:code` param name and `useParams` call in `DriverKioskPage` are unchanged.

**Route ordering**: `/kiosk/:code/driver` must be registered before `/kiosk/:code` in `App.tsx` to prevent the staff kiosk route from shadowing it. Currently `/kiosk/:code/students` is already registered before `/kiosk/:code`, confirming this ordering pattern is already established.

**Alternatives considered**:
- Keeping the old URL and adding a redirect from the new URL — rejected; the spec explicitly requires the old URL to 404. Adding a redirect would keep two entry points alive.
- Using a query param (`/kiosk/:code?type=driver`) — rejected; inconsistent with the existing path-suffix convention.
