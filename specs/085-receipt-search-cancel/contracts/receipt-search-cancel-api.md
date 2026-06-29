# API Contract: Receipt Search and Cancel

**Feature**: 085-receipt-search-cancel
**Date**: 2026-05-30

---

## 1. Search Payments by Receipt Number

### `GET /api/payments/with-students`

Already exists. This contract documents how the receipt search feature uses it.

**Query Parameters** (additions/overrides for receipt search):

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `search` | string | NO | Partial receipt number (e.g., `2026.05.30`) or full receipt number. Already LIKE-matches `p.receipt_number` among other fields. |
| `page` | integer | NO | Page number (default: 1) |
| `limit` | integer | NO | Items per page (default: 20, max: 100) |
| `sortBy` | string | NO | `receiptNumber` to sort by receipt number |
| `sortOrder` | string | NO | `asc` or `desc` |

**Request Example**:
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/payments/with-students?search=2026.05.30&sortBy=receiptNumber&sortOrder=desc"
```

**Response** (existing envelope, augmented with void status):
```json
{
  "status": "success",
  "data": {
    "data": [
      {
        "id": "p_abc123",
        "tenantId": "t_001",
        "studentId": "s_001",
        "amount": 150.00,
        "date": "2026-05-30",
        "method": "Cash",
        "category": "Fees",
        "receiptNumber": "2026.05.30.143012.A",
        "isVoided": false,
        "voidedAt": null,
        "voidReason": null,
        "student": {
          "id": "s_001",
          "firstName": "John",
          "lastName": "Doe",
          "admissionNumber": "ADM001",
          "className": "10A"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    },
    "summary": { ... },
    "stats": { ... }
  }
}
```

**New/Modified Fields in Payment Row**:
- `isVoided` (boolean): `true` when `voided_at` is not null
- `voidedAt` (string|null): ISO 8601 datetime or null
- `voidReason` (string|null): Reason for void

---

## 2. Cancel / Void a Payment

### `POST /api/payments/:id/void`

**Authentication**: JWT required  
**Authorization**: `admin` or `bursar` role only

**Request Body**:
```json
{
  "reason": "Duplicate entry — reversed by bursar"
}
```

**Validation**:
- `reason` is required, non-empty string, max 500 characters
- Payment must exist and belong to the requesting user's tenant
- Payment must not already be voided (`voided_at IS NULL`)
- If payment has `payment_group_id`, all sibling rows sharing the same group ID are voided atomically

**Response — Success (200)**:
```json
{
  "status": "success",
  "data": {
    "paymentId": "p_abc123",
    "receiptNumber": "2026.05.30.143012.A",
    "voidedAt": "2026-05-30T14:35:00Z",
    "voidReason": "Duplicate entry — reversed by bursar",
    "voidedBy": "u_admin001",
    "studentId": "s_001",
    "recalculatedBalance": 167.00,
    "groupedRowsVoided": 2
  },
  "message": "Receipt canceled and payment voided successfully."
}
```

**Response — Error: Missing Reason (400)**:
```json
{
  "status": "error",
  "message": "A reason is required to void a payment."
}
```

**Response — Error: Already Voided (409)**:
```json
{
  "status": "error",
  "message": "This payment has already been voided."
}
```

**Response — Error: Not Found (404)**:
```json
{
  "status": "error",
  "message": "Payment not found."
}
```

**Response — Error: Unauthorized Role (403)**:
```json
{
  "status": "error",
  "message": "You do not have permission to void payments."
}
```

---

## 3. View Receipt (with Void Status)

### `GET /api/receipts/:paymentId`

Already exists (public, no JWT). This contract documents the void-related fields added to the response.

**Response — Active Receipt** (existing shape, unchanged):
```json
{
  "status": "success",
  "data": {
    "payment": { ... },
    "student": { ... },
    "school": { "name": "Greenwood Academy" }
  }
}
```

**Response — Voided Receipt** (augmented with void fields):
```json
{
  "status": "success",
  "data": {
    "payment": {
      "id": "p_abc123",
      "amount": 150.00,
      "receiptNumber": "2026.05.30.143012.A",
      "isVoided": true,
      "voidedAt": "2026-05-30T14:35:00Z",
      "voidReason": "Duplicate entry — reversed by bursar",
      "voidedBy": "u_admin001",
      "balanceAfterPayment": null,
      "categoryLines": [...]
    },
    "student": { ... },
    "school": { "name": "Greenwood Academy" }
  }
}
```

**Visual contract for receipt view**: When `isVoided === true`, the receipt MUST render:
- A prominent red "CANCELED / INVALID" banner at the top
- Void date in local format
- Void reason text
- All monetary amounts struck through or grayed out

---

## 4. Payment Summary / Stats (void-aware)

The existing `GET /api/payments/with-students` summary and stats endpoints MUST exclude voided payments from financial totals:

- `totalAmount` — sum of active (non-voided) payments only
- `totalCount` — count of active payment transactions only
- `totalThisMonth` — active payments this month only
- `paymentsToday` — active payments today only
- `totalOutstanding` — ledger-based outstanding (already excludes voided via LedgerService fix)

The `byMethod` and `byCategory` breakdowns MUST also exclude voided payments.
