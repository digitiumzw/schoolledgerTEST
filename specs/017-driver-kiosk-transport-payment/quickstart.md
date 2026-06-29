# Quickstart: Driver Kiosk Toggle & Transport Payment Indicators

**Branch**: `017-driver-kiosk-transport-payment`  
**Date**: 2026-04-07

---

## What this feature adds

1. **Driver kiosk toggle in Settings** — admins can enable/disable the driver kiosk and copy its URL from the same Settings page that already controls staff and student kiosks.
2. **Transport payment status in route detail** — the route detail modal shows a per-student payment badge (Paid / Unpaid / No Charge) for the current month.

---

## Dev environment setup

No migrations needed. Both features use existing tables.

```bash
# Backend
cd backend && php spark serve      # runs on :8080

# Frontend
cd frontend && npm run dev         # runs on :8080 (Vite proxy)
```

Credentials: `admin@greenwood.co.zw` / `1234`

---

## Backend changes at a glance

### 1. `SettingsController.php`

| Section | Change |
|---------|--------|
| `DEFAULT_SETTINGS` | Add `'driverKioskModeEnabled' => false` |
| `index()` | Read and return `driverKioskModeEnabled` from settings JSON |
| `update()` | Accept and persist `driverKioskModeEnabled` in `$updatedSettings` |

### 2. `DriverKioskController.php`

| Section | Change |
|---------|--------|
| `resolveTenant()` | After fetching the tenant row, decode `settings` JSON and return `null` if `driverKioskModeEnabled` is falsy |

### 3. `TransportController.php`

| Section | Change |
|---------|--------|
| New method | `getRoutePaymentStatus($routeId)` — role-gated, returns tri-state status per student |

### 4. `Routes.php`

```php
// Add before the existing transport/routes/(:segment) line:
$routes->get('transport/routes/(:segment)/payment-status', 'TransportController::getRoutePaymentStatus/$1');
```

---

## Frontend changes at a glance

### 1. `src/types/dashboard.ts`

- Add `driverKioskModeEnabled?: boolean` to the `Settings` interface
- Add `paymentStatus?: 'paid' | 'unpaid' | 'no_charge' | 'unknown'` to `TransportStudent`

### 2. `src/api/api.ts`

- Add `getRoutePaymentStatus(routeId, month?)` function to the `api` object
- Add `RoutePaymentStatusResponse` interface

### 3. `src/components/settings/GeneralSettingsTab.tsx`

Add a third kiosk Card after the existing "Student Attendance Kiosk" Card:

```tsx
<Card>
  <CardHeader>
    <CardTitle>Driver Kiosk</CardTitle>
    <CardDescription>
      Enable a shared terminal for drivers to view their route roster without logging in.
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* toggle: settings.driverKioskModeEnabled */}
    {/* URL display when enabled: /kiosk/{kioskCode}/driver */}
    {/* Save button → handleSave() */}
  </CardContent>
</Card>
```

### 4. `src/components/modals/RouteDetailModal.tsx`

- Add `useQuery` call for `api.getRoutePaymentStatus(route.id)` when `open && route`
- Merge status data into the student list by `studentId`
- Render a `Badge` per student row:
  - `paid` → `variant="secondary"` with green text class
  - `unpaid` → `variant="destructive"`
  - `no_charge` → `variant="outline"` muted
  - `unknown` (fetch error / loading) → `variant="outline"` muted, no text emphasis

---

## Testing checklist

### Settings — driver kiosk toggle
- [ ] Enable driver kiosk → URL appears with format `/kiosk/:code/driver`
- [ ] Copy button copies the full URL to clipboard
- [ ] Disable driver kiosk → URL hidden
- [ ] Navigating to kiosk URL while disabled → kiosk shows unavailable / 403 path

### Route detail — payment status
- [ ] Open a route with students who have paid transport charge → "Paid" badge shown
- [ ] Open a route with students who have unpaid transport charge → "Unpaid" badge (red) shown
- [ ] Open a route with students who have no charge generated → "No Charge" badge shown
- [ ] Simulate payment status fetch failure → modal still renders students with neutral placeholder
- [ ] Modal opens in under 3 seconds on standard connection

---

## Key file locations

| File | Purpose |
|------|---------|
| `backend/app/Controllers/Api/SettingsController.php` | Add `driverKioskModeEnabled` |
| `backend/app/Controllers/Api/DriverKioskController.php` | Enforce enabled flag in `resolveTenant()` |
| `backend/app/Controllers/Api/TransportController.php` | New `getRoutePaymentStatus()` method |
| `backend/app/Config/Routes.php` | Register new payment-status route |
| `frontend/src/types/dashboard.ts` | Type extensions |
| `frontend/src/api/api.ts` | New API function + type |
| `frontend/src/components/settings/GeneralSettingsTab.tsx` | Driver kiosk Card UI |
| `frontend/src/components/modals/RouteDetailModal.tsx` | Payment status badges |
