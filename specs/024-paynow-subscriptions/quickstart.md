# Quickstart: Paynow Subscription Packages

**Feature**: `024-paynow-subscriptions`  
**Date**: 2026-04-10

This guide walks a developer through getting the subscription feature running locally for the first time.

---

## Prerequisites

- PHP 8.1+, Composer, MySQL running locally
- Node.js 18+ with `bun` (or `npm`)
- A Paynow merchant account with sandbox credentials
- Existing SchoolLedger dev environment already working (backend + frontend)

---

## 1. Apply Migrations

```bash
cd backend
php spark migrate
```

This runs the three new migrations:
- `2026-04-10-100000_Create_subscription_plans_table`
- `2026-04-10-110000_Create_school_subscriptions_table`
- `2026-04-10-120000_Create_subscription_transactions_table`

---

## 2. Seed Plan Data

```bash
php spark db:seed SubscriptionPlanSeeder
```

This inserts the four plan rows (Free / Standard / Advanced / Enterprise) with placeholder pricing. Verify with:

```sql
SELECT id, name, max_students, monthly_price_cents, annual_price_cents FROM subscription_plans;
```

---

## 3. Configure Paynow Credentials

Add the following to `backend/.env`:

```env
# Paynow Integration
PAYNOW_INTEGRATION_ID=your_sandbox_integration_id
PAYNOW_INTEGRATION_KEY=your_sandbox_integration_key
PAYNOW_RESULT_URL=http://localhost:8080/api/subscription/webhook
PAYNOW_RETURN_URL=http://localhost:5173/billing?payment=complete

# Subscription currency
SUBSCRIPTION_CURRENCY=USD
```

> Obtain sandbox credentials from your Paynow merchant dashboard under **Integrations → Web Payments**.

---

## 4. Test the Backend Endpoints

Start the backend:

```bash
cd backend
php spark serve --port 8080
```

**Get plans (no payment needed)**:
```bash
curl -H "Authorization: Bearer <your-jwt>" \
  http://localhost:8080/api/subscription/plans
```

**Get current subscription**:
```bash
curl -H "Authorization: Bearer <your-jwt>" \
  http://localhost:8080/api/subscription/current
```

**Activate Free plan** (for a tenant with < 50 students):
```bash
curl -X POST -H "Authorization: Bearer <your-jwt>" \
  http://localhost:8080/api/subscription/activate-free
```

**Initiate paid subscription**:
```bash
curl -X POST -H "Authorization: Bearer <your-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"planId":"standard","billingCycle":"monthly"}' \
  http://localhost:8080/api/subscription/initiate
```
Response will include a `redirectUrl` — open it in a browser to complete the Paynow sandbox payment.

---

## 5. Simulate a Paynow Webhook (local testing)

Since Paynow cannot reach `localhost`, simulate the webhook callback manually:

```bash
curl -X POST http://localhost:8080/api/subscription/webhook \
  -d "reference=SUB-<tenant_id>-<timestamp>&paynowreference=12345&amount=15.00&status=Paid&hash=<computed_hash>"
```

Compute the hash in PHP:
```php
$fields = ['reference', 'amount', 'paynowreference', 'pollurl', 'status'];
$str = '';
foreach ($fields as $f) { $str .= $_POST[$f] ?? ''; }
$hash = strtoupper(md5($str . env('PAYNOW_INTEGRATION_KEY')));
```

Alternatively, use [ngrok](https://ngrok.com) to expose `localhost:8080` and set `PAYNOW_RESULT_URL` to the ngrok URL for full end-to-end testing.

---

## 6. Frontend

Start the frontend:

```bash
cd frontend
bun dev
```

Navigate to `http://localhost:5173/billing` to see the Billing page with the plan selector.

---

## 7. Verify Enforcement

1. Create a school with 50 active students in the dev database.
2. Ensure the tenant has a **Free** plan active.
3. Attempt to add a 50th student via the Students page or API.
4. Confirm the request is blocked with a "student limit reached" error and an upgrade prompt appears.

---

## Rollback

To undo all migrations for this feature:

```bash
php spark migrate:rollback --batch 3
```

*(Assumes these three migrations form the last batch. Check `migrations` table to confirm.)*
