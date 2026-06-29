# API Contracts: Campaign Receipt & Payments Integration

**Feature**: 062-campaign-receipt-payments  
**Date**: 2026-05-05

> All endpoints already exist. This document describes the **contracts as they will behave after this feature is implemented** — specifically the fields added or changed in the response shapes.

All authenticated endpoints require `Authorization: Bearer <JWT>` where the token encodes `tenant_id` and `role`. Roles that may call write endpoints: `super_admin`, `admin`, `bursar`.

---

## 1. `POST /api/fee-campaigns/:campaignId/students`

Add a student manually to an active campaign.

### Request

```http
POST /api/fee-campaigns/{campaignId}/students
Authorization: Bearer <token>
Content-Type: application/json

{
  "studentId": "stu_b1"
}
```

### Success — 201 Created

```json
{
  "status": "success",
  "data": {
    "id":             "cs_xxxxxxxxxxx",
    "tenantId":       "tenant_abc",
    "feeCampaignId":  "fc_xxxxxxxxxxx",
    "studentId":      "stu_b1",
    "expectedAmount": 50.00,
    "paidAmount":     0.00,
    "remainingAmount": 50.00,
    "status":         "unpaid",
    "createdAt":      "2026-05-05T10:00:00Z"
  },
  "message": ""
}
```

### Error Cases

| Condition | HTTP | `message` |
|-----------|------|-----------|
| Student already in campaign | 400 | `"Student is already assigned to this campaign"` |
| Campaign is closed | 409 | `"Cannot add students to a closed campaign"` |
| Student belongs to different tenant | 404 | `"Student not found"` |
| Campaign not found | 404 | `"Campaign not found"` |
| Missing `studentId` | 400 | `"studentId is required"` |
| Unauthenticated | 401 | `"Unauthorized"` |
| Wrong role | 403 | `"Forbidden"` |

---

## 2. `POST /api/fee-campaigns/:campaignId/record-payment`

Record a payment against a student's campaign record. **After this feature**: snapshot and receipt number are guaranteed to be populated.

### Request

```http
POST /api/fee-campaigns/{campaignId}/record-payment
Authorization: Bearer <token>
Content-Type: application/json

{
  "studentId": "stu_b1",
  "amount":    30.00,
  "method":    "Cash",
  "date":      "2026-05-05"
}
```

**Valid `method` values**: `Cash`, `EcoCash`, `Bank Transfer`, `Mukuru`, `InnBucks`, `OneMoney`, `Telecash`, `Swipe`, `ZIPIT`, `Other`

### Success — 201 Created

```json
{
  "status": "success",
  "data": {
    "payment": {
      "id":            "pay_xxxxxxxxxxx",
      "amount":        30.00,
      "receiptNumber": "2026.05.05.100000.K"
    },
    "campaignStudent": {
      "id":             "cs_xxxxxxxxxxx",
      "studentId":      "stu_b1",
      "feeCampaignId":  "fc_xxxxxxxxxxx",
      "expectedAmount": 50.00,
      "paidAmount":     30.00,
      "remainingAmount": 20.00,
      "status":         "partially_paid"
    }
  },
  "message": ""
}
```

**Guarantee introduced by feature 062**: the `payments` row for this payment will have:
- `receipt_number` non-null (format `YYYY.MM.DD.HHmmss.X`)
- `snapshot` non-null (JSON object with all fields from the snapshot shape in `data-model.md`)

### Error Cases

| Condition | HTTP | `message` |
|-----------|------|-----------|
| Student not assigned to campaign | 404 | `"Student is not assigned to this campaign"` |
| Student fully paid | 400 | `"Student has already fully paid"` |
| Amount exceeds remaining | 400 | `"Amount exceeds remaining balance of X.XX"` |
| Amount ≤ 0 | 400 | `"Amount must be greater than zero"` |
| Campaign is closed | 409 | `"Cannot record payment on a closed campaign"` |
| Campaign not found | 404 | `"Campaign not found"` |
| Invalid payment method | 400 | `"Invalid payment method"` |
| Missing required fields | 400 | `"Missing required fields: ..."` |

---

## 3. `GET /api/receipts/:paymentId`

Retrieve a receipt for any payment, including campaign payments. **After this feature**: campaign payments return campaign-specific balance (not general ledger balance).

Public endpoint — no JWT required (enables QR code scanning by parents).

### Request

```http
GET /api/receipts/{paymentId}
```

### Success — 200 OK (campaign payment)

```json
{
  "status": "success",
  "data": {
    "payment": {
      "id":                  "pay_xxxxxxxxxxx",
      "studentId":           "stu_b1",
      "amount":              30.00,
      "date":                "2026-05-05",
      "method":              "Cash",
      "category":            "Grade 7 Exam Fee",
      "feeCampaignId":       "fc_xxxxxxxxxxx",
      "receiptNumber":       "2026.05.05.100000.K",
      "balanceAfterPayment": 20.00,
      "snapshot": {
        "studentName":    "Jane Doe",
        "className":      "Grade 7A",
        "campaignName":   "Grade 7 Exam Fee",
        "expectedAmount": 50.00,
        "paidBefore":     0.00,
        "amountPaid":     30.00,
        "remainingAfter": 20.00,
        "paymentMethod":  "Cash",
        "paymentDate":    "2026-05-05"
      }
    },
    "student": {
      "id":        "stu_b1",
      "firstName": "Jane",
      "lastName":  "Doe",
      "className": "Grade 7A"
    },
    "school": {
      "name": "Springfield Primary"
    }
  },
  "message": ""
}
```

**Key contract change**: for campaign payments (`feeCampaignId` non-null), `balanceAfterPayment` equals `snapshot.remainingAfter` (the campaign remaining balance), **not** the student's general fee ledger balance.

### Error Cases

| Condition | HTTP | `message` |
|-----------|------|-----------|
| Payment ID not found | 404 | `"Receipt not found"` |

---

## 4. `GET /api/payments` (unchanged, verified)

List all payments for the tenant. Campaign payments are already included — no contract change.

### Response shape (per item, relevant fields)

```json
{
  "id":            "pay_xxxxxxxxxxx",
  "studentId":     "stu_b1",
  "amount":        30.00,
  "date":          "2026-05-05",
  "method":        "Cash",
  "category":      "Grade 7 Exam Fee",
  "feeCampaignId": "fc_xxxxxxxxxxx",
  "receiptNumber": "2026.05.05.100000.K",
  "snapshot": { ... }
}
```

`category` contains the campaign name, making it the natural source label on the payments page. `feeCampaignId` non-null signals "this is a campaign payment" for UI differentiation.

---

## 5. `GET /api/payments/student/:studentId` (unchanged, verified)

Student-specific payment history. Campaign payments already included — no contract change.
