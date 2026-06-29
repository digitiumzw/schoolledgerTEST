# Quickstart: Finance Control Center

**Branch**: `080-finance-control-center`  
**Date**: 2026-05-21  
**Base URL**: `http://localhost:8080/api/platform`

---

## Prerequisites

- Backend running on `http://localhost:8080`
- Frontend running on `http://localhost:8081`
- Platform admin credentials available
- `jq` installed for JSON parsing

---

## Step 1: Authenticate as a Platform Admin

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/platform/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@localhost.com","password":"12345678"}' \
  | jq -r '.data.token')

echo "$TOKEN"
```

Expected: HTTP 200 and a token string.

---

## Step 2: Verify Finance Summary KPIs

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/platform/finance/summary \
  | jq '.data | {total_revenue, pending_amount, failed_amount, invoice_count, mrr, failed_payments_count, renewals_due_count, monthly_churn_count, growth_rate}'
```

Expected: HTTP 200 and all KPI fields present.

---

## Step 3: Verify Finance Chart Data

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/platform/analytics/growth \
  | jq '.data.revenue_growth[0]'
```

Expected: HTTP 200 and month-aligned chart buckets suitable for monthly markers.

---

## Step 4: Verify Filtered Invoice Results

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/platform/finance/invoices?status=failed&from=2026-05-01&to=2026-05-31&limit=10" \
  | jq '{total: .meta.total, sample: .data[0]}'
```

Expected: HTTP 200, filtered rows only, and pagination metadata present.

---

## Step 5: Verify CSV Export Matches the Selected Context

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"failed","from":"2026-05-01","to":"2026-05-31"}' \
  http://localhost:8080/api/platform/finance/invoices/export \
  | head
```

Expected: CSV output with rows matching the same date/status filter context.

---

## Step 6: Verify Unauthorized Access Is Blocked

```bash
curl -s http://localhost:8080/api/platform/finance/summary \
  | jq '{status, message}'
```

Expected: HTTP 401 with the platform’s standard error envelope.

---

## UI Verification Checklist

- KPI cards show finance-focused labels and clearer semantic colors.
- KPI cards show trend indicators or percentage changes where available.
- The chart displays readable monthly labels and axis values.
- Date range and status filters update the entire finance view consistently.
- Export actions download a file that matches the selected filters.
- Sidebar active state is visibly stronger than inactive items.
- Summary cards and charts have clearer spacing and hierarchy.
- Operational panels surface overdue invoices, recent transactions, payout summaries, revenue breakdowns, and payment health alerts.

---

## Validation Results

> To be filled during implementation.

| Test | Expected | Actual | Pass/Fail |
|------|----------|--------|-----------|
| Auth login | HTTP 200 |  |  |
| Finance summary | KPI fields present |  |  |
| Chart data | Monthly buckets present |  |  |
| Filtered invoices | Filtered rows and pagination |  |  |
| CSV export | Export matches filter context |  |  |
| Unauthorized guard | HTTP 401 |  |  |
