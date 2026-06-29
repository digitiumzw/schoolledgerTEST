# API Contracts: Ledger and Payment System Refactor

**Branch**: `020-ledger-payment-refactor`
**Phase**: 1 — Design
**Date**: 2026-04-08

All endpoints:
- Require `Authorization: Bearer <token>` header
- Return `Content-Type: application/json`
- Return errors as `{"status": "error", "message": "..."}`
- Filter all data by `tenant_id` from JWT (never from request body)

---

## Modified Endpoints

### POST /api/payments
**Change**: Now uses `charge_type` instead of `is_fee_structure` for FIFO allocation. Response shape unchanged.

**Request Body**:
```json
{
  "studentId": "string (required)",
  "amount": "number > 0 and <= 1000000 (required)",
  "date": "string YYYY-MM-DD (required)",
  "method": "Cash|EcoCash|Bank Transfer|ZIPIT|Swipe|Cheque|Other (required)",
  "category": "string (optional)",
  "description": "string (optional)",
  "routeId": "string (optional — set for transport payments)"
}
```

**Response 201**:
```json
{
  "status": "success",
  "data": {
    "id": "string",
    "studentId": "string",
    "amount": "number",
    "date": "string",
    "method": "string",
    "category": "string",
    "month": "number (1-12, derived from date)",
    "description": "string|null",
    "routeId": "string|null",
    "createdAt": "string ISO-8601"
  }
}
```

**Errors**:
- `400` — validation failure (missing required field, invalid amount, invalid method, invalid date)
- `404` — student not found or not in tenant
- `500` — transaction failure

---

### GET /api/charges/check-exist
**Change**: Primary lookup now uses `charge_type` on charges; falls back to academic calendar for legacy data.

**Query Params**: `termId` (required)

**Response 200**:
```json
{
  "status": "success",
  "data": {
    "exists": true,
    "chargeCount": 142,
    "billingRunId": "string|null"
  }
}
```

---

### GET /api/ledger/student/:studentId/balance
**Change**: Response now includes `feeBalance` and `transportBalance` sub-totals.

**Response 200**:
```json
{
  "status": "success",
  "data": {
    "studentId": "string",
    "totalCharges": "number",
    "totalPayments": "number",
    "creditAdjustments": "number",
    "debitAdjustments": "number",
    "balance": "number",
    "feeBalance": "number",
    "transportBalance": "number"
  }
}
```

---

### GET /api/ledger/balances
**Change**: Response now includes `feeBalance` and `transportBalance` per student.

**Response 200**:
```json
{
  "status": "success",
  "data": [
    {
      "studentId": "string",
      "name": "string",
      "class": "string",
      "balance": "number",
      "feeBalance": "number",
      "transportBalance": "number"
    }
  ]
}
```

---

## New Endpoints: Billing Run

### GET /api/billing/preview
**Roles**: `bursar`, `admin`, `super_admin`

**Query Params**: `termId` (required)

**Response 200**:
```json
{
  "status": "success",
  "data": {
    "termId": "string",
    "academicYear": "string",
    "eligibleStudents": 120,
    "excludedStudents": 5,
    "excludedReasons": [
      {"studentId": "...", "reason": "zero-amount after bursary reduction"}
    ],
    "totalAmount": 15000.00,
    "breakdown": [
      {"category": "Tuition", "amount": 300.00, "students": 120, "subtotal": 36000.00},
      {"category": "Development", "amount": 50.00, "students": 118, "subtotal": 5900.00}
    ],
    "existingBillingRun": null
  }
}
```

**Errors**:
- `400` — termId missing
- `409` — a completed billing run already exists for this term

---

### GET /api/billing/status
**Roles**: `bursar`, `admin`, `super_admin`

**Query Params**: `termId` (required)

**Response 200**:
```json
{
  "status": "success",
  "data": {
    "termId": "string",
    "billingRunId": "string|null",
    "billingStatus": "none|pending|completed|voided",
    "totalStudents": 120,
    "totalAmount": 15000.00,
    "completedAt": "string ISO-8601|null",
    "voidedAt": "string ISO-8601|null"
  }
}
```

---

### POST /api/billing/finalize
**Roles**: `bursar`, `admin`, `super_admin`

**Request Body**:
```json
{
  "termId": "string (required)",
  "academicYear": "string (required, format: YYYY-YYYY)",
  "confirmed": true,
  "notes": "string (optional)"
}
```

**Response 201**:
```json
{
  "status": "success",
  "data": {
    "billingRunId": "string",
    "termId": "string",
    "totalStudents": 120,
    "totalAmount": 15000.00,
    "status": "completed"
  }
}
```

