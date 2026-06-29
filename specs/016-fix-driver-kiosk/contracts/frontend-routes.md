# Frontend Route Contracts

## Driver Kiosk Route (changed)

| Property | Old value | New value |
|---|---|---|
| Path pattern | `/kiosk/driver/:code` | `/kiosk/:code/driver` |
| Component | `DriverKioskPage` | `DriverKioskPage` (unchanged) |
| Auth required | None (public) | None (public) |
| URL param | `code` — opaque kiosk code | `code` — opaque kiosk code (unchanged) |

The old path `/kiosk/driver/:code` MUST be removed. It MUST NOT redirect to the new path.

## Route ordering in App.tsx (required)

Routes must appear in this order to prevent shadowing:

```
/kiosk/:code/students   → StudentKioskPage   (most specific — already correct)
/kiosk/:code/driver     → DriverKioskPage    (new — insert here)
/kiosk/:code            → KioskPage          (less specific — already correct)
/kiosk                  → KioskPage          (legacy — already correct)
```

## Backend API contracts (unchanged)

No backend routes change. The existing contracts remain:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/kiosk/status/:code` | Validate any kiosk code (reused for initial load check) |
| POST | `/api/kiosk/driver/validate` | Validate driver employee ID; returns name + routes |
| GET | `/api/kiosk/driver/routes/:code?employee_id=&route_id=` | Returns student roster for a route |
