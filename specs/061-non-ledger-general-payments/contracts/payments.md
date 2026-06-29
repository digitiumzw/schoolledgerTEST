# API Contracts: Payments (Non-Ledger General Payments)

**Branch**: `061-non-ledger-general-payments`
**Date**: 2026-05-04

---

## Modified: POST /api/payments

Records a payment for a student. Supports both single-category (existing shape) and multi-category (new `categories` array).

### Single-Category Request (unchanged, backward-compatible)

```json
POST /api/payments
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "studentId": "s_abc",
  "amount": 100.00,
  "date": "2026-05-04",
  "method": "Cash",
  "category": "Fees",
  "description": ""
}
```

### Multi-Category Request (new)

```json
POST /api/payments
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "studentId": "s_abc",
  "amount": 50.00,
  "date": "2026-05-04",
  "method": "Cash",
  "description": "Combined levy",
  "categories": [
    { "categoryName": "Stationery", "amount": 30.00 },
    { "categoryName": "School Trip", "amount": 20.00 }
  ]
}
```

**Validation rules**:
- `amount` MUST equal `SUM(categories[*].amount)` — HTTP 422 if mismatch.
- All `categories[*].categoryName` MUST be either all system names OR all user-defined names — HTTP 422 if mixed.
- When `categories` is absent, the single-category path runs using `category` field (existing behaviour).
- `categories` array MUST NOT be empty if present.

### Success Response (single-category — unchanged)

```json
HTTP 201 Created
{
  "status": "success",
  "data": {
    "id": "p_abc",
    "studentId": "s_abc",
    "amount": 100.00,
    "date": "2026-05-04",
    "method": "Cash",
    "category": "Fees",
    "receiptNumber": "2026.05.04.143000.1",
    "balanceAfterPayment": 150.00,
    "isGeneralPayment": false,
    "paymentGroupId": null
  },
  "message": "Payment recorded"
}
```

### Success Response (multi-category — new)

Returns the **first** row of the group; frontend uses `receiptNumber` to fetch the full group receipt.

```json
HTTP 201 Created
{
  "status": "success",
  "data": {
    "id": "p_abc",
    "studentId": "s_abc",
    "amount": 30.00,
    "date": "2026-05-04",
    "method": "Cash",
    "category": "Stationery",
    "receiptNumber": "2026.05.04.143000.1",
    "balanceAfterPayment": null,
    "isGeneralPayment": true,
    "paymentGroupId": "grp_xyz"
  },
  "message": "Payment recorded"
}
```

### Error Responses

| Condition | Status | Message |
|-----------|--------|---------|
| Mixed system + user-defined categories | 422 | "Cannot mix system and user-defined categories in one transaction" |
| Category allocations do not sum to total | 422 | "Category allocations must sum to the total amount" |
| Student not found | 404 | "Student not found or does not belong to your organisation" |
| Invalid amount | 400 | "Amount must be greater than zero" |

---

## Modified: GET /api/receipts/:paymentId

Returns receipt data for a payment. If the payment belongs to a `payment_group_id`, returns aggregate data for the full group.

### Response (non-ledger / general payment — updated)

```json
HTTP 200 OK
{
  "status": "success",
  "data": {
    "payment": {
      "id": "p_abc",
      "receiptNumber": "2026.05.04.143000.1",
      "amount": 50.00,
      "date": "2026-05-04",
      "method": "Cash",
      "category": "Stationery",
      "description": "Combined levy",
      "balanceAfterPayment": null,
      "snapshot": null,
      "isGeneralPayment": true,
      "paymentGroupId": "grp_xyz",
      "categoryLines": [
        { "category": "Stationery", "amount": 30.00 },
        { "category": "School Trip", "amount": 20.00 }
      ]
    },
    "student": {
      "firstName": "Alice",
      "lastName": "Moyo",
      "admissionNumber": "ADM-001",
      "className": "Form 2A"
    },
    "school": {
      "name": "Riverside High School"
    }
  }
}
```

**Note**: `balanceAfterPayment: null` and `snapshot: null` for all non-ledger payments — the receipt document omits the balance block when these are null (existing `ReceiptDocument.tsx` guard).

---

## No New Routes Required

All changes are additive modifications to existing endpoints. No new routes are added. The existing route `POST /api/payments` handles both single and multi-category via payload shape detection.