**Errors**:
- `400` — termId or academicYear missing; `confirmed` not true
- `409` — billing run already completed for this term (idempotency check)
- `500` — transaction failure; charges rolled back

---

### POST /api/billing/void
**Roles**: `bursar`, `admin`, `super_admin`

**Request Body**:
```json
{
  "billingRunId": "string (required — use billing run ID, not term ID)",
  "reason": "string (required)"
}
```

**Response 200**:
```json
{
  "status": "success",
  "data": {
    "billingRunId": "string",
    "chargesSoftDeleted": 142,
    "status": "voided"
  }
}
```

**Errors**:
- `400` — billingRunId or reason missing
- `409` — cannot void: payments have been recorded against charges in this billing run
- `404` — billing run not found

---

### GET /api/billing/unbilled-students
**Roles**: `bursar`, `admin`, `super_admin`

**Query Params**: `termId` (required)

**Response 200**:
```json
{
  "status": "success",
  "data": {
    "termId": "string",
    "unbilledStudents": [
      {"studentId": "...", "name": "...", "class": "..."}
    ],
    "count": 5
  }
}
```

---

### POST /api/billing/supplementary
**Roles**: `bursar`, `admin`, `super_admin`

**Request Body**:
```json
{
  "termId": "string (required)",
  "academicYear": "string (required)",
  "studentIds": ["string", "..."],
  "reason": "string (required — documents why supplementary billing needed)"
}
```

**Response 201**:
```json
{
  "status": "success",
  "data": {
    "billingRunId": "string",
    "studentsCharged": 5,
    "totalAmount": 750.00,
    "status": "completed"
  }
}
```

---

## New Endpoints: Reports

### GET /api/reports/payment-collection
**Roles**: `bursar`, `admin`, `super_admin`

**Query Params**: `termId` (required)

**Response 200**:
```json
{
  "status": "success",
  "data": {
    "termId": "string",
    "totalCharged": 150000.00,
    "totalCollected": 112500.00,
    "collectionRate": 75.0,
    "studentsFullyPaid": 85,
    "studentsWithBalance": 35,
    "studentsNotPaid": 5,
    "byStudent": [
      {
        "studentId": "...",
        "name": "...",
        "class": "...",
        "totalCharged": 350.00,
        "totalPaid": 350.00,
        "balance": 0.00,
        "status": "paid"
      }
    ]
  }
}
```

---

### GET /api/reports/aged-balances
**Roles**: `bursar`, `admin`, `super_admin`

**Query Params**: `termId` (required)

**Response 200**:
```json
{
  "status": "success",
  "data": {
    "termId": "string",
    "generatedAt": "string ISO-8601",
    "summary": {
      "current": {"count": 20, "totalBalance": 7000.00},
      "days1to30": {"count": 15, "totalBalance": 5250.00},
      "days31to60": {"count": 8, "totalBalance": 2800.00},
      "days61to90": {"count": 5, "totalBalance": 1750.00},
      "days90plus": {"count": 3, "totalBalance": 1050.00}
    },
    "students": [
      {
        "studentId": "...",
        "name": "...",
        "class": "...",
        "oldestDueDate": "2026-02-01",
        "daysOverdue": 65,
        "bucket": "days61to90",
        "outstandingBalance": 350.00
      }
    ]
  }
}
```

---

### GET /api/reports/revenue-by-category
**Roles**: `bursar`, `admin`, `super_admin`

**Query Params**: `termId` (required), `category` (optional filter)

**Response 200**:
```json
{
  "status": "success",
  "data": {
    "termId": "string",
    "categories": [
      {
        "category": "Tuition",
        "totalCharged": 36000.00,
        "totalCollected": 28000.00,
        "collectionRate": 77.8,
        "outstanding": 8000.00
      },
      {
        "category": "Development",
        "totalCharged": 5900.00,
        "totalCollected": 5900.00,
        "collectionRate": 100.0,
        "outstanding": 0.00
      }
    ]
  }
}
```

---

## Modified Endpoint: GET /api/payments/student/:studentId/term-total

**Change**: Now accepts optional `termId` query param. Falls back to current-term detection via academic calendar (not hardcoded months).

**Query Params**: `termId` (optional)

**Response 200** (unchanged shape):
```json
{
  "status": "success",
  "data": {
    "studentId": "string",
    "termId": "string",
    "totalPaid": 350.00
  }
}
```

---

## Error Response Standard

All endpoints return errors in this shape:

```json
{
  "status": "error",
  "message": "Human-readable description",
  "code": "MACHINE_READABLE_CODE (optional)"
}
```

Common codes: `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, `FORBIDDEN`, `INTERNAL_ERROR`
