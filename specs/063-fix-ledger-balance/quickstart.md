# Quickstart: Fix Ledger Balance Filtering

## Goal

Verify that student balances include only:

- Charges with `charge_type` of `fee_structure` or `transport`
- Payments with category `Fees`, `Transport + Fees`, or `Transport Fee`
- Approved debit and credit adjustments for the same student and tenant
- Opening balance only through eligible opening-balance charge rows

Formula:

```text
Current Balance = (Total Charges + Debit Adjustments + Opening Balance) - (Total Payments + Credit Adjustments)
```

## Implementation Notes

Expected backend focus:

1. Centralize eligible charge types and payment categories in the ledger layer.
2. Update `LedgerService::getStudentBalance()` and `LedgerService::getAllBalances()` to use exact payment category filters.
3. Update payment allocation logic so only eligible ledger payments affect eligible charge allocation.
4. Align `StudentModel` balance queries and cached/preloaded balance methods with the same filters.
5. Preserve existing endpoint response shapes.

No migration is planned.

## Manual Data Setup

Use a test tenant with at least two students.

For Student A, create or identify:

- Eligible charges:
  - One `fee_structure` charge
  - One `transport` charge
  - Optional opening-balance charge stored as `fee_structure`
- Ineligible charges:
  - At least one charge with another `charge_type`
- Eligible payments:
  - One `Fees` payment
  - One `Transport + Fees` payment
  - One `Transport Fee` payment
- Ineligible payments:
  - At least one payment with another category, such as a campaign/general/non-ledger category
- Adjustments:
  - One approved debit adjustment
  - One approved credit adjustment
  - Optional pending adjustment that should not count

For Student B, create eligible records with different amounts to confirm student isolation.

## Expected Calculation

For Student A, calculate manually:

```text
expected = SUM(Student A eligible fee_structure/transport charges)
  + SUM(Student A approved debit adjustments)
  - SUM(Student A eligible Fees/Transport + Fees/Transport Fee payments)
  - SUM(Student A approved credit adjustments)
```

Do not include:

- Other charge types
- Other payment categories
- Pending/rejected/voided adjustments
- Any records belonging to Student B
- Any records belonging to another tenant

## Post-Implementation Curl Checks

Set environment variables for convenience:

```bash
export API_BASE="http://localhost:8080/api"
export TOKEN="<jwt-token>"
export STUDENT_ID="<student-a-id>"
```

### 1. Single student balance happy path

```bash
curl -sS -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/students/$STUDENT_ID/balance" | jq .
```

Verify:

- `status` is `success`
- `data.totalCharges` equals eligible charges only
- `data.totalPayments` equals eligible payment categories only
- `data.balance` equals the required formula

### 2. Ledger endpoint consistency

```bash
curl -sS -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/ledger/student/$STUDENT_ID/balance" | jq .
```

Verify this returns the same `balance`, `totalCharges`, `totalPayments`, `creditAdjustments`, and `debitAdjustments` as `/students/{id}/balance`.

### 3. Bulk balance consistency

```bash
curl -sS -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/ledger/balances" | jq --arg id "$STUDENT_ID" '.data[] | select(.studentId == $id)'
```

Verify the row for Student A matches the single-student balance response.

### 4. Reconciliation consistency

```bash
curl -sS -H "Authorization: Bearer $TOKEN" \
  "$API_BASE/reconciliation/student/$STUDENT_ID/balance" | jq .
```

Verify reconciliation `balance` and component totals match the ledger response.

### 5. Recalculate endpoint consistency

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"studentId\":\"$STUDENT_ID\"}" \
  "$API_BASE/reconciliation/recalculate-balance" | jq .
```

Verify `data.calculatedBalance` equals the single-student balance.

### 6. Edge path: unauthorized request

```bash
curl -i -sS "$API_BASE/students/$STUDENT_ID/balance"
```

Verify the response is unauthorized and does not expose ledger data.

### 7. Multi-tenant isolation

Using a token from another tenant:

```bash
export OTHER_TENANT_TOKEN="<other-tenant-jwt-token>"

curl -i -sS -H "Authorization: Bearer $OTHER_TENANT_TOKEN" \
  "$API_BASE/students/$STUDENT_ID/balance"
```

Verify the response is not found or otherwise denies access, and no Student A balance is returned.

## Quality Checks

Run after implementation as applicable:

```bash
php -l backend/app/Services/LedgerService.php
php -l backend/app/Models/StudentModel.php
php -l backend/app/Controllers/Api/LedgerController.php
php -l backend/app/Controllers/Api/StudentController.php
php -l backend/app/Controllers/Api/ReconciliationController.php
```

If frontend types are changed:

```bash
npm run lint
```

Run frontend commands from `frontend/` and backend PHP commands from the repository root or `backend/` as appropriate.
