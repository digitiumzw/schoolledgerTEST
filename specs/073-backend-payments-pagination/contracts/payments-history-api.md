# Contract: Payments History API

**Feature**: 073-backend-payments-pagination  
**Base Path**: `/api`  
**Response Envelope**: All responses use the existing `{ status, data, message }` success envelope or `{ status, message, errors }` error envelope.

## GET /payments/with-students

Returns backend-filtered, backend-sorted, paginated payment history for the main payments table.

### Query Parameters

- `page` optional positive integer, default `1`.
- `limit` optional positive integer, backend bounded.
- `search` optional string. Searches supported payment/student fields.
- `method` optional string or `all`.
- `category` optional string, `all`, or empty category marker used by the frontend.
- `classId` optional class identifier or `all`.
- `month` optional `1`-`12` or `all`.
- `year` optional positive year or `all`.
- `dateFrom` optional `YYYY-MM-DD`.
- `dateTo` optional `YYYY-MM-DD`.
- `paymentType` optional allowlisted payment classification when implemented.
- `sortBy` optional allowlisted field: `date`, `amount`, `studentName`, `method`, `category`, `receiptNumber`.
- `sortOrder` optional `asc` or `desc`.

### Success Data Shape

```json
{
  "data": [
    {
      "id": "p_123",
      "tenantId": "tenant_1",
      "studentId": "student_1",
      "amount": 100.0,
      "date": "2026-05-13",
      "method": "Cash",
      "description": "Term payment",
      "category": "Fees",
      "receiptNumber": "2026.05.13.160000.A",
      "feeCampaignId": null,
      "isGeneralPayment": false,
      "paymentGroupId": null,
      "balanceAfterPayment": 50.0,
      "student": {
        "id": "student_1",
        "firstName": "Jane",
        "lastName": "Doe",
        "admissionNumber": "ADM001",
        "classId": "class_1",
        "className": "Form 1A"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 125,
    "totalPages": 7
  },
  "summary": {
    "totalAmount": 10000.0,
    "totalCount": 125,
    "totalThisMonth": 2500.0,
    "paymentsToday": 6,
    "totalOutstanding": 1152.0,
    "byMethod": [],
    "byCategory": []
  },
  "filters": {
    "search": "Jane",
    "sortBy": "date",
    "sortOrder": "desc"
  }
}
```

### Rules

- `data` must contain only the requested page.
- `pagination.total` and `summary` must reflect the full filtered dataset.
- All rows, counts, and summaries must be tenant-scoped from the authenticated token.
- Unsupported sort fields must be rejected or normalized predictably.

### Error Cases

- `400` for invalid month, date range, limit, page, payment type, or sort direction.
- `401` for missing/invalid authentication.
- `403` for roles not allowed to view payment history.

## GET /payments/student/{studentId}

Returns backend-filtered, backend-sorted, paginated payment history for one student. This replaces any related frontend behavior that fetches all student payments and locally sorts, slices, or totals them.

### Query Parameters

- `page` optional positive integer, default `1`.
- `limit` optional positive integer, backend bounded.
- `sortBy` optional allowlisted field, default `date`.
- `sortOrder` optional `asc` or `desc`, default `desc`.
- `dateFrom` optional `YYYY-MM-DD`.
- `dateTo` optional `YYYY-MM-DD`.
- `category` optional string or `all`.
- `method` optional string or `all`.

### Success Data Shape

```json
{
  "student": {
    "id": "student_1",
    "firstName": "Jane",
    "lastName": "Doe",
    "admissionNumber": "ADM001",
    "classId": "class_1",
    "className": "Form 1A",
    "currentBalance": 50.0
  },
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 15,
    "total": 0,
    "totalPages": 0
  },
  "summary": {
    "totalPaid": 0.0,
    "totalThisTerm": 0.0,
    "latestPaymentDate": null,
    "daysSinceLastPayment": null
  }
}
```

### Rules

- Must verify the student belongs to the authenticated tenant before returning history.
- Must not require a separate full-history request for total paid, last payment, or modal pagination.
- May preserve existing term-total and balance endpoints for backward compatibility, but new UI behavior should consume this processed response.

### Error Cases

- `400` for invalid filters.
- `401` for missing/invalid authentication.
- `403` for unauthorized role.
- `404` when the student is not found in the authenticated tenant.

## GET /payments/recent

Returns a bounded list of recent payments. This endpoint must remain bounded and must not be used as a substitute for full-history table loading.

### Query Parameters

- `limit` optional positive integer with backend maximum.

### Rules

- Always tenant-scoped.
- No client-side pagination assumptions.

## GET /payments/{id}

Returns one payment detail for receipt/detail use.

### Rules

- Must be tenant-scoped.
- Must include enough detail for receipt display without requiring a full payment-history fetch.
- For grouped payments, receipt consumers may receive grouped category lines from the receipt contract rather than constructing them from all payment rows.
