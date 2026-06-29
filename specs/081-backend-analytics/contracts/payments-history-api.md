# Contract: Payments History and Related Reporting API

## Purpose

Defines the backend-prepared contract for payment history, payment detail, and related reporting views that must remain scalable and authoritative.

## Endpoints in scope

### GET `/api/payments/with-students`

Returns a paginated payment history page with backend summary metadata.

#### Supported query parameters
- `page`
- `limit`
- `search`
- `method`
- `category`
- `classId`
- `month`
- `year`
- `dateFrom`
- `dateTo`
- `paymentType`
- `sortBy`
- `sortOrder`

#### Expected response
```json
{
  "status": "success",
  "data": [
    {
      "id": "pay_123",
      "amount": 100,
      "date": "2026-05-22",
      "method": "cash",
      "category": "fees",
      "student": {
        "id": "stu_1",
        "firstName": "Jane",
        "lastName": "Doe",
        "admissionNumber": "A001"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 123,
    "totalPages": 7
  },
  "summary": {
    "totalCount": 123,
    "totalAmount": 4567.89
  },
  "stats": {
    "totalThisMonth": 1200,
    "paymentsToday": 5,
    "totalOutstanding": 300
  }
}
```

#### Contract expectations
- The backend must return only one requested page of rows.
- Summary values must reflect the full filtered dataset.
- The frontend must not load the complete history and slice it locally.

### GET `/api/payments/student/{studentId}`

Returns a paginated payment history for one student.

#### Supported query parameters
- `page`
- `limit`
- `search`
- `month`
- `year`
- `dateFrom`
- `dateTo`
- `sortBy`
- `sortOrder`

#### Expected response
- Same pagination contract as `/api/payments/with-students`, plus student display metadata.

#### Contract expectations
- The backend must scope the result to the requested student and tenant.
- The frontend must not compute student payment summaries from local arrays.

## Rules

- Search, filter, and sort must be evaluated on the backend.
- Paginated results and summaries must always match.
- Related screens such as receipts and reconciliation must request only the minimum detail needed for their current view.
- Response payloads should avoid repeated lookups and avoid returning unneeded rows.
