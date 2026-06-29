# Contract: Finance Control Center API

**Branch**: `080-finance-control-center`  
**Date**: 2026-05-21

## Purpose

Defines the backend-prepared finance data required by the finance control center page.

---

## 1) Finance Summary

### Endpoint
`GET /api/platform/finance/summary`

### Purpose
Returns the top-level KPI snapshot used by the finance control center.

### Response Shape
```json
{
  "status": "success",
  "data": {
    "total_revenue": 12450.0,
    "pending_amount": 250.0,
    "failed_amount": 75.0,
    "invoice_count": 48,
    "mrr": 625.0,
    "failed_payments_count": 3,
    "renewals_due_count": 7,
    "monthly_churn_count": 2,
    "growth_rate": 12.4
  }
}
```

### Notes
- Values are precomputed by the backend.
- The frontend uses the response directly for KPI cards and trend displays.
- All values must be tenant-safe when tenant-specific data is included.

---

## 2) Finance Invoices / Operational Rows

### Endpoint
`GET /api/platform/finance/invoices`

### Query Parameters
| Parameter | Required | Description |
|-----------|----------|-------------|
| `page` | No | Requested page number |
| `limit` | No | Rows per page |
| `status` | No | Invoice or payment status filter |
| `from` | No | Start date for the reporting window |
| `to` | No | End date for the reporting window |
| `tenant_id` | No | Optional tenant scope for platform finance users |

### Response Shape
```json
{
  "status": "success",
  "data": [
    {
      "id": "inv_123",
      "invoice_number": "INV-2026-001",
      "school_name": "Greenwood Academy",
      "plan_name": "Pro",
      "billing_cycle": "annual",
      "amount": 250.0,
      "currency": "USD",
      "issued_at": "2026-05-01 10:30:00",
      "payment_status": "completed",
      "alerts": ["expiring_soon"]
    }
  ],
  "meta": {
    "page": 1,
    "limit": 25,
    "total": 48,
    "last_page": 2
  }
}
```

### Notes
- The row shape may be extended with trend or alert fields as needed, but the response must stay backend-prepared.
- Filters must be applied before pagination.

---

## 3) Export Finance CSV

### Endpoint
`POST /api/platform/finance/invoices/export`

### Purpose
Downloads a CSV snapshot of the currently selected finance context.

### Request Body
```json
{
  "status": "failed",
  "from": "2026-05-01",
  "to": "2026-05-31",
  "tenant_id": "optional-tenant-id"
}
```

### Expected Behavior
- Returns a downloadable CSV response.
- The CSV rows must match the same filter context used by the on-screen finance data.
- The export should use the same date/status semantics as the list endpoint.

---

## 4) Monthly Revenue Trend Data

### Endpoint
`GET /api/platform/analytics/growth`

### Purpose
Provides chart-ready monthly points used by the finance revenue chart.

### Response Shape
```json
{
  "status": "success",
  "data": {
    "revenue_growth": [
      { "month": "2026-01", "revenue": 1125.0, "comparisonValue": 1000.0, "deltaPercent": 12.5 }
    ]
  }
}
```

### Notes
- Month labels should be chart-ready.
- The frontend should not regroup raw revenue values in the browser.

---

## Contract Requirements

- Responses must remain consistent with the platform API success envelope.
- Empty states must return valid responses, not errors.
- Unauthorized requests must continue to fail with the platform’s standard auth response.
- Filtered exports must correspond exactly to the selected filter context.
