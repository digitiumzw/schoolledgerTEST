# API Contract: Capacity Data

This feature introduces **no new endpoints**. It consumes two existing endpoints.

---

## GET /api/subscription/current

**Auth**: Bearer JWT (admin, super_admin, bursar)

### Response (relevant fields)

```json
{
  "data": {
    "subscription": {
      "planId": "starter",
      "planName": "Starter",
      "status": "active",
      "expiresAt": "2026-05-13T00:00:00Z"
    },
    "studentCount": 188,
    "isOverLimit": false,
    "isExpired": false,
    "daysUntilExpiry": 30
  }
}
```

**Capacity derivation** (frontend, using `studentCount` + plan's `maxStudents`):

| Condition | Value |
|-----------|-------|
| `studentCount = 188`, `maxStudents = 249` | `capacityPercent = 75`, `remainingSlots = 61`, `isNearCapacity = true` |
| `studentCount = 186`, `maxStudents = 249` | `capacityPercent = 74`, `remainingSlots = 63`, `isNearCapacity = false` |
| `maxStudents = null` (Enterprise) | `capacityPercent = null`, `remainingSlots = null`, `isNearCapacity = false` |

---

## GET /api/subscription/plans

**Auth**: Bearer JWT

### Response (relevant fields)

```json
{
  "data": [
    { "id": "starter",    "name": "Starter",    "maxStudents": 249  },
    { "id": "growth",     "name": "Growth",     "maxStudents": 349  },
    { "id": "enterprise", "name": "Enterprise", "maxStudents": null }
  ]
}
```

The frontend cross-references `subscription.planId` against this list to obtain `maxStudents`.

---

## Frontend Interface Contract

### `UseSubscriptionReturn` additions

```ts
maxStudents:      number | null;   // plan ceiling; null = unlimited
capacityPercent:  number | null;   // 0–100; null when unlimited
remainingSlots:   number | null;   // maxStudents − studentCount; null when unlimited
isNearCapacity:   boolean;         // true when capacityPercent >= 75 && !isOverLimit && !isExpired
```

### `StudentCapacityCard` props

```ts
interface StudentCapacityCardProps {
  studentCount:    number;
  maxStudents:     number | null;
  capacityPercent: number | null;
  remainingSlots:  number | null;
  isLoading:       boolean;
}
```
