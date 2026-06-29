# API Contract: Charge Batch Rollback and Labels

All endpoints are under `/api`, require JWT authentication, and use the standard response envelope.

## Authorization

Allowed roles:

- `super_admin`
- `admin`
- `bursar`

Transport charge generation may remain stricter if existing product rules allow only `super_admin` and `admin`; rollback/summary access should be aligned with finance users if implementation confirms bursars manage charges.

## GET /api/fee-rules/latest-charge-batch

Returns the latest non-voided fee rule charge batch for the authenticated tenant.

### Success Response: 200

```json
{
  "status": "success",
  "data": {
    "id": "run_123",
    "chargeType": "fee_structure",
    "periodKey": "term-2",
    "periodLabel": "TERM-2-2026",
    "descriptionLabel": "TERM-2-2026 Fee Rules Charges",
    "generatedAt": "2026-05-06 08:00:00",
    "generatedBy": "usr_123",
    "chargeCount": 120,
    "affectedStudentCount": 60,
    "totalAmount": 4500.00,
    "canVoid": true,
    "blockedReason": null
  },
  "message": "Latest fee rule charge batch retrieved"
}
```

### Error Responses

- **404**: No active fee rule charge batch exists.
- **403**: User role cannot view rollback summaries.

## POST /api/fee-rules/latest-charge-batch/void

Voids the latest non-voided fee rule charge batch for the authenticated tenant.

### Request Body

```json
{
  "reason": "Generated for the wrong term"
}
```

### Success Response: 200

```json
{
  "status": "success",
  "data": {
    "batchId": "run_123",
    "chargeType": "fee_structure",
    "periodLabel": "TERM-2-2026",
    "chargeCount": 120,
    "affectedStudentCount": 60,
    "totalAmount": 4500.00,
    "voidedAt": "2026-05-06 08:15:00"
  },
  "message": "Latest fee rule charge batch voided"
}
```

### Error Responses

- **404**: No active fee rule charge batch exists.
- **409**: Latest batch was already voided or changed during the request.
- **422**: Batch cannot be voided without resolving listed financial activity.

## GET /api/transport/latest-charge-batch

Returns the latest non-voided transport charge batch for the authenticated tenant.

### Success Response: 200

```json
{
  "status": "success",
  "data": {
    "id": "run_456",
    "chargeType": "transport",
    "periodKey": "2026-06",
    "periodLabel": "TERM-2-JUNE-2026",
    "descriptionLabel": "TERM-2-JUNE-2026 Transport Charges",
    "generatedAt": "2026-06-01 08:00:00",
    "generatedBy": "usr_123",
    "chargeCount": 35,
    "affectedStudentCount": 35,
    "totalAmount": 875.00,
    "canVoid": true,
    "blockedReason": null
  },
  "message": "Latest transport charge batch retrieved"
}
```

### Error Responses

- **404**: No active transport charge batch exists.
- **403**: User role cannot view rollback summaries.

## POST /api/transport/latest-charge-batch/void

Voids the latest non-voided transport charge batch for the authenticated tenant.

### Request Body

```json
{
  "reason": "Generated before route allocation corrections were complete"
}
```

### Success Response: 200

```json
{
  "status": "success",
  "data": {
    "batchId": "run_456",
    "chargeType": "transport",
    "periodLabel": "TERM-2-JUNE-2026",
    "chargeCount": 35,
    "affectedStudentCount": 35,
    "totalAmount": 875.00,
    "voidedAt": "2026-06-01 08:15:00"
  },
  "message": "Latest transport charge batch voided"
}
```

### Error Responses

- **404**: No active transport charge batch exists.
- **409**: Latest batch was already voided or changed during the request.
- **422**: Batch cannot be voided without resolving listed financial activity.

## Updated Existing Endpoint: POST /api/fee-rules/generate

The generation response should include batch and label details.

### Additional Response Fields

```json
{
  "billingPeriod": "term-2",
  "batchId": "run_123",
  "descriptionLabel": "TERM-2-2026 Fee Rules Charges",
  "generatedCount": 120,
  "skippedDuplicateCount": 0,
  "totalAmount": 4500.00,
  "perRule": []
}
```

## Updated Existing Endpoint: POST /api/transport/generate-charges

The generation response should include batch and label details.

### Additional Response Fields

```json
{
  "month": "2026-06",
  "batchId": "run_456",
  "descriptionLabel": "TERM-2-JUNE-2026 Transport Charges",
  "created": 35,
  "skipped": 0,
  "totalAmount": 875.00
}
```
