# Quickstart: Roll Back or Void Generated Charges

## Preconditions

- Backend and frontend environments are configured.
- A tenant has an academic calendar with a current term.
- At least one active fee rule exists.
- At least one active transport route/allocation exists.
- You have a JWT for an authorized `admin`, `bursar`, or `super_admin` user.

Set shell variables for curl validation after implementation:

```bash
API_BASE="http://localhost:8080/api"
TOKEN="<jwt-token>"
```

## Manual Validation Flow

1. Generate fee rule charges for a term or billing period.
2. Confirm generated fee rule charge descriptions follow `TERM-{termNumber}-{year} Fee Rules Charges`.
3. Fetch the latest fee rule charge batch.
4. Void the latest fee rule charge batch.
5. Confirm fee rule charges no longer count toward balances.
6. Confirm transport charges remain active.
7. Generate transport charges for a month.
8. Confirm generated transport descriptions follow `TERM-{termNumber}-{monthName}-{year} Transport Charges`.
9. Fetch the latest transport charge batch.
10. Void the latest transport charge batch.
11. Confirm transport charges no longer count toward balances.
12. Confirm fee rule charges remain active when only transport is voided.

## Curl Checks After Implementation

### Generate Fee Rule Charges

```bash
curl -sS -X POST "$API_BASE/fee-rules/generate" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"billingPeriod":"term-2"}'
```

Expected:

- HTTP 200.
- Response includes `batchId`.
- Response includes `descriptionLabel` like `TERM-2-2026 Fee Rules Charges`.

### Fetch Latest Fee Rule Batch

```bash
curl -sS "$API_BASE/fee-rules/latest-charge-batch" \
  -H "Authorization: Bearer $TOKEN"
```

Expected:

- HTTP 200.
- `data.chargeType` is `fee_structure`.
- `data.canVoid` is `true`.

### Void Latest Fee Rule Batch

```bash
curl -sS -X POST "$API_BASE/fee-rules/latest-charge-batch/void" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Validation rollback"}'
```

Expected:

- HTTP 200.
- Response confirms `chargeType` is `fee_structure`.
- A repeated request returns HTTP 404 or 409 with a clear error message.

### Generate Transport Charges

```bash
curl -sS -X POST "$API_BASE/transport/generate-charges" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"month":"2026-06"}'
```

Expected:

- HTTP 200.
- Response includes `batchId`.
- Response includes `descriptionLabel` like `TERM-2-JUNE-2026 Transport Charges`.

### Fetch Latest Transport Batch

```bash
curl -sS "$API_BASE/transport/latest-charge-batch" \
  -H "Authorization: Bearer $TOKEN"
```

Expected:

- HTTP 200.
- `data.chargeType` is `transport`.
- `data.canVoid` is `true`.

### Void Latest Transport Batch

```bash
curl -sS -X POST "$API_BASE/transport/latest-charge-batch/void" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Validation rollback"}'
```

Expected:

- HTTP 200.
- Response confirms `chargeType` is `transport`.
- Fee rule charges remain unchanged.

### Unauthorized Role Check

```bash
curl -sS "$API_BASE/fee-rules/latest-charge-batch" \
  -H "Authorization: Bearer <teacher-token>"
```

Expected:

- HTTP 403.
- Standard error envelope.

### Tenant Isolation Check

Use a token from a different tenant and request latest batch summaries.

Expected:

- No batches from the original tenant are returned.
- Response is either HTTP 404 or a summary for only the token tenant.

## Frontend Validation

- Open Fee Rules settings and generate charges.
- Verify a latest-batch rollback card or action appears for fee rule charges.
- Confirm the rollback dialog displays charge type, label, charge count, total amount, and affected students.
- Open Transport charge generation area and repeat the same checks for transport charges.
- Ensure success/error toasts clearly mention the affected charge type.
