# Quickstart: Non-Ledger General Payments

**Branch**: `061-non-ledger-general-payments`
**Date**: 2026-05-04

---

## Setup

```bash
# Switch to feature branch
git checkout 061-non-ledger-general-payments

# Apply new migrations
cd backend
php spark migrate

# Verify columns added
php spark db:table payments
# Should show: is_general_payment, payment_group_id columns
```

---

## Verification: Non-Ledger Payment Does Not Affect Balance

```bash
# 1. Get student balance before
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/students/$STUDENT_ID/balance

# Note the balance value

# 2. Record a payment under a user-defined category
curl -X POST http://localhost:8080/api/payments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "'$STUDENT_ID'",
    "amount": 50.00,
    "date": "2026-05-04",
    "method": "Cash",
    "category": "School Trip"
  }'

# Expect: is_general_payment=1 in DB, balanceAfterPayment=null in response

# 3. Get balance again — must be unchanged
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/students/$STUDENT_ID/balance

# Expect: balance identical to step 1
```

---

## Verification: System Category Payment Still Affects Balance

```bash
curl -X POST http://localhost:8080/api/payments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "'$STUDENT_ID'",
    "amount": 100.00,
    "date": "2026-05-04",
    "method": "Cash",
    "category": "Fees"
  }'

# Expect: is_general_payment=0, balanceAfterPayment != null
# Balance should decrease by 100
```

---

## Verification: Mixed Category Rejection

```bash
curl -X POST http://localhost:8080/api/payments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "'$STUDENT_ID'",
    "amount": 80.00,
    "date": "2026-05-04",
    "method": "Cash",
    "categories": [
      { "categoryName": "Fees", "amount": 50.00 },
      { "categoryName": "School Trip", "amount": 30.00 }
    ]
  }'

# Expect: HTTP 422
# { "status": "error", "message": "Cannot mix system and user-defined categories in one transaction" }
```

---

## Verification: Multi-Category Non-Ledger Payment

```bash
# Record
curl -X POST http://localhost:8080/api/payments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "'$STUDENT_ID'",
    "amount": 50.00,
    "date": "2026-05-04",
    "method": "Cash",
    "categories": [
      { "categoryName": "Stationery", "amount": 30.00 },
      { "categoryName": "School Trip", "amount": 20.00 }
    ]
  }'

# Expect: HTTP 201, two rows in DB with same payment_group_id + receipt_number
# balanceAfterPayment=null on both rows

# Check DB
SELECT id, amount, category, is_general_payment, payment_group_id, receipt_number
FROM payments
WHERE student_id = '$STUDENT_ID'
ORDER BY created_at DESC LIMIT 5;
```

---

## Verification: Split Mismatch Rejection

```bash
curl -X POST http://localhost:8080/api/payments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "'$STUDENT_ID'",
    "amount": 50.00,
    "categories": [
      { "categoryName": "Stationery", "amount": 30.00 },
      { "categoryName": "School Trip", "amount": 15.00 }
    ]
  }'

# Expect: HTTP 422
# { "status": "error", "message": "Category allocations must sum to the total amount" }
```

---

## Integration Tests

```bash
cd backend
php vendor/bin/phpunit tests/Integration/GeneralPaymentTest.php --testdox
```

Expected test cases:
- `[a]` non-ledger payment does not reduce student balance
- `[b]` non-ledger payment excluded from getAllBalances subquery
- `[c]` system-category payment still posts to ledger normally
- `[d]` mixed-category request returns 422
- `[e]` split mismatch returns 422
- `[f]` multi-category non-ledger: two rows, same group_id, same receipt_number
- `[g]` multi-category system: two rows, same group_id, balance reduced by combined total
- `[h]` receipt for non-ledger payment has balanceAfterPayment=null
- `[i]` receipt for multi-category shows categoryLines
- `[j]` tenant isolation — cannot record payment for another tenant's student
