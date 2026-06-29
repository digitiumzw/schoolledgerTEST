# Quickstart: Fee Campaign Payment in Record Payment Modal

**Feature**: 086-fee-campaign-payment-modal  
**Backend**: PHP 8.1+ · CodeIgniter 4 · MySQL  
**Frontend**: React 18 · TypeScript · Vite · TailwindCSS · shadcn/ui

## Prerequisites

- Backend server running on `http://localhost:8080`
- Frontend dev server running on `http://localhost:5173` (or built)
- Feature 059 (Fee Campaigns) fully implemented and migrated
- Test tenant with at least one active fee campaign
- At least one student enrolled in a campaign, and one student NOT enrolled in any campaign

## curl Validation Steps

All commands assume `BASE=http://localhost:8080/api` and `TOKEN` is obtained via login.

### 1. Login

```bash
TOKEN=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@greenwood.co.zw","password":"12345678"}' | jq -r '.data.token')
echo "TOKEN=$TOKEN"
```

**Expected**: HTTP 200 with valid JWT token.

---

### 2. List Active Campaigns

```bash
curl -s "$BASE/fee-campaigns?status=active&limit=100" \
  -H "Authorization: Bearer $TOKEN" | jq '.data.data[] | {id, name, status}'
```

**Expected**: HTTP 200 with array of active campaigns.

---

### 3. Get Student's Existing Campaigns

Replace `STUDENT_ID` with a student who IS enrolled in at least one campaign:

```bash
STUDENT_ID="s_existing_member"
curl -s "$BASE/students/$STUDENT_ID/campaigns" \
  -H "Authorization: Bearer $TOKEN" | jq '.data'
```

**Expected**: HTTP 200 with array of campaign memberships including `expectedAmount`, `paidAmount`, `remainingAmount`.

---

### 4. Get Campaigns for Unenrolled Student

Replace `STUDENT_ID` with a student who is NOT enrolled in any campaign:

```bash
STUDENT_ID="s_no_campaigns"
curl -s "$BASE/students/$STUDENT_ID/campaigns" \
  -H "Authorization: Bearer $TOKEN" | jq '.data'
```

**Expected**: HTTP 200 with empty array `[]`.

---

### 5. Add Student to Campaign (Auto-Enrollment Step)

Replace `CAMPAIGN_ID` with an active campaign and `STUDENT_ID` with a student not yet in it:

```bash
CAMPAIGN_ID="fc_active_campaign"
STUDENT_ID="s_no_campaigns"
curl -s -X POST "$BASE/fee-campaigns/$CAMPAIGN_ID/students" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"studentId":"'$STUDENT_ID'"}' | jq '.data'
```

**Expected**: HTTP 201 with campaign student record, `status: "unpaid"`, `paidAmount: 0`.

---

### 6. Record Payment Against Campaign (Happy Path)

```bash
curl -s -X POST "$BASE/fee-campaigns/$CAMPAIGN_ID/record-payment" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "'$STUDENT_ID'",
    "amount": 50.00,
    "method": "Cash",
    "date": "2025-05-30",
    "description": "Test campaign payment"
  }' | jq '.data'
```

**Expected**: HTTP 201 with payment ID, receipt number, and updated campaign student status.

---

### 7. Pay Against Closed Campaign (Error Path)

Replace `CLOSED_CAMPAIGN_ID` with a closed campaign:

```bash
CLOSED_CAMPAIGN_ID="fc_closed_campaign"
curl -s -X POST "$BASE/fee-campaigns/$CLOSED_CAMPAIGN_ID/record-payment" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "'$STUDENT_ID'",
    "amount": 10.00,
    "method": "Cash"
  }' | jq '.status, .message'
```

**Expected**: HTTP 409 with message `"Cannot record payment on a closed campaign"`.

---

### 8. Pay Without Enrollment (Error Path)

Replace `CAMPAIGN_ID` and `NEW_STUDENT_ID` where student is NOT in the campaign:

```bash
NEW_STUDENT_ID="s_not_enrolled"
curl -s -X POST "$BASE/fee-campaigns/$CAMPAIGN_ID/record-payment" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "'$NEW_STUDENT_ID'",
    "amount": 10.00,
    "method": "Cash"
  }' | jq '.status, .message'
```

**Expected**: HTTP 404 with message `"Student is not assigned to this campaign"`.

---

### 9. Exceed Remaining Amount (Error Path)

```bash
curl -s -X POST "$BASE/fee-campaigns/$CAMPAIGN_ID/record-payment" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "'$STUDENT_ID'",
    "amount": 99999.00,
    "method": "Cash"
  }' | jq '.status, .message'
```

**Expected**: HTTP 400 with message indicating amount exceeds remaining balance.

---

### 10. Tenant Isolation

Login with a second-tenant admin and attempt to access the first tenant's campaign:

```bash
TOKEN2=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"other-tenant@example.com","password":"12345678"}' | jq -r '.data.token')

curl -s "$BASE/fee-campaigns/$CAMPAIGN_ID" \
  -H "Authorization: Bearer $TOKEN2" | jq '.status, .message'
```

**Expected**: HTTP 404 (not 403) to prevent tenant enumeration.

---

### 11. Missing Auth

```bash
curl -s "$BASE/fee-campaigns?status=active" | jq '.status, .message'
```

**Expected**: HTTP 401 with message indicating unauthorized.

---

### 12. Role Guard (Teacher Cannot Record)

Login as a teacher and attempt to record a campaign payment:

```bash
TEACHER_TOKEN=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@greenwood.co.zw","password":"12345678"}' | jq -r '.data.token')

curl -s -X POST "$BASE/fee-campaigns/$CAMPAIGN_ID/record-payment" \
  -H "Authorization: Bearer $TEACHER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "studentId": "'$STUDENT_ID'",
    "amount": 10.00,
    "method": "Cash"
  }' | jq '.status, .message'
```

**Expected**: HTTP 403 with message indicating insufficient permissions.

---

## Frontend Validation Steps

1. Open the application and log in as admin.
2. Navigate to the Payments page and click **Record Payment**.
3. Select a student who is **not** in any fee campaign.
4. Toggle **Fee Campaign Payment** on.
5. Verify the dropdown shows all active campaigns.
6. Select a campaign. Verify the amount field pre-fills with the remaining expected amount.
7. Submit. Verify:
   - Success toast appears
   - Student is enrolled in the campaign
   - Payment appears in the campaign's payment history
   - Receipt shows campaign name
8. Repeat with a student who **is** already in a campaign.
9. Verify the dropdown shows the existing campaign with a "Member" badge.
10. Select the member campaign, submit a partial payment.
11. Verify the campaign student's `paidAmount` and `status` update correctly.
12. Toggle campaign mode off. Verify standard category selector reappears and campaign selection is cleared.

## Rollback / Cleanup

No migrations or schema changes were made. To clean up test data:

```bash
# Void test payments (if applicable — requires campaign-specific void endpoint)
# Or delete directly in database if testing environment
```
