# Quickstart: Campaign Receipt & Payments Integration

**Feature**: 062-campaign-receipt-payments  
**Date**: 2026-05-05

## Prerequisites

- PHP 8.1+ with Composer
- Node.js 18+ with Bun (or npm)
- MySQL running with an existing SchoolLedger database (feature 059 migrations applied)
- Backend `.env` configured with database credentials and `JWT_SECRET_KEY`
- Feature 057 (`receipt_number`, `snapshot` columns on `payments`) and Feature 059 (`fee_campaigns`, `campaign_students`, `payments.fee_campaign_id`) already deployed

## Backend Setup

```bash
cd backend

# No new migrations — all columns already exist.
# Verify with:
php spark migrate:status

# Start the backend dev server
php spark serve --port 8080
```

## Run Integration Tests

```bash
cd backend

# Run only the fee campaign tests (includes new 062 cases)
php vendor/bin/phpunit tests/Integration/FeeCampaignTest.php --testdox

# Or via spark
php spark test --filter FeeCampaignTest
```

---

## Curl Tests

All curl tests below assume:
- Backend running at `http://localhost:8080`
- You have a valid admin JWT token stored in `TOKEN`
- You have existing IDs from setup steps stored in shell variables

### Step 0 — Authenticate

```bash
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@school.test","password":"password"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")

echo "Token: $TOKEN"
```

---

### Step 1 — Create a Campaign (US1 setup)

```bash
CAMPAIGN=$(curl -s -X POST http://localhost:8080/api/fee-campaigns \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Grade 7 Exam Fee 2026",
    "targetScopeType": "class",
    "targetScopeId": "CLASS_ID_HERE",
    "amount": 50.00,
    "dueDate": "2026-06-30"
  }')

echo "$CAMPAIGN" | python3 -m json.tool
CAMPAIGN_ID=$(echo "$CAMPAIGN" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['campaign']['id'])")
echo "Campaign ID: $CAMPAIGN_ID"
```

**Expected**: HTTP 201, `data.campaign.id` set, `data.assignedCount` equals number of active students in the class.

---

### Step 2 — Verify a Student Not in the Class (US1 prerequisite)

```bash
# Pick a student ID NOT in the targeted class — replace STU_OTHER_ID with a real student ID
STU_OTHER="STU_OTHER_ID_HERE"
```

---

### Test A — Manually Add Student to Campaign (US1 happy path)

```bash
curl -s -X POST "http://localhost:8080/api/fee-campaigns/$CAMPAIGN_ID/students" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"studentId\": \"$STU_OTHER\"}" \
  | python3 -m json.tool
```

**Expected**:
- HTTP 201
- `data.studentId = STU_OTHER`
- `data.expectedAmount = 50`
- `data.paidAmount = 0`
- `data.status = "unpaid"`

---

### Test B — Duplicate Student Addition (US1 error path)

```bash
# Attempt to add the same student again
curl -s -X POST "http://localhost:8080/api/fee-campaigns/$CAMPAIGN_ID/students" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"studentId\": \"$STU_OTHER\"}" \
  | python3 -m json.tool
```

**Expected**:
- HTTP 400
- `data.message` contains `"already assigned"`

---

### Test C — Add Student from Different Tenant (US1 tenant isolation)

```bash
# Use a student ID from a different tenant (or a non-existent ID)
curl -s -X POST "http://localhost:8080/api/fee-campaigns/$CAMPAIGN_ID/students" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"studentId": "stu_other_tenant_999"}' \
  | python3 -m json.tool
```

**Expected**:
- HTTP 404
- `data.message` contains `"Student not found"`

---

### Step 3 — Pick a Student Already in the Campaign

```bash
# Get the list of campaign students and pick one
STUDENTS=$(curl -s "http://localhost:8080/api/fee-campaigns/$CAMPAIGN_ID/students" \
  -H "Authorization: Bearer $TOKEN")

echo "$STUDENTS" | python3 -m json.tool

STU_ID=$(echo "$STUDENTS" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['studentId'])")
echo "Student ID: $STU_ID"
```

---

### Test D — Record Campaign Payment (US2 happy path)

```bash
PAYMENT=$(curl -s -X POST "http://localhost:8080/api/fee-campaigns/$CAMPAIGN_ID/record-payment" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"studentId\": \"$STU_ID\",
    \"amount\": 30.00,
    \"method\": \"Cash\",
    \"date\": \"$(date +%Y-%m-%d)\"
  }")

echo "$PAYMENT" | python3 -m json.tool
PAYMENT_ID=$(echo "$PAYMENT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['payment']['id'])")
RECEIPT_NO=$(echo "$PAYMENT" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['payment']['receiptNumber'])")
echo "Payment ID: $PAYMENT_ID"
echo "Receipt Number: $RECEIPT_NO"
```

**Expected**:
- HTTP 201
- `data.payment.receiptNumber` is non-null, format `YYYY.MM.DD.HHmmss.X`
- `data.campaignStudent.status = "partially_paid"`
- `data.campaignStudent.paidAmount = 30`
- `data.campaignStudent.remainingAmount = 20`

---

### Test E — Verify Snapshot Was Stored (US2 snapshot assertion)

```bash
curl -s "http://localhost:8080/api/payments/$PAYMENT_ID" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool
```

