# API Contracts: Fee Structure Billing Cycle Configuration

**Branch**: `047-fee-billing-cycle` | **Date**: 2026-04-27

All endpoints follow the project JSON envelope (Principle VI):
- Success: `{ "status": "success", "data": { ... }, "message": "..." }`
- Error:   `{ "status": "error", "message": "...", "errors": { ... } }`

Authentication: All endpoints require `Authorization: Bearer <JWT>` with role `admin` or `super_admin`.

---

## 1. GET /api/settings/fee-structure

Retrieve the current fee structure for the authenticated tenant.

**Changed**: Response now always includes `structureType`. Previously defaulted to `"termly"` implicitly; now explicitly returned.

### Response (unchanged shape, no new fields)

```json
{
  "status": "success",
  "data": {
    "tenantId": "t_abc123",
    "structureType": "monthly",
    "termsPerYear": 3,
    "defaultFees": {
      "Tuition": 300,
      "Books": 60
    },
    "classOverrides": {
      "c_form6": { "Tuition": 420 }
    }
  }
}
```

| Field | Type | Notes |
|-------|------|-------|
| `structureType` | `"termly"` \| `"monthly"` | Previously could be `"annual"`; now restricted to two values |

---

## 2. PUT /api/settings/fee-structure

Save the fee structure for the authenticated tenant.

**Changed**: `structureType` validation tightened from `["termly","monthly","annual"]` to `["termly","monthly"]`.

### Request Body

```json
{
  "structureType": "monthly",
  "termsPerYear": 3,
  "defaultFees": {
    "Tuition": 300,
    "Books": 60
  },
  "classOverrides": {}
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `structureType` | string | Yes | Must be `"termly"` or `"monthly"` |
| `termsPerYear` | integer | Yes | 1–4 |
| `defaultFees` | object | Yes | Keys = fee name strings, values = positive numbers |
| `classOverrides` | object | No | Keys = class IDs, values = `{ feeName: number }` |

### Error Responses

| HTTP | Condition |
|------|-----------|
| 400 | `structureType` not in `["termly","monthly"]` — `"Invalid structure type. Allowed: termly, monthly"` |
| 400 | `termsPerYear` outside 1–4 |
| 401 | Missing or invalid JWT |
| 403 | Role is not `admin` or `super_admin` |

---

## 3. GET /api/billing/preview?termId={termId}

Get the billing preview for a term before confirming charge generation.

**Changed**: Response extended with `billingCycle`, `installments`, and `installmentAmount` fields.

### Response (extended)

```json
{
  "status": "success",
  "data": {
    "isLocked": false,
    "term": {
      "id": "term_1_2026",
      "name": "Term 1",
      "start": "2026-01-13",
      "end": "2026-04-03"
    },
    "academicYear": "2026",
    "totalStudents": 120,
    "excludedStudents": 5,
    "defaultFees": { "Tuition": 300, "Books": 60 },
    "defaultFeeTotal": 360,
    "feeBreakdown": [ ... ],
    "expectedTotal": 43200,
    "billingCycle": "monthly",
    "installments": 3,
    "installmentAmount": 120.00
  }
}
```

#### New fields

| Field | Type | Notes |
|-------|------|-------|
| `billingCycle` | `"termly"` \| `"monthly"` | Read from `fee_structure.structureType` |
| `installments` | `integer` | For `termly`: always `1`. For `monthly`: count of distinct calendar months in the term (≥ 1) |
| `installmentAmount` | `number` | Per-installment amount for a default-fee student (= `defaultFeeTotal / installments`, truncated to cent). For `termly`: equals `defaultFeeTotal`. |

#### Already-locked response (unchanged)

```json
{
  "status": "success",
  "data": {
    "isLocked": true,
    "billingRunId": "billing_xyz",
    "message": "Charges already generated for this term",
    "generatedAt": "2026-01-13T08:30:00Z"
  }
}
```

### Error Responses

| HTTP | Condition |
|------|-----------|
| 400 | `termId` missing |
| 404 | Term not found in academic calendar |
| 422 | Calendar incomplete / outside term dates / new year detected |

---

## 4. POST /api/billing/finalize

Finalize billing and generate charges for the current term.

**Changed**: When `fee_structure.structureType == "monthly"`, generates N charge rows per student per fee category (one per installment month) instead of 1. Request body and success response shape are **unchanged**.

### Request Body (unchanged)

```json
{
  "termId": "term_1_2026",
  "confirmed": true,
  "notes": "Optional confirmation note"
}
```

### Success Response (unchanged shape)

```json
{
  "status": "success",
  "data": {
    "success": true,
    "billingRunId": "billing_abc123",
    "termId": "term_1_2026",
    "generatedCount": 720,
    "totalAmount": 43200.00,
    "studentsAffected": 120,
    "isLocked": true
  }
}
```

> **Note**: Under monthly billing with 3 installments, 2 fee categories, and 120 students: `generatedCount = 120 × 2 × 3 = 720`. Under termly: `generatedCount = 120 × 2 = 240`. The count difference is the observable indication of which cycle ran.

### Already-generated response (unchanged — idempotency guard)

```json
{
  "status": "success",
  "data": {
    "alreadyGenerated": true,
    "billingRunId": "billing_abc123",
    "message": "Billing already finalized for this term"
  }
}
```

### Error Responses (unchanged)

| HTTP | Condition |
|------|-----------|
| 400 | `termId` missing |
| 400 | `confirmed` not `true` |
| 404 | No active students |
| 422 | Calendar guard failures (TERM_MISMATCH, OUTSIDE_TERM_DATES, NEW_YEAR_DETECTED, CALENDAR_INCOMPLETE) |

---

## 5. POST /api/billing/void — Unchanged

Voiding a billing run under monthly billing works identically to termly — all charge rows sharing the `billing_run_id` are voided in one operation. No contract changes.

---

## Frontend Type Changes

### `FeeStructure` interface (`src/types/dashboard.ts`)

```typescript
// BEFORE
structureType: 'termly' | 'monthly' | 'custom';

// AFTER (tighten to match backend validation)
structureType: 'termly' | 'monthly';
```

> The value `'custom'` was present in the TypeScript type but never produced by the backend. Removing it aligns the frontend type with the validated backend contract. If `'custom'` is needed in future it can be re-added.

### `BillingPreview` (new interface to type the preview response)

```typescript
export interface BillingPreview {
  isLocked: boolean;
  billingRunId?: string;
  generatedAt?: string;
  term?: { id: string; name: string; start: string; end: string };
  academicYear?: string;
  totalStudents?: number;
  excludedStudents?: number;
  defaultFees?: Record<string, number>;
  defaultFeeTotal?: number;
  feeBreakdown?: Array<{
    type: 'default' | 'override';
    className: string;
    classId: string | null;
    feePerStudent: number;
    studentCount: number;
    subtotal: number;
  }>;
  expectedTotal?: number;
  billingCycle?: 'termly' | 'monthly';
  installments?: number;
  installmentAmount?: number;
}
```
