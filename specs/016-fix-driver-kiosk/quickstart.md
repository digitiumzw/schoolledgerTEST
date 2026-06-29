# Quickstart: Fix Driver Kiosk Bugs and URI Format

## What changes

Three bugs are fixed, all in the frontend:

1. **URL format** — driver kiosk moves from `/kiosk/driver/:code` to `/kiosk/:code/driver`
2. **Roster load errors** — errors from route selection are now visible in the routes view
3. **Missing initial validation** — the page now validates the kiosk code on load before showing the employee ID form

No backend changes. No database migrations.

## Files to change

| File | Change |
|---|---|
| `frontend/src/App.tsx` | Replace `/kiosk/driver/:code` route with `/kiosk/:code/driver`; insert before `/kiosk/:code` |
| `frontend/src/pages/DriverKioskPage.tsx` | Add `loading` view + initial `getKioskStatus` call; add `routeError` state; render it in routes view |

## Testing the changes manually

1. Start the frontend: `npm run dev` (from `frontend/`)
2. Start the backend: `php spark serve` (from `backend/`)
3. Get a valid kiosk code from the database (or Settings page)

**Test new URL format**:
- Navigate to `/kiosk/VALIDCODE/driver` → should show employee ID entry screen
- Navigate to `/kiosk/driver/VALIDCODE` → should show 404 page

**Test invalid kiosk code**:
- Navigate to `/kiosk/BADCODE/driver` → should show "Kiosk Unavailable" error screen without prompting for employee ID

**Test route error visibility**:
- Log in as a driver, select a route, simulate a network failure (browser DevTools → Network → Offline) → error message must appear in the routes view, not disappear silently
