# API Contract: Charge Generation & Unbilled Alert

**Branch**: `056-fee-structure-billing` | **Date**: 2026-05-01  
**Controller**: `App\Controllers\Api\FeeRuleController`  
**Base path**: `/api/fee-rules`  
**Auth**: JWT required on all endpoints.

---

## GET /api/fee-rules/billing-meta

Returns the school's configured billing cycle and the current period identifier. Used by the frontend to render the correct period selector in the generation panel.

**Roles**: `admin`, `bursar`

### Response 200

```json
{
  "status": "success",
  "data": {
    "billingCycle": "monthly",
    "currentPeriod": "2026-04",
    "currentPeriodLabel": "April 2026",
    "hasActiveTerm": null
  }
}
```

```json
{
  "status": "success",
  "data": {
    "billingCycle": "termly",
    "currentPeriod": "term-1-2025",
    "currentPeriodLabel": "Term 1 2025",
    "hasActiveTerm": true
  }
}
```

```json
{
  "status": "success",
  "data": {
    "billingCycle": "termly",
    "currentPeriod": null,
    "currentPeriodLabel": null,
    "hasActiveTerm": false
  }
}
```

| Field | Notes |
|-------|-------|
| `billingCycle` | `"monthly"` or `"termly"` — from `tenants.fee_structure.structureType` |
| `currentPeriod` | `"YYYY-MM"` (monthly) or `term_id` string (termly). `null` if no active term |
| `currentPeriodLabel` | Human-readable label for UI display |
| `hasActiveTerm` | `null` when monthly (irrelevant); `true`/`false` when termly |

---

## POST /api/fee-rules/generate

Trigger the billing engine to generate charges for the given billing period.

**Roles**: `admin`, `bursar`

### Request Body

```json
{
  "billingPeriod": "2026-04"
}
```

```json
{
  "billingPeriod": "term-1-2025"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `billingPeriod` | string | ✅ | `"YYYY-MM"` for monthly schools; `term_id` for termly schools. Must match the school's configured billing cycle type — mismatches are rejected with 422. |

### Response 200

```json
{
  "status": "success",
  "data": {
    "billingPeriod": "2026-04",
    "chargesCreated": 47,
    "studentsBilled": 15,
    "studentsSkipped": 2,
    "totalAmount": 7050.00,
    "ruleBreakdown": [
      {
        "feeRuleId": "fr-abc123",
        "feeRuleName": "Tuition",
        "charged": 15,
        "skipped": 2,
        "subtotal": 2250.00
      },
      {
        "feeRuleId": "fr-def456",
        "feeRuleName": "Library Fee",
        "charged": 15,
        "skipped": 0,
        "subtotal": 300.00
      }
    ],
    "skippedDetails": [
      {
        "feeRuleId": "fr-abc123",
        "feeRuleName": "Tuition",
        "studentId": "stu-xyz",
        "studentName": "John Doe",
        "reason": "already_billed"
      }
    ]
  }
}
```

### Error Responses

| Status | Reason |
|--------|--------|
| 400 | `billingPeriod` is missing |
| 422 | `billingPeriod` type does not match the school's configured billing cycle (e.g., submitted `"YYYY-MM"` but school is termly) |
| 422 | No active term found for submitted termly period (term not in academic calendar) |
| 404 | No active fee rules found for tenant |
| 403 | Caller is not `admin` or `bursar` |
| 500 | Transaction failed — rolled back, no charges created |

### Behaviour Notes

- The entire run executes inside a single database transaction. If any exception occurs, **all** inserted charges are rolled back.
- Students who already have a charge for the same `(student_id, fee_rule_id, billing_period)` combination are skipped and counted in `studentsSkipped` / `skippedDetails` with `reason = "already_billed"`.
- Students with `status ≠ 'active'` are always excluded.
- A `school_wide` fee rule applies to all active students in the tenant.
- A `class`-scoped rule applies only to students with a matching `class_id`.
- A `category`-scoped rule applies to students whose `category` field matches `assignmentScopeId`.
- A `service`-scoped rule (P2) applies to students with an active `transport_assignment` for the billing period.

---

## GET /api/fee-rules/unbilled-alert

Returns the count of eligible students who have no charges for the current billing period. Used to render the billing tab notification badge.

**Roles**: `admin`, `bursar`

### Response 200 — monthly school, current period has unbilled students

```json
{
  "status": "success",
  "data": {
    "billingCycle": "monthly",
    "currentPeriod": "2026-04",
    "currentPeriodLabel": "April 2026",
    "unbilledCount": 8,
    "hasAlert": true
  }
}
```

### Response 200 — termly school, no active term

```json
{
  "status": "success",
  "data": {
    "billingCycle": "termly",
    "currentPeriod": null,
    "currentPeriodLabel": null,
    "unbilledCount": 0,
    "hasAlert": false
  }
}
```

### Response 200 — all students billed

```json
{
  "status": "success",
  "data": {
    "billingCycle": "monthly",
    "currentPeriod": "2026-04",
    "currentPeriodLabel": "April 2026",
    "unbilledCount": 0,
    "hasAlert": false
  }
}
```

| Field | Notes |
|-------|-------|
| `unbilledCount` | Count of active students who match at least one active fee rule but have no charge for the current period |
| `hasAlert` | `true` when `unbilledCount > 0` AND a valid current period exists |

### Behaviour Notes

- This endpoint is lightweight and expected to be called on every billing tab load.
- For termly schools with no active term, always returns `hasAlert: false` and `unbilledCount: 0`.
- Count is computed freshly on each request — not cached.