**Expected**:
- `data.feeCampaignId = CAMPAIGN_ID`
- `data.receiptNumber` matches `$RECEIPT_NO`
- `data.snapshot` is non-null object containing:
  - `studentName` (non-empty string)
  - `campaignName = "Grade 7 Exam Fee 2026"`
  - `expectedAmount = 50`
  - `paidBefore = 0`
  - `amountPaid = 30`
  - `remainingAfter = 20`
  - `paymentMethod = "Cash"`

---

### Test F — Retrieve Receipt (US2 receipt endpoint)

```bash
curl -s "http://localhost:8080/api/receipts/$PAYMENT_ID" \
  | python3 -m json.tool
```

**Expected** (no JWT required — public endpoint):
- HTTP 200
- `data.payment.receiptNumber = RECEIPT_NO`
- `data.payment.category = "Grade 7 Exam Fee 2026"` (campaign name as source label)
- `data.payment.feeCampaignId = CAMPAIGN_ID`
- `data.payment.balanceAfterPayment = 20` (campaign remaining balance, NOT general ledger balance)
- `data.student.firstName` and `data.student.lastName` are populated
- `data.school.name` is populated

---

### Test G — Campaign Payment on Main Payments Page (US3)

```bash
curl -s "http://localhost:8080/api/payments" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "
import sys, json
payments = json.load(sys.stdin)['data']
campaign_payments = [p for p in payments if p.get('feeCampaignId')]
print(f'Total payments: {len(payments)}')
print(f'Campaign payments: {len(campaign_payments)}')
for p in campaign_payments:
    print(f'  id={p[\"id\"]} category={p[\"category\"]} receiptNumber={p[\"receiptNumber\"]} feeCampaignId={p[\"feeCampaignId\"]}')
"
```

**Expected**:
- At least one payment with `feeCampaignId` non-null
- That payment's `receiptNumber` matches `$RECEIPT_NO`
- `category = "Grade 7 Exam Fee 2026"` (campaign name used as source label)

---

### Test H — Overpayment Rejected (US2 error path)

```bash
curl -s -X POST "http://localhost:8080/api/fee-campaigns/$CAMPAIGN_ID/record-payment" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"studentId\": \"$STU_ID\",
    \"amount\": 100.00,
    \"method\": \"Cash\"
  }" \
  | python3 -m json.tool
```

**Expected**:
- HTTP 400
- `message` contains `"Amount exceeds remaining balance"`

---

### Test I — Payment on Closed Campaign Rejected

```bash
# Close the campaign first (force=true to skip outstanding balance check)
curl -s -X POST "http://localhost:8080/api/fee-campaigns/$CAMPAIGN_ID/close" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"force": true}' \
  | python3 -m json.tool

# Now try to add a student — should be rejected
curl -s -X POST "http://localhost:8080/api/fee-campaigns/$CAMPAIGN_ID/students" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"studentId": "stu_new_999"}' \
  | python3 -m json.tool
```

**Expected (second call)**:
- HTTP 409
- `message` contains `"closed"`

---

### Test J — Verify Campaign Payment Does Not Affect Student Ledger Balance

```bash
# Fetch student's ledger balance — should be unchanged
curl -s "http://localhost:8080/api/students/$STU_ID/balance" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -m json.tool
```

**Expected**:
- `data.balance` reflects only standard charges minus standard payments
- The 30.00 campaign payment does NOT reduce this balance
- (If the student has no standard charges/payments, balance should be 0 or based on existing charges only)

---

### Test K — Student Payment History Includes Campaign Payment

```bash
curl -s "http://localhost:8080/api/payments/student/$STU_ID" \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "
import sys, json
payments = json.load(sys.stdin)['data']
for p in payments:
    campaign_marker = ' ← CAMPAIGN' if p.get('feeCampaignId') else ''
    print(f'  {p[\"date\"]} | {p[\"amount\"]} | {p[\"category\"]} | receipt={p[\"receiptNumber\"]}{campaign_marker}')
"
```

**Expected**:
- The 30.00 campaign payment appears in the list with `← CAMPAIGN` marker
- Receipt number is populated

---

## Key Files Modified

| Layer | File | Change |
|-------|------|--------|
| Service | `app/Services/FeeCampaignService.php` | `recordPayment()` — add `snapshot` field to payment insert |
| Controller | `app/Controllers/Api/ReceiptController.php` | `show()` — for campaign payments, use `snapshot.remainingAfter` as `balanceAfterPayment` instead of ledger approximation |
| Tests | `tests/Integration/FeeCampaignTest.php` | Add 7 new test cases (snapshot contents, receipt number, payments visibility, tenant isolation) |
| Frontend | `src/types/dashboard.ts` | Add `campaignName?: string` to Payment type |
| Frontend | `src/pages/Payments.tsx` | Display campaign name label when `feeCampaignId` is non-null |

## API Endpoints (no new routes)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/fee-campaigns/:id/students` | Add student manually (FR-001–FR-004) |
| POST | `/api/fee-campaigns/:id/record-payment` | Record payment + generate receipt + snapshot (FR-005–FR-008) |
| GET | `/api/receipts/:paymentId` | Retrieve receipt with campaign-specific balance (FR-009–FR-010) |
| GET | `/api/payments` | Main payments page — campaign payments already included (FR-011–FR-013) |
