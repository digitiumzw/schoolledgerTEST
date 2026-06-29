# API Contract: Ledger Balance Filtering

This feature changes calculation semantics for existing API responses. It does not introduce new endpoints.

## Authentication and Tenant Scope

All endpoints are under `/api/*` and require Bearer JWT authentication through existing filters. Tenant scope must come from the decoded JWT payload. Clients must not provide `tenant_id` to influence balance results.

## Affected Endpoints

### GET /api/students/{studentId}/balance

Returns the authoritative balance for one student.

Expected success envelope:

```json
{
  "status": "success",
  "data": {
    "studentId": "student-id",
    "totalCharges": 1000.0,
    "totalPayments": 300.0,
    "creditAdjustments": 50.0,
    "debitAdjustments": 25.0,
    "balance": 675.0,
    "feeBalance": 0.0,
    "transportBalance": 0.0
  },
  "message": ""
}
```

Calculation semantics:

```text
balance = totalCharges + debitAdjustments - totalPayments - creditAdjustments
```

Where:

- `totalCharges` includes only `fee_structure` and `transport` charge types for the student and tenant.
- `totalPayments` includes only `Fees`, `Transport + Fees`, and `Transport Fee` payment categories for the student and tenant.
- `debitAdjustments` includes only approved debit adjustments for the student and tenant.
- `creditAdjustments` includes only approved credit adjustments for the student and tenant.

### GET /api/ledger/student/{studentId}/balance

Same response semantics as `GET /api/students/{studentId}/balance`. This route delegates to the same ledger balance authority and must return the same numeric values for the same student.

### GET /api/reconciliation/student/{studentId}/balance

Returns a reconciliation-oriented balance breakdown.

Expected success envelope:

```json
{
  "status": "success",
  "data": {
    "studentId": "student-id",
    "totalCharges": 1000.0,
    "totalPayments": 300.0,
    "creditAdjustments": 50.0,
    "debitAdjustments": 25.0,
    "netAdjustments": -25.0,
    "balance": 675.0
  },
  "message": ""
}
```

`netAdjustments` remains `debitAdjustments - creditAdjustments`.

### POST /api/reconciliation/recalculate-balance

Request:

```json
{
  "studentId": "student-id"
}
```

Expected success envelope:

```json
{
  "status": "success",
  "data": {
    "studentId": "student-id",
    "calculatedBalance": 675.0,
    "message": "Balance recalculated successfully"
  },
  "message": ""
}
```

`calculatedBalance` must match the `balance` returned by the single-student balance endpoints for the same student.

### GET /api/ledger/balances

Returns balances for active students in the tenant using bulk query semantics.

Each row must use the same eligibility filters as the single-student endpoint:

```json
{
  "studentId": "student-id",
  "studentName": "Student Name",
  "classId": "class-id",
  "totalCharges": 1000.0,
  "totalPayments": 300.0,
  "creditAdjustments": 50.0,
  "debitAdjustments": 25.0,
  "balance": 675.0,
  "feeBalance": 0.0,
  "transportBalance": 0.0
}
```

### Student list endpoints with balance fields

Any endpoint returning `students[].balance`, balance-only counts, or balance-based summary values must use the same eligibility filters:

- `charge_type IN ('fee_structure', 'transport')`
- `category IN ('Fees', 'Transport + Fees', 'Transport Fee')`
- approved adjustments only
- same student and tenant only

## Error Responses

Existing error envelopes remain unchanged:

```json
{
  "status": "error",
  "message": "Student not found",
  "errors": {}
}
```

## Compatibility Requirements

- No endpoint path changes.
- No required request payload changes.
- Response fields remain present for existing consumers.
- Numeric values change only because eligibility filters are corrected.
