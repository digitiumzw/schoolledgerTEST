# Quickstart: Receipt Search and Cancel

**Feature**: 085-receipt-search-cancel
**Date**: 2026-05-30
**Base URL**: `http://localhost:8080/api`

## Prerequisites

1. Backend server running on `localhost:8080`
2. Frontend dev server running (optional, for UI verification)
3. Valid JWT token for an admin or bursar user
4. At least one payment with a known `receipt_number` exists in the database

## Setup

```bash
export BASE_URL="http://localhost:8080/api"

# Login as admin
ADMIN_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@greenwood.co.zw","password":"12345678"}' | jq -r '.data.token')

echo "Admin token: $ADMIN_TOKEN"
```

## Validation Steps

### 1. Receipt Search — Happy Path

Search for a payment by partial receipt number:

```bash
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$BASE_URL/payments/with-students?search=2026.05&limit=10" | jq '.data.data[] | {id, receiptNumber, amount, studentName: .student.firstName}'
```

**Expected**: HTTP 200, array of payments whose receipt numbers contain the search term.

### 2. Receipt Search — Exact Match

```bash
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$BASE_URL/payments/with-students?search=2026.05.30.143012.A&limit=1" | jq '.data.data[0].receiptNumber'
```

**Expected**: HTTP 200, exactly one payment with matching receipt number.

### 3. Receipt Search — Not Found

```bash
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$BASE_URL/payments/with-students?search=NONEXISTENT-999&limit=10" | jq '.data.pagination.total'
```

**Expected**: HTTP 200, `pagination.total` is `0`.

### 4. View Active Receipt

```bash
# Replace PAYMENT_ID with an active payment ID
RECEIPT_URL="$BASE_URL/receipts/$PAYMENT_ID"
curl -s "$RECEIPT_URL" | jq '.data.payment | {id, receiptNumber, isVoided, voidedAt}'
```

**Expected**: HTTP 200, `isVoided` is `false`, `voidedAt` is `null`.

### 5. Cancel / Void a Receipt — Happy Path

```bash
# Replace PAYMENT_ID with an active payment ID
VOID_RESPONSE=$(curl -s -X POST "$BASE_URL/payments/$PAYMENT_ID/void" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Test void via quickstart"}')

echo "$VOID_RESPONSE" | jq '.'
```

**Expected**: HTTP 200, response contains `voidedAt`, `voidReason`, `recalculatedBalance`.

### 6. Verify Student Balance After Void

```bash
# Replace STUDENT_ID with the student from the voided payment
STUDENT_ID=$(echo "$VOID_RESPONSE" | jq -r '.data.studentId')
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$BASE_URL/students/$STUDENT_ID/balance" | jq '.data.balance'
```

**Expected**: HTTP 200. Balance should have increased by the voided payment amount (if the payment was previously counted in the ledger).

### 7. View Voided Receipt

```bash
curl -s "$RECEIPT_URL" | jq '.data.payment | {isVoided, voidedAt, voidReason}'
```

**Expected**: HTTP 200, `isVoided` is `true`, `voidedAt` and `voidReason` are populated.

### 8. Double-Void Guard

```bash
curl -s -X POST "$BASE_URL/payments/$PAYMENT_ID/void" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Should fail"}' | jq '.status, .message'
```

**Expected**: HTTP 409, message indicates the payment is already voided.

### 9. Missing Reason Validation

```bash
# Create a new payment first (or use a different active payment ID)
curl -s -X POST "$BASE_URL/payments/ANOTHER_PAYMENT_ID/void" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":""}' | jq '.status, .message'
```

**Expected**: HTTP 400, message indicates a reason is required.

### 10. Unauthorized Role Guard

```bash
# Login as a teacher
TEACHER_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@greenwood.co.zw","password":"12345678"}' | jq -r '.data.token')

curl -s -X POST "$BASE_URL/payments/$PAYMENT_ID/void" \
  -H "Authorization: Bearer $TEACHER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Unauthorized attempt"}' | jq '.status, .message'
```

**Expected**: HTTP 403, message indicates insufficient permission.

### 11. Tenant Isolation

```bash
# Login as admin of a DIFFERENT tenant
OTHER_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"other-tenant-admin@example.test","password":"12345678"}' | jq -r '.data.token')

curl -s -X POST "$BASE_URL/payments/$PAYMENT_ID/void" \
  -H "Authorization: Bearer $OTHER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Cross-tenant attempt"}' | jq '.status, .message'
```

**Expected**: HTTP 404 (payment not found for that tenant), not 403.

## Frontend Smoke Test

1. Open the Payments page
2. Enter a known receipt number in the new "Search by Receipt" field
3. Verify the matching payment appears with student details
4. Click the cancel/void action on an active payment row
5. Enter a reason in the modal and confirm
6. Verify: loading spinner during request, success toast, payment row updates with "Voided" badge
7. Refresh the page and verify the voided payment still appears with the voided indicator
8. Open the receipt view (print or preview) for the voided payment
9. Verify the "CANCELED / INVALID" banner is displayed with void date and reason

## Lint / Type-Check Commands

```bash
# Backend PHP lint
cd backend && php -l app/Controllers/Api/PaymentController.php
php -l app/Controllers/Api/ReceiptController.php
php -l app/Models/PaymentModel.php
php -l app/Services/LedgerService.php
php -l app/Config/Routes.php

# Frontend TypeScript
cd frontend && ./node_modules/.bin/tsc --noEmit --pretty false

# Git diff check
git diff --check
```
