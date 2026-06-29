# API Contracts: Driver Kiosk Toggle & Transport Payment Indicators

**Branch**: `017-driver-kiosk-transport-payment`  
**Date**: 2026-04-07

---

## Modified endpoints

### PUT /api/settings

**Change**: Accept and persist the new `driverKioskModeEnabled` boolean field.

**Request body additions**:
```json
{
  "driverKioskModeEnabled": true
}
```

**Response body additions** (merged into existing settings response):
```json
{
  "driverKioskModeEnabled": true
}
```

**Backend changes**:
- `SettingsController::DEFAULT_SETTINGS` — add `'driverKioskModeEnabled' => false`
- `SettingsController::index()` — read and return `driverKioskModeEnabled` from settings JSON
- `SettingsController::update()` — accept and persist `driverKioskModeEnabled` in the settings JSON blob

**Auth**: JWT required (`admin`, `super_admin`)

---

### GET /api/settings

**Change**: Response now includes `driverKioskModeEnabled`.

**Response** (existing shape, new field added):
```json
{
  "success": true,
  "data": {
    "tenantId": "...",
    "schoolName": "...",
    "kioskModeEnabled": true,
    "studentKioskModeEnabled": false,
    "driverKioskModeEnabled": false,
    "kioskCode": "a1b2c3d4e5",
    "...other existing fields..."
  }
}
```

**Auth**: JWT required

---

### POST /api/kiosk/driver/validate (modified)

**Change**: `resolveTenant()` in `DriverKioskController` now also checks `driverKioskModeEnabled`. If the driver kiosk is disabled for the tenant, the method returns `null`, causing a 403 response identical to an invalid kiosk code.

**No change to request or response shape** — behavior change only.

---

### GET /api/kiosk/driver/routes/:code (modified)

**Change**: Same `resolveTenant()` update applies — returns 404 if driver kiosk is disabled.

**No change to request or response shape** — behavior change only.

---

## New endpoint

### GET /api/transport/routes/:routeId/payment-status

Returns transport payment status for each student assigned to the specified route for the given month. Intended for the route detail modal in the admin UI.

**Auth**: JWT required (`admin`, `super_admin`)

**URL params**:
| Param | Type | Description |
|-------|------|-------------|
| `routeId` | string | Route UUID |

**Query params**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `month` | string | current month | Format: `YYYY-MM` (e.g. `2026-04`) |

**Success response** `200 OK`:
```json
{
  "success": true,
  "data": {
    "routeId": "route-uuid",
    "month": "2026-04",
    "students": [
      {
        "studentId": "student-uuid-1",
        "paymentStatus": "paid"
      },
      {
        "studentId": "student-uuid-2",
        "paymentStatus": "unpaid"
      },
      {
        "studentId": "student-uuid-3",
        "paymentStatus": "no_charge"
      }
    ]
  }
}
```

**`paymentStatus` values**:
| Value | Meaning |
|-------|---------|
| `"paid"` | Transport charge exists for the month; sum of payments ≥ charge amount |
| `"unpaid"` | Transport charge exists for the month; sum of payments < charge amount |
| `"no_charge"` | No transport charge record exists for this student/route/month |

**Error responses**:
| Code | Condition |
|------|-----------|
| `401` | No or invalid JWT |
| `403` | Caller role not `admin` or `super_admin` |
| `404` | Route not found or does not belong to the caller's tenant |
| `400` | `month` query param is malformed (must match `YYYY-MM`) |

**Query design** (follows Constitution Principle V — single subquery, no N+1):
```sql
SELECT
  ta.student_id,
  ch.id        AS charge_id,
  ch.amount    AS charge_amount,
  p.paid_total
FROM transport_assignments ta
LEFT JOIN charges ch ON
  ch.student_id        = ta.student_id
  AND ch.route_id      = :routeId
  AND ch.charge_type   = 'transport'
  AND ch.academic_session = :month
  AND ch.tenant_id     = :tenantId
LEFT JOIN (
  SELECT charge_id, SUM(amount) AS paid_total
  FROM payments
  WHERE tenant_id = :tenantId
  GROUP BY charge_id
) p ON p.charge_id = ch.id
WHERE ta.route_id  = :routeId
  AND ta.tenant_id = :tenantId
  AND ta.status    = 'active'
```

**Backend implementation**: New method `getRoutePaymentStatus($routeId)` in `TransportController`. Registered route: `$routes->get('transport/routes/(:segment)/payment-status', 'TransportController::getRoutePaymentStatus/$1');`

> **Route registration order**: This new route must be declared **before** `transport/routes/(:segment)` (the existing `getRoute` wildcard) in `Routes.php` to prevent shadowing.

---

## Frontend API additions (`src/api/api.ts`)

```typescript
// New function added to the `api` object
getRoutePaymentStatus: async (routeId: string, month?: string): Promise<RoutePaymentStatusResponse> => {
  const qs = month ? `?month=${month}` : '';
  const response = await apiRequest(`/transport/routes/${routeId}/payment-status${qs}`);
  return response.data;
},
```
