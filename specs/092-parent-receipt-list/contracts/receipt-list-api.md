# API Contract: Receipt List Endpoint

**Feature**: 092-parent-receipt-list
**Date**: 2026-06-25

## Endpoint

### GET /api/receipts/student/:studentId

Public endpoint (no JWT required). Returns a paginated list of payment receipt summaries for a single student, sorted by payment date descending.

**Path Parameters**:
- `studentId` (string, required) — globally unique student identifier

**Query Parameters**:
- `page` (integer, optional, default: 1) — page number, must be ≥ 1
- `limit` (integer, optional, default: 20, max: 100) — entries per page

**Response (200 OK)**:
```json
{
  "status": true,
  "message": "Success",
  "data": {
    "receipts": [
      {
        "id": "pay_1234567890_abcdef12",
        "amount": 150.00,
        "date": "2026-06-15",
        "method": "Cash",
        "category": "Fees",
        "description": "Term 2 fees",
        "receiptNumber": "2026.06.15.143022.K",
        "isGeneralPayment": false,
        "paymentGroupId": null,
        "isVoided": false,
        "voidedAt": null,
        "voidReason": null
      }
    ],
    "student": {
      "id": "s1782381468_62ac4e51",
      "firstName": "John",
      "lastName": "Doe",
      "admissionNumber": "ADM001",
      "className": "Grade 10A"
    },
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 47,
      "totalPages": 3,
      "last_page": 3
    }
  }
}
```

**Error Responses**:

- **404 Not Found**: Student ID does not exist
```json
{
  "status": false,
  "message": "Student not found"
}
```

- **400 Bad Request**: Invalid pagination parameter
```json
{
  "status": false,
  "message": "Invalid page value. Must be a positive integer."
}
```
```json
{
  "status": false,
  "message": "Invalid limit value. Must be between 1 and 100."
}
```

## Multi-Category Grouping

When multiple payment rows share the same `payment_group_id`, they appear as a single entry in the `receipts` array:
- `amount`: sum of all grouped rows' amounts
- `category`: comma-separated list of categories (e.g., "Fees, Transport Fee")
- `id`: the MIN(id) of the grouped rows (used as the link target for individual receipt view)

## Voided Payments

Voided payments are included in the list with:
- `isVoided`: true
- `voidedAt`: ISO datetime string
- `voidReason`: string or null

They appear in chronological position (sorted by date) with visual distinction in the frontend.

## Security

- No JWT authentication required (public endpoint)
- Student ID is globally unique (contains random hex suffix) — not guessable
- All queries are scoped by both `student_id` and the `tenant_id` resolved from the student record
- No cross-student or cross-tenant data is returned
