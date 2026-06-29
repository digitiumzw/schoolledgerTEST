# Quickstart: Paynow Integration Refactor

**Feature**: 025-paynow-refactor
**Date**: 2026-04-10

---

## What This Feature Changes

This is a backend-only bug-fix refactor. No frontend changes, no new migrations, no new endpoints.

**Files changed**:
- `backend/app/Services/PaynowService.php` — remove unused parameters, fix hash verification
- `backend/app/Controllers/Api/SubscriptionController.php` — store `paynow_reference` from webhook, update call sites

---

## Environment Prerequisites

```env
# backend/.env
PAYNOW_INTEGRATION_ID=<your-id>
PAYNOW_INTEGRATION_KEY=<your-key>
PAYNOW_RESULT_URL=https://yourdomain.com/api/subscription/webhook
PAYNOW_RETURN_URL=https://yourdomain.com/billing
```

Leave `PAYNOW_INTEGRATION_ID` empty or as `your_paynow_integration_id` to activate sandbox mode.

---

## Running the Backend

```bash
cd backend
php spark serve          # starts on port 8080
php spark migrate        # ensure subscription_payment_transactions table exists
```

---

## Testing the Payment Flow

### 1. Sandbox (no live credentials needed)

```bash
# 1. Authenticate
POST http://localhost:8080/api/auth/login
{"email":"admin@greenwood.co.zw","password":"1234"}

# 2. Get plans
GET http://localhost:8080/api/subscription/plans

# 3. Initiate payment (returns sandbox redirectUrl)
POST http://localhost:8080/api/subscription/initiate
{"planId":"standard","billingCycle":"monthly"}
# Response includes transactionId

# 4. Poll (sandbox always returns paid)
GET http://localhost:8080/api/subscription/poll/<transactionId>
# Response: {"paid":true,"paynowStatus":"paid","subscriptionStatus":"active"}
```

### 2. Simulating a Webhook (local testing)

Generate a valid hash by running this PHP snippet:
```php
<?php
$key = strtolower('YOUR_INTEGRATION_KEY');
$fields = [
    'reference'       => 'SUB-your-ref',
    'paynowreference' => 'PAYNOW-12345',
    'amount'          => '50.00',
    'status'          => 'Paid',
];
$string = implode('', array_values($fields)) . $key;
$hash   = strtoupper(hash('sha512', $string));
echo $hash;
```

Then POST to the webhook with the generated hash:
```bash
curl -X POST http://localhost:8080/api/subscription/webhook \
  -d "reference=SUB-your-ref" \
  -d "paynowreference=PAYNOW-12345" \
  -d "amount=50.00" \
  -d "status=Paid" \
  -d "hash=<generated_hash>"
```

Expected result:
- Response body: `Received`, HTTP 200
- Transaction: status=`paid`, `paynow_reference`=`PAYNOW-12345`
- Subscription: status=`active`, expiry set to +1 month

---

## Key Files Reference

| File | Role |
|------|------|
| `backend/app/Services/PaynowService.php` | Paynow SDK wrapper — initiation, polling, hash verification |
| `backend/app/Controllers/Api/SubscriptionController.php` | Endpoint handlers — initiate, webhook, poll, current, history |
| `backend/vendor/paynow/php-sdk/src/Util/Hash.php` | SHA-512 hash generation and verification (read-only, do not edit) |
| `backend/vendor/paynow/php-sdk/src/Payments/Paynow.php` | SDK entry point (read-only) |
