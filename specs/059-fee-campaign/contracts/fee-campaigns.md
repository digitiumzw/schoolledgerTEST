# API Contract: Fee Campaigns

**Feature**: 059-fee-campaign  
**Base path**: `/api/fee-campaigns`  
**Auth**: JWT required (admin, bursar roles)

---

## GET /api/fee-campaigns

List all campaigns for the authenticated tenant.

**Query params**:
- `status` (optional): `active` | `closed` | `all` (default: `all`)

**Response** `200`:
```json
{
  "status": true,
  "message": "Success",
  "data": [
    {
      "id": "fc_1714834200_a1b2c3d4",
      "name": "Grade 7 Exam Fee",
      "description": "Annual examination fee for Grade 7",
      "targetScopeType": "class",
      "targetScopeId": ["cls_abc123"],
      "amount": 50.00,
      "dueDate": "2026-06-30",
      "status": "active",
      "createdBy": "usr_123",
      "createdAt": "2026-05-04T10:00:00",
      "summary": {
        "totalStudents": 25,
        "totalExpected": 1250.00,
        "totalCollected": 600.00,
        "totalOutstanding": 650.00,
        "fullyPaidCount": 10,
        "partiallyPaidCount": 5,
        "unpaidCount": 10
      }
    }
  ]
}
```

---

## POST /api/fee-campaigns

Create a new campaign and auto-assign eligible students.

**Request body**:
```json
{
  "name": "Grade 7 Exam Fee",
  "description": "Annual examination fee for Grade 7",
  "targetScopeType": "class",
  "targetScopeId": ["cls_abc123"],
  "amount": 50.00,
  "dueDate": "2026-06-30"
}
```

**Validation**:
- `name` — required, max 255 chars, unique per tenant
- `targetScopeType` — required, one of: `school_wide`, `class`
- `targetScopeId` — required when `targetScopeType` = `class`; string or array of strings
- `amount` — required, numeric, > 0, ≤ 1,000,000
- `dueDate` — optional, YYYY-MM-DD format

**Response** `201`:
```json
{
  "status": true,
  "message": "Campaign created with 25 students assigned",
  "data": {
    "id": "fc_1714834200_a1b2c3d4",
    "name": "Grade 7 Exam Fee",
    "description": "Annual examination fee for Grade 7",
    "targetScopeType": "class",
    "targetScopeId": ["cls_abc123"],
    "amount": 50.00,
    "dueDate": "2026-06-30",
    "status": "active",
    "assignedCount": 25
  }
}
```

**Error** `400` (duplicate name):
```json
{
  "status": false,
  "message": "A campaign with this name already exists"
}
```

---

## GET /api/fee-campaigns/:id

Get campaign detail with aggregate summary.

**Response** `200`:
```json
{
  "status": true,
  "message": "Success",
  "data": {
    "id": "fc_1714834200_a1b2c3d4",
    "name": "Grade 7 Exam Fee",
    "description": "Annual examination fee for Grade 7",
    "targetScopeType": "class",
    "targetScopeId": ["cls_abc123"],
    "amount": 50.00,
    "dueDate": "2026-06-30",
    "status": "active",
    "createdBy": "usr_123",
    "createdAt": "2026-05-04T10:00:00",
    "summary": {
      "totalStudents": 25,
      "totalExpected": 1250.00,
      "totalCollected": 600.00,
      "totalOutstanding": 650.00,
      "fullyPaidCount": 10,
      "partiallyPaidCount": 5,
      "unpaidCount": 10
    }
  }
}
```

---

## PUT /api/fee-campaigns/:id

Update campaign metadata. Amount is immutable once any payment has been recorded.

**Request body**:
```json
{
  "name": "Grade 7 Exam Fee (Updated)",
  "description": "Updated description",
  "dueDate": "2026-07-15"
}
```

**Error** `400` (amount change with existing payments):
```json
{
  "status": false,
  "message": "Cannot change campaign amount after payments have been recorded"
}
```

---

## POST /api/fee-campaigns/:id/close

Close/archive a campaign.

**Request body** (optional):
```json
{
  "force": true
}
```

**Response** `200`:
```json
{
  "status": true,
  "message": "Campaign closed",
  "data": { "id": "fc_...", "status": "closed" }
}
```

**Error** `409` (outstanding balances without force):
```json
{
  "status": false,
  "message": "Campaign has outstanding balances. Set force=true to close anyway."
}
```

---

## POST /api/fee-campaigns/:id/record-payment

Record a payment for a student against this campaign.

**Request body**:
```json
{
  "studentId": "stu_abc123",
  "amount": 25.00,
  "method": "Cash",
  "date": "2026-05-04",
  "description": "Partial exam fee payment"
}
```

**Validation**:
- `studentId` — required, must be assigned to this campaign
- `amount` — required, > 0, must not exceed remaining balance
- `method` — required, one of: Cash, EcoCash, OneMoney, Telecash, Bank Transfer, ZIPIT, Swipe, Cheque, Other
- `date` — optional (defaults to today), YYYY-MM-DD format

**Response** `201`:
```json
{
  "status": true,
  "message": "Payment recorded",
  "data": {
    "payment": {
      "id": "p1714834200_a1b2c3d4",
      "amount": 25.00,
      "method": "Cash",
      "date": "2026-05-04",
      "receiptNumber": "2026.05.04.100000.A",
      "feeCampaignId": "fc_1714834200_a1b2c3d4"
    },
    "campaignStudent": {
      "studentId": "stu_abc123",
      "expectedAmount": 50.00,
      "paidAmount": 25.00,
      "remainingAmount": 25.00,
      "status": "partially_paid"
    }
  }
}
```

**Error** `400` (overpayment):
```json
{
  "status": false,
  "message": "Payment amount ($40.00) exceeds remaining balance ($30.00)"
}
```

**Error** `409` (campaign closed):
```json
{
  "status": false,
  "message": "Cannot record payment — campaign is closed"
}
```
