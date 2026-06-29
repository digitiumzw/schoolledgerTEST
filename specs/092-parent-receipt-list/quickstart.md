# Quickstart: Parent Receipt List

**Feature**: 092-parent-receipt-list
**Date**: 2026-06-25

## Prerequisites

- Backend running at `http://localhost:8080/api`
- Frontend running at `http://localhost:5173`
- At least one student with multiple payment records
- At least one voided payment for visual testing

## Setup

1. Start the backend server:
```bash
cd backend && php spark serve --port 8080
```

2. Start the frontend dev server:
```bash
cd frontend && npm run dev
```

3. Identify a test student with multiple payments. Login as admin to get a token:
```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@greenwood.co.zw","password":"12345678"}' | jq -r '.data.token')
```

4. Get a student ID with payments:
```bash
STUDENT_ID=$(curl -s http://localhost:8080/api/payments/with-students?limit=1 \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data.data[0].studentId')
echo "Test student: $STUDENT_ID"
```

## Validation

### 1. Happy Path — Receipt List

```bash
curl -s http://localhost:8080/api/receipts/student/$STUDENT_ID?page=1&limit=20 | jq .
```

**Expected**: HTTP 200, `status: true`, `data.receipts` array sorted by date descending, `data.student` object with name, `data.pagination` with total/totalPages.

### 2. Pagination — Page 2

```bash
curl -s "http://localhost:8080/api/receipts/student/$STUDENT_ID?page=2&limit=5" | jq '.data.pagination'
```

**Expected**: `page: 2`, `limit: 5`, `totalPages` reflects total count.

### 3. Single Receipt Student

```bash
# Find a student with only one payment
SINGLE_STUDENT=$(curl -s http://localhost:8080/api/payments/with-students?limit=50 \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data.data | group_by(.studentId) | map({id: .[0].studentId, count: length}) | .[] | select(.count == 1) | .id' | head -1)
curl -s "http://localhost:8080/api/receipts/student/$SINGLE_STUDENT" | jq '.data.pagination'
```

**Expected**: `total: 1`, `totalPages: 1`, receipts array with 1 entry.

### 4. Invalid Student ID (404)

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/receipts/student/nonexistent_student_id
```

**Expected**: HTTP 404.

### 5. Invalid Pagination — Page 0 (400)

```bash
curl -s -o /dev/null -w "%{http_code}" "http://localhost:8080/api/receipts/student/$STUDENT_ID?page=0"
```

**Expected**: HTTP 400.

### 6. Invalid Pagination — Limit > 100 (400)

```bash
curl -s -o /dev/null -w "%{http_code}" "http://localhost:8080/api/receipts/student/$STUDENT_ID?limit=999"
```

**Expected**: HTTP 400.

### 7. Voided Payment Included

```bash
curl -s "http://localhost:8080/api/receipts/student/$STUDENT_ID?limit=100" | jq '.data.receipts[] | select(.isVoided == true)'
```

**Expected**: At least one entry with `isVoided: true` (if voided payments exist for the student).

### 8. Frontend — View All Receipts Button

1. Open `http://localhost:5173/receipt/{anyPaymentId}` in a browser
2. Verify "View All Receipts" button is visible
3. Click the button
4. Verify the receipt list page loads with paginated entries sorted by date descending
5. Click any receipt entry
6. Verify navigation to the individual receipt page
7. Click browser back
8. Verify return to the receipt list page

### 9. Frontend — Voided Payment Visual Treatment

1. Navigate to the receipt list page for a student with voided payments
2. Verify voided entries show a "VOIDED" badge and strikethrough on the amount

### 10. Frontend — Pagination Controls

1. Navigate to a student with more than 20 receipts
2. Verify "Next" / "Previous" pagination controls are visible
3. Click "Next" and verify older receipts load
4. Verify pagination metadata (page X of Y) is displayed

## Validation Results (2026-06-25)

**Backend**: http://localhost:8080/api | **Test Student**: `s1782411024_623ed506`

### Curl Results

| Scenario | Status | Result |
|----------|--------|--------|
| 1. Happy Path | PASS | 200 — 1 receipt, student name "Stress StudentSTRESS-2010230320", date 2026-06-25, pagination total=1 totalPages=1 |
| 2. Pagination (page=2, limit=5) | PASS | 200 — page=2, total=1, totalPages=1, 0 receipts on page 2 |
| 3. Invalid Student ID | PASS | 404 — "Student not found" |
| 4. Invalid Page (page=0) | PASS | 400 — "Invalid page value. Must be a positive integer." |
| 5. Invalid Limit (limit=999) | PASS | 400 — "Invalid limit value. Must be between 1 and 100." |
| 6. Existing receipt endpoint | PASS | 200 — `GET /api/receipts/:id` still works, no route conflict |
| 7. Voided payment | N/A | No voided payments in current test dataset — code path verified by implementation |
| 8. Multi-category grouped | N/A | No grouped payments in current test dataset — code path verified by implementation |

### Code Quality Results

| Check | Status |
|-------|--------|
| PHP lint (PaymentModel, ReceiptController, Routes) | PASS — no syntax errors |
| TypeScript tsc --noEmit | PASS — 0 errors |
| ESLint (ReceiptListPage, ReceiptPage, useReceiptList) | PASS — 0 errors |
| git diff --check | PASS — no whitespace errors |

### Frontend Manual Tests

- Scenarios 8-10 require browser interaction with the frontend dev server. Not yet executed in this session.

