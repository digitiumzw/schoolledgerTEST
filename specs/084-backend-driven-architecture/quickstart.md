# Quickstart: Backend-Driven Architecture (Feature 084)

## Prerequisites

- Backend running at `http://localhost:8080`
- Frontend running at `http://localhost:5173`
- Admin credentials: `admin@greenwood.co.zw` / `12345678`

---

## 1. Authenticate

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@greenwood.co.zw","password":"12345678"}' \
  | jq -r '.data.token')
echo "Token: $TOKEN"
```

Expected: HTTP 200, token string.

---

## 2. Staff — Paginated Backend-Filtered List

### Happy path — default pagination

```bash
curl -s http://localhost:8080/api/staff \
  -H "Authorization: Bearer $TOKEN" | jq '.data.pagination'
```

Expected: `{ page: 1, limit: 20, total: N, totalPages: X }` — total must equal actual staff count.

### Search filter

```bash
curl -s "http://localhost:8080/api/staff?search=alice&limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq '.data | {total: .pagination.total, names: [.data[].name]}'
```

Expected: Only staff with "alice" in name or email; `total` reflects matched count.

### Department filter

```bash
curl -s "http://localhost:8080/api/staff?department=Mathematics&limit=20" \
  -H "Authorization: Bearer $TOKEN" | jq '.data.summary.departmentBreakdown'
```

Expected: Response contains only Mathematics staff; summary shows `departmentBreakdown`.

### Employment status filter

```bash
curl -s "http://localhost:8080/api/staff?employmentStatus=active&limit=20" \
  -H "Authorization: Bearer $TOKEN" | jq '.data.pagination.total'
```

Expected: Total equals count of active staff only.

### Invalid params — HTTP 400

```bash
curl -s "http://localhost:8080/api/staff?limit=999" \
  -H "Authorization: Bearer $TOKEN" | jq '.status'
```

Expected: `"error"` with HTTP 400.

```bash
curl -s "http://localhost:8080/api/staff?sortBy=invalid_field" \
  -H "Authorization: Bearer $TOKEN" | jq '.status'
```

Expected: `"error"` with HTTP 400.

### No auth — HTTP 401

```bash
curl -s http://localhost:8080/api/staff | jq '.status'
```

Expected: `"error"` with HTTP 401.

---

## 3. Fee Campaigns — N+1 Fix + Pagination

### Happy path — all campaigns with inline summaries

```bash
curl -s http://localhost:8080/api/fee-campaigns \
  -H "Authorization: Bearer $TOKEN" | jq '.data | {total: .pagination.total, first_summary: .data[0].summary}'
```

Expected: `pagination.total` > 0; `summary` object present on first campaign (not null).

### Status filter

```bash
curl -s "http://localhost:8080/api/fee-campaigns?status=active" \
  -H "Authorization: Bearer $TOKEN" | jq '[.data.data[].status] | unique'
```

Expected: `["active"]` — only active campaigns returned.

### Verify single DB query (not N+1)

Monitor MySQL slow-query log or use `SHOW STATUS LIKE 'Queries'` before and after:
expected ≤ 3 queries total for a list of 10 campaigns (1 campaigns query + 1 summaries batch + 1 count).

---

## 4. Transport — Pagination Added

### Routes with pagination

```bash
curl -s "http://localhost:8080/api/transport/routes?limit=5&page=1" \
  -H "Authorization: Bearer $TOKEN" | jq '.data.pagination'
```

Expected: `{ page: 1, limit: 5, total: N, totalPages: X }`.

### Vehicles with pagination

```bash
curl -s "http://localhost:8080/api/transport/vehicles?limit=10" \
  -H "Authorization: Bearer $TOKEN" | jq '.data.pagination'
```

Expected: pagination metadata present.

### Drivers search + pagination

```bash
curl -s "http://localhost:8080/api/transport/drivers?search=john&limit=10" \
  -H "Authorization: Bearer $TOKEN" | jq '.data | {total: .pagination.total, names: [.data[].name]}'
```

Expected: Only drivers matching "john"; correct total.

---

## 5. Real-Time Polling Verification

### Two-tab manual verification

1. Open the Payments page in browser Tab 1.
2. Open browser DevTools Network tab on Tab 1 — filter by `XHR`.
3. Wait up to 35 seconds without any user interaction.
4. Verify `GET /api/payments/with-students` is automatically re-called by React Query polling.
5. In Tab 2, record a new payment.
6. Within 30 seconds, Tab 1 should display the new payment without manual refresh.

### QueryClient staleTime verification

In browser console (on any page):
```js
window.__reactQuery?.getQueryCache().getAll()[0]?.state?.dataUpdatedAt
```

Wait 31 seconds; re-check. Value should have changed (fresh background fetch occurred).

---

## 6. Performance Checks

### Staff query timing

```bash
time curl -s "http://localhost:8080/api/staff?limit=20" \
  -H "Authorization: Bearer $TOKEN" > /dev/null
```

Expected: Under 500ms for up to 500 staff records.

### Verify no N+1 on fee campaigns

Enable CodeIgniter query log in development and check that the number of DB queries
for `GET /api/fee-campaigns` with 10 campaigns equals 2–3 (not 11+).

---

## 7. Tenant Isolation

```bash
# Get token for a second tenant
TOKEN2=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@otherschool.co.zw","password":"12345678"}' \
  | jq -r '.data.token')

curl -s "http://localhost:8080/api/staff?limit=20" \
  -H "Authorization: Bearer $TOKEN2" | jq '.data.pagination.total'
```

Expected: Returns only the second tenant's staff count — never Greenwood's data.

---

## Validation Results Log

| Test | Expected | Result | Date |
|------|----------|--------|------|
| Staff default pagination | HTTP 200, pagination object | | |
| Staff search filter | Only matching staff | | |
| Staff department filter | Summary breakdowns match | | |
| Staff invalid limit | HTTP 400 | | |
| Staff no auth | HTTP 401 | | |
| Fee campaigns inline summary | summary not null | | |
| Fee campaigns status filter | Only active/closed | | |
| Transport routes pagination | pagination metadata | | |
| Transport vehicles pagination | pagination metadata | | |
| Transport drivers search | Only matching | | |
| Real-time polling (30s) | Auto-refetch in DevTools | | |
| Tenant isolation | Only own tenant data | | |
