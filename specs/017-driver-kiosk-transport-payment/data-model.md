# Data Model: Driver Kiosk Toggle & Transport Payment Indicators

**Branch**: `017-driver-kiosk-transport-payment`  
**Phase**: 1 — Design  
**Date**: 2026-04-07

---

## Schema changes

**No migration required.** Both features use existing tables. The only persistence change is adding a new JSON field to the existing `tenants.settings` blob.

---

## Tenant settings JSON — new field

The `tenants.settings` JSON column gains one new key:

```json
{
  "...existing fields...",
  "kioskModeEnabled": true,
  "studentKioskModeEnabled": false,
  "driverKioskModeEnabled": false,
  "kiosk_code": "a1b2c3d4e5"
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `driverKioskModeEnabled` | boolean | `false` | Controls whether the driver kiosk is active for this tenant. Stored in `tenants.settings` JSON, mirroring existing kiosk flags. |

---

## Transport payment status — read model (no new tables)

Payment status for route students is **derived at query time** from existing tables. No new columns or tables are introduced.

### Existing tables used

**`transport_assignments`**
| Column | Type | Relevant for |
|--------|------|--------------|
| `id` | varchar | PK |
| `student_id` | varchar | Join to students |
| `route_id` | varchar | Filter by route |
| `tenant_id` | varchar | Multi-tenancy filter |
| `status` | enum | Filter: `active` only |

**`charges`**
| Column | Type | Relevant for |
|--------|------|--------------|
| `id` | varchar | PK, join to payments |
| `student_id` | varchar | Join |
| `route_id` | varchar | Match transport charge to route |
| `charge_type` | varchar | Filter: `transport` |
| `academic_session` | varchar | Filter: `YYYY-MM` format |
| `amount` | decimal | Compare against sum of payments |
| `tenant_id` | varchar | Multi-tenancy filter |

**`payments`**
| Column | Type | Relevant for |
|--------|------|--------------|
| `id` | varchar | PK |
| `charge_id` | varchar | FK to charges |
| `amount` | decimal | Sum for paid total |
| `tenant_id` | varchar | Multi-tenancy filter |

### Derived payment status tri-state

```
For each student in transport_assignments WHERE route_id = :routeId AND status = 'active':

  LEFT JOIN charges ch ON
    ch.student_id = ta.student_id
    AND ch.route_id = :routeId
    AND ch.charge_type = 'transport'
    AND ch.academic_session = :month
    AND ch.tenant_id = :tenantId

  LEFT JOIN (
    SELECT charge_id, SUM(amount) AS paid_total
    FROM payments
    WHERE tenant_id = :tenantId
    GROUP BY charge_id
  ) p ON p.charge_id = ch.id

→ paymentStatus:
    IF ch.id IS NULL          → 'no_charge'
    IF p.paid_total >= ch.amount → 'paid'
    ELSE                      → 'unpaid'
```

This single-query pattern preserves the `getAllBalances()` optimization (Constitution Principle V).

### API response shape for payment status endpoint

`GET /api/transport/routes/:routeId/payment-status?month=YYYY-MM`

```json
{
  "success": true,
  "data": {
    "routeId": "route-uuid",
    "month": "2026-04",
    "students": [
      {
        "studentId": "student-uuid",
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

`paymentStatus` values: `"paid"` | `"unpaid"` | `"no_charge"`

---

## Frontend type extensions

### `TransportStudent` type (existing, in `src/types/dashboard.ts`)

Extend with an optional payment status field:

```typescript
interface TransportStudent {
  // ...existing fields...
  paymentStatus?: 'paid' | 'unpaid' | 'no_charge' | 'unknown';
}
```

### New API response type (in `src/api/api.ts`)

```typescript
interface RoutePaymentStatusResponse {
  routeId: string;
  month: string;
  students: Array<{
    studentId: string;
    paymentStatus: 'paid' | 'unpaid' | 'no_charge';
  }>;
}
```

### Settings type extension

The existing `Settings` interface (in `src/types/dashboard.ts`) gains:

```typescript
interface Settings {
  // ...existing fields...
  driverKioskModeEnabled?: boolean;
}
```
