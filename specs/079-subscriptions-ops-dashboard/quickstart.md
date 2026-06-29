# Quickstart: Subscriptions Operations Dashboard

**Branch**: `079-subscriptions-ops-dashboard`  
**Date**: 2026-05-21  
**Base URL**: `http://localhost:8080/api/platform`

---

## Prerequisites

- Backend running on `http://localhost:8080`
- Frontend running on `http://localhost:8081`
- Platform admin user credentials available (e.g., `owner@platform.dev` / `password`)
- `jq` installed for JSON parsing

---

## Step 1: Authenticate as Platform Admin

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/platform/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@localhost.com","password":"12345678"}' \
  | jq -r '.data.token')

echo "Token: $TOKEN"
```

Expected: HTTP 200, token string printed.

---

## Step 2: Verify Finance Summary KPIs (new fields)

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/platform/finance/summary \
  | jq '.data | {mrr, failed_payments_count, renewals_due_count, monthly_churn_count}'
```

Expected: HTTP 200. All four fields present. `failed_payments_count`, `renewals_due_count`, `monthly_churn_count` are non-negative integers (0 is valid).

---

## Step 3: Subscriptions list — happy path with enriched row fields

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/platform/subscriptions?limit=5" \
  | jq '{total: .meta.total, active_count: .meta.active_count, first_row: .data[0] | {id, tenant_name, payment_status, max_students, alerts}}'
```

Expected: HTTP 200. Each row includes `payment_status` (string or null), `max_students` (int or null), and `alerts` (array).

---

## Step 4: Search filter

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/platform/subscriptions?q=greenwood" \
  | jq '{total: .meta.total, names: [.data[].tenant_name]}'
```

Expected: HTTP 200. Only rows with "greenwood" in tenant name or email. `total` reflects filtered count.

---

## Step 5: Plan filter

```bash
# First, get a valid plan ID
PLAN_ID=$(curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/platform/plans \
  | jq -r '.data[0].id')

curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/platform/subscriptions?plan_id=${PLAN_ID}" \
  | jq '{total: .meta.total, plans: [.data[].plan_id] | unique}'
```

Expected: HTTP 200. All rows have `plan_id` matching the requested plan.

---

## Step 6: Billing cycle filter

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/platform/subscriptions?billing_cycle=annual" \
  | jq '{total: .meta.total, cycles: [.data[].billing_cycle] | unique}'
```

Expected: HTTP 200. `cycles` array contains only `["annual"]`.

---

## Step 7: Payment status filter

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/platform/subscriptions?payment_status=failed" \
  | jq '{total: .meta.total, payment_statuses: [.data[].payment_status] | unique}'
```

Expected: HTTP 200. `payment_statuses` contains only `["failed"]` (or empty array if none).

---

## Step 8: Expiring soon filter

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/platform/subscriptions?expiring_soon=1" \
  | jq '{total: .meta.total, expiry_dates: [.data[].expires_at]}'
```

Expected: HTTP 200. All returned `expires_at` dates are within the next 30 days of today.

---

## Step 9: Combined filters

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/api/platform/subscriptions?billing_cycle=monthly&status=active&limit=10" \
  | jq '{total: .meta.total, page: .meta.page}'
```

Expected: HTTP 200. Rows satisfy all applied filters simultaneously.

---

## Step 10: Unauthorized access guard

```bash
curl -s http://localhost:8080/api/platform/subscriptions | jq '{status, message}'
```

Expected: HTTP 401. `{"status": "error", "message": "..."}`.

---

## Step 11: Finance summary — unauthorized guard

```bash
curl -s http://localhost:8080/api/platform/finance/summary | jq '{status, message}'
```

Expected: HTTP 401.

---

## Validation Results

> Validated: 2026-05-21. Environment: `admin@localhost.com` / `12345678`, backend `http://localhost:8080`.

| Test | Expected | Actual | Pass/Fail |
|------|----------|--------|-----------|
| Step 1: Login | HTTP 200, token | HTTP 200, JWT token returned | ✅ PASS |
| Step 2: Finance summary new fields | 4 fields present, integers | `mrr=35.83`, `failed_payments_count=0`, `renewals_due_count=0`, `monthly_churn_count=2` | ✅ PASS |
| Step 3: Subscriptions enriched rows | payment_status, max_students, alerts present | All 3 fields present on each row; `total=20`, `active_count=2` | ✅ PASS |
| Step 4: Search filter | Only matching tenant names | `q=pinecrest` → `total=7`, all rows `"Pinecrest College Primary"` | ✅ PASS |
| Step 5: Plan filter | Only matching plan_id | `plan_id=starter` → `total=13`, `plans=["starter"]` | ✅ PASS |
| Step 6: Billing cycle filter | Only "annual" rows | `billing_cycle=annual` → `total=3`, `cycles=["annual"]` | ✅ PASS |
| Step 7: Payment status filter | Only failed rows | `payment_status=failed` → `total=6`, `payment_statuses=["failed"]` | ✅ PASS |
| Step 8: Expiring soon filter | expires_at within 30 days | `expiring_soon=1` → 4 rows all expiring 2026-05-27 (6 days) | ✅ PASS |
| Step 9: Combined filters | Correct combined result | `billing_cycle=monthly&status=active` → `total=1`, cycles+statuses match | ✅ PASS |
| Step 10: Unauth subscriptions | HTTP 401 | HTTP 401, `"No authentication token provided."` | ✅ PASS |
| Step 11: Unauth finance summary | HTTP 401 | HTTP 401, `"No authentication token provided."` | ✅ PASS |
