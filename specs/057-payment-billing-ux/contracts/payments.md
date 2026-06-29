# API Contract: Payments

**Feature**: `057-payment-billing-ux`  
**Scope**: Changes to `POST /api/payments` and `GET /api/receipts/:id`

---

## POST /api/payments — Record Payment

### Changes from current

1. **`receiptNumber`** is now generated server-side and returned in the response.
2. **`snapshot`** is now stored and returned in the response.
3. Request body is **unchanged** — no new required fields.

### Request

```
POST /api/payments
Authorization: Bearer <jwt>
Content-Type: application/json
```

```json
{
  "studentId":   "stu_abc123",
  "amount":      80.00,
  "date":        "2026-05-04",
  "method":      "Cash",
  "category":    "Fees",
  "description": "Term 2 fees",
  "routeId":     null
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `studentId` | string | yes | Must belong to tenant |
| `amount` | number | yes | > 0, ≤ 1,000,000 |
| `date` | string | yes | ISO `YYYY-MM-DD` |
| `method` | string | yes | One of `VALID_METHODS` |
| `category` | string | no | Defaults to `"Fees"` |
| `description` | string | no | Free text |
| `routeId` | string\|null | no | Set for transport payments |

### Response `201 Created`

```json
{
  "success": true,
  "data": {
    "id":                  "p1746300123_abc12345",
    "tenantId":            "ten_xyz",
    "studentId":           "stu_abc123",
    "amount":              80.00,
    "date":                "2026-05-04",
    "method":              "Cash",
    "description":         "Term 2 fees",
    "category":            "Fees",
    "month":               5,
    "routeId":             null,
    "balanceAfterPayment": 40.00,
    "receiptNumber":       "2026.05.04.143022.K",
    "snapshot": {
      "studentName":   "Alice Moyo",
      "className":     "Form 3A",
      "balanceBefore": 120.00,
      "paymentMethod": "Cash",
      "paymentDate":   "2026-05-04",
      "amount":        80.00,
      "category":      "Fees"
    }
  }
}
```

### Error responses (unchanged)

| Status | Condition |
|---|---|
| 400 | Missing required fields, invalid amount, invalid method, invalid date |
| 404 | Student not found or not in tenant |
| 500 | Transaction failure |

### Server-side generation logic

```
receiptNumber = date('Y.m.d.His') . '.' . chr(random_int(65, 90))
```

The `snapshot` is assembled **before** the payment insert inside the same DB transaction:
1. Fetch student record (name, `class_id`).
2. Fetch class name via `class_id`.
3. Fetch ledger balance (`LedgerService::getStudentBalance`) — this is `balanceBefore`.
4. Insert payment row with `receipt_number` and `snapshot` fields populated.
5. Run `allocatePaymentToCharges`.
6. Snapshot `balance_after_payment`.
7. Commit.

---

## GET /api/receipts/:id — Fetch Receipt

### Changes from current

1. Response now includes `receiptNumber` (from `payments.receipt_number`).
2. `payment.snapshot` is included in the response when present.
3. `ReceiptController` prefers `snapshot.className` over the live JOIN result; falls back to live JOIN for legacy rows.

### Request

```
GET /api/receipts/:paymentId
```

No authentication required (public endpoint — same as current).

### Response `200 OK`

```json
{
  "success": true,
  "data": {
    "payment": {
      "id":                  "p1746300123_abc12345",
      "tenantId":            "ten_xyz",
      "studentId":           "stu_abc123",
      "amount":              80.00,
      "date":                "2026-05-04",
      "method":              "Cash",
      "description":         "Term 2 fees",
      "category":            "Fees",
      "month":               5,
      "routeId":             null,
      "balanceAfterPayment": 40.00,
      "receiptNumber":       "2026.05.04.143022.K",
      "snapshot": {
        "studentName":   "Alice Moyo",
        "className":     "Form 3A",
        "balanceBefore": 120.00,
        "paymentMethod": "Cash",
        "paymentDate":   "2026-05-04",
        "amount":        80.00,
        "category":      "Fees"
      }
    },
    "student": {
      "id":        "stu_abc123",
      "firstName": "Alice",
      "lastName":  "Moyo",
      "className": "Form 3A"
    },
    "school": {
      "name": "Sunrise Academy"
    }
  }
}
```

**`student.className`**: When `payment.snapshot` is present, this field is overridden with `snapshot.className` by the controller before sending the response. This ensures receipts reflect the class name at the time of payment.

### Error responses (unchanged)

| Status | Condition |
|---|---|
| 404 | Payment not found |
