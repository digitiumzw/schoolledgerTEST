# API Contract: Student Campaign Records

**Feature**: 059-fee-campaign  
**Auth**: JWT required (admin, bursar roles)

---

## GET /api/fee-campaigns/:id/students

List all students assigned to a campaign with their individual payment status.

**Query params**:
- `status` (optional): `unpaid` | `partially_paid` | `fully_paid` | `all` (default: `all`)

**Response** `200`:
```json
{
  "status": true,
  "message": "Success",
  "data": [
    {
      "id": "cs_1714834200_a1b2c3d4",
      "studentId": "stu_abc123",
      "studentName": "John Doe",
      "className": "Grade 7A",
      "expectedAmount": 50.00,
      "paidAmount": 25.00,
      "remainingAmount": 25.00,
      "status": "partially_paid"
    },
    {
      "id": "cs_1714834200_e5f6g7h8",
      "studentId": "stu_def456",
      "studentName": "Jane Smith",
      "className": "Grade 7A",
      "expectedAmount": 50.00,
      "paidAmount": 0.00,
      "remainingAmount": 50.00,
      "status": "unpaid"
    }
  ]
}
```

---

## POST /api/fee-campaigns/:id/students

Manually add a student to a campaign (US4, P2).

**Request body**:
```json
{
  "studentId": "stu_xyz789"
}
```

**Validation**:
- `studentId` — required, must belong to tenant, must not already be in this campaign
- Campaign must be `active`

**Response** `201`:
```json
{
  "status": true,
  "message": "Student added to campaign",
  "data": {
    "id": "cs_1714834201_a1b2c3d4",
    "studentId": "stu_xyz789",
    "expectedAmount": 50.00,
    "paidAmount": 0.00,
    "remainingAmount": 50.00,
    "status": "unpaid"
  }
}
```

**Error** `400` (already assigned):
```json
{
  "status": false,
  "message": "Student is already assigned to this campaign"
}
```

**Error** `409` (campaign closed):
```json
{
  "status": false,
  "message": "Cannot add students to a closed campaign"
}
```

---

## DELETE /api/fee-campaigns/:id/students/:studentId

Remove a student from a campaign (US4, P2).

**Query params**:
- `force` (optional): `true` — required if student has recorded payments

**Response** `200`:
```json
{
  "status": true,
  "message": "Student removed from campaign"
}
```

**Error** `409` (has payments, no force flag):
```json
{
  "status": false,
  "message": "Student has recorded payments. Set force=true to confirm removal. Payment records will be preserved in the general ledger."
}
```

---

## GET /api/students/:id/campaigns

Get all campaign memberships for a student (student profile integration, FR-017).

**Response** `200`:
```json
{
  "status": true,
  "message": "Success",
  "data": [
    {
      "campaignId": "fc_1714834200_a1b2c3d4",
      "campaignName": "Grade 7 Exam Fee",
      "campaignStatus": "active",
      "dueDate": "2026-06-30",
      "expectedAmount": 50.00,
      "paidAmount": 25.00,
      "remainingAmount": 25.00,
      "status": "partially_paid"
    },
    {
      "campaignId": "fc_1714834201_b2c3d4e5",
      "campaignName": "Science Lab Fee",
      "campaignStatus": "active",
      "dueDate": null,
      "expectedAmount": 30.00,
      "paidAmount": 30.00,
      "remainingAmount": 0.00,
      "status": "fully_paid"
    }
  ]
}
```
