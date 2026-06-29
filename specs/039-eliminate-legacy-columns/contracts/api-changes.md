# API Contract Changes — Eliminate Legacy Columns

**Feature**: 039-eliminate-legacy-columns
**Change type**: Subtractive (backwards-compatible on the wire as long as consumers tolerate missing optional fields; breaking only for consumers that *require* the removed fields)

This document enumerates every API response shape that changes. No request shapes change. No routes, status codes, or error contracts change.

## Affected endpoints

### 1. `GET /api/students/{id}` (via `StudentController::getStudent`)

**Removed from each item in the `payments[]` array**:

```diff
  {
    "id": "pay_001",
    "amount": 250.00,
    "date": "2026-01-20",
    "method": "Cash",
    "category": "Tuition",
    "description": "Tuition Term 1",
-   "isFeeStructure": true,
    "routeId": null
  }
```

### 2. `GET /api/students/{id}/ledger` (via `StudentController`, "full ledger view")

**Removed from each item in the `charges[]` array**:

```diff
  {
    "id": "charge_abc",
    "termName": "Term 1",
    "description": "Tuition – Term 1",
    "isOpeningBalance": false,
-   "isFeeStructure": true
  }
```

**Removed from each item in the `payments[]` array**:

```diff
  {
    "id": "pay_001",
    "amount": 250.00,
    "date": "2026-01-20",
    "method": "Cash",
    "category": "Tuition",
    "description": "Tuition Term 1",
-   "isFeeStructure": true,
    "routeId": null
  }
```

### 3. Any endpoint returning `Charge` objects formatted by `ChargeModel::formatForApi`

No visible contract change — `formatForApi` does not currently emit `isFeeStructure` or `isTransport`. The `chargeType` field continues to be returned and is the canonical replacement.

## Frontend type contract

`frontend/src/types/dashboard.ts`:

```diff
  export interface Charge {
    // ...
    deletedAt?: string;
    deletionReason?: string;
-   // Legacy fields for backward compatibility
-   isFeeStructure?: boolean;               // Deprecated: use chargeType === 'fee_structure'
-   isTransport?: boolean;                  // Deprecated: use chargeType === 'transport'
  }
```

Any frontend code that still reads these fields must migrate to:

- `charge.chargeType === 'fee_structure'` instead of `charge.isFeeStructure`
- `charge.chargeType === 'transport'` instead of `charge.isTransport`

A grep over `frontend/src` at research time found **no** readers of these two properties — only the type declaration itself. Removing the declaration is therefore safe.

## Migration guidance for external consumers

If any external consumer (mobile client, reporting tool, third-party integration) still depends on the removed fields:

- **`payment.isFeeStructure`**: replace with `payment.category` inspection, or join to the matching charge via `payment.studentId + payment.category` and read `charge.chargeType`.
- **`charge.isFeeStructure`**: replace with `charge.chargeType === 'fee_structure'`.
- **`charge.isTransport`**: replace with `charge.chargeType === 'transport'`.

## Backwards compatibility

No API version bump is planned. The removed fields were already marked `Deprecated` in `frontend/src/types/dashboard.ts` and the backing DB columns were flagged for removal in the `2026-04-08-000001_Backfill_charge_type_from_flags` migration docblock. Removing them closes that deprecation.
