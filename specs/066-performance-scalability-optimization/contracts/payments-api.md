# API Contract: Payments (Paginated)

**Route**: `GET /api/payments/with-students`  
**Controller**: `PaymentController::withStudents()`  
**Auth**: JWT required (`admin`, `bursar`)

---

## Query Parameters

| Parameter | Type | Default | Validation | Description |
|---|---|---|---|---|
| `page` | int | 1 | ≥ 1 | Page number |
| `limit` | int | 20 | 1–100 | Records per page |
| `search` | string | — | max 100 chars | Matches student first name, last name |
| `method` | string | — | must be valid method or omitted | Filter by payment method |
| `category` | string | — | — | Filter by payment category name |
| `classId` | string | — | valid class ID or omitted | Filter by student's class |
| `month` | int | — | 1–12 | Filter by payment month |
| `year` | int | — | 4-digit year | Filter by payment year |
| `sortBy` | string | `date` | `date` \| `amount` \| `studentName` | Sort field |
| `sortOrder` | string | `desc` | `asc` \| `desc` | Sort direction |

---

## Response — 200 OK

```json
{
  "status": "success",
  "data": {
    "data": [
      {
        "id": "pay_abc123",
        "studentId": "s_xyz",
        "tenantId": "t_001",
        "amount": 150.00,
        "date": "2026-05-01",
        "method": "EcoCash",
        "description": "Term 2 fees",
        "category": "Fees",
        "receiptNumber": "2026.05.01.093045.1",
        "balanceAfterPayment": 50.00,
        "isGeneralPayment": false,
        "feeCampaignId": null,
        "student": {
          "id": "s_xyz",
          "firstName": "Alice",
          "lastName": "Moyo",
          "classId": "cls_001",
          "balance": 50.00
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 547,
      "totalPages": 28
    },
    "stats": {
      "totalThisMonth": 12500.00,
      "paymentsToday": 3,
      "totalOutstanding": 48200.00
    }
  }
}
```

## Response — 400 Bad Request

```json
{
  "status": "error",
  "message": "Invalid month value. Must be 1–12.",
  "errors": {}
}
```

## Response — 401 Unauthorized

```json
{ "status": "error", "message": "Unauthorized" }
```

---

## Notes

- `totalOutstanding` in `stats` is computed as `SUM(eligible_charges) + SUM(approved_debit_adjustments) - SUM(eligible_payments) - SUM(approved_credit_adjustments)` using `LedgerService::ELIGIBLE_CHARGE_TYPES` and `LedgerService::ELIGIBLE_PAYMENT_CATEGORIES` constants (same logic as `LedgerService::getAllBalances()`).
- `totalThisMonth` is the sum of all payments for the current calendar month (regardless of filters).
- `paymentsToday` is the count of payments with `date = CURDATE()` (regardless of filters).
- The `data` array IS filtered and paginated. The stats fields are always tenant-wide aggregates.
- Existing callers of this endpoint that expected a flat array will need to be updated to read `response.data.data` instead of `response.data`.
