# Quickstart: Subscription Billing Overhaul

**Branch**: `027-subscription-billing-overhaul` | **Date**: 2026-04-13

## What This Feature Does

1. Removes EcoCash / OneMoney USSD-push payment from the UI and backend routes.
2. Adds a "You'll be redirected to Paynow" confirmation dialog before any Subscribe / Upgrade / Downgrade action.
3. Hardcodes Enterprise as the recommended plan (was dynamic based on student count).
4. Detects payment cancellation on return from Paynow and shows a cancellation notice.
5. Optimises the backend poll endpoint to short-circuit on already-resolved transactions.

---

## Dev Setup

No environment changes are needed. The existing backend `.env` and frontend setup work as-is.

Verify the backend is in sandbox mode (no real Paynow credentials needed):

```bash
# backend/.env should have placeholder values:
# PAYNOW_INTEGRATION_ID = your_paynow_integration_id
# PAYNOW_INTEGRATION_KEY = your_paynow_integration_key
# PAYNOW_RETURN_URL = http://localhost:8080/billing?payment=complete

# Confirm sandbox mode is active
grep PAYNOW backend/.env
```

Start both servers:

```bash
# Terminal 1 — backend
cd backend && php spark serve

# Terminal 2 — frontend
cd frontend && npm run dev
```

---

## Testing the Feature

### 1. Subscribe (sandbox flow)

1. Log in as `admin@greenwood.co.zw` / `1234`
2. Navigate to **Billing**
3. Select a plan → click **Subscribe**
4. **Expected**: A dialog appears listing "Paynow payment methods" (Visa, Mastercard, EcoCash web, OneMoney, Telecash) with a "Continue to Paynow" button
5. Click **Continue to Paynow**
6. Sandbox redirects immediately back to `http://localhost:8080/billing?payment=complete&txId=...`
7. **Expected**: "Payment Confirmed" green banner; Current Subscription card updates; new invoice appears in Invoices section; new event in Billing History

### 2. Cancel from Paynow (sandbox)

In sandbox mode, cancellation cannot be triggered automatically. To test manually:
1. Open the Billing page directly with `?payment=complete&txId=<any-cancelled-txId>`
2. Or modify the poll endpoint mock to return `paynowStatus: 'Cancelled'`
3. **Expected**: "Transaction Cancelled" amber banner; subscription status unchanged

### 3. Upgrade / Downgrade

1. With an active subscription, open Billing
2. A lower-tier plan card shows **Downgrade**; a higher-tier shows **Upgrade**
3. Clicking either opens the same redirect confirmation dialog
4. If attempting a downgrade with too many students, an inline block message appears before the dialog

### 4. Enterprise recommended badge

1. Open Billing with any tenant
2. **Expected**: Enterprise plan card has the gold "Recommended" star badge; no other card has it

### 5. EcoCash UI removed

1. Open Billing
2. **Expected**: No "Pay with EcoCash / OneMoney" button or phone number form is visible anywhere on the page

### 6. Poll optimisation (manual)

1. Complete a payment (sandbox)
2. Make a second manual request to `GET /api/subscription/poll/<txId>` (e.g., via curl or browser DevTools)
3. **Expected**: Response returns immediately with `"paid": true` — no delay from a Paynow gateway call, confirmed by near-instant response time

---

## Key Files Reference

| File | Change type |
|------|-------------|
| `backend/app/Controllers/Api/SubscriptionController.php` | Modify: `poll()`, `resolveRecommendedPlan()`, remove EcoCash route |
| `backend/app/Config/Routes.php` | Remove: `POST /api/subscription/initiate-ecocash` |
| `frontend/src/hooks/useSubscription.ts` | Modify: remove EcoCash state + method |
| `frontend/src/pages/Billing.tsx` | Modify: remove EcoCash UI, add dialog, add cancellation banner |
| `frontend/src/api/api.ts` | Modify: remove `initiateEcocashSubscription` + `InitiateEcocashResponse` type |
| `frontend/src/components/subscription/SubscribeConfirmDialog.tsx` | **New file** |
