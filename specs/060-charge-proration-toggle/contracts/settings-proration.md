# Contract: Settings — Charge Proration Toggle

## Endpoint: GET /api/settings

**Auth**: JWT required. Roles: `super_admin`, `admin`, `bursar`.

### Response (additive change — new field)

```json
{
  "status": "success",
  "data": {
    "tenantId": "ten_abc",
    "schoolName": "Example School",
    "chargeProrationEnabled": false,
    "kioskModeEnabled": false,
    "...": "...existing fields unchanged..."
  }
}
```

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `chargeProrationEnabled` | boolean | `false` | Missing from legacy records treated as `false` by the backend. |

---

## Endpoint: PUT /api/settings

**Auth**: JWT required. Roles: `super_admin`, `admin` (bursar cannot mutate settings).

### Request body (additive — new field accepted)

```json
{
  "chargeProrationEnabled": true
}
```

All other existing fields remain unchanged and continue to follow the existing merge/patch semantics.

### Validation rules

| Field | Rule |
|-------|------|
| `chargeProrationEnabled` | Optional boolean. Non-boolean values are cast via `(bool)`. |

### Success response

```json
{
  "status": "success",
  "data": {
    "chargeProrationEnabled": true,
    "...": "...all other settings fields..."
  },
  "message": "Settings saved successfully"
}
```

---

## Charge Generation Side Effects

When `chargeProrationEnabled` is `true`, the following endpoints produce prorated amounts for mid-period students:

### POST /api/fee-rules/generate

The `perRule[].amount` in the response reflects total prorated amounts, not the sum of full amounts, when some students were prorated.

```json
{
  "status": "success",
  "data": {
    "billingPeriod": "2026-05",
    "generatedCount": 12,
    "skippedDuplicateCount": 0,
    "totalAmount": 1840.00,
    "perRule": [
      {
        "feeRuleId": "rule_xyz",
        "name": "Tuition Fee",
        "studentsCharged": 12,
        "amount": 1840.00
      }
    ]
  }
}
```

Charge descriptions for prorated students:

```
"Tuition Fee (2026-05) – prorated 18/31 days"
```

Full-period students (no annotation):

```
"Tuition Fee (2026-05)"
```

### POST /api/transport/generate-charges

Same pattern. Transport charge description for prorated students:

```
"Route 1 – May 2026 – prorated 22/31 days"
```

Full-period students (no annotation):

```
"Route 1 – May 2026"
```

---

## Backward Compatibility

- All existing tenants with no `chargeProrationEnabled` in their settings JSON receive `false` from the API.
- Existing charges are never modified. Proration only affects newly generated charges.
- No breaking changes to any existing field or endpoint.
