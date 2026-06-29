# API Contract: Fee Campaign Payment in Record Payment Modal

**Feature**: 086-fee-campaign-payment-modal

## Overview

This contract documents the API endpoints used by the Record Payment modal for the Fee Campaign Payment flow. All endpoints are already implemented as part of Feature 059 (Fee Campaigns). No new endpoints are required.

---

## Endpoint 1: List Active Fee Campaigns

**Method**: `GET`  
**Path**: `/api/fee-campaigns?status=active&limit=100`

**Headers**:
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Query Parameters**:
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| status | string | No | Filter by status (`active`, `closed`) |
| limit | int | No | Max records per page (1–100, default 50) |
| page | int | No | Page number (default 1) |
| sortBy | string | No | `name`, `status`, `dueDate`, `createdAt` |
| sortOrder | string | No | `asc` or `desc` |

**Response 200**:
```json
{
  "status": "success",
  "data": {
    "data": [
      {
        "id": "fc_abc123",
        "tenantId": "t_xyz",
        "name": "Term 2 Fundraiser",
        "description": "Annual term fees",
        "amount": 150.00,
        "dueDate": "2025-08-31",
        "targetScopeType": "school_wide",
        "targetScopeId": null,
        "status": "active",
        "createdBy": "usr_001",
        "createdAt": "2025-05-01T10:00:00Z",
        "updatedAt": "2025-05-01T10:00:00Z",
        "summary": {
          "totalStudents": 45,
          "totalExpected": 6750.00,
          "totalCollected": 3200.00,
          "collectionRate": 47.4
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 100,
      "total": 3,
      "totalPages": 1,
      "last_page": 1
    }
  }
}
```

**Errors**:
- `401 Unauthorized` — missing or invalid JWT
- `403 Forbidden` — insufficient role

---

## Endpoint 2: Get Student's Campaign Memberships

**Method**: `GET`  
**Path**: `/api/students/{studentId}/campaigns`

**Headers**:
```
Authorization: Bearer <JWT_TOKEN>
```

**Response 200**:
```json
{
  "status": "success",
  "data": [
    {
      "feeCampaignId": "fc_abc123",
      "campaignName": "Term 2 Fundraiser",
      "campaignStatus": "active",
      "dueDate": "2025-08-31",
      "expectedAmount": 150.00,
      "paidAmount": 75.00,
      "remainingAmount": 75.00,
      "status": "partially_paid"
    }
  ]
}
```

**Errors**:
- `401 Unauthorized` — missing or invalid JWT
- `404 Not Found` — student not found or not in this tenant

---

## Endpoint 3: Add Student to Campaign

**Method**: `POST`  
**Path**: `/api/fee-campaigns/{campaignId}/students`

**Headers**:
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Body**:
```json
{
  "studentId": "s_student123"
}
```

**Response 201**:
```json
{
  "status": "success",
  "data": {
    "id": "cs_def456",
    "tenantId": "t_xyz",
    "feeCampaignId": "fc_abc123",
    "studentId": "s_student123",
    "expectedAmount": 150.00,
    "paidAmount": 0.00,
    "status": "unpaid",
    "createdAt": "2025-05-30T12:00:00Z",
    "updatedAt": "2025-05-30T12:00:00Z"
  }
}
```

**Errors**:
- `400 Bad Request` — student already in campaign, or campaign is closed
- `401 Unauthorized` — missing or invalid JWT
- `403 Forbidden` — insufficient role (not admin/bursar)
- `404 Not Found` — campaign not found or not in this tenant

---

## Endpoint 4: Record Campaign Payment

**Method**: `POST`  
**Path**: `/api/fee-campaigns/{campaignId}/record-payment`

**Headers**:
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Body**:
```json
{
  "studentId": "s_student123",
  "amount": 75.00,
  "method": "Cash",
  "date": "2025-05-30",
  "description": "Optional note"
}
```

**Response 201**:
```json
{
  "status": "success",
  "data": {
    "payment": {
      "id": "pay_ghi789",
      "amount": 75.00,
      "receiptNumber": "2025.05.30.120015.X"
    },
    "campaignStudent": {
      "id": "cs_def456",
      "tenantId": "t_xyz",
      "feeCampaignId": "fc_abc123",
      "studentId": "s_student123",
      "expectedAmount": 150.00,
      "paidAmount": 75.00,
      "status": "partially_paid",
      "createdAt": "2025-05-30T12:00:00Z",
      "updatedAt": "2025-05-30T12:00:00Z"
    }
  }
}
```

**Errors**:
- `400 Bad Request` — amount <= 0, amount exceeds remaining balance, or student fully paid
- `401 Unauthorized` — missing or invalid JWT
- `403 Forbidden` — insufficient role
- `404 Not Found` — campaign not found, student not enrolled in campaign, or not in tenant
- `409 Conflict` — campaign is closed

---

## Frontend Flow Sequence

```
1. Admin opens Record Payment modal
2. Admin selects a student
3. Admin toggles "Fee Campaign Payment" on
4. Frontend fetches concurrently:
   a. GET /api/fee-campaigns?status=active&limit=100
   b. GET /api/students/{id}/campaigns
5. Dropdown renders with all active campaigns; student's existing campaigns highlighted
6. Admin selects a campaign; amount pre-fills with remaining balance
7. Admin enters/adjusts amount, selects method, picks date
8. Admin clicks "Record Payment"
9. Frontend checks if student is already in selected campaign:
   a. If NOT enrolled → POST /api/fee-campaigns/{id}/students { studentId }
      → On 201 success → POST /api/fee-campaigns/{id}/record-payment { studentId, amount, method, date }
      → On any error → show error, keep modal open
   b. If ALREADY enrolled → POST /api/fee-campaigns/{id}/record-payment directly
10. On success → show success toast, invalidate caches, close modal, open receipt
```

## Tenant Isolation Guarantees

All endpoints enforce tenant isolation:
- `tenant_id` is sourced from the decoded JWT payload
- Campaign lookups are scoped to the requesting tenant
- Student lookups are scoped to the requesting tenant
- Cross-tenant access returns 404 (not 403) to prevent tenant enumeration
