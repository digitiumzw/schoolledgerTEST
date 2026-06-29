# API Contract: Subscription & Billing

**Branch**: `026-billing-plans-management` | **Date**: 2026-04-12  
**Base path**: `/api/subscription`  
**Auth**: All endpoints require `Authorization: Bearer <JWT>` unless noted as PUBLIC.  
**Tenant isolation**: All endpoints derive `tenant_id` from the JWT payload — never from request body.

---

## Unchanged Endpoints

The following existing endpoints are **unchanged** in contract (behaviour may be updated internally):

| Method | Path | Auth roles | Description |
|--------|------|-----------|-------------|
| GET | `/api/subscription/plans` | Any authenticated | List active plans (free plan filtered out by `is_active=0`) |
| GET | `/api/subscription/current` | Any authenticated | Current subscription, student count, recommended plan |
| POST | `/api/subscription/initiate` | admin, super_admin | Initiate Paynow redirect payment (now supports downgrade) |
| POST | `/api/subscription/initiate-ecocash` | admin, super_admin | Initiate EcoCash/OneMoney payment (now supports downgrade) |
| GET | `/api/subscription/poll/:txId` | Any authenticated | Poll Paynow transaction status |
| POST | `/api/subscription/webhook` | PUBLIC | Paynow webhook callback |

**Breaking change to `POST /api/subscription/initiate` and `initiate-ecocash`**:  
The downgrade-rejection error is removed. A new error is returned when a downgrade is blocked by student count:

```json
HTTP 422
{
  "status": "error",
  "message": "Downgrade blocked: student count exceeds target plan limit.",
  "errors": {
    "downgrade_blocked": true,
    "studentCount": 285,
    "planLimit": 249
  }
}
```

**Removed endpoint**: `POST /api/subscription/activate-free` — removed from routes (free plan no longer exists).

---

## New Endpoints

### GET `/api/subscription/invoices`

Returns all invoices for the authenticated tenant, sorted most-recent first.

**Auth roles**: `admin`, `super_admin`, `bursar`

**Response** `200 OK`:
```json
{
  "status": "success",
  "data": {
    "invoices": [
      {
        "id": "uuid",
        "invoiceNumber": "INV-abc123-202604-001",
        "planName": "Starter",
        "billingCycle": "monthly",
        "amountCents": 1500,
        "currency": "USD",
        "issuedAt": "2026-04-12T10:30:00Z",
        "downloadUrl": "/api/subscription/invoices/uuid/download"
      }
    ]
  }
}
```

**Empty state** `200 OK`:
```json
{ "status": "success", "data": { "invoices": [] } }
```

---

### GET `/api/subscription/invoices/:invoiceId/download`

Streams the invoice PDF for download.

**Auth roles**: `admin`, `super_admin`, `bursar`

**Response** `200 OK`:  
- `Content-Type: application/pdf`  
- `Content-Disposition: attachment; filename="invoice-{invoiceNumber}.pdf"`  
- Body: binary PDF stream

**Error responses**:

| Status | Condition |
|--------|-----------|
| 404 | Invoice not found or belongs to a different tenant |
| 500 | PDF generation failed (with retry message) |

---

### GET `/api/subscription/events`

Returns paginated billing events for the authenticated tenant (significant events only).

**Auth roles**: `admin`, `super_admin`, `bursar`

**Query parameters**:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | int | 1 | Page number (1-indexed) |
| `perPage` | int | 20 | Events per page (max 50) |

**Response** `200 OK`:
```json
{
  "status": "success",
  "data": {
    "events": [
      {
        "id": "uuid",
        "eventType": "plan_upgraded",
        "planName": "Growth",
        "billingCycle": "annual",
        "amountCents": 25000,
        "currency": "USD",
        "occurredAt": "2026-04-12T10:30:00Z"
      },
      {
        "id": "uuid",
        "eventType": "payment_confirmed",
        "planName": "Starter",
        "billingCycle": "monthly",
        "amountCents": 1500,
        "currency": "USD",
        "occurredAt": "2026-03-01T08:00:00Z"
      }
    ],
    "total": 5,
    "page": 1,
    "perPage": 20
  }
}
```

**Allowed `eventType` values**: `payment_confirmed`, `plan_activated`, `plan_upgraded`, `plan_downgraded`, `subscription_renewed`, `subscription_expired`

---

## Removed Endpoint

### ~~POST `/api/subscription/activate-free`~~ (REMOVED)

This endpoint is removed. The free plan no longer exists. Any client calling this endpoint will receive `404 Not Found`.

---

## Error Response Shape (all endpoints)

```json
{
  "status": "error",
  "message": "Human-readable description",
  "errors": {
    "fieldName": "Field-specific error message"
  }
}
```

`errors` object is omitted when not applicable.

---

## Paynow Webhook — No Contract Change

The webhook endpoint (`POST /api/subscription/webhook`) contract is unchanged. Internally it now additionally:
1. Creates a `subscription_invoices` record on `paid` status.
2. Writes `payment_confirmed` and `plan_activated` / `plan_upgraded` / `plan_downgraded` / `subscription_renewed` events to `billing_events`.
